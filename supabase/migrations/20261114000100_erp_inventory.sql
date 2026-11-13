-- =====================================================================
-- ERP 2/5 — PEMBELIAN & PERSEDIAAN
--
-- Alur: purchase_orders (+items) → terima barang (receive_purchase_order)
--       → inventory (1 baris = 1 lot pembelian) + inventory_movements 'in'
--       → alokasi ke proyek (project_material_allocations, stok TIDAK berkurang)
--       → pemakaian (project_material_usage, stok fisik berkurang).
--
-- Stok per lot:
--   qty_on_hand   = stok fisik (jumlah seluruh mutasi)
--   qty_allocated = sudah dipesan proyek tapi belum dipakai
--   tersedia      = qty_on_hand - qty_allocated
-- Kuantitas HANYA berubah lewat fungsi stok (security definer + cek is_admin),
-- dengan constraint qty_on_hand >= 0 dan qty_allocated <= qty_on_hand.
-- Setiap mutasi unik per (reference_type, reference_id, movement_type) → tidak dobel.
-- =====================================================================

create sequence if not exists public.po_seq;
create sequence if not exists public.stock_seq;

create table if not exists public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  po_number text not null unique,
  supplier_id uuid not null references public.suppliers (id) on delete restrict,
  project_id uuid references public.projects (id) on delete set null,
  order_date date not null default public.jakarta_today(),
  invoice_number text,
  status text not null default 'draft' check (status in ('draft', 'ordered', 'received', 'cancelled')),
  expected_date date,
  received_at date,
  due_date date,
  subtotal numeric(14, 2) not null default 0 check (subtotal >= 0),
  discount numeric(14, 2) not null default 0 check (discount >= 0),
  shipping_cost numeric(14, 2) not null default 0 check (shipping_cost >= 0),
  total numeric(14, 2) generated always as (greatest(subtotal - discount + shipping_cost, 0)) stored,
  paid_amount numeric(14, 2) not null default 0 check (paid_amount >= 0),
  notes text,
  created_by uuid references public.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists purchase_orders_supplier_idx on public.purchase_orders (supplier_id);
create index if not exists purchase_orders_project_idx on public.purchase_orders (project_id);
create index if not exists purchase_orders_date_idx on public.purchase_orders (order_date);

create table if not exists public.purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.purchase_orders (id) on delete cascade,
  material_item_id uuid not null references public.material_items (id) on delete restrict,
  description text,
  qty numeric(14, 2) not null check (qty > 0),
  unit text not null default 'pcs',
  unit_price numeric(14, 2) not null default 0 check (unit_price >= 0),
  line_total numeric(14, 2) generated always as (round(qty * unit_price, 2)) stored,
  project_id uuid references public.projects (id) on delete set null,
  sort_order int not null default 0
);
create index if not exists purchase_order_items_po_idx on public.purchase_order_items (purchase_order_id);
create index if not exists purchase_order_items_item_idx on public.purchase_order_items (material_item_id);

