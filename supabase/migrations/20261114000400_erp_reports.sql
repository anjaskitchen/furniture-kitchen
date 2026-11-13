-- =====================================================================
-- ERP 5/5 — VIEW & LAPORAN
--
-- Biaya proyek (realisasi):
--   Material = pemakaian stok (dipakai + rusak − sisa kembali) × harga lot + biaya material langsung
--   Upah     = hari kerja di proyek (absensi) × tarif harian + upah borongan di slip gaji (disetujui/dibayar)
--              + biaya tenaga kerja lepas (project_expenses 'labor')
--   Lainnya  = project_expenses kategori lain (transport, pemasangan, dll.)
-- Laba kotor proyek    = nilai kontrak − biaya langsung proyek
-- Laba operasional     = laba kotor − biaya overhead (pengeluaran tanpa proyek) − gaji yang tidak terbebankan ke proyek
-- Semua view security_invoker: RLS tabel asal tetap berlaku (data gaji/keuangan hanya untuk admin utama).
-- =====================================================================

create or replace view public.employee_rates
with (security_invoker = true) as
select
  ps.employee_id,
  ps.pay_type,
  case ps.pay_type
    when 'daily' then ps.daily_wage
    when 'monthly' then round(ps.monthly_salary / ps.working_days_per_month, 2)
    else 0
  end as daily_rate
from public.employee_pay_settings ps;

create or replace view public.project_financials
with (security_invoker = true) as
select
  x.*,
  x.material_actual + x.labor_actual + x.other_actual as actual_total_cost,
  x.contract_value - (x.material_actual + x.labor_actual + x.other_actual) as actual_profit,
  case
    when x.budget_cost_total > 0 then x.contract_value - x.budget_cost_total
    else x.contract_value - (x.rab_total + x.labor_estimate)
  end as estimated_profit
from (
  select
    p.id as project_id,
    o.total as contract_value,
    coalesce(b.material, 0) as budget_material,
    coalesce(b.labor, 0) as budget_labor,
    coalesce(b.other, 0) as budget_other,
    coalesce(b.profit, 0) as budget_profit,
    coalesce(b.material, 0) + coalesce(b.labor, 0) + coalesce(b.other, 0) as budget_cost_total,
    coalesce(b.n, 0) > 0 as has_budget,
    coalesce(rq.total, 0) as rab_total,
    coalesce(mu.cost, 0) as material_used_cost,
    coalesce(ex.material, 0) as material_direct,
    coalesce(mu.cost, 0) + coalesce(ex.material, 0) as material_actual,
    coalesce(att.days, 0) as labor_days,
    coalesce(att.cost, 0) as labor_attendance_cost,
    coalesce(pp.amount, 0) as labor_project_pay,
    coalesce(ex.labor, 0) as labor_direct,
    coalesce(att.cost, 0) + coalesce(pp.amount, 0) + coalesce(ex.labor, 0) as labor_actual,
    coalesce(wk.estimate, 0) as labor_estimate,
    coalesce(ex.other, 0) as other_actual
  from public.projects p
  join public.orders o on o.id = p.order_id
  left join lateral (
    select
      count(*) as n,
      sum(amount) filter (where category = 'material') as material,
      sum(amount) filter (where category = 'labor') as labor,
      sum(amount) filter (where category not in ('material', 'labor', 'profit')) as other,
      sum(amount) filter (where category = 'profit') as profit
    from public.project_budgets where project_id = p.id
  ) b on true
  left join lateral (select sum(est_total) as total from public.project_material_requirements where project_id = p.id) rq on true
  left join lateral (
    select sum(case when kind = 'returned' then -qty else qty end * unit_cost) as cost
    from public.project_material_usage where project_id = p.id
  ) mu on true
  left join lateral (
    select
      sum(amount) filter (where category = 'material') as material,
      sum(amount) filter (where category = 'labor') as labor,
      sum(amount) filter (where category not in ('material', 'labor')) as other
    from public.project_expenses where project_id = p.id
  ) ex on true
  left join lateral (
    select sum(a.days_worked) as days, sum(a.days_worked * coalesce(r.daily_rate, 0)) as cost
    from public.employee_attendance a left join public.employee_rates r on r.employee_id = a.employee_id
    where a.project_id = p.id and a.status = 'present'
  ) att on true
  left join lateral (
    select sum(i.amount) as amount
    from public.payroll_items i join public.payroll pr on pr.id = i.payroll_id
    where i.project_id = p.id and i.category = 'project_pay' and pr.status in ('approved', 'paid')
  ) pp on true
  left join lateral (
    select sum(case when coalesce(r.pay_type, 'daily') = 'project' or w.agreed_amount > 0 then w.agreed_amount else w.estimated_days * coalesce(r.daily_rate, 0) end) as estimate
    from public.project_workers w left join public.employee_rates r on r.employee_id = w.employee_id
    where w.project_id = p.id
  ) wk on true
) x;

