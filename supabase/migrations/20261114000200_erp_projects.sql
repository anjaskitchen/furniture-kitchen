-- =====================================================================
-- ERP 3/5 — PROYEK: template material, RAB/kebutuhan material, anggaran,
-- biaya proyek, tahapan & progres, pekerja proyek.
-- =====================================================================

-- Pengaturan default (bisa diubah admin di Pengaturan ERP).
alter table public.settings add column if not exists budget_defaults jsonb not null default
  '{"workshop": 3, "transport": 3, "installation": 3, "utilities": 1, "marketing": 2, "admin": 1, "contingency": 5}'::jsonb;
alter table public.settings add column if not exists project_stages text[] not null default array[
  'Survei dan pengukuran', 'Desain dan persetujuan konsumen', 'Persiapan material', 'Pemotongan material',
  'Perakitan', 'Finishing', 'Pemasangan', 'Pemeriksaan hasil', 'Serah terima'];
alter table public.settings add column if not exists company_signatory text;

-- ---------------------------------------------------------------------
-- TEMPLATE MATERIAL (formula bisa dikonfigurasi)
-- Variabel formula: panjang, tinggi, kedalaman (meter), kabinet_atas, kabinet_bawah, laci, pintu
-- Fungsi: ceil, floor, round, min, max. Contoh: ceil(panjang * 2.2) + laci
-- ---------------------------------------------------------------------
create table if not exists public.material_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 2 and 120),
  work_type text,
  description text,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.material_template_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.material_templates (id) on delete cascade,
  material_item_id uuid references public.material_items (id) on delete set null,
  name text not null check (char_length(name) between 1 and 160),
  formula text not null check (char_length(formula) between 1 and 300),
  waste_pct numeric(5, 2) not null default 0 check (waste_pct between 0 and 100),
  round_up boolean not null default true,
  unit text not null default 'pcs',
  notes text,
  sort_order int not null default 0
);
create index if not exists material_template_items_tpl_idx on public.material_template_items (template_id);

alter table public.projects add column if not exists template_id uuid references public.material_templates (id) on delete set null;

-- ---------------------------------------------------------------------
-- RAB: kebutuhan material per proyek
-- ---------------------------------------------------------------------
create table if not exists public.project_material_requirements (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  material_item_id uuid references public.material_items (id) on delete restrict,
  name text not null check (char_length(name) between 1 and 160),
  spec_text text,
  qty numeric(14, 2) not null check (qty > 0),
  unit text not null default 'pcs',
  est_unit_price numeric(14, 2) not null default 0 check (est_unit_price >= 0),
  est_total numeric(14, 2) generated always as (round(qty * est_unit_price, 2)) stored,
  preferred_supplier_id uuid references public.suppliers (id) on delete set null,
  source text not null default 'manual' check (source in ('manual', 'template')),
  notes text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists requirements_project_idx on public.project_material_requirements (project_id);
create index if not exists requirements_item_idx on public.project_material_requirements (material_item_id);

-- ---------------------------------------------------------------------
-- ANGGARAN (rencana) & BIAYA LANGSUNG (realisasi non-stok)
-- ---------------------------------------------------------------------
create table if not exists public.project_budgets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  category text not null check (category in ('material', 'labor', 'workshop', 'transport', 'installation', 'utilities', 'marketing', 'admin', 'contingency', 'profit')),
  amount numeric(14, 2) not null default 0 check (amount >= 0),
  notes text,
  updated_at timestamptz not null default now(),
  unique (project_id, category)
);

