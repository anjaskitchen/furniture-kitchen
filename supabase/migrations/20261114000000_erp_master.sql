-- =====================================================================
-- ERP 1/5 — DATA MASTER
--   audit log, kategori & spesifikasi bahan, bahan baku, supplier + harga,
--   jabatan & pegawai (data gaji & dokumen terpisah, khusus admin utama),
--   akun kas & buku kas (financial_transactions), dan proyek (1 order = 1 proyek).
--
-- Hak akses:
--   is_admin()        (admin + editor) : operasional (supplier, stok, proyek, absensi)
--   is_super_admin()  (admin utama)    : gaji, dokumen KTP, keuangan, audit log
-- Semua nominal uang memakai numeric(14,2), bukan floating point.
-- =====================================================================

-- ---------------------------------------------------------------------
-- AUDIT LOG — dipasang ke tabel transaksi lewat public.attach_audit().
-- ---------------------------------------------------------------------
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  table_name text not null,
  record_id uuid,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  old_data jsonb,
  new_data jsonb,
  changed_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists audit_logs_record_idx on public.audit_logs (table_name, record_id, created_at desc);
create index if not exists audit_logs_created_idx on public.audit_logs (created_at desc);

create or replace function public.audit_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_uid uuid := (select auth.uid());
begin
  -- Update yang tidak mengubah apa pun selain updated_at tidak dicatat.
  if tg_op = 'UPDATE' and (to_jsonb(old) - 'updated_at') = (to_jsonb(new) - 'updated_at') then
    return null;
  end if;
  insert into public.audit_logs (table_name, record_id, action, old_data, new_data, changed_by)
  values (
    tg_table_name,
    nullif(v_row ->> 'id', '')::uuid,
    tg_op,
    case when tg_op <> 'INSERT' then to_jsonb(old) end,
    case when tg_op <> 'DELETE' then to_jsonb(new) end,
    case when exists (select 1 from public.users where id = v_uid) then v_uid end
  );
  return null;
end;
$$;

create or replace function public.attach_audit(p_table text)
returns void
language plpgsql
as $$
begin
  execute format('drop trigger if exists audit_%1$s on public.%1$s', p_table);
  execute format('create trigger audit_%1$s after insert or update or delete on public.%1$s for each row execute function public.audit_trigger()', p_table);
end;
$$;

-- Penomoran dokumen: PREFIX-YYMM-0001 (sequence per jenis dokumen).
create or replace function public.next_doc_number(p_prefix text, p_seq text, p_date date default null, p_pad int default 4)
returns text
language sql
volatile
as $$
  select p_prefix || '-' || to_char(coalesce(p_date, public.jakarta_today()), 'YYMM') || '-' || lpad(nextval(p_seq)::text, p_pad, '0');
$$;

create sequence if not exists public.material_item_seq;
create sequence if not exists public.supplier_seq;
create sequence if not exists public.employee_seq;
create sequence if not exists public.txn_seq;

-- ---------------------------------------------------------------------
-- KATEGORI & SPESIFIKASI DINAMIS
-- ---------------------------------------------------------------------
create table if not exists public.material_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 1 and 80),
  description text,
  default_unit text not null default 'pcs',
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Definisi field spesifikasi per kategori (admin bisa tambah/ubah tanpa ubah aplikasi).
create table if not exists public.material_specifications (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.material_categories (id) on delete cascade,
  key text not null check (key ~ '^[a-z][a-z0-9_]{0,39}$'),
  label text not null check (char_length(label) between 1 and 60),
  field_type text not null default 'text' check (field_type in ('text', 'number', 'select')),
  options text[] not null default '{}',
  unit text,
  is_required boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (category_id, key)
);