create table if not exists public.purchase_payments (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.purchase_orders (id) on delete restrict,
  paid_at date not null default public.jakarta_today(),
  amount numeric(14, 2) not null check (amount > 0),
  account_id uuid not null references public.cash_accounts (id) on delete restrict,
  reference text,
  note text,
  created_by uuid references public.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists purchase_payments_po_idx on public.purchase_payments (purchase_order_id);

create table if not exists public.inventory (
  id uuid primary key default gen_random_uuid(),
  stock_code text not null unique,
  material_item_id uuid not null references public.material_items (id) on delete restrict,
  supplier_id uuid references public.suppliers (id) on delete set null,
  purchase_order_item_id uuid unique references public.purchase_order_items (id) on delete restrict,
  invoice_number text,
  purchase_date date not null default public.jakarta_today(),
  qty_in numeric(14, 2) not null check (qty_in > 0),
  unit text not null default 'pcs',
  unit_cost numeric(14, 2) not null default 0 check (unit_cost >= 0),
  total_cost numeric(14, 2) generated always as (round(qty_in * unit_cost, 2)) stored,
  location text,
  specs jsonb not null default '{}'::jsonb check (jsonb_typeof(specs) = 'object'),
  photo_url text,
  notes text,
  qty_on_hand numeric(14, 2) not null default 0 check (qty_on_hand >= 0),
  qty_allocated numeric(14, 2) not null default 0 check (qty_allocated >= 0),
  qty_used numeric(14, 2) not null default 0,
  qty_damaged numeric(14, 2) not null default 0,
  qty_returned numeric(14, 2) not null default 0,
  created_by uuid references public.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inventory_allocated_le_on_hand check (qty_allocated <= qty_on_hand)
);
create index if not exists inventory_item_idx on public.inventory (material_item_id);

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  inventory_id uuid not null references public.inventory (id) on delete restrict,
  material_item_id uuid not null references public.material_items (id) on delete restrict,
  movement_type text not null check (movement_type in ('in', 'usage', 'damaged', 'return_supplier', 'return_from_project', 'adjustment_plus', 'adjustment_minus')),
  qty numeric(14, 2) not null check (qty > 0),
  project_id uuid references public.projects (id) on delete set null,
  reference_type text not null,
  reference_id uuid not null,
  reason text,
  moved_at date not null default public.jakarta_today(),
  created_by uuid references public.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  unique (reference_type, reference_id, movement_type)
);
create index if not exists inventory_movements_inv_idx on public.inventory_movements (inventory_id, created_at desc);
create index if not exists inventory_movements_project_idx on public.inventory_movements (project_id);

create table if not exists public.project_material_allocations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete restrict,
  inventory_id uuid not null references public.inventory (id) on delete restrict,
  qty_allocated numeric(14, 2) not null check (qty_allocated > 0),
  qty_consumed numeric(14, 2) not null default 0 check (qty_consumed >= 0),
  qty_released numeric(14, 2) not null default 0 check (qty_released >= 0),
  notes text,
  created_by uuid references public.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (qty_consumed + qty_released <= qty_allocated)
);
create index if not exists allocations_project_idx on public.project_material_allocations (project_id);
create index if not exists allocations_inventory_idx on public.project_material_allocations (inventory_id);

