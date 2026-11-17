-- =====================================================================
-- HPP (Harga Pokok Penjualan) per item order + dashboard persentase HPP.
--
-- HPP item = material + tenaga kerja + overhead (baris) + lainnya
--            + overhead otomatis (overhead% × (material + tenaga kerja))
-- HPP %    = HPP item ÷ nilai jual item (line_total) × 100
-- Order yang punya rincian HPP → orders.cost_estimate diisi otomatis
-- (laporan laba kotor yang sudah ada ikut memakai angka ini).
-- Data biaya hanya untuk admin utama (sama seperti anggaran proyek).
-- =====================================================================

alter table public.settings add column if not exists hpp_overhead_pct numeric(5, 2) not null default 10 check (hpp_overhead_pct between 0 and 100);
alter table public.settings add column if not exists hpp_target_pct numeric(5, 2) not null default 60 check (hpp_target_pct between 0 and 100);
alter table public.settings add column if not exists hpp_max_pct numeric(5, 2) not null default 75 check (hpp_max_pct between 0 and 100);

-- Overhead% khusus item (kosong = pakai default di pengaturan).
alter table public.order_items add column if not exists hpp_overhead_pct numeric(5, 2) check (hpp_overhead_pct is null or hpp_overhead_pct between 0 and 100);