create or replace view public.projects_view
with (security_invoker = true) as
select
  z.*,
  case
    when z.order_status = 'cancelled' then 'gray'
    when z.schedule_status = 'late' or z.budget_status = 'over' then 'red'
    when z.schedule_status in ('near_deadline', 'behind') or z.budget_status = 'near' then 'yellow'
    else 'green'
  end as indicator
from (
  select
    y.*,
    case
      when y.order_status = 'completed' then 'done'
      when y.order_status = 'cancelled' then 'cancelled'
      when y.target_end_date is null then 'no_schedule'
      when public.jakarta_today() > y.target_end_date then 'late'
      when y.expected_progress - y.progress > 25 then 'behind'
      when y.target_end_date - public.jakarta_today() <= 3 then 'near_deadline'
      else 'on_track'
    end as schedule_status,
    case
      when y.budget_cost_total <= 0 then 'none'
      when y.actual_total_cost > y.budget_cost_total
        or (y.budget_labor > 0 and y.labor_actual > y.budget_labor)
        or (y.budget_material > 0 and y.material_actual > y.budget_material) then 'over'
      when y.actual_total_cost >= 0.9 * y.budget_cost_total
        or (y.budget_labor > 0 and y.labor_actual >= 0.9 * y.budget_labor)
        or (y.budget_material > 0 and y.material_actual >= 0.9 * y.budget_material) then 'near'
      else 'ok'
    end as budget_status
  from (
    select
      p.id, p.order_id, p.work_type, p.specs, p.manager_id, m.full_name as manager_name, p.template_id,
      p.start_date, p.target_end_date, coalesce(p.actual_end_date, o.completed_at) as actual_end_date,
      p.estimated_days, p.progress, p.notes, p.created_at, p.updated_at,
      o.order_number, o.order_date, o.customer_name, o.customer_phone, o.customer_address, o.title, o.category,
      o.status as order_status, o.paid_amount, greatest(o.total - o.paid_amount, 0) as balance, o.due_date as payment_due_date,
      o.status in ('confirmed', 'production', 'installation', 'completed') as is_booked,
      o.status in ('confirmed', 'production', 'installation') as is_active,
      case when p.start_date is not null then coalesce(p.actual_end_date, o.completed_at, public.jakarta_today()) - p.start_date + 1 end as actual_days,
      case when p.start_date is not null and p.target_end_date is not null then p.target_end_date - p.start_date + 1 end as planned_days,
      case
        when p.start_date is null or p.target_end_date is null then 0
        when p.target_end_date <= p.start_date then case when public.jakarta_today() >= p.start_date then 100 else 0 end
        else least(100, greatest(0, round((public.jakarta_today() - p.start_date)::numeric / (p.target_end_date - p.start_date) * 100, 1)))
      end as expected_progress,
      f.contract_value, f.budget_material, f.budget_labor, f.budget_other, f.budget_profit, f.budget_cost_total, f.has_budget,
      f.rab_total, f.material_used_cost, f.material_direct, f.material_actual, f.labor_days, f.labor_attendance_cost,
      f.labor_project_pay, f.labor_direct, f.labor_actual, f.labor_estimate, f.other_actual, f.actual_total_cost,
      f.actual_profit, f.estimated_profit
    from public.projects p
    join public.orders o on o.id = p.order_id
    left join public.employees m on m.id = p.manager_id
    join public.project_financials f on f.project_id = p.id
  ) y
) z;

create or replace view public.inventory_view
with (security_invoker = true) as
select
  i.*,
  i.qty_on_hand - i.qty_allocated as qty_available,
  round(i.qty_on_hand * i.unit_cost, 2) as stock_value,
  m.code as item_code, m.name as item_name, m.brand, m.category_id, c.name as category_name, s.name as supplier_name,
  po.po_number,
  case
    when i.qty_returned > 0 and i.qty_on_hand = 0 and i.qty_used = 0 then 'returned'
    when i.qty_on_hand = 0 and i.qty_damaged > 0 and i.qty_used = 0 then 'damaged'
    when i.qty_on_hand = 0 then 'depleted'
    when i.qty_allocated > 0 and i.qty_allocated >= i.qty_on_hand then 'allocated'
    when i.qty_used > 0 or i.qty_damaged > 0 then 'partial'
    else 'available'
  end as stock_status
