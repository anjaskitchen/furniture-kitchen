-- =====================================================================
-- PENJUALAN: order, item, pembayaran, ringkasan, dan laporan KPI.
--
-- Definisi angka (dipakai konsisten di seluruh laporan):
--   Order terkonfirmasi : status confirmed / production / installation / completed
--                         (quotation = penawaran & cancelled TIDAK dihitung omset)
--   Omset               : jumlah total order terkonfirmasi berdasarkan order_date
--   Kas masuk           : jumlah pembayaran berdasarkan paid_at
--   Piutang             : total - dibayar untuk order terkonfirmasi (per hari ini)
--   Laba kotor          : total - cost_estimate (HPP) order terkonfirmasi
-- Semua tanggal bertipe DATE (zona Asia/Jakarta) agar tidak bergeser karena UTC.
-- =====================================================================

create sequence if not exists public.order_number_seq;

create or replace function public.jakarta_today()
returns date
language sql
stable
as $$ select (now() at time zone 'Asia/Jakarta')::date $$;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  order_date date not null default public.jakarta_today(),
  customer_name text not null check (char_length(customer_name) between 1 and 120),
  customer_phone text,
  customer_email text,
  customer_address text,
  title text not null check (char_length(title) between 1 and 200),
  category text,
  source text not null default 'whatsapp'
    check (source in ('whatsapp', 'website', 'survey', 'instagram', 'tiktok', 'facebook', 'referral', 'walk_in', 'repeat', 'other')),
  status text not null default 'confirmed'
    check (status in ('quotation', 'confirmed', 'production', 'installation', 'completed', 'cancelled')),
  subtotal numeric(14, 2) not null default 0 check (subtotal >= 0),
  discount numeric(14, 2) not null default 0 check (discount >= 0),
  additional_fee numeric(14, 2) not null default 0 check (additional_fee >= 0),
  total numeric(14, 2) generated always as (greatest(subtotal - discount + additional_fee, 0)) stored,
  cost_estimate numeric(14, 2) not null default 0 check (cost_estimate >= 0),
  paid_amount numeric(14, 2) not null default 0,
  due_date date,
  completed_at date,
  survey_request_id uuid references public.survey_requests (id) on delete set null,
  contact_message_id uuid references public.contact_messages (id) on delete set null,
  notes text,
  created_by uuid references public.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists orders_date_idx on public.orders (order_date);
create index if not exists orders_status_idx on public.orders (status);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  description text,
  qty numeric(12, 2) not null default 1 check (qty > 0),
  unit text not null default 'unit',
  unit_price numeric(14, 2) not null default 0 check (unit_price >= 0),
  line_total numeric(14, 2) generated always as (round(qty * unit_price, 2)) stored,
  sort_order int not null default 0
);
create index if not exists order_items_order_idx on public.order_items (order_id);

create table if not exists public.order_payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  paid_at date not null default public.jakarta_today(),
  amount numeric(14, 2) not null check (amount > 0),
  method text not null default 'transfer' check (method in ('transfer', 'cash', 'qris', 'debit', 'credit', 'other')),
  kind text not null default 'dp' check (kind in ('dp', 'termin', 'pelunasan', 'other')),
  reference text,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists order_payments_order_idx on public.order_payments (order_id);
create index if not exists order_payments_date_idx on public.order_payments (paid_at);

-- Nilai target omset bulanan untuk KPI.
alter table public.settings add column if not exists monthly_revenue_target numeric(14, 2) not null default 0
  check (monthly_revenue_target >= 0);

-- ---------------------------------------------------------------------
-- Trigger: nomor order, updated_at, tanggal selesai, subtotal & dibayar.
-- ---------------------------------------------------------------------
create or replace function public.orders_before_write()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' and (new.order_number is null or new.order_number = '') then
    new.order_number := 'ORD-' || to_char(new.order_date, 'YYMM') || '-' || lpad(nextval('public.order_number_seq')::text, 4, '0');
  end if;
  if new.status = 'completed' and new.completed_at is null then
    new.completed_at := public.jakarta_today();
  elsif new.status <> 'completed' then
    new.completed_at := null;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists orders_before_write on public.orders;