create table if not exists public.material_items (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default ('MAT-' || lpad(nextval('public.material_item_seq')::text, 4, '0')),
  category_id uuid not null references public.material_categories (id) on delete restrict,
  name text not null check (char_length(name) between 1 and 160),
  brand text,
  specs jsonb not null default '{}'::jsonb check (jsonb_typeof(specs) = 'object'),
  unit text not null default 'pcs' check (char_length(unit) between 1 and 20),
  min_stock numeric(14, 2) not null default 0 check (min_stock >= 0),
  photo_url text,
  notes text,
  is_active boolean not null default true,
  deleted_at timestamptz,
  created_by uuid references public.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists material_items_category_idx on public.material_items (category_id);
create index if not exists material_items_name_idx on public.material_items (lower(name));

-- ---------------------------------------------------------------------
-- SUPPLIER & HARGA PER SUPPLIER (satu bahan → banyak supplier)
-- ---------------------------------------------------------------------
create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default ('SUP-' || lpad(nextval('public.supplier_seq')::text, 4, '0')),
  name text not null check (char_length(name) between 2 and 160),
  contact_person text,
  address text,
  whatsapp text,
  category text,
  notes text,
  is_active boolean not null default true,
  deleted_at timestamptz,
  created_by uuid references public.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists suppliers_name_idx on public.suppliers (lower(name));

create table if not exists public.supplier_products (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers (id) on delete cascade,
  material_item_id uuid not null references public.material_items (id) on delete cascade,
  supplier_sku text,
  price numeric(14, 2) not null check (price >= 0),
  unit text,
  price_updated_at date not null default public.jakarta_today(),
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (supplier_id, material_item_id)
);
create index if not exists supplier_products_item_idx on public.supplier_products (material_item_id);

create table if not exists public.supplier_price_history (
  id uuid primary key default gen_random_uuid(),
  supplier_product_id uuid not null references public.supplier_products (id) on delete cascade,
  supplier_id uuid not null references public.suppliers (id) on delete cascade,
  material_item_id uuid not null references public.material_items (id) on delete cascade,
  old_price numeric(14, 2),
  new_price numeric(14, 2) not null,
  changed_by uuid references public.users (id) on delete set null default auth.uid(),
  changed_at timestamptz not null default now()
);
create index if not exists supplier_price_history_idx on public.supplier_price_history (material_item_id, changed_at desc);

create or replace function public.supplier_products_price_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.price is distinct from old.price then
    new.price_updated_at := public.jakarta_today();
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.supplier_products_price_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' or new.price is distinct from old.price then
    insert into public.supplier_price_history (supplier_product_id, supplier_id, material_item_id, old_price, new_price, changed_by)
    values (new.id, new.supplier_id, new.material_item_id, case when tg_op = 'UPDATE' then old.price end, new.price,
            case when exists (select 1 from public.users where id = (select auth.uid())) then (select auth.uid()) end);
  end if;
  return null;
end;
$$;

drop trigger if exists supplier_products_before on public.supplier_products;
create trigger supplier_products_before before update on public.supplier_products
  for each row execute function public.supplier_products_price_log();
drop trigger if exists supplier_products_after on public.supplier_products;
create trigger supplier_products_after after insert or update on public.supplier_products
  for each row execute function public.supplier_products_price_history();

-- ---------------------------------------------------------------------
-- JABATAN & PEGAWAI
-- ---------------------------------------------------------------------
create table if not exists public.positions (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 1 and 80),
  description text,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  employee_number text not null unique default ('PGW-' || lpad(nextval('public.employee_seq')::text, 4, '0')),
  full_name text not null check (char_length(full_name) between 2 and 120),
  photo_path text,
  gender text check (gender in ('L', 'P')),
  birth_place text,
  birth_date date,
  address text,
  phone text,
  emergency_contact_name text,
  emergency_contact_relation text,
  emergency_contact_phone text,
  position_id uuid references public.positions (id) on delete restrict,
  start_date date,
  end_date date,
  status text not null default 'active' check (status in ('active', 'inactive', 'resigned')),
  notes text,
  deleted_at timestamptz,
  created_by uuid references public.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists employees_status_idx on public.employees (status);

-- Data gaji dipisah agar bisa dikunci khusus admin utama (RLS berbeda).
create table if not exists public.employee_pay_settings (
  employee_id uuid primary key references public.employees (id) on delete cascade,
  pay_type text not null default 'daily' check (pay_type in ('daily', 'monthly', 'project')),
  daily_wage numeric(14, 2) not null default 0 check (daily_wage >= 0),
  monthly_salary numeric(14, 2) not null default 0 check (monthly_salary >= 0),
  working_days_per_month int not null default 26 check (working_days_per_month between 1 and 31),
  default_allowance numeric(14, 2) not null default 0 check (default_allowance >= 0),
  default_incentive numeric(14, 2) not null default 0 check (default_incentive >= 0),
  commission_note text,
  updated_at timestamptz not null default now()
);

create table if not exists public.employee_documents (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete cascade,
  doc_type text not null default 'ktp' check (doc_type in ('ktp', 'kk', 'npwp', 'bpjs', 'kontrak', 'ijazah', 'lainnya')),
  file_path text not null,
  file_name text not null,
  mime_type text,
  size_bytes int,
  uploaded_by uuid references public.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists employee_documents_emp_idx on public.employee_documents (employee_id);

-- ---------------------------------------------------------------------
-- AKUN KAS & BUKU KAS (satu sumber kebenaran arus kas)
-- ---------------------------------------------------------------------
create table if not exists public.cash_accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 1 and 80),
  kind text not null default 'bank' check (kind in ('cash', 'bank', 'ewallet')),
  account_number text,
  opening_balance numeric(14, 2) not null default 0,
  opening_date date not null default public.jakarta_today(),
  is_default boolean not null default false,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- PROYEK: dibuat otomatis untuk setiap order (data konsumen tetap di orders).
-- ---------------------------------------------------------------------
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders (id) on delete cascade,
  work_type text,
  specs jsonb not null default '{}'::jsonb check (jsonb_typeof(specs) = 'object'),
  manager_id uuid references public.employees (id) on delete set null,
  start_date date,
  target_end_date date,
  actual_end_date date,
  estimated_days int check (estimated_days is null or estimated_days >= 0),
  progress numeric(5, 2) not null default 0 check (progress between 0 and 100),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (target_end_date is null or start_date is null or target_end_date >= start_date)
);