from public.inventory i
join public.material_items m on m.id = i.material_item_id
join public.material_categories c on c.id = m.category_id
left join public.suppliers s on s.id = i.supplier_id
left join public.purchase_order_items pi on pi.id = i.purchase_order_item_id
left join public.purchase_orders po on po.id = pi.purchase_order_id;

create or replace view public.material_stock_view
with (security_invoker = true) as
select
  m.*,
  c.name as category_name,
  coalesce(st.on_hand, 0) as qty_on_hand,
  coalesce(st.allocated, 0) as qty_allocated,
  coalesce(st.on_hand, 0) - coalesce(st.allocated, 0) as qty_available,
  coalesce(st.value, 0) as stock_value,
  m.min_stock > 0 and coalesce(st.on_hand, 0) - coalesce(st.allocated, 0) <= m.min_stock as is_low_stock,
  bp.price as best_price,
  bp.supplier_id as best_supplier_id,
  bp.supplier_name as best_supplier_name,
  coalesce(sc.n, 0) as supplier_count
from public.material_items m
join public.material_categories c on c.id = m.category_id
left join lateral (
  select sum(qty_on_hand) as on_hand, sum(qty_allocated) as allocated, sum(qty_on_hand * unit_cost) as value
  from public.inventory where material_item_id = m.id
) st on true
left join lateral (
  select sp.price, sp.supplier_id, s.name as supplier_name
  from public.supplier_products sp join public.suppliers s on s.id = sp.supplier_id
  where sp.material_item_id = m.id and sp.is_active and s.is_active and s.deleted_at is null
  order by sp.price, sp.price_updated_at desc limit 1
) bp on true
left join lateral (
  select count(*) as n from public.supplier_products sp join public.suppliers s on s.id = sp.supplier_id
  where sp.material_item_id = m.id and sp.is_active and s.deleted_at is null
) sc on true;

create or replace view public.project_requirements_view
with (security_invoker = true) as
select
  y.*,
  case
    when y.material_item_id is null then 'untracked'
    when y.covered_qty >= y.qty then 'fulfilled'
    when y.covered_qty + y.on_order_qty >= y.qty then 'ordered'
    when y.stock_available >= y.still_needed then 'in_stock'
    when y.covered_qty > 0 or y.on_order_qty > 0 then 'partial'
    else 'to_buy'
  end as procurement_status,
  greatest(y.still_needed - greatest(y.stock_available, 0) - y.on_order_qty, 0) as shortage_qty
from (
  select
    x.*,
    greatest(x.qty - x.covered_qty, 0) as still_needed
  from (
    select
      r.*,
      m.code as item_code, m.name as item_name, c.name as category_name,
      coalesce(al.qty, 0) + coalesce(us.qty, 0) as covered_qty,
      coalesce(al.remaining, 0) as allocated_remaining,
      coalesce(us.used, 0) as used_qty,
      coalesce(oo.qty, 0) as on_order_qty,
      coalesce(st.available, 0) as stock_available,
      coalesce(ps.supplier_id, bp.supplier_id) as recommended_supplier_id,
      coalesce(ps.supplier_name, bp.supplier_name) as recommended_supplier_name,
      coalesce(ps.price, bp.price) as recommended_price,
      bp.price as best_price
    from public.project_material_requirements r
    left join public.material_items m on m.id = r.material_item_id
    left join public.material_categories c on c.id = m.category_id
    left join lateral (
      select sum(a.qty_allocated - a.qty_released) as qty, sum(a.qty_allocated - a.qty_consumed - a.qty_released) as remaining
      from public.project_material_allocations a join public.inventory i on i.id = a.inventory_id
      where a.project_id = r.project_id and i.material_item_id = r.material_item_id
    ) al on true
    left join lateral (
      select
        sum(u.qty - u.qty_from_allocation) filter (where u.kind in ('used', 'damaged')) as qty,
        sum(case when u.kind = 'returned' then -u.qty when u.kind = 'used' then u.qty else 0 end) as used
      from public.project_material_usage u join public.inventory i on i.id = u.inventory_id
      where u.project_id = r.project_id and i.material_item_id = r.material_item_id
    ) us on true
    left join lateral (
      select sum(pi.qty) as qty
      from public.purchase_order_items pi join public.purchase_orders po on po.id = pi.purchase_order_id
      where pi.project_id = r.project_id and pi.material_item_id = r.material_item_id and po.status in ('draft', 'ordered')
    ) oo on true
    left join lateral (
      select sum(qty_on_hand - qty_allocated) as available from public.inventory where material_item_id = r.material_item_id
    ) st on true
    left join lateral (
      select sp.price, sp.supplier_id, s.name as supplier_name
      from public.supplier_products sp join public.suppliers s on s.id = sp.supplier_id
      where sp.material_item_id = r.material_item_id and sp.supplier_id = r.preferred_supplier_id
    ) ps on true
    left join lateral (
      select sp.price, sp.supplier_id, s.name as supplier_name
      from public.supplier_products sp join public.suppliers s on s.id = sp.supplier_id
      where sp.material_item_id = r.material_item_id and sp.is_active and s.is_active and s.deleted_at is null
      order by sp.price limit 1
    ) bp on true
  ) x
) y;