create table if not exists public.project_material_usage (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete restrict,
  inventory_id uuid not null references public.inventory (id) on delete restrict,
  allocation_id uuid references public.project_material_allocations (id) on delete restrict,
  kind text not null default 'used' check (kind in ('used', 'damaged', 'returned')),
  qty numeric(14, 2) not null check (qty > 0),
  qty_from_allocation numeric(14, 2) not null default 0,
  unit_cost numeric(14, 2) not null default 0,
  usage_date date not null default public.jakarta_today(),
  notes text,
  created_by uuid references public.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists usage_project_idx on public.project_material_usage (project_id);

-- ---------------------------------------------------------------------
-- Trigger: nomor dokumen, total PO, kunci PO yang sudah diterima.
-- ---------------------------------------------------------------------
create or replace function public.purchase_orders_before()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' and (new.po_number is null or new.po_number = '') then
    new.po_number := public.next_doc_number('PO', 'public.po_seq', new.order_date);
  end if;
  if tg_op = 'UPDATE' and old.status = 'received' and current_setting('app.stock_rpc', true) is distinct from 'on' then
    if new.supplier_id <> old.supplier_id or new.subtotal <> old.subtotal or new.discount <> old.discount
       or new.shipping_cost <> old.shipping_cost or new.status <> old.status then
      raise exception 'PO % sudah diterima. Nilai & status tidak bisa diubah (gunakan retur ke supplier).', old.po_number;
    end if;
  end if;
  if tg_op = 'UPDATE' and new.status = 'cancelled' and old.status <> 'cancelled' and old.paid_amount > 0 then
    raise exception 'PO sudah ada pembayaran. Hapus pembayaran dulu sebelum membatalkan.';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists purchase_orders_before on public.purchase_orders;
create trigger purchase_orders_before before insert or update on public.purchase_orders
  for each row execute function public.purchase_orders_before();

create or replace function public.recalc_purchase_order(p_po uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('app.stock_rpc', 'on', true);
  update public.purchase_orders po set
    subtotal = coalesce((select sum(line_total) from public.purchase_order_items i where i.purchase_order_id = po.id), 0),
    paid_amount = coalesce((select sum(amount) from public.purchase_payments p where p.purchase_order_id = po.id), 0)
  where po.id = p_po;
  perform set_config('app.stock_rpc', 'off', true);
  if exists (select 1 from public.purchase_orders where id = p_po and paid_amount > total + 0.009) then
    raise exception 'Total pembayaran melebihi total PO';
  end if;
end;
$$;

create or replace function public.purchase_order_items_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_po uuid := coalesce(new.purchase_order_id, old.purchase_order_id);
begin
  if exists (select 1 from public.purchase_orders where id = v_po and status in ('received', 'cancelled'))
     and current_setting('app.stock_rpc', true) is distinct from 'on' then
    raise exception 'Item PO yang sudah diterima/dibatalkan tidak bisa diubah';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
drop trigger if exists purchase_order_items_guard on public.purchase_order_items;
create trigger purchase_order_items_guard before insert or update or delete on public.purchase_order_items
  for each row execute function public.purchase_order_items_guard();

create or replace function public.purchase_children_changed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.recalc_purchase_order(coalesce(new.purchase_order_id, old.purchase_order_id));
  return null;
end;
$$;
drop trigger if exists purchase_order_items_changed on public.purchase_order_items;
create trigger purchase_order_items_changed after insert or update or delete on public.purchase_order_items
  for each row execute function public.purchase_children_changed();
drop trigger if exists purchase_payments_changed on public.purchase_payments;
create trigger purchase_payments_changed after insert or update or delete on public.purchase_payments
  for each row execute function public.purchase_children_changed();

-- Pembayaran ke supplier → kas keluar (kategori pembelian material).
create or replace function public.purchase_payments_ledger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_po record;
begin
  if tg_op = 'DELETE' then
    perform public.sync_ledger('purchase_payment', old.id, false, null, null, null, 0, null, null, null, null);
    return null;
  end if;
  select po.po_number, po.project_id, s.name as supplier into v_po
  from public.purchase_orders po join public.suppliers s on s.id = po.supplier_id where po.id = new.purchase_order_id;
  if exists (select 1 from public.purchase_orders where id = new.purchase_order_id and status in ('draft', 'cancelled')) then
    raise exception 'Pembayaran hanya untuk PO berstatus Dipesan atau Diterima';
  end if;
  perform public.sync_ledger('purchase_payment', new.id, true, new.paid_at, new.account_id, 'out', new.amount, 'material_purchase',
    v_po.project_id, null, 'Bayar ' || v_po.po_number || ' · ' || v_po.supplier, new.reference);
  return null;
end;
$$;
drop trigger if exists purchase_payments_ledger on public.purchase_payments;
create trigger purchase_payments_ledger after insert or update or delete on public.purchase_payments
  for each row execute function public.purchase_payments_ledger();

-- ---------------------------------------------------------------------
-- Inventory: kode stok, kunci kuantitas, mutasi otomatis saat lot dibuat.
-- ---------------------------------------------------------------------
create or replace function public.inventory_before()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.stock_code is null or new.stock_code = '' then
      new.stock_code := public.next_doc_number('STK', 'public.stock_seq', new.purchase_date, 5);
    end if;
    -- Saldo diisi oleh mutasi 'in' (trigger after insert), bukan dari input.
    new.qty_on_hand := 0;
    new.qty_allocated := 0;
    new.qty_used := 0;
    new.qty_damaged := 0;
    new.qty_returned := 0;
  elsif current_setting('app.stock_rpc', true) is distinct from 'on' then
    if new.qty_on_hand <> old.qty_on_hand or new.qty_allocated <> old.qty_allocated or new.qty_used <> old.qty_used
       or new.qty_damaged <> old.qty_damaged or new.qty_returned <> old.qty_returned or new.qty_in <> old.qty_in
       or new.unit_cost <> old.unit_cost or new.material_item_id <> old.material_item_id then
      raise exception 'Jumlah & harga stok hanya bisa diubah lewat transaksi stok (penyesuaian, pemakaian, retur)';
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists inventory_before on public.inventory;
create trigger inventory_before before insert or update on public.inventory
  for each row execute function public.inventory_before();

create or replace function public.inventory_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.inventory_movements (inventory_id, material_item_id, movement_type, qty, reference_type, reference_id, reason, moved_at)
  values (new.id, new.material_item_id, 'in', new.qty_in,
    case when new.purchase_order_item_id is null then 'stock_entry' else 'purchase_order_item' end,
    coalesce(new.purchase_order_item_id, new.id),
    case when new.purchase_order_item_id is null then 'Input stok manual' else 'Penerimaan barang PO' end,
    new.purchase_date);
  return null;
end;
$$;
drop trigger if exists inventory_after_insert on public.inventory;
create trigger inventory_after_insert after insert on public.inventory
  for each row execute function public.inventory_after_insert();

-- Mutasi → saldo lot. Mutasi tidak bisa diubah; penghapusan (koreksi lewat fungsi) membalik saldo.
create or replace function public.inventory_movements_apply()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  m record;
  s numeric := case when tg_op = 'DELETE' then -1 else 1 end;
  d_on_hand numeric := 0; d_used numeric := 0; d_damaged numeric := 0; d_returned numeric := 0;
begin
  if tg_op = 'UPDATE' then
    raise exception 'Mutasi stok tidak bisa diubah. Buat transaksi koreksi.';
  end if;
  if tg_op = 'DELETE' then m := old; else m := new; end if;
  case m.movement_type
    when 'in' then d_on_hand := m.qty;
    when 'adjustment_plus' then d_on_hand := m.qty;
    when 'adjustment_minus' then d_on_hand := -m.qty;
    when 'usage' then d_on_hand := -m.qty; d_used := m.qty;
    when 'return_from_project' then d_on_hand := m.qty; d_used := -m.qty;
    when 'damaged' then d_on_hand := -m.qty; d_damaged := m.qty;
    when 'return_supplier' then d_on_hand := -m.qty; d_returned := m.qty;
  end case;
  perform set_config('app.stock_rpc', 'on', true);
  update public.inventory set
    qty_on_hand = qty_on_hand + s * d_on_hand,
    qty_used = qty_used + s * d_used,
    qty_damaged = qty_damaged + s * d_damaged,
    qty_returned = qty_returned + s * d_returned
  where id = m.inventory_id;
  perform set_config('app.stock_rpc', 'off', true);
  return null;
exception
  when check_violation then
    raise exception 'Stok tidak mencukupi untuk transaksi ini (stok fisik tidak boleh minus / kurang dari yang sudah dialokasikan)';
end;
$$;
drop trigger if exists inventory_movements_apply on public.inventory_movements;
create trigger inventory_movements_apply after insert or update or delete on public.inventory_movements
  for each row execute function public.inventory_movements_apply();

-- Alokasi → qty_allocated lot.
create or replace function public.allocations_apply()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv uuid;
begin
  foreach v_inv in array array[old.inventory_id, new.inventory_id] loop
    continue when v_inv is null;
    perform set_config('app.stock_rpc', 'on', true);
    update public.inventory i set qty_allocated = coalesce((
      select sum(a.qty_allocated - a.qty_consumed - a.qty_released) from public.project_material_allocations a where a.inventory_id = i.id
    ), 0) where i.id = v_inv;
    perform set_config('app.stock_rpc', 'off', true);
  end loop;
  return null;
exception
  when check_violation then
    raise exception 'Stok tersedia tidak cukup untuk dialokasikan';
end;
$$;
drop trigger if exists allocations_apply on public.project_material_allocations;
create trigger allocations_apply after insert or update or delete on public.project_material_allocations
  for each row execute function public.allocations_apply();

-- ---------------------------------------------------------------------
-- FUNGSI STOK (satu transaksi database per operasi)
-- ---------------------------------------------------------------------
create or replace function public.assert_admin()
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Akses ditolak';
  end if;
end;
$$;

-- Simpan PO + item (draft/dipesan). Item diganti seluruhnya.
create or replace function public.save_purchase_order(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid := nullif(p ->> 'id', '')::uuid;
  v_status text;
begin
  perform public.assert_admin();
  if v_id is null then
    insert into public.purchase_orders (supplier_id, project_id, order_date, invoice_number, status, expected_date, due_date, discount, shipping_cost, notes)
    values ((p ->> 'supplier_id')::uuid, nullif(p ->> 'project_id', '')::uuid, coalesce(nullif(p ->> 'order_date', '')::date, public.jakarta_today()),
      nullif(p ->> 'invoice_number', ''), coalesce(nullif(p ->> 'status', ''), 'draft'), nullif(p ->> 'expected_date', '')::date,
      nullif(p ->> 'due_date', '')::date, coalesce((p ->> 'discount')::numeric, 0), coalesce((p ->> 'shipping_cost')::numeric, 0), nullif(p ->> 'notes', ''))
    returning id into v_id;
  else
    select status into v_status from public.purchase_orders where id = v_id for update;
    if v_status is null then raise exception 'PO tidak ditemukan'; end if;
    if v_status = 'received' then
      -- PO diterima: hanya info administrasi yang bisa diubah.
      update public.purchase_orders set invoice_number = nullif(p ->> 'invoice_number', ''), due_date = nullif(p ->> 'due_date', '')::date,
        notes = nullif(p ->> 'notes', '') where id = v_id;
      return v_id;
    end if;
    if v_status = 'cancelled' then raise exception 'PO dibatalkan tidak bisa diubah'; end if;
    update public.purchase_orders set supplier_id = (p ->> 'supplier_id')::uuid, project_id = nullif(p ->> 'project_id', '')::uuid,
      order_date = coalesce(nullif(p ->> 'order_date', '')::date, order_date), invoice_number = nullif(p ->> 'invoice_number', ''),
      status = coalesce(nullif(p ->> 'status', ''), status), expected_date = nullif(p ->> 'expected_date', '')::date,
      due_date = nullif(p ->> 'due_date', '')::date, discount = coalesce((p ->> 'discount')::numeric, 0),
      shipping_cost = coalesce((p ->> 'shipping_cost')::numeric, 0), notes = nullif(p ->> 'notes', '')
    where id = v_id;
    delete from public.purchase_order_items where purchase_order_id = v_id;
  end if;
  insert into public.purchase_order_items (purchase_order_id, material_item_id, description, qty, unit, unit_price, project_id, sort_order)
  select v_id, (x ->> 'material_item_id')::uuid, nullif(x ->> 'description', ''), (x ->> 'qty')::numeric, coalesce(nullif(x ->> 'unit', ''), 'pcs'),
    coalesce((x ->> 'unit_price')::numeric, 0), coalesce(nullif(x ->> 'project_id', '')::uuid, nullif(p ->> 'project_id', '')::uuid), ord::int
  from jsonb_array_elements(coalesce(p -> 'items', '[]'::jsonb)) with ordinality as t(x, ord);
  if not exists (select 1 from public.purchase_order_items where purchase_order_id = v_id) then
    raise exception 'PO minimal berisi 1 barang';
  end if;
  if (select total < 0 from public.purchase_orders where id = v_id) then raise exception 'Diskon melebihi nilai PO'; end if;
  return v_id;
end;
$$;

-- Terima barang: buat lot stok per item (biaya ongkir & diskon dibagi proporsional),
-- lalu alokasikan otomatis ke proyek tujuan item. Tidak bisa diterima dua kali.
create or replace function public.receive_purchase_order(p_po uuid, p_date date default null, p_location text default null)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_po record;
  v_item record;
  v_inv uuid;
  v_factor numeric;
  v_count int := 0;
begin
  perform public.assert_admin();
  select * into v_po from public.purchase_orders where id = p_po for update;
  if v_po.id is null then raise exception 'PO tidak ditemukan'; end if;
  if v_po.status = 'received' then raise exception 'PO % sudah pernah diterima', v_po.po_number; end if;
  if v_po.status = 'cancelled' then raise exception 'PO dibatalkan tidak bisa diterima'; end if;
  v_factor := case when v_po.subtotal > 0 then v_po.total / v_po.subtotal else 1 end;

  for v_item in
    select i.*, m.specs as item_specs from public.purchase_order_items i join public.material_items m on m.id = i.material_item_id
    where i.purchase_order_id = p_po order by i.sort_order
  loop
    insert into public.inventory (material_item_id, supplier_id, purchase_order_item_id, invoice_number, purchase_date, qty_in, unit, unit_cost, location, specs, notes)
    values (v_item.material_item_id, v_po.supplier_id, v_item.id, v_po.invoice_number, coalesce(p_date, public.jakarta_today()), v_item.qty, v_item.unit,
      round(v_item.unit_price * v_factor, 2), nullif(p_location, ''), v_item.item_specs, v_item.description)
    on conflict (purchase_order_item_id) do nothing
    returning id into v_inv;
    if v_inv is not null then
      v_count := v_count + 1;
      if v_item.project_id is not null then
        insert into public.project_material_allocations (project_id, inventory_id, qty_allocated, notes)
        values (v_item.project_id, v_inv, v_item.qty, 'Otomatis dari ' || v_po.po_number);
      end if;
    end if;
  end loop;

  perform set_config('app.stock_rpc', 'on', true);
  update public.purchase_orders set status = 'received', received_at = coalesce(p_date, public.jakarta_today()) where id = p_po;
  perform set_config('app.stock_rpc', 'off', true);
  return v_count;
end;
$$;

-- Input stok manual (stok awal / beli tanpa PO).
create or replace function public.add_stock(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  perform public.assert_admin();
  insert into public.inventory (material_item_id, supplier_id, invoice_number, purchase_date, qty_in, unit, unit_cost, location, specs, photo_url, notes)
  select (p ->> 'material_item_id')::uuid, nullif(p ->> 'supplier_id', '')::uuid, nullif(p ->> 'invoice_number', ''),
    coalesce(nullif(p ->> 'purchase_date', '')::date, public.jakarta_today()), (p ->> 'qty_in')::numeric,
    coalesce(nullif(p ->> 'unit', ''), m.unit), coalesce((p ->> 'unit_cost')::numeric, 0), nullif(p ->> 'location', ''),
    m.specs || coalesce(p -> 'specs', '{}'::jsonb), nullif(p ->> 'photo_url', ''), nullif(p ->> 'notes', '')
  from public.material_items m where m.id = (p ->> 'material_item_id')::uuid
  returning id into v_id;
  if v_id is null then raise exception 'Bahan baku tidak ditemukan'; end if;
  return v_id;
end;
$$;

-- Penyesuaian / rusak / retur ke supplier (mengurangi atau menambah stok fisik).
create or replace function public.stock_adjust(p_inventory uuid, p_type text, p_qty numeric, p_reason text, p_date date default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid := gen_random_uuid();
  v_item uuid;
begin
  perform public.assert_admin();
  if p_type not in ('adjustment_plus', 'adjustment_minus', 'damaged', 'return_supplier') then raise exception 'Jenis penyesuaian tidak valid'; end if;
  if coalesce(p_qty, 0) <= 0 then raise exception 'Jumlah harus lebih dari 0'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'Alasan wajib diisi'; end if;
  select material_item_id into v_item from public.inventory where id = p_inventory for update;
  if v_item is null then raise exception 'Stok tidak ditemukan'; end if;
  insert into public.inventory_movements (id, inventory_id, material_item_id, movement_type, qty, reference_type, reference_id, reason, moved_at)
  values (v_id, p_inventory, v_item, p_type, p_qty, 'adjustment', v_id, p_reason, coalesce(p_date, public.jakarta_today()));
  return v_id;
end;
$$;

-- Alokasi stok untuk proyek (stok fisik belum berkurang).
create or replace function public.allocate_stock(p_project uuid, p_inventory uuid, p_qty numeric, p_notes text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  perform public.assert_admin();
  if coalesce(p_qty, 0) <= 0 then raise exception 'Jumlah alokasi harus lebih dari 0'; end if;
  perform 1 from public.inventory where id = p_inventory for update;
  insert into public.project_material_allocations (project_id, inventory_id, qty_allocated, notes)
  values (p_project, p_inventory, p_qty, nullif(p_notes, '')) returning id into v_id;
  return v_id;
end;
$$;

-- Lepas sisa alokasi (kembali menjadi stok tersedia).
create or replace function public.release_allocation(p_allocation uuid, p_qty numeric default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  a record;
  v_qty numeric;
begin
  perform public.assert_admin();
  select * into a from public.project_material_allocations where id = p_allocation for update;
  if a.id is null then raise exception 'Alokasi tidak ditemukan'; end if;
  v_qty := coalesce(p_qty, a.qty_allocated - a.qty_consumed - a.qty_released);
  if v_qty <= 0 or v_qty > a.qty_allocated - a.qty_consumed - a.qty_released then raise exception 'Jumlah melebihi sisa alokasi'; end if;
  update public.project_material_allocations set qty_released = qty_released + v_qty, updated_at = now() where id = p_allocation;
end;
$$;

-- Catat pemakaian / rusak / sisa kembali ke stok untuk proyek.
--   used, damaged : dari alokasi proyek dulu (jika ada), sisanya dari stok tersedia.
--   returned      : sisa bahan proyek yang masih layak dikembalikan ke stok.
create or replace function public.record_usage(p_project uuid, p_inventory uuid, p_kind text, p_qty numeric, p_date date default null, p_notes text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid := gen_random_uuid();
  v_inv record;
  v_alloc record;
  v_from_alloc numeric := 0;
  v_net_used numeric;
begin
  perform public.assert_admin();
  if p_kind not in ('used', 'damaged', 'returned') then raise exception 'Jenis pemakaian tidak valid'; end if;
  if coalesce(p_qty, 0) <= 0 then raise exception 'Jumlah harus lebih dari 0'; end if;
  select * into v_inv from public.inventory where id = p_inventory for update;
  if v_inv.id is null then raise exception 'Stok tidak ditemukan'; end if;

  if p_kind = 'returned' then
    select coalesce(sum(case when kind = 'returned' then -qty when kind = 'used' then qty else 0 end), 0) into v_net_used
    from public.project_material_usage where project_id = p_project and inventory_id = p_inventory;
    if p_qty > v_net_used then raise exception 'Jumlah sisa melebihi bahan yang dipakai proyek dari stok ini (%)', v_net_used; end if;
    insert into public.project_material_usage (id, project_id, inventory_id, kind, qty, unit_cost, usage_date, notes)
    values (v_id, p_project, p_inventory, 'returned', p_qty, v_inv.unit_cost, coalesce(p_date, public.jakarta_today()), nullif(p_notes, ''));
    insert into public.inventory_movements (inventory_id, material_item_id, movement_type, qty, project_id, reference_type, reference_id, reason, moved_at)
    values (p_inventory, v_inv.material_item_id, 'return_from_project', p_qty, p_project, 'usage', v_id,
      coalesce(nullif(p_notes, ''), 'Sisa proyek kembali ke stok'), coalesce(p_date, public.jakarta_today()));
    return v_id;
  end if;

  select * into v_alloc from public.project_material_allocations
  where project_id = p_project and inventory_id = p_inventory and qty_allocated - qty_consumed - qty_released > 0
  order by created_at limit 1 for update;
  if v_alloc.id is not null then
    v_from_alloc := least(p_qty, v_alloc.qty_allocated - v_alloc.qty_consumed - v_alloc.qty_released);
    update public.project_material_allocations set qty_consumed = qty_consumed + v_from_alloc, updated_at = now() where id = v_alloc.id;
  end if;

  insert into public.project_material_usage (id, project_id, inventory_id, allocation_id, kind, qty, qty_from_allocation, unit_cost, usage_date, notes)
  values (v_id, p_project, p_inventory, v_alloc.id, p_kind, p_qty, v_from_alloc, v_inv.unit_cost, coalesce(p_date, public.jakarta_today()), nullif(p_notes, ''));
  insert into public.inventory_movements (inventory_id, material_item_id, movement_type, qty, project_id, reference_type, reference_id, reason, moved_at)
  values (p_inventory, v_inv.material_item_id, case when p_kind = 'used' then 'usage' else 'damaged' end, p_qty, p_project, 'usage', v_id,
    coalesce(nullif(p_notes, ''), case when p_kind = 'used' then 'Dipakai proyek' else 'Rusak / terbuang di proyek' end), coalesce(p_date, public.jakarta_today()));
  return v_id;
end;
$$;

-- Batalkan catatan pemakaian (salah input): saldo stok & alokasi dikembalikan.
create or replace function public.delete_usage(p_usage uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  u record;
begin
  perform public.assert_admin();
  select * into u from public.project_material_usage where id = p_usage for update;
  if u.id is null then raise exception 'Data pemakaian tidak ditemukan'; end if;
  perform 1 from public.inventory where id = u.inventory_id for update;
  -- Hapus mutasi dulu (stok fisik kembali), baru kembalikan alokasi.
  delete from public.inventory_movements where reference_type = 'usage' and reference_id = u.id;
  if u.allocation_id is not null and u.qty_from_allocation > 0 then
    update public.project_material_allocations set qty_consumed = qty_consumed - u.qty_from_allocation, updated_at = now() where id = u.allocation_id;
  end if;
  delete from public.project_material_usage where id = u.id;
end;
$$;

-- Batalkan penyesuaian manual.
create or replace function public.delete_adjustment(p_movement uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_admin();
  delete from public.inventory_movements where id = p_movement and reference_type = 'adjustment';
  if not found then raise exception 'Hanya penyesuaian manual yang bisa dibatalkan'; end if;
end;
$$;

-- ---------------------------------------------------------------------
-- updated_at, audit, RLS
-- ---------------------------------------------------------------------
drop trigger if exists touch_project_material_allocations on public.project_material_allocations;

do $$
declare t text;
begin
  foreach t in array array['purchase_orders', 'purchase_order_items', 'purchase_payments', 'inventory', 'inventory_movements',
    'project_material_allocations', 'project_material_usage'] loop
    perform public.attach_audit(t);
  end loop;
end $$;

alter table public.purchase_orders enable row level security;
alter table public.purchase_order_items enable row level security;
alter table public.purchase_payments enable row level security;
alter table public.inventory enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.project_material_allocations enable row level security;
alter table public.project_material_usage enable row level security;

-- PO: admin/editor kelola (mutasi stok terjadi lewat fungsi).
drop policy if exists "admin all purchase_orders" on public.purchase_orders;
create policy "admin all purchase_orders" on public.purchase_orders for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admin all purchase_order_items" on public.purchase_order_items;
create policy "admin all purchase_order_items" on public.purchase_order_items for all to authenticated using (public.is_admin()) with check (public.is_admin());
-- Pembayaran supplier = keuangan: admin utama.
drop policy if exists "owner all purchase_payments" on public.purchase_payments;
create policy "owner all purchase_payments" on public.purchase_payments for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
-- Stok: baca semua; ubah info lot (lokasi, catatan, foto) boleh; kuantitas dikunci trigger.
drop policy if exists "admin read inventory" on public.inventory;
create policy "admin read inventory" on public.inventory for select to authenticated using (public.is_admin());
drop policy if exists "admin update inventory" on public.inventory;
create policy "admin update inventory" on public.inventory for update to authenticated using (public.is_admin()) with check (public.is_admin());
do $$
declare t text;
begin
  foreach t in array array['inventory_movements', 'project_material_allocations', 'project_material_usage'] loop
    execute format('drop policy if exists "admin read %1$s" on public.%1$s', t);
    execute format('create policy "admin read %1$s" on public.%1$s for select to authenticated using (public.is_admin())', t);
  end loop;
end $$;

revoke all on public.purchase_orders, public.purchase_order_items, public.purchase_payments, public.inventory, public.inventory_movements,
  public.project_material_allocations, public.project_material_usage from anon;
grant select, insert, update, delete on public.purchase_orders, public.purchase_order_items, public.purchase_payments to authenticated;
grant select, update on public.inventory to authenticated;
grant select on public.inventory_movements, public.project_material_allocations, public.project_material_usage to authenticated;
grant all on public.purchase_orders, public.purchase_order_items, public.purchase_payments, public.inventory, public.inventory_movements,
  public.project_material_allocations, public.project_material_usage to service_role;
grant usage, select on sequence public.po_seq, public.stock_seq to authenticated, service_role;

do $$
declare f text;
begin
  foreach f in array array[
    'public.save_purchase_order(jsonb)', 'public.receive_purchase_order(uuid, date, text)', 'public.add_stock(jsonb)',
    'public.stock_adjust(uuid, text, numeric, text, date)', 'public.allocate_stock(uuid, uuid, numeric, text)',
    'public.release_allocation(uuid, numeric)', 'public.record_usage(uuid, uuid, text, numeric, date, text)',
    'public.delete_usage(uuid)', 'public.delete_adjustment(uuid)', 'public.assert_admin()'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
end $$;
revoke all on function public.recalc_purchase_order(uuid) from public, anon, authenticated;