create table if not exists public.project_expenses (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete restrict,
  expense_date date not null default public.jakarta_today(),
  category text not null check (category in ('material', 'labor', 'workshop', 'transport', 'installation', 'utilities', 'marketing', 'admin', 'contingency')),
  description text not null check (char_length(description) between 2 and 200),
  amount numeric(14, 2) not null check (amount > 0),
  account_id uuid not null references public.cash_accounts (id) on delete restrict,
  vendor text,
  receipt_url text,
  created_by uuid references public.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists project_expenses_project_idx on public.project_expenses (project_id);
create index if not exists project_expenses_date_idx on public.project_expenses (expense_date);

create or replace function public.project_expenses_ledger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_label text;
  v_order uuid;
begin
  if tg_op = 'DELETE' then
    perform public.sync_ledger('project_expense', old.id, false, null, null, null, 0, null, null, null, null);
    return null;
  end if;
  select o.order_number, o.id into v_label, v_order from public.projects p join public.orders o on o.id = p.order_id where p.id = new.project_id;
  perform public.sync_ledger('project_expense', new.id, true, new.expense_date, new.account_id, 'out', new.amount, new.category,
    new.project_id, v_order, new.description || ' · ' || coalesce(v_label, ''), new.vendor);
  return null;
end;
$$;
drop trigger if exists project_expenses_ledger on public.project_expenses;
create trigger project_expenses_ledger after insert or update or delete on public.project_expenses
  for each row execute function public.project_expenses_ledger();

-- ---------------------------------------------------------------------
-- TAHAPAN PENGERJAAN
-- ---------------------------------------------------------------------
create table if not exists public.project_timelines (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  stage_name text not null check (char_length(stage_name) between 1 and 120),
  sort_order int not null default 0,
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'done', 'skipped')),
  start_date date,
  target_date date,
  actual_end_date date,
  progress int not null default 0 check (progress between 0 and 100),
  notes text,
  photos text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists project_timelines_project_idx on public.project_timelines (project_id, sort_order);

create or replace function public.project_timelines_before()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'done' then
    new.progress := 100;
    new.actual_end_date := coalesce(new.actual_end_date, public.jakarta_today());
  elsif new.status = 'pending' and new.progress > 0 then
    new.status := 'in_progress';
  elsif new.status <> 'done' then
    new.actual_end_date := null;
  end if;
  if new.status = 'in_progress' and new.start_date is null then
    new.start_date := public.jakarta_today();
  end if;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists project_timelines_before on public.project_timelines;
create trigger project_timelines_before before insert or update on public.project_timelines
  for each row execute function public.project_timelines_before();

create or replace function public.project_timelines_progress()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project uuid := coalesce(new.project_id, old.project_id);
begin
  update public.projects p set progress = coalesce((
    select round(avg(t.progress), 2) from public.project_timelines t where t.project_id = p.id and t.status <> 'skipped'
  ), 0) where p.id = v_project;
  return null;
end;
$$;
drop trigger if exists project_timelines_progress on public.project_timelines;
create trigger project_timelines_progress after insert or update or delete on public.project_timelines
  for each row execute function public.project_timelines_progress();

-- Proyek baru → tahapan default dari pengaturan.
create or replace function public.projects_default_stages()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.project_timelines (project_id, stage_name, sort_order)
  select new.id, s.name, s.ord
  from unnest((select project_stages from public.settings limit 1)) with ordinality as s(name, ord);
  return null;
end;
$$;
drop trigger if exists projects_default_stages on public.projects;
create trigger projects_default_stages after insert on public.projects
  for each row execute function public.projects_default_stages();

insert into public.project_timelines (project_id, stage_name, sort_order)
select p.id, s.name, s.ord
from public.projects p
cross join lateral unnest((select project_stages from public.settings limit 1)) with ordinality as s(name, ord)
where not exists (select 1 from public.project_timelines t where t.project_id = p.id);

-- ---------------------------------------------------------------------
-- PEKERJA PROYEK
-- ---------------------------------------------------------------------
create table if not exists public.project_workers (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete restrict,
  role text,
  start_date date,
  end_date date,
  estimated_days numeric(6, 1) not null default 0 check (estimated_days >= 0),
  -- Upah borongan untuk pegawai sistem "per proyek".
  agreed_amount numeric(14, 2) not null default 0 check (agreed_amount >= 0),
  notes text,
  created_at timestamptz not null default now(),
  unique (project_id, employee_id)
);
create index if not exists project_workers_emp_idx on public.project_workers (employee_id);