create or replace view public.cash_accounts_view
with (security_invoker = true) as
select
  a.*,
  a.opening_balance
    + coalesce((select sum(case when t.direction = 'in' then t.amount else -t.amount end) from public.financial_transactions t where t.account_id = a.id), 0) as balance
from public.cash_accounts a;

-- ---------------------------------------------------------------------
-- LAPORAN KEUANGAN (rentang tanggal inklusif)
-- ---------------------------------------------------------------------
create or replace function public.finance_report(p_from date, p_to date)
returns jsonb
language plpgsql
stable
as $$
declare
  v jsonb;
  v_series_from date := (date_trunc('month', p_to::timestamp) - interval '11 months')::date;
  v_overhead_cats text[] := array['material', 'labor', 'workshop', 'transport', 'installation', 'utilities', 'marketing', 'admin', 'contingency', 'other_expense'];
begin
  if p_to < p_from then raise exception 'Tanggal akhir harus setelah tanggal awal'; end if;

  with
  booked as (select * from public.orders_view where is_booked),
  led as (select * from public.financial_transactions where txn_date between p_from and p_to),
  pf as (
    select f.*, o.order_date from public.project_financials f
    join public.projects p on p.id = f.project_id join public.orders o on o.id = p.order_id
    where o.status in ('confirmed', 'production', 'installation', 'completed')
  ),
  att_cost as (
    select coalesce(sum(a.days_worked * coalesce(r.daily_rate, 0)), 0) as cost
    from public.employee_attendance a left join public.employee_rates r on r.employee_id = a.employee_id
    where a.project_id is not null and a.status = 'present' and a.work_date between p_from and p_to
  ),
  pay as (
    select coalesce(sum(total_earnings), 0) as gross from public.payroll
    where status in ('approved', 'paid') and period_end between p_from and p_to
  )
  select jsonb_build_object(
    'range', jsonb_build_object('from', p_from, 'to', p_to),
    'revenue', (select coalesce(sum(total), 0) from booked where order_date between p_from and p_to),
    'orders', (select count(*) from booked where order_date between p_from and p_to),
    'customer_payments', (
      select jsonb_build_object(
        'dp', coalesce(sum(amount) filter (where kind = 'dp'), 0),
        'termin', coalesce(sum(amount) filter (where kind = 'termin'), 0),
        'pelunasan', coalesce(sum(amount) filter (where kind = 'pelunasan'), 0),
        'other', coalesce(sum(amount) filter (where kind = 'other'), 0),
        'total', coalesce(sum(amount), 0))
      from public.order_payments where paid_at between p_from and p_to
    ),
    'purchases', (select coalesce(sum(total), 0) from public.purchase_orders where status in ('ordered', 'received') and order_date between p_from and p_to),
    'purchases_paid', (select coalesce(sum(amount), 0) from led where category = 'material_purchase'),
    'payroll_gross', (select gross from pay),
    'payroll_paid', (select coalesce(sum(amount), 0) from led where category = 'salary'),
    'labor_direct', (select coalesce(sum(amount), 0) from led where category = 'labor'),
    'labor_total', (select gross from pay) + (select coalesce(sum(amount), 0) from led where category = 'labor'),
    'operational', (select coalesce(sum(amount), 0) from led where direction = 'out' and category = any(v_overhead_cats) and category <> 'labor'),
    'cash_in', (select coalesce(sum(amount), 0) from led where direction = 'in' and category <> 'transfer_in'),
    'cash_out', (select coalesce(sum(amount), 0) from led where direction = 'out' and category <> 'transfer_out'),
    'direct_cost', (select coalesce(sum(actual_total_cost), 0) from pf where order_date between p_from and p_to),
    'gross_profit', (select coalesce(sum(actual_profit), 0) from pf where order_date between p_from and p_to),
    'estimated_profit', (select coalesce(sum(estimated_profit), 0) from pf where order_date between p_from and p_to),
    'overhead', (select coalesce(sum(amount), 0) from led where direction = 'out' and project_id is null and category = any(v_overhead_cats)),
    'payroll_unallocated', greatest((select gross from pay) - (select cost from att_cost), 0),
    'cash_balance', (
      select coalesce(sum(a.opening_balance + coalesce((
        select sum(case when t.direction = 'in' then t.amount else -t.amount end) from public.financial_transactions t
        where t.account_id = a.id and t.txn_date <= p_to), 0)), 0)
      from public.cash_accounts a where a.opening_date <= p_to
    ),
    'accounts', (
      select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'name', a.name, 'kind', a.kind, 'balance', a.opening_balance + coalesce((
        select sum(case when t.direction = 'in' then t.amount else -t.amount end) from public.financial_transactions t
        where t.account_id = a.id and t.txn_date <= p_to), 0)) order by a.kind, a.name), '[]'::jsonb)
      from public.cash_accounts a where a.is_active
    ),
    'receivables', (select coalesce(sum(balance), 0) from booked),
    'receivables_orders', (select count(*) from booked where balance > 0),
    'payables', (select coalesce(sum(total - paid_amount), 0) from public.purchase_orders where status in ('ordered', 'received')),
    'payables_orders', (select count(*) from public.purchase_orders where status in ('ordered', 'received') and total - paid_amount > 0),
    'loans_outstanding', (select coalesce(sum(outstanding), 0) from public.employee_loans),
    'expense_by_category', (
      select coalesce(jsonb_agg(jsonb_build_object('category', category, 'amount', amount) order by amount desc), '[]'::jsonb)
      from (select category, sum(amount) as amount from led where direction = 'out' and category <> 'transfer_out' group by category) x
    ),
    'income_by_category', (
      select coalesce(jsonb_agg(jsonb_build_object('category', category, 'amount', amount) order by amount desc), '[]'::jsonb)
      from (select category, sum(amount) as amount from led where direction = 'in' and category <> 'transfer_in' group by category) x
    ),
    'fund_allocation', (
      select coalesce(jsonb_agg(jsonb_build_object('category', category, 'budget', budget, 'allocated', allocated, 'spent', spent) order by ord), '[]'::jsonb)
      from (
        select b.category,
          array_position(array['material', 'labor', 'workshop', 'transport', 'installation', 'utilities', 'marketing', 'admin', 'contingency', 'profit'], b.category) as ord,
          sum(b.amount) as budget,
          sum(round(least(o.paid_amount, o.total) * b.amount / nullif(o.total, 0), 2)) as allocated,
          sum(case b.category
                when 'material' then f.material_actual
                when 'labor' then f.labor_actual
                when 'profit' then 0
                else coalesce((select sum(e.amount) from public.project_expenses e where e.project_id = b.project_id and e.category = b.category), 0)
              end) as spent
        from public.project_budgets b
        join public.projects p on p.id = b.project_id
        join public.orders o on o.id = p.order_id
        join public.project_financials f on f.project_id = p.id
        where o.status in ('confirmed', 'production', 'installation')
        group by b.category
      ) x
    ),
    'active_received', (select coalesce(sum(least(paid_amount, total)), 0) from public.orders where status in ('confirmed', 'production', 'installation')),
    'series', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'month', m.month,
        'revenue', coalesce((select sum(total) from booked b where date_trunc('month', b.order_date::timestamp)::date = m.month), 0),
        'cash_in', coalesce((select sum(amount) from public.financial_transactions t where t.direction = 'in' and t.category <> 'transfer_in' and date_trunc('month', t.txn_date::timestamp)::date = m.month), 0),
        'cash_out', coalesce((select sum(amount) from public.financial_transactions t where t.direction = 'out' and t.category <> 'transfer_out' and date_trunc('month', t.txn_date::timestamp)::date = m.month), 0),
        'gross_profit', coalesce((select sum(actual_profit) from pf where date_trunc('month', pf.order_date::timestamp)::date = m.month), 0),
        'material_usage', coalesce((select sum(case when u.kind = 'returned' then -u.qty else u.qty end * u.unit_cost) from public.project_material_usage u where date_trunc('month', u.usage_date::timestamp)::date = m.month), 0),
        'payroll', coalesce((select sum(total_earnings) from public.payroll pr where pr.status in ('approved', 'paid') and date_trunc('month', pr.period_end::timestamp)::date = m.month), 0)
      ) order by m.month), '[]'::jsonb)
      from (select generate_series(v_series_from, date_trunc('month', p_to::timestamp)::date, interval '1 month')::date as month) m
    )
  ) into v;

  v := v || jsonb_build_object('operating_profit',
    (v ->> 'gross_profit')::numeric - (v ->> 'overhead')::numeric - (v ->> 'payroll_unallocated')::numeric);
  return v;