create trigger orders_before_write
  before insert or update on public.orders
  for each row execute function public.orders_before_write();

create or replace function public.recalc_order_totals(p_order_id uuid)
returns void
language sql
as $$
  update public.orders o set
    subtotal = coalesce((select sum(line_total) from public.order_items i where i.order_id = o.id), 0),
    paid_amount = coalesce((select sum(amount) from public.order_payments p where p.order_id = o.id), 0)
  where o.id = p_order_id;
$$;

create or replace function public.order_children_changed()
returns trigger
language plpgsql
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform public.recalc_order_totals(old.order_id);
  end if;
  if tg_op in ('INSERT', 'UPDATE') and (tg_op = 'INSERT' or new.order_id is distinct from old.order_id) then
    perform public.recalc_order_totals(new.order_id);
  end if;
  return null;
end;
$$;

drop trigger if exists order_items_changed on public.order_items;
create trigger order_items_changed
  after insert or update or delete on public.order_items
  for each row execute function public.order_children_changed();

drop trigger if exists order_payments_changed on public.order_payments;
create trigger order_payments_changed
  after insert or update or delete on public.order_payments
  for each row execute function public.order_children_changed();

-- ---------------------------------------------------------------------
-- View ringkasan (security_invoker: RLS tabel asal tetap berlaku).
-- ---------------------------------------------------------------------
create or replace view public.orders_view
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

