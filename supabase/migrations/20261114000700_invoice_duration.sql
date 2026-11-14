-- =====================================================================
-- Invoice & order:
--   * Jangka waktu pengerjaan (mis. 60 hari kerja / 2 bulan) → estimasi selesai maksimal.
--   * Item order dengan ukuran panjang × tinggi (qty = luas m² otomatis).
--   * Pengaturan invoice (logo, judul, catatan, syarat) + rekening transfer.
-- =====================================================================

alter table public.orders
  add column if not exists work_duration int check (work_duration is null or work_duration between 1 and 1000),
  add column if not exists work_duration_unit text not null default 'work_days'
    check (work_duration_unit in ('work_days', 'calendar_days', 'weeks', 'months')),
  add column if not exists work_start_date date,
  add column if not exists estimated_finish_date date,
  add column if not exists invoice_notes text;

alter table public.order_items
  add column if not exists length_m numeric(10, 3) check (length_m is null or length_m > 0),
  add column if not exists height_m numeric(10, 3) check (height_m is null or height_m > 0);

alter table public.settings
  add column if not exists invoice_logo_url text,
  add column if not exists invoice_title text not null default 'INVOICE',
  add column if not exists invoice_footer text,
  add column if not exists invoice_terms text,
  add column if not exists invoice_show_bank boolean not null default true,
  add column if not exists work_days_per_week int not null default 6 check (work_days_per_week between 5 and 7);