create or replace function public.orders_create_project()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.projects (order_id, work_type) values (new.id, new.category) on conflict (order_id) do nothing;
  return null;
end;
$$;
drop trigger if exists orders_create_project on public.orders;
create trigger orders_create_project after insert on public.orders
  for each row execute function public.orders_create_project();

-- Order lama: buat proyeknya sekarang.
insert into public.projects (order_id, work_type)
select o.id, o.category from public.orders o
on conflict (order_id) do nothing;

-- ---------------------------------------------------------------------
-- BUKU KAS
-- ---------------------------------------------------------------------
create table if not exists public.financial_transactions (
  id uuid primary key default gen_random_uuid(),
  txn_number text not null unique,
  txn_date date not null default public.jakarta_today(),
  account_id uuid not null references public.cash_accounts (id) on delete restrict,
  direction text not null check (direction in ('in', 'out')),
  amount numeric(14, 2) not null check (amount > 0),
  category text not null check (category in (
    'customer_payment', 'capital_in', 'other_income', 'transfer_in',
    'material_purchase', 'material', 'labor', 'salary', 'employee_loan',
    'workshop', 'transport', 'installation', 'utilities', 'marketing', 'admin', 'contingency', 'other_expense',
    'owner_withdrawal', 'transfer_out'
  )),
  project_id uuid references public.projects (id) on delete set null,
  order_id uuid references public.orders (id) on delete set null,
  source_type text not null default 'manual' check (source_type in ('manual', 'order_payment', 'purchase_payment', 'project_expense', 'employee_loan', 'payroll', 'transfer')),
  source_id uuid,
  description text,
  reference text,
  created_by uuid references public.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((direction = 'in') = (category in ('customer_payment', 'capital_in', 'other_income', 'transfer_in'))),
  check ((source_type = 'manual') = (source_id is null) or source_type = 'transfer')
);
-- Satu sumber transaksi hanya boleh tercatat sekali di buku kas.
create unique index if not exists financial_transactions_source_uidx
  on public.financial_transactions (source_type, source_id) where source_id is not null and source_type <> 'transfer';
create index if not exists financial_transactions_date_idx on public.financial_transactions (txn_date);
create index if not exists financial_transactions_project_idx on public.financial_transactions (project_id);

create or replace function public.financial_transactions_before()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' and (new.txn_number is null or new.txn_number = '') then
    new.txn_number := public.next_doc_number('TRX', 'public.txn_seq', new.txn_date, 5);
  end if;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists financial_transactions_before on public.financial_transactions;
create trigger financial_transactions_before before insert or update on public.financial_transactions
  for each row execute function public.financial_transactions_before();