-- ---------------------------------------------------------------------
-- updated_at, audit, RLS
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['material_templates', 'project_material_requirements', 'project_expenses'] loop
    execute format('drop trigger if exists touch_%1$s on public.%1$s', t);
    execute format('create trigger touch_%1$s before update on public.%1$s for each row execute function public.touch_updated_at()', t);
  end loop;
  foreach t in array array['project_material_requirements', 'project_budgets', 'project_expenses', 'project_timelines', 'project_workers'] loop
    perform public.attach_audit(t);
  end loop;
  foreach t in array array['material_templates', 'material_template_items', 'project_material_requirements', 'project_timelines', 'project_workers'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "admin all %1$s" on public.%1$s', t);
    execute format('create policy "admin all %1$s" on public.%1$s for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
  foreach t in array array['project_budgets', 'project_expenses'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "owner all %1$s" on public.%1$s', t);
    execute format('create policy "owner all %1$s" on public.%1$s for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin())', t);
  end loop;
end $$;

revoke all on public.material_templates, public.material_template_items, public.project_material_requirements, public.project_budgets,
  public.project_expenses, public.project_timelines, public.project_workers from anon;
grant select, insert, update, delete on public.material_templates, public.material_template_items, public.project_material_requirements,
  public.project_budgets, public.project_expenses, public.project_timelines, public.project_workers to authenticated;
grant all on public.material_templates, public.material_template_items, public.project_material_requirements, public.project_budgets,
  public.project_expenses, public.project_timelines, public.project_workers to service_role;

-- ---------------------------------------------------------------------
-- TEMPLATE AWAL (perkiraan — sesuaikan formula dengan standar workshop)
-- ---------------------------------------------------------------------
insert into public.material_templates (name, work_type, description, sort_order) values
  ('Kitchen set bawah', 'Kitchen Set', 'Kabinet bawah standar (tinggi ±85 cm, kedalaman ±60 cm).', 1),
  ('Kitchen set atas', 'Kitchen Set', 'Kabinet gantung atas (tinggi ±70 cm, kedalaman ±35 cm).', 2),
  ('Kitchen set full plafon', 'Kitchen Set', 'Kabinet bawah + atas sampai plafon.', 3),
  ('Lemari pakaian', 'Wardrobe', 'Lemari pakaian custom.', 4),
  ('Backdrop TV', 'Furniture', 'Backdrop / panel TV dengan kabinet.', 5),
  ('Meja kerja', 'Office', 'Meja kerja custom dengan laci.', 6),
  ('Furniture custom lainnya', 'Furniture', 'Template kosong — isi sesuai kebutuhan.', 7)
on conflict (name) do nothing;

insert into public.material_template_items (template_id, material_item_id, name, formula, waste_pct, unit, sort_order)
select t.id, m.id, x.item, x.formula, x.waste, x.unit, x.ord
from (values
  ('Kitchen set bawah', 'Multiplek 18 mm', 'panjang * 2.2', 10, 'lembar', 1),
  ('Kitchen set bawah', 'Multiplek 9 mm', 'panjang * 0.6', 10, 'lembar', 2),
  ('Kitchen set bawah', 'HPL (warna sesuai pilihan)', 'panjang * 1.8', 10, 'lembar', 3),
  ('Kitchen set bawah', 'Lem kuning', 'panjang * 0.8', 0, 'kg', 4),
  ('Kitchen set bawah', 'Edging PVC', 'panjang * 12 + laci * 3', 5, 'meter', 5),
  ('Kitchen set bawah', 'Engsel sendok slowmotion', 'pintu * 2', 0, 'pcs', 6),
  ('Kitchen set bawah', 'Rel laci full extension 45 cm', 'laci', 0, 'set', 7),
  ('Kitchen set bawah', 'Handle tarik', 'pintu + laci', 0, 'pcs', 8),
  ('Kitchen set bawah', 'Sekrup & fischer', 'max(1, panjang / 3)', 0, 'box', 9),
  ('Kitchen set atas', 'Multiplek 18 mm', 'panjang * 1.4', 10, 'lembar', 1),
  ('Kitchen set atas', 'Multiplek 9 mm', 'panjang * 0.5', 10, 'lembar', 2),
  ('Kitchen set atas', 'HPL (warna sesuai pilihan)', 'panjang * 1.4', 10, 'lembar', 3),
  ('Kitchen set atas', 'Lem kuning', 'panjang * 0.5', 0, 'kg', 4),
  ('Kitchen set atas', 'Edging PVC', 'panjang * 9', 5, 'meter', 5),
  ('Kitchen set atas', 'Engsel sendok slowmotion', 'pintu * 2', 0, 'pcs', 6),
  ('Kitchen set atas', 'Handle tarik', 'pintu', 0, 'pcs', 7),
  ('Kitchen set atas', 'Sekrup & fischer', 'max(1, panjang / 3)', 0, 'box', 8),
  ('Kitchen set full plafon', 'Multiplek 18 mm', 'panjang * 4', 10, 'lembar', 1),
  ('Kitchen set full plafon', 'Multiplek 9 mm', 'panjang * 1.2', 10, 'lembar', 2),
  ('Kitchen set full plafon', 'HPL (warna sesuai pilihan)', 'panjang * 3.6', 10, 'lembar', 3),
  ('Kitchen set full plafon', 'Lem kuning', 'panjang * 1.4', 0, 'kg', 4),
  ('Kitchen set full plafon', 'Edging PVC', 'panjang * 22 + laci * 3', 5, 'meter', 5),
  ('Kitchen set full plafon', 'Engsel sendok slowmotion', 'pintu * 2', 0, 'pcs', 6),
  ('Kitchen set full plafon', 'Rel laci full extension 45 cm', 'laci', 0, 'set', 7),
  ('Kitchen set full plafon', 'Handle tarik', 'pintu + laci', 0, 'pcs', 8),
  ('Kitchen set full plafon', 'Sekrup & fischer', 'max(1, panjang / 2)', 0, 'box', 9),
  ('Lemari pakaian', 'Multiplek 18 mm', 'panjang * tinggi * 1.6', 10, 'lembar', 1),
  ('Lemari pakaian', 'Multiplek 9 mm', 'panjang * tinggi * 0.4', 10, 'lembar', 2),
  ('Lemari pakaian', 'HPL (warna sesuai pilihan)', 'panjang * tinggi * 1.2', 10, 'lembar', 3),
  ('Lemari pakaian', 'Lem kuning', 'panjang * tinggi * 0.3', 0, 'kg', 4),
  ('Lemari pakaian', 'Edging PVC', 'panjang * tinggi * 6', 5, 'meter', 5),
  ('Lemari pakaian', 'Engsel sendok slowmotion', 'pintu * 3', 0, 'pcs', 6),
  ('Lemari pakaian', 'Rel laci full extension 45 cm', 'laci', 0, 'set', 7),
  ('Lemari pakaian', 'Handle tarik', 'pintu + laci', 0, 'pcs', 8),
  ('Backdrop TV', 'Multiplek 18 mm', 'panjang * tinggi * 0.8', 10, 'lembar', 1),
  ('Backdrop TV', 'HPL (warna sesuai pilihan)', 'panjang * tinggi * 0.8', 10, 'lembar', 2),
  ('Backdrop TV', 'Lem kuning', 'panjang * tinggi * 0.2', 0, 'kg', 3),
  ('Backdrop TV', 'Edging PVC', 'panjang * 6', 5, 'meter', 4),
  ('Backdrop TV', 'Rel laci full extension 45 cm', 'laci', 0, 'set', 5),
  ('Meja kerja', 'Multiplek 18 mm', 'panjang * 1.2', 10, 'lembar', 1),
  ('Meja kerja', 'HPL (warna sesuai pilihan)', 'panjang * 1.2', 10, 'lembar', 2),
  ('Meja kerja', 'Lem kuning', 'panjang * 0.4', 0, 'kg', 3),
  ('Meja kerja', 'Edging PVC', 'panjang * 6 + laci * 3', 5, 'meter', 4),
  ('Meja kerja', 'Rel laci full extension 45 cm', 'laci', 0, 'set', 5),
  ('Meja kerja', 'Handle tarik', 'laci + pintu', 0, 'pcs', 6)
) as x(tpl, item, formula, waste, unit, ord)
join public.material_templates t on t.name = x.tpl
left join public.material_items m on lower(m.name) = lower(x.item)
where not exists (select 1 from public.material_template_items i where i.template_id = t.id);