end;
$$;

-- ---------------------------------------------------------------------
-- PERINGATAN DASHBOARD
-- ---------------------------------------------------------------------
create or replace function public.dashboard_alerts()
returns jsonb
language sql
stable
as $$
  with active as (select * from public.projects_view where is_active)
  select jsonb_build_object(
    'near_deadline', (
      select coalesce(jsonb_agg(jsonb_build_object('id', id, 'order_number', order_number, 'title', title, 'customer', customer_name,
        'date', target_end_date, 'progress', progress, 'days_left', target_end_date - public.jakarta_today()) order by target_end_date), '[]'::jsonb)
      from active where target_end_date between public.jakarta_today() and public.jakarta_today() + 7
    ),
    'late', (
      select coalesce(jsonb_agg(jsonb_build_object('id', id, 'order_number', order_number, 'title', title, 'customer', customer_name,
        'date', target_end_date, 'progress', progress, 'days_late', public.jakarta_today() - target_end_date) order by target_end_date), '[]'::jsonb)
      from active where target_end_date < public.jakarta_today()
    ),
    'behind', (
      select coalesce(jsonb_agg(jsonb_build_object('id', id, 'order_number', order_number, 'title', title, 'customer', customer_name,
        'progress', progress, 'expected', expected_progress)), '[]'::jsonb)
      from active where schedule_status = 'behind'
    ),
    'material_missing', (
      select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'order_number', a.order_number, 'title', a.title, 'items', x.items, 'names', x.names)), '[]'::jsonb)
      from active a join lateral (
        select count(*) as items, string_agg(r.name, ', ' order by r.sort_order) as names
        from public.project_requirements_view r where r.project_id = a.id and r.procurement_status in ('to_buy', 'partial', 'in_stock')
      ) x on x.items > 0
    ),
    'material_budget', (
      select coalesce(jsonb_agg(jsonb_build_object('id', id, 'order_number', order_number, 'title', title,
        'budget', budget_material, 'actual', material_actual, 'pct', round(material_actual / budget_material * 100))), '[]'::jsonb)
      from active where budget_material > 0 and material_actual >= 0.9 * budget_material
    ),
    'labor_over', (
      select coalesce(jsonb_agg(jsonb_build_object('id', id, 'order_number', order_number, 'title', title,
        'budget', greatest(budget_labor, labor_estimate), 'actual', labor_actual)), '[]'::jsonb)
      from active where labor_actual > 0 and labor_actual > greatest(budget_labor, labor_estimate) and greatest(budget_labor, labor_estimate) > 0
    ),
    'low_stock', (
      select coalesce(jsonb_agg(jsonb_build_object('id', id, 'code', code, 'name', name, 'unit', unit, 'available', qty_available, 'min', min_stock) order by qty_available), '[]'::jsonb)
      from public.material_stock_view where is_low_stock and is_active and deleted_at is null
    )
  );
$$;

revoke all on public.employee_rates, public.project_financials, public.projects_view, public.inventory_view, public.material_stock_view,
  public.project_requirements_view, public.cash_accounts_view from anon;
grant select on public.employee_rates, public.project_financials, public.projects_view, public.inventory_view, public.material_stock_view,
  public.project_requirements_view, public.cash_accounts_view to authenticated;
grant all on public.employee_rates, public.project_financials, public.projects_view, public.inventory_view, public.material_stock_view,
  public.project_requirements_view, public.cash_accounts_view to service_role;
revoke all on function public.finance_report(date, date) from public, anon;
grant execute on function public.finance_report(date, date) to authenticated, service_role;
revoke all on function public.dashboard_alerts() from public, anon;
grant execute on function public.dashboard_alerts() to authenticated, service_role;

-- Realtime untuk layar operasional.
do $$
declare t text;
begin
  foreach t in array array['projects', 'project_timelines', 'inventory', 'purchase_orders', 'employee_attendance'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