create table if not exists public.order_item_costs (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null references public.order_items (id) on delete cascade,
  order_id uuid not null references public.orders (id) on delete cascade,
  category text not null check (category in ('material', 'labor', 'overhead', 'other')),
  material_item_id uuid references public.material_items (id) on delete set null,
  name text not null check (char_length(name) between 1 and 160),
  qty numeric(14, 3) not null check (qty > 0),
  unit text not null default 'pcs' check (char_length(unit) between 1 and 20),
  unit_cost numeric(14, 2) not null default 0 check (unit_cost >= 0),
  total numeric(14, 2) generated always as (round(qty * unit_cost, 2)) stored,
  source text not null default 'manual' check (source in ('manual', 'template', 'rab')),
  notes text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists order_item_costs_item_idx on public.order_item_costs (order_item_id, sort_order);
create index if not exists order_item_costs_order_idx on public.order_item_costs (order_id);

-- order_id selalu mengikuti item (tidak bisa dipalsukan dari client).
create or replace function public.order_item_costs_before()
returns trigger
language plpgsql
as $$
begin
  select oi.order_id into new.order_id from public.order_items oi where oi.id = new.order_item_id;
  if new.order_id is null then
    raise exception 'Item order tidak ditemukan';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists order_item_costs_before on public.order_item_costs;
create trigger order_item_costs_before before insert or update on public.order_item_costs
  for each row execute function public.order_item_costs_before();

-- ---------------------------------------------------------------------
-- VIEW: HPP per item
-- ---------------------------------------------------------------------
create or replace view public.order_item_hpp
with (security_invoker = true) as
select
  y.*,
  case when y.cost_lines > 0 then y.material + y.labor + y.overhead_lines + y.other + y.auto_overhead else 0 end as hpp_total,
  case when y.cost_lines > 0 and y.qty > 0 then round((y.material + y.labor + y.overhead_lines + y.other + y.auto_overhead) / y.qty, 2) end as hpp_unit,
  case when y.cost_lines > 0 and y.line_total > 0 then round((y.material + y.labor + y.overhead_lines + y.other + y.auto_overhead) / y.line_total * 100, 2) end as hpp_pct
from (
  select
    x.*,
    round((x.material + x.labor) * x.overhead_pct / 100, 2) as auto_overhead
  from (
    select
      oi.id as item_id, oi.order_id, oi.name, oi.description, oi.qty, oi.unit, oi.unit_price, oi.line_total,
      oi.length_m, oi.height_m, oi.sort_order, oi.hpp_overhead_pct,
      coalesce(oi.hpp_overhead_pct, s.hpp_overhead_pct, 0) as overhead_pct,
      coalesce(c.n, 0) as cost_lines,
      coalesce(c.material, 0) as material,
      coalesce(c.labor, 0) as labor,
      coalesce(c.overhead, 0) as overhead_lines,
      coalesce(c.other, 0) as other
    from public.order_items oi
    left join public.settings s on s.id = true
    left join lateral (
      select
        count(*) as n,
        sum(total) filter (where category = 'material') as material,
        sum(total) filter (where category = 'labor') as labor,
        sum(total) filter (where category = 'overhead') as overhead,
        sum(total) filter (where category = 'other') as other
      from public.order_item_costs where order_item_id = oi.id
    ) c on true
  ) x
) y;

-- Isi orders.cost_estimate dari rincian HPP (hanya bila order punya rincian).
create or replace function public.recalc_order_hpp(p_order uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hpp numeric;
begin
  if not exists (select 1 from public.order_item_costs where order_id = p_order) then
    return;
  end if;
  select coalesce(sum(hpp_total), 0) into v_hpp from public.order_item_hpp where order_id = p_order;
  update public.orders set cost_estimate = round(v_hpp, 2) where id = p_order and cost_estimate is distinct from round(v_hpp, 2);
end;
$$;
revoke all on function public.recalc_order_hpp(uuid) from public, anon;
grant execute on function public.recalc_order_hpp(uuid) to authenticated, service_role;

create or replace function public.order_item_costs_after()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.recalc_order_hpp(old.order_id);
    -- Rincian terakhir dihapus → kembalikan HPP order ke 0 (bukan angka rincian lama).
    if not exists (select 1 from public.order_item_costs where order_id = old.order_id) then
      update public.orders set cost_estimate = 0 where id = old.order_id and cost_estimate <> 0;
    end if;
    return null;
  end if;
  if tg_op = 'UPDATE' and new.order_id is distinct from old.order_id then
    perform public.recalc_order_hpp(old.order_id);
  end if;
  perform public.recalc_order_hpp(new.order_id);
  return null;
end;
$$;
drop trigger if exists order_item_costs_after on public.order_item_costs;
create trigger order_item_costs_after after insert or update or delete on public.order_item_costs
  for each row execute function public.order_item_costs_after();

create or replace function public.order_items_hpp_changed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.recalc_order_hpp(new.order_id);
  return null;
end;
$$;
drop trigger if exists order_items_hpp_changed on public.order_items;
create trigger order_items_hpp_changed after update of hpp_overhead_pct, qty, unit_price on public.order_items
  for each row execute function public.order_items_hpp_changed();

create or replace function public.settings_hpp_changed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare r record;
begin
  for r in select distinct order_id from public.order_item_costs loop
    perform public.recalc_order_hpp(r.order_id);
  end loop;
  return null;
end;
$$;
drop trigger if exists settings_hpp_changed on public.settings;
create trigger settings_hpp_changed after update of hpp_overhead_pct on public.settings
  for each row when (old.hpp_overhead_pct is distinct from new.hpp_overhead_pct)
  execute function public.settings_hpp_changed();

-- ---------------------------------------------------------------------
-- VIEW: HPP per order (estimasi dari rincian + aktual dari proyek)
-- ---------------------------------------------------------------------
create or replace view public.order_hpp
with (security_invoker = true) as
select
  o.id as order_id, o.order_number, o.order_date, o.title, o.customer_name, o.category, o.status,
  o.subtotal, o.discount, o.additional_fee, o.total, o.cost_estimate, o.completed_at,
  p.id as project_id,
  coalesce(h.items, 0) as items_count,
  coalesce(h.items_with_hpp, 0) as items_with_hpp,
  coalesce(h.material, 0) as material,
  coalesce(h.labor, 0) as labor,
  coalesce(h.overhead, 0) as overhead,
  coalesce(h.other, 0) as other,
  coalesce(h.hpp, 0) as hpp_detail,
  coalesce(h.items_with_hpp, 0) > 0 as has_detail,
  -- HPP estimasi: rincian bila ada, selain itu angka HPP manual di order.
  case when coalesce(h.items_with_hpp, 0) > 0 then coalesce(h.hpp, 0) else o.cost_estimate end as hpp_estimate,
  coalesce(f.actual_total_cost, 0) as hpp_actual,
  coalesce(f.material_actual, 0) as actual_material,
  coalesce(f.labor_actual, 0) as actual_labor,
  coalesce(f.other_actual, 0) as actual_other
from public.orders o
left join public.projects p on p.order_id = o.id
left join public.project_financials f on f.project_id = p.id
left join lateral (
  select
    count(*) as items,
    count(*) filter (where cost_lines > 0) as items_with_hpp,
    sum(material) as material,
    sum(labor) as labor,
    sum(overhead_lines + auto_overhead) as overhead,
    sum(other) as other,
    sum(hpp_total) as hpp
  from public.order_item_hpp where order_id = o.id
) h on true;

-- ---------------------------------------------------------------------
-- save_order: item di-update berdasarkan id (bukan hapus semua) agar
-- rincian HPP per item tidak hilang saat order diedit.
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

  -- Item yang tidak ada lagi di form → hapus (rincian HPP-nya ikut terhapus).
  delete from public.order_items oi
  where oi.order_id = v_id
    and oi.id not in (
      select nullif(x ->> 'id', '')::uuid
      from jsonb_array_elements(coalesce(p -> 'items', '[]'::jsonb)) as t(x)
      where nullif(x ->> 'id', '') is not null
    );

  -- Item lama → update; item baru → insert.
  with src as (
    select nullif(x ->> 'id', '')::uuid as id, x ->> 'name' as name, nullif(x ->> 'description', '') as description,
           case when nullif(x ->> 'length_m', '') is not null and nullif(x ->> 'height_m', '') is not null
                then round((x ->> 'length_m')::numeric * (x ->> 'height_m')::numeric, 2)
                else (x ->> 'qty')::numeric end as qty,
           case when nullif(x ->> 'length_m', '') is not null and nullif(x ->> 'height_m', '') is not null then 'm²'
                else coalesce(nullif(x ->> 'unit', ''), 'unit') end as unit,
           (x ->> 'unit_price')::numeric as unit_price, ord::int as sort_order,
           nullif(x ->> 'length_m', '')::numeric as length_m, nullif(x ->> 'height_m', '')::numeric as height_m
    from jsonb_array_elements(coalesce(p -> 'items', '[]'::jsonb)) with ordinality as t(x, ord)
  ),
  upd as (
    update public.order_items oi set
      name = s.name, description = s.description, qty = s.qty, unit = s.unit, unit_price = s.unit_price,
      sort_order = s.sort_order, length_m = s.length_m, height_m = s.height_m
    from src s
    where s.id is not null and oi.id = s.id and oi.order_id = v_id
    returning oi.id
  )
  insert into public.order_items (order_id, name, description, qty, unit, unit_price, sort_order, length_m, height_m)
  select v_id, s.name, s.description, s.qty, s.unit, s.unit_price, s.sort_order, s.length_m, s.height_m
  from src s
  where s.id is null or not exists (select 1 from upd u where u.id = s.id);

  delete from public.order_payments where order_id = v_id;
  insert into public.order_payments (order_id, paid_at, amount, method, kind, reference, note)
  select v_id, coalesce(nullif(x ->> 'paid_at', '')::date, public.jakarta_today()), (x ->> 'amount')::numeric,
         coalesce(nullif(x ->> 'method', ''), 'transfer'), coalesce(nullif(x ->> 'kind', ''), 'dp'),
         nullif(x ->> 'reference', ''), nullif(x ->> 'note', '')
  from jsonb_array_elements(coalesce(p -> 'payments', '[]'::jsonb)) as t(x);

  perform public.recalc_order_totals(v_id);
  perform public.recalc_order_hpp(v_id);
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------
-- RLS, audit, grants
-- ---------------------------------------------------------------------
alter table public.order_item_costs enable row level security;
drop policy if exists "owner all order_item_costs" on public.order_item_costs;
create policy "owner all order_item_costs" on public.order_item_costs for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

drop trigger if exists touch_order_item_costs on public.order_item_costs;
select public.attach_audit('order_item_costs');

revoke all on public.order_item_costs from anon;
grant select, insert, update, delete on public.order_item_costs to authenticated;
grant all on public.order_item_costs to service_role;
revoke all on public.order_item_hpp, public.order_hpp from anon;
grant select on public.order_item_hpp, public.order_hpp to authenticated;
grant select on public.order_item_hpp, public.order_hpp to service_role;