-- ---------------------------------------------------------------------
-- Simpan order + item + pembayaran secara atomik (satu transaksi).
-- security invoker: hanya admin/editor (RLS) yang bisa menulis.
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
      discount, additional_fee, cost_estimate, due_date, survey_request_id, contact_message_id, notes
    ) values (
      coalesce(nullif(p ->> 'order_date', '')::date, public.jakarta_today()),
      p ->> 'customer_name', nullif(p ->> 'customer_phone', ''), nullif(p ->> 'customer_email', ''), nullif(p ->> 'customer_address', ''),
      p ->> 'title', nullif(p ->> 'category', ''), coalesce(nullif(p ->> 'source', ''), 'whatsapp'), coalesce(nullif(p ->> 'status', ''), 'confirmed'),
      coalesce((p ->> 'discount')::numeric, 0), coalesce((p ->> 'additional_fee')::numeric, 0), coalesce((p ->> 'cost_estimate')::numeric, 0),
      nullif(p ->> 'due_date', '')::date, nullif(p ->> 'survey_request_id', '')::uuid, nullif(p ->> 'contact_message_id', '')::uuid, nullif(p ->> 'notes', '')
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
      notes = nullif(p ->> 'notes', '')
    where id = v_id;
    if not found then
      raise exception 'Order tidak ditemukan atau tidak punya akses';
    end if;
  end if;

  delete from public.order_items where order_id = v_id;
  insert into public.order_items (order_id, name, description, qty, unit, unit_price, sort_order)
  select v_id, x ->> 'name', nullif(x ->> 'description', ''), (x ->> 'qty')::numeric, coalesce(nullif(x ->> 'unit', ''), 'unit'),
         (x ->> 'unit_price')::numeric, ord::int
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

-- ---------------------------------------------------------------------
-- Laporan KPI untuk rentang tanggal (inklusif) + periode pembanding
-- dengan panjang sama tepat sebelumnya. security invoker (RLS berlaku).
-- ---------------------------------------------------------------------
create or replace function public.order_report(p_from date, p_to date)
returns jsonb
language plpgsql
stable
as $$
declare
  v_len int := p_to - p_from + 1;
  v_prev_from date := p_from - (p_to - p_from + 1);
  v_prev_to date := p_from - 1;
  v_grain text;
  v_result jsonb;
begin
  if p_to < p_from then
    raise exception 'Tanggal akhir harus setelah tanggal awal';
  end if;
  v_grain := case when v_len <= 31 then 'day' when v_len <= 120 then 'week' else 'month' end;

  with
  booked as (
    select * from public.orders_view where is_booked
  ),
  kpi as (
    select
      period,
      coalesce(sum(b.total), 0) as revenue,
      count(b.id) as orders,
      coalesce(sum(b.gross_profit), 0) as gross_profit,
      coalesce(sum(b.cost_estimate), 0) as cost
    from (values ('current', p_from, p_to), ('previous', v_prev_from, v_prev_to)) as per(period, d_from, d_to)
    left join booked b on b.order_date between per.d_from and per.d_to
    group by period
  ),
  cash as (
    select
      period,
      coalesce(sum(pm.amount), 0) as cash_in,
      count(pm.id) as payments
    from (values ('current', p_from, p_to), ('previous', v_prev_from, v_prev_to)) as per(period, d_from, d_to)
    left join public.order_payments pm on pm.paid_at between per.d_from and per.d_to
    group by period
  ),
  other as (
    select
      period,
      (select count(*) from public.orders o where o.status = 'completed' and o.completed_at between per.d_from and per.d_to) as completed,
      (select count(*) from public.orders o where o.status = 'cancelled' and o.order_date between per.d_from and per.d_to) as cancelled,
      (select count(*) from public.orders o where o.status = 'quotation' and o.order_date between per.d_from and per.d_to) as quotations,
      (select count(*) from public.survey_requests s where (s.created_at at time zone 'Asia/Jakarta')::date between per.d_from and per.d_to)
        + (select count(*) from public.contact_messages c where (c.created_at at time zone 'Asia/Jakarta')::date between per.d_from and per.d_to) as leads
    from (values ('current', p_from, p_to), ('previous', v_prev_from, v_prev_to)) as per(period, d_from, d_to)
  ),
  buckets as (
    select generate_series(date_trunc(v_grain, p_from::timestamp), date_trunc(v_grain, p_to::timestamp), ('1 ' || v_grain)::interval)::date as bucket
  ),
  series as (
    select
      bk.bucket,
      coalesce((select sum(b.total) from booked b where b.order_date between p_from and p_to and date_trunc(v_grain, b.order_date::timestamp)::date = bk.bucket), 0) as revenue,
      coalesce((select count(*) from booked b where b.order_date between p_from and p_to and date_trunc(v_grain, b.order_date::timestamp)::date = bk.bucket), 0) as orders,
      coalesce((select sum(pm.amount) from public.order_payments pm where pm.paid_at between p_from and p_to and date_trunc(v_grain, pm.paid_at::timestamp)::date = bk.bucket), 0) as cash_in
    from buckets bk
  )
  select jsonb_build_object(
    'range', jsonb_build_object('from', p_from, 'to', p_to, 'prev_from', v_prev_from, 'prev_to', v_prev_to, 'days', v_len, 'grain', v_grain),
    'current', (
      select jsonb_build_object('revenue', k.revenue, 'orders', k.orders, 'gross_profit', k.gross_profit, 'cost', k.cost,
        'cash_in', c.cash_in, 'payments', c.payments, 'completed', o.completed, 'cancelled', o.cancelled, 'quotations', o.quotations, 'leads', o.leads)
      from kpi k join cash c using (period) join other o using (period) where k.period = 'current'
    ),
    'previous', (
      select jsonb_build_object('revenue', k.revenue, 'orders', k.orders, 'gross_profit', k.gross_profit, 'cost', k.cost,
        'cash_in', c.cash_in, 'payments', c.payments, 'completed', o.completed, 'cancelled', o.cancelled, 'quotations', o.quotations, 'leads', o.leads)
      from kpi k join cash c using (period) join other o using (period) where k.period = 'previous'
    ),
    'receivables', (
      select jsonb_build_object(
        'amount', coalesce(sum(balance), 0),
        'orders', count(*) filter (where balance > 0),
        'overdue_amount', coalesce(sum(balance) filter (where due_date < public.jakarta_today()), 0),
        'overdue_orders', count(*) filter (where balance > 0 and due_date < public.jakarta_today())
      ) from booked
    ),
    'pipeline', (
      select coalesce(jsonb_agg(jsonb_build_object('status', s.status, 'orders', s.orders, 'value', s.value) order by s.ord), '[]'::jsonb)
      from (
        select status, count(*) as orders, sum(total) as value,
          array_position(array['quotation', 'confirmed', 'production', 'installation'], status) as ord
        from public.orders where status in ('quotation', 'confirmed', 'production', 'installation') group by status
      ) s
    ),
    'series', (select coalesce(jsonb_agg(jsonb_build_object('bucket', bucket, 'revenue', revenue, 'orders', orders, 'cash_in', cash_in) order by bucket), '[]'::jsonb) from series),
    'by_category', (
      select coalesce(jsonb_agg(jsonb_build_object('label', label, 'revenue', revenue, 'orders', orders) order by revenue desc), '[]'::jsonb)
      from (select coalesce(nullif(category, ''), 'Lainnya') as label, sum(total) as revenue, count(*) as orders
            from booked where order_date between p_from and p_to group by 1) x
    ),
    'by_source', (
      select coalesce(jsonb_agg(jsonb_build_object('label', source, 'revenue', revenue, 'orders', orders) order by revenue desc), '[]'::jsonb)
      from (select source, sum(total) as revenue, count(*) as orders from booked where order_date between p_from and p_to group by 1) x
    ),
    'by_status', (
      select coalesce(jsonb_agg(jsonb_build_object('label', status, 'value', value, 'orders', orders) order by orders desc), '[]'::jsonb)
      from (select status, sum(total) as value, count(*) as orders from public.orders where order_date between p_from and p_to group by 1) x
    ),
    'top_customers', (
      select coalesce(jsonb_agg(jsonb_build_object('name', name, 'phone', phone, 'revenue', revenue, 'orders', orders) order by revenue desc), '[]'::jsonb)
      from (
        select min(customer_name) as name, min(customer_phone) as phone, sum(total) as revenue, count(*) as orders
        from booked where order_date between p_from and p_to
        group by coalesce(nullif(regexp_replace(customer_phone, '\D', '', 'g'), ''), lower(trim(customer_name)))
        order by sum(total) desc limit 5
      ) x
    )
  ) into v_result;

  return v_result;
end;
$$;

-- ---------------------------------------------------------------------
-- RLS & hak akses: data penjualan hanya untuk admin/editor yang login.
-- ---------------------------------------------------------------------
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_payments enable row level security;

do $$
declare t text;
begin
  foreach t in array array['orders', 'order_items', 'order_payments'] loop
    execute format('drop policy if exists "admin all %1$s" on public.%1$s', t);
    execute format('create policy "admin all %1$s" on public.%1$s for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

revoke all on public.orders, public.order_items, public.order_payments, public.orders_view from anon;
grant select, insert, update, delete on public.orders, public.order_items, public.order_payments to authenticated;
grant select on public.orders_view to authenticated;
grant all on public.orders, public.order_items, public.order_payments, public.orders_view to service_role;
grant usage, select on sequence public.order_number_seq to authenticated, service_role;

revoke all on function public.save_order(jsonb) from public, anon;
grant execute on function public.save_order(jsonb) to authenticated, service_role;
revoke all on function public.order_report(date, date) from public, anon;
grant execute on function public.order_report(date, date) to authenticated, service_role;
grant execute on function public.jakarta_today() to anon, authenticated, service_role;

-- Realtime: admin lain melihat order baru/berubah tanpa reload.
do $$
declare t text;
begin
  foreach t in array array['orders', 'order_payments'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