-- Akun default untuk pembayaran otomatis: tunai → akun kas default, lainnya → bank default.
create or replace function public.default_cash_account(p_method text default 'transfer')
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.cash_accounts
  where is_active
  order by (kind = case when p_method = 'cash' then 'cash' else 'bank' end) desc, is_default desc, created_at
  limit 1;
$$;

-- Tulis / perbarui / hapus baris buku kas untuk sumber otomatis (dipakai trigger modul lain).
create or replace function public.sync_ledger(
  p_source_type text, p_source_id uuid, p_active boolean,
  p_date date, p_account uuid, p_direction text, p_amount numeric, p_category text,
  p_project uuid, p_order uuid, p_description text, p_reference text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not p_active or coalesce(p_amount, 0) <= 0 then
    delete from public.financial_transactions where source_type = p_source_type and source_id = p_source_id;
    return;
  end if;
  if p_account is null then
    raise exception 'Belum ada akun kas aktif. Tambahkan akun di menu Keuangan → Akun Kas.';
  end if;
  insert into public.financial_transactions (txn_date, account_id, direction, amount, category, project_id, order_id, source_type, source_id, description, reference)
  values (p_date, p_account, p_direction, p_amount, p_category, p_project, p_order, p_source_type, p_source_id, p_description, p_reference)
  on conflict (source_type, source_id) where source_id is not null and source_type <> 'transfer'
  do update set txn_date = excluded.txn_date, account_id = excluded.account_id, direction = excluded.direction,
    amount = excluded.amount, category = excluded.category, project_id = excluded.project_id, order_id = excluded.order_id,
    description = excluded.description, reference = excluded.reference;
end;
$$;

-- Pembayaran konsumen (order_payments) → kas masuk.
alter table public.order_payments add column if not exists account_id uuid references public.cash_accounts (id) on delete restrict;

create or replace function public.order_payments_ledger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project uuid;
  v_label text;
begin
  if tg_op = 'DELETE' then
    perform public.sync_ledger('order_payment', old.id, false, null, null, null, 0, null, null, null, null);
    return null;
  end if;
  select p.id, o.order_number || ' · ' || o.customer_name into v_project, v_label
  from public.orders o left join public.projects p on p.order_id = o.id where o.id = new.order_id;
  perform public.sync_ledger('order_payment', new.id, true, new.paid_at,
    coalesce(new.account_id, public.default_cash_account(new.method)), 'in', new.amount, 'customer_payment',
    v_project, new.order_id, 'Pembayaran ' || upper(new.kind) || ' ' || coalesce(v_label, ''), new.reference);
  return null;
end;
$$;
drop trigger if exists order_payments_ledger on public.order_payments;
create trigger order_payments_ledger after insert or update or delete on public.order_payments
  for each row execute function public.order_payments_ledger();

-- ---------------------------------------------------------------------
-- updated_at, audit
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['material_categories', 'material_items', 'suppliers', 'employees', 'employee_pay_settings', 'projects'] loop
    execute format('drop trigger if exists touch_%1$s on public.%1$s', t);
    execute format('create trigger touch_%1$s before update on public.%1$s for each row execute function public.touch_updated_at()', t);
  end loop;
  foreach t in array array['suppliers', 'supplier_products', 'material_items', 'employees', 'employee_pay_settings', 'employee_documents', 'cash_accounts', 'financial_transactions', 'projects'] loop
    perform public.attach_audit(t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  -- Operasional: admin & editor.
  foreach t in array array['material_categories', 'material_specifications', 'material_items', 'suppliers', 'supplier_products', 'positions', 'employees', 'projects'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "admin all %1$s" on public.%1$s', t);
    execute format('create policy "admin all %1$s" on public.%1$s for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
  -- Sensitif: admin utama saja.
  foreach t in array array['employee_pay_settings', 'employee_documents', 'cash_accounts'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "owner all %1$s" on public.%1$s', t);
    execute format('create policy "owner all %1$s" on public.%1$s for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin())', t);
  end loop;
end $$;

alter table public.supplier_price_history enable row level security;
drop policy if exists "admin read supplier_price_history" on public.supplier_price_history;
create policy "admin read supplier_price_history" on public.supplier_price_history for select to authenticated using (public.is_admin());

alter table public.audit_logs enable row level security;
drop policy if exists "owner read audit_logs" on public.audit_logs;
create policy "owner read audit_logs" on public.audit_logs for select to authenticated using (public.is_super_admin());

-- Buku kas: hanya baris manual yang boleh diubah langsung; baris otomatis dikelola trigger.
alter table public.financial_transactions enable row level security;
drop policy if exists "owner read financial_transactions" on public.financial_transactions;
create policy "owner read financial_transactions" on public.financial_transactions for select to authenticated using (public.is_super_admin());
drop policy if exists "owner insert manual financial_transactions" on public.financial_transactions;
create policy "owner insert manual financial_transactions" on public.financial_transactions for insert to authenticated
  with check (public.is_super_admin() and source_type = 'manual');
drop policy if exists "owner update manual financial_transactions" on public.financial_transactions;
create policy "owner update manual financial_transactions" on public.financial_transactions for update to authenticated
  using (public.is_super_admin() and source_type = 'manual') with check (public.is_super_admin() and source_type = 'manual');
drop policy if exists "owner delete manual financial_transactions" on public.financial_transactions;
create policy "owner delete manual financial_transactions" on public.financial_transactions for delete to authenticated
  using (public.is_super_admin() and source_type in ('manual', 'transfer'));

revoke all on public.audit_logs, public.material_categories, public.material_specifications, public.material_items, public.suppliers,
  public.supplier_products, public.supplier_price_history, public.positions, public.employees, public.employee_pay_settings,
  public.employee_documents, public.cash_accounts, public.financial_transactions, public.projects from anon;
grant select, insert, update, delete on public.audit_logs, public.material_categories, public.material_specifications, public.material_items, public.suppliers,
  public.supplier_products, public.supplier_price_history, public.positions, public.employees, public.employee_pay_settings,
  public.employee_documents, public.cash_accounts, public.financial_transactions, public.projects to authenticated;
grant all on public.audit_logs, public.material_categories, public.material_specifications, public.material_items, public.suppliers,
  public.supplier_products, public.supplier_price_history, public.positions, public.employees, public.employee_pay_settings,
  public.employee_documents, public.cash_accounts, public.financial_transactions, public.projects to service_role;
grant usage, select on sequence public.material_item_seq, public.supplier_seq, public.employee_seq, public.txn_seq to authenticated, service_role;
revoke all on function public.sync_ledger(text, uuid, boolean, date, uuid, text, numeric, text, uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.audit_trigger() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- STORAGE PRIVAT: KTP, dokumen & foto pegawai (akses lewat signed URL).
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('hr-private', 'hr-private', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "owner read hr-private" on storage.objects;
create policy "owner read hr-private" on storage.objects for select to authenticated using (bucket_id = 'hr-private' and public.is_super_admin());
drop policy if exists "owner insert hr-private" on storage.objects;
create policy "owner insert hr-private" on storage.objects for insert to authenticated with check (bucket_id = 'hr-private' and public.is_super_admin());
drop policy if exists "owner update hr-private" on storage.objects;
create policy "owner update hr-private" on storage.objects for update to authenticated using (bucket_id = 'hr-private' and public.is_super_admin());
drop policy if exists "owner delete hr-private" on storage.objects;
create policy "owner delete hr-private" on storage.objects for delete to authenticated using (bucket_id = 'hr-private' and public.is_super_admin());

-- ---------------------------------------------------------------------
-- DATA AWAL
-- ---------------------------------------------------------------------
insert into public.cash_accounts (name, kind, is_default, notes)
values ('Kas Tunai', 'cash', true, 'Uang tunai di kantor/workshop'), ('Rekening Bank Utama', 'bank', true, 'Ubah nama & nomor rekening sesuai bank perusahaan')
on conflict (name) do nothing;

insert into public.positions (name, sort_order) values
  ('Direktur', 1), ('Manajer Operasional', 2), ('Kepala Workshop', 3), ('Kepala Produksi', 4), ('Tukang Furniture', 5),
  ('Tukang Finishing', 6), ('Helper', 7), ('Tim Pemasangan', 8), ('Administrasi', 9)
on conflict (name) do nothing;

insert into public.material_categories (name, default_unit, sort_order) values
  ('Multiplek', 'lembar', 1), ('Blockboard', 'lembar', 2), ('MDF', 'lembar', 3), ('HPL', 'lembar', 4), ('PVC Board', 'lembar', 5),
  ('Cat Duco', 'kaleng', 6), ('Lem', 'kg', 7), ('Edging', 'roll', 8), ('Rel Laci', 'set', 9), ('Engsel', 'pcs', 10),
  ('Handle', 'pcs', 11), ('Aksesoris Furniture', 'pcs', 12), ('Aluminium', 'batang', 13), ('Kaca', 'lembar', 14),
  ('Sekrup & Perlengkapan Pemasangan', 'box', 15), ('Material Finishing', 'pcs', 16), ('Bahan Pendukung Lainnya', 'pcs', 17)
on conflict (name) do nothing;

insert into public.material_specifications (category_id, key, label, field_type, options, unit, sort_order)
select c.id, s.key, s.label, s.field_type, s.options, s.unit, s.ord
from (values
  ('Multiplek', 'ketebalan', 'Ketebalan', 'select', array['3', '4', '6', '9', '12', '15', '18'], 'mm', 1),
  ('Multiplek', 'ukuran', 'Ukuran lembar', 'text', '{}'::text[], 'cm', 2),
  ('Multiplek', 'grade', 'Grade / kualitas', 'text', '{}'::text[], null, 3),
  ('Blockboard', 'ketebalan', 'Ketebalan', 'select', array['12', '15', '18'], 'mm', 1),
  ('Blockboard', 'ukuran', 'Ukuran lembar', 'text', '{}'::text[], 'cm', 2),
  ('MDF', 'ketebalan', 'Ketebalan', 'select', array['3', '6', '9', '12', '15', '18'], 'mm', 1),
  ('MDF', 'ukuran', 'Ukuran lembar', 'text', '{}'::text[], 'cm', 2),
  ('MDF', 'jenis', 'Jenis', 'select', array['MDF biasa', 'MDF HMR (tahan lembap)', 'MDF lapis HPL'], null, 3),
  ('HPL', 'kode_warna', 'Kode warna', 'text', '{}'::text[], null, 1),
  ('HPL', 'motif', 'Motif / corak', 'text', '{}'::text[], null, 2),
  ('HPL', 'tekstur', 'Tekstur', 'select', array['Doff', 'Glossy', 'Super glossy', 'Texture', 'Woodgrain'], null, 3),
  ('HPL', 'finishing', 'Jenis finishing', 'text', '{}'::text[], null, 4),
  ('PVC Board', 'ketebalan', 'Ketebalan', 'select', array['3', '5', '8', '9', '12', '15', '18'], 'mm', 1),
  ('PVC Board', 'ukuran', 'Ukuran lembar', 'text', '{}'::text[], 'cm', 2),
  ('PVC Board', 'warna', 'Warna', 'text', '{}'::text[], null, 3),
  ('Cat Duco', 'warna', 'Warna', 'text', '{}'::text[], null, 1),
  ('Cat Duco', 'kode_warna', 'Kode warna', 'text', '{}'::text[], null, 2),
  ('Cat Duco', 'jenis_cat', 'Jenis cat', 'select', array['NC', 'PU', 'Waterbased', 'Epoxy', 'Dempul', 'Thinner', 'Sanding sealer'], null, 3),
  ('Cat Duco', 'kemasan', 'Ukuran kemasan', 'text', '{}'::text[], null, 4),
  ('Lem', 'jenis', 'Jenis lem', 'select', array['Lem kuning', 'Lem putih', 'Lem epoxy', 'Lem silikon', 'Lem tembak'], null, 1),
  ('Lem', 'kemasan', 'Ukuran kemasan', 'text', '{}'::text[], null, 2),
  ('Edging', 'bahan', 'Bahan', 'select', array['PVC', 'ABS', 'HPL'], null, 1),
  ('Edging', 'lebar', 'Lebar', 'number', '{}'::text[], 'mm', 2),
  ('Edging', 'tebal', 'Tebal', 'number', '{}'::text[], 'mm', 3),
  ('Edging', 'kode_warna', 'Kode warna', 'text', '{}'::text[], null, 4),
  ('Rel Laci', 'ukuran', 'Panjang', 'select', array['25', '30', '35', '40', '45', '50', '55', '60'], 'cm', 1),
  ('Rel Laci', 'jenis_rel', 'Jenis rel', 'select', array['Double track', 'Ball bearing / full extension', 'Tandem / undermount', 'Push open'], null, 2),
  ('Rel Laci', 'soft_close', 'Soft close', 'select', array['Ya', 'Tidak'], null, 3),
  ('Engsel', 'jenis', 'Jenis engsel', 'select', array['Sendok / slowmotion', 'Sendok biasa', 'Clip on', 'Push open', 'Lift up', 'Kupu-kupu'], null, 1),
  ('Engsel', 'ukuran', 'Tipe dudukan', 'select', array['Lurus (full overlay)', 'Bengkok sedang (half overlay)', 'Bengkok penuh (inset)'], null, 2),
  ('Engsel', 'soft_close', 'Soft close', 'select', array['Ya', 'Tidak'], null, 3),
  ('Handle', 'model', 'Model', 'text', '{}'::text[], null, 1),
  ('Handle', 'panjang', 'Panjang / jarak lubang', 'number', '{}'::text[], 'mm', 2),
  ('Handle', 'warna', 'Warna / finishing', 'text', '{}'::text[], null, 3),
  ('Aksesoris Furniture', 'jenis', 'Jenis aksesoris', 'text', '{}'::text[], null, 1),
  ('Aksesoris Furniture', 'ukuran', 'Ukuran', 'text', '{}'::text[], null, 2),
  ('Aluminium', 'profil', 'Profil', 'text', '{}'::text[], null, 1),
  ('Aluminium', 'panjang', 'Panjang', 'number', '{}'::text[], 'm', 2),
  ('Aluminium', 'warna', 'Warna', 'text', '{}'::text[], null, 3),
  ('Kaca', 'ketebalan', 'Ketebalan', 'select', array['3', '5', '6', '8', '10', '12'], 'mm', 1),
  ('Kaca', 'jenis', 'Jenis kaca', 'select', array['Bening', 'Riben / gelap', 'Cermin', 'Tempered', 'Buram / sandblast'], null, 2),
  ('Kaca', 'ukuran', 'Ukuran', 'text', '{}'::text[], 'cm', 3),
  ('Sekrup & Perlengkapan Pemasangan', 'jenis', 'Jenis', 'text', '{}'::text[], null, 1),
  ('Sekrup & Perlengkapan Pemasangan', 'ukuran', 'Ukuran', 'text', '{}'::text[], null, 2),
  ('Material Finishing', 'jenis', 'Jenis', 'text', '{}'::text[], null, 1),
  ('Material Finishing', 'warna', 'Warna', 'text', '{}'::text[], null, 2),
  ('Bahan Pendukung Lainnya', 'keterangan', 'Keterangan', 'text', '{}'::text[], null, 1)
) as s(cat, key, label, field_type, options, unit, ord)
join public.material_categories c on c.name = s.cat
on conflict (category_id, key) do nothing;

-- Bahan baku umum sebagai titik awal (harga diisi per supplier).
insert into public.material_items (category_id, name, specs, unit)
select c.id, s.name, s.specs::jsonb, s.unit
from (values
  ('Multiplek', 'Multiplek 18 mm', '{"ketebalan":"18","ukuran":"122 x 244"}', 'lembar'),
  ('Multiplek', 'Multiplek 9 mm', '{"ketebalan":"9","ukuran":"122 x 244"}', 'lembar'),
  ('Multiplek', 'Multiplek 3 mm', '{"ketebalan":"3","ukuran":"122 x 244"}', 'lembar'),
  ('HPL', 'HPL (warna sesuai pilihan)', '{"tekstur":"Doff"}', 'lembar'),
  ('Lem', 'Lem kuning', '{"jenis":"Lem kuning"}', 'kg'),
  ('Edging', 'Edging PVC', '{"bahan":"PVC","lebar":"22","tebal":"1"}', 'meter'),
  ('Engsel', 'Engsel sendok slowmotion', '{"jenis":"Sendok / slowmotion","ukuran":"Lurus (full overlay)","soft_close":"Ya"}', 'pcs'),
  ('Rel Laci', 'Rel laci full extension 45 cm', '{"ukuran":"45","jenis_rel":"Ball bearing / full extension","soft_close":"Tidak"}', 'set'),
  ('Handle', 'Handle tarik', '{}', 'pcs'),
  ('Sekrup & Perlengkapan Pemasangan', 'Sekrup & fischer', '{}', 'box')
) as s(cat, name, specs, unit)
join public.material_categories c on c.name = s.cat
where not exists (select 1 from public.material_items m where lower(m.name) = lower(s.name));