create table if not exists public.invoice_bank_accounts (
  id uuid primary key default gen_random_uuid(),
  bank_name text not null check (char_length(bank_name) between 1 and 80),
  account_number text not null check (char_length(account_number) between 3 and 40),
  account_holder text not null check (char_length(account_holder) between 1 and 120),
  notes text,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.invoice_bank_accounts enable row level security;
drop policy if exists "admin all invoice_bank_accounts" on public.invoice_bank_accounts;
create policy "admin all invoice_bank_accounts" on public.invoice_bank_accounts for all to authenticated using (public.is_admin()) with check (public.is_admin());
revoke all on public.invoice_bank_accounts from anon;
grant select, insert, update, delete on public.invoice_bank_accounts to authenticated;
grant all on public.invoice_bank_accounts to service_role;
select public.attach_audit('invoice_bank_accounts');

-- ---------------------------------------------------------------------
-- Tanggal selesai maksimal dari tanggal mulai + durasi.
--   work_days     : hari kerja (6/minggu = Senin–Sabtu, 5/minggu = Senin–Jumat, 7 = setiap hari);
--                   hari mulai dihitung sebagai hari ke-1 bila hari kerja.
--   calendar_days : mulai + n − 1 hari
--   weeks         : mulai + 7n − 1 hari
--   months        : mulai + n bulan − 1 hari
-- ---------------------------------------------------------------------
create or replace function public.finish_date(p_start date, p_n int, p_unit text, p_days_per_week int default 6)
returns date
language plpgsql
immutable
as $$
declare
  d date := p_start;
  counted int := 0;
  dow int;
begin
  if p_start is null or p_n is null or p_n < 1 then return null; end if;
  if p_unit = 'calendar_days' then return p_start + (p_n - 1); end if;
  if p_unit = 'weeks' then return p_start + (p_n * 7 - 1); end if;
  if p_unit = 'months' then return (p_start + make_interval(months => p_n))::date - 1; end if;
  loop
    dow := extract(isodow from d); -- 1 = Senin … 7 = Minggu
    if dow <= coalesce(p_days_per_week, 6) then counted := counted + 1; end if;
    exit when counted >= p_n;
    d := d + 1;
  end loop;
  return d;
end;
$$;
grant execute on function public.finish_date(date, int, text, int) to authenticated, service_role;

create or replace function public.orders_finish_date()
returns trigger
language plpgsql
as $$
begin
  new.estimated_finish_date := public.finish_date(coalesce(new.work_start_date, new.order_date), new.work_duration, new.work_duration_unit,
    (select work_days_per_week from public.settings limit 1));
  return new;
end;
$$;
drop trigger if exists orders_finish_date on public.orders;
create trigger orders_finish_date before insert or update of work_duration, work_duration_unit, work_start_date, order_date on public.orders
  for each row execute function public.orders_finish_date();

-- Jadwal proyek mengikuti order bila belum diatur sendiri.
create or replace function public.orders_sync_project_schedule()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.estimated_finish_date is distinct from old.estimated_finish_date or new.work_start_date is distinct from old.work_start_date then
    update public.projects p set
      target_end_date = case when p.target_end_date is null or p.target_end_date = old.estimated_finish_date then new.estimated_finish_date else p.target_end_date end,
      start_date = case when p.start_date is null or p.start_date = old.work_start_date then coalesce(new.work_start_date, p.start_date) else p.start_date end
    where p.order_id = new.id;
  end if;
  return null;
end;
$$;
drop trigger if exists orders_sync_project_schedule on public.orders;
create trigger orders_sync_project_schedule after update on public.orders
  for each row execute function public.orders_sync_project_schedule();

-- Proyek baru: jadwal awal dari order.
create or replace function public.orders_create_project()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.projects (order_id, work_type, start_date, target_end_date, estimated_days)
  values (new.id, new.category, new.work_start_date, new.estimated_finish_date,
    case when new.work_duration_unit in ('work_days', 'calendar_days') then new.work_duration end)
  on conflict (order_id) do nothing;
  return null;
end;
$$;

-- ---------------------------------------------------------------------
-- save_order: + durasi pengerjaan, catatan invoice, ukuran item (qty = panjang × tinggi bila diisi).
-- ---------------------------------------------------------------------
create or replace function public.save_order(p jsonb)
returns uuid
language plpgsql
as $$
declare
  v_id uuid := nullif(p ->> 'id', '')::uuid;
begin
  if v_id is null then
    insert into public.orders (
      order_date, customer_name, customer_phone, customer_email, customer_address, title, category, source, status,
      discount, additional_fee, cost_estimate, due_date, completed_at, survey_request_id, contact_message_id, notes,
      work_duration, work_duration_unit, work_start_date, invoice_notes
    ) values (
      coalesce(nullif(p ->> 'order_date', '')::date, public.jakarta_today()),
      p ->> 'customer_name', nullif(p ->> 'customer_phone', ''), nullif(p ->> 'customer_email', ''), nullif(p ->> 'customer_address', ''),
      p ->> 'title', nullif(p ->> 'category', ''), coalesce(nullif(p ->> 'source', ''), 'whatsapp'), coalesce(nullif(p ->> 'status', ''), 'confirmed'),
      coalesce((p ->> 'discount')::numeric, 0), coalesce((p ->> 'additional_fee')::numeric, 0), coalesce((p ->> 'cost_estimate')::numeric, 0),
      nullif(p ->> 'due_date', '')::date, nullif(p ->> 'completed_at', '')::date, nullif(p ->> 'survey_request_id', '')::uuid, nullif(p ->> 'contact_message_id', '')::uuid, nullif(p ->> 'notes', ''),
      nullif(p ->> 'work_duration', '')::int, coalesce(nullif(p ->> 'work_duration_unit', ''), 'work_days'), nullif(p ->> 'work_start_date', '')::date, nullif(p ->> 'invoice_notes', '')
    )
    returning id into v_id;
  else
    update public.orders set
      order_date = coalesce(nullif(p ->> 'order_date', '')::date, order_date),
      customer_name = p ->> 'customer_name',
      customer_phone = nullif(p ->> 'customer_phone', ''),
      customer_email = nullif(p ->> 'customer_email', ''),
      customer_address = nullif(p ->> 'customer_address', ''),
      title = p ->> 'title',
      category = nullif(p ->> 'category', ''),
      source = coalesce(nullif(p ->> 'source', ''), source),
      status = coalesce(nullif(p ->> 'status', ''), status),
      discount = coalesce((p ->> 'discount')::numeric, 0),
      additional_fee = coalesce((p ->> 'additional_fee')::numeric, 0),
      cost_estimate = coalesce((p ->> 'cost_estimate')::numeric, 0),
      due_date = nullif(p ->> 'due_date', '')::date,
      completed_at = nullif(p ->> 'completed_at', '')::date,
      notes = nullif(p ->> 'notes', ''),
      work_duration = nullif(p ->> 'work_duration', '')::int,
      work_duration_unit = coalesce(nullif(p ->> 'work_duration_unit', ''), 'work_days'),
      work_start_date = nullif(p ->> 'work_start_date', '')::date,
      invoice_notes = nullif(p ->> 'invoice_notes', '')
    where id = v_id;
    if not found then
      raise exception 'Order tidak ditemukan atau tidak punya akses';
    end if;
  end if;

  delete from public.order_items where order_id = v_id;
  insert into public.order_items (order_id, name, description, qty, unit, unit_price, sort_order, length_m, height_m)
  select v_id, x ->> 'name', nullif(x ->> 'description', ''),
         case when nullif(x ->> 'length_m', '') is not null and nullif(x ->> 'height_m', '') is not null
              then round((x ->> 'length_m')::numeric * (x ->> 'height_m')::numeric, 2)
              else (x ->> 'qty')::numeric end,
         case when nullif(x ->> 'length_m', '') is not null and nullif(x ->> 'height_m', '') is not null then 'm²'
              else coalesce(nullif(x ->> 'unit', ''), 'unit') end,
         (x ->> 'unit_price')::numeric, ord::int,
         nullif(x ->> 'length_m', '')::numeric, nullif(x ->> 'height_m', '')::numeric
  from jsonb_array_elements(coalesce(p -> 'items', '[]'::jsonb)) with ordinality as t(x, ord);

  delete from public.order_payments where order_id = v_id;
  insert into public.order_payments (order_id, paid_at, amount, method, kind, reference, note)
  select v_id, coalesce(nullif(x ->> 'paid_at', '')::date, public.jakarta_today()), (x ->> 'amount')::numeric,
         coalesce(nullif(x ->> 'method', ''), 'transfer'), coalesce(nullif(x ->> 'kind', ''), 'dp'),
         nullif(x ->> 'reference', ''), nullif(x ->> 'note', '')
  from jsonb_array_elements(coalesce(p -> 'payments', '[]'::jsonb)) as t(x);

  perform public.recalc_order_totals(v_id);
  return v_id;
end;
$$;

-- View order ikut kolom baru (o.* dibaca ulang) — dibuat ulang karena urutan kolom berubah.
drop view if exists public.orders_view;
create view public.orders_view
with (security_invoker = true) as
select
  o.*,
  greatest(o.total - o.paid_amount, 0) as balance,
  case
    when o.paid_amount <= 0 then 'unpaid'
    when o.paid_amount >= o.total then 'paid'
    else 'partial'
  end as payment_status,
  o.total - o.cost_estimate as gross_profit,
  o.status in ('confirmed', 'production', 'installation', 'completed') as is_booked,
  (select count(*) from public.order_items i where i.order_id = o.id) as items_count
from public.orders o;

revoke all on public.orders_view from anon;
grant select on public.orders_view to authenticated;
grant all on public.orders_view to service_role;
