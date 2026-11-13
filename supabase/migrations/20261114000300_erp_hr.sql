-- =====================================================================
-- ERP 4/5 — SDM: absensi, potongan, kasbon/pinjaman, penggajian & slip.
--
-- Gaji Kotor  = hari kerja × upah harian (harian) | gaji bulanan (bulanan) | upah borongan (proyek)
-- Gaji Bersih = Gaji Kotor + insentif + tunjangan − total potongan
-- Kasbon dicatat sebagai piutang pegawai (employee_loans, kas keluar 'employee_loan'),
-- pengembaliannya lewat potongan slip gaji (payroll_items.loan_id) → tidak tercatat dobel.
-- =====================================================================

create sequence if not exists public.payroll_seq;
create sequence if not exists public.loan_seq;

create table if not exists public.employee_attendance (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete restrict,
  work_date date not null,
  status text not null default 'present' check (status in ('present', 'leave', 'sick', 'off', 'absent')),
  check_in time,
  check_out time,
  days_worked numeric(3, 2) not null default 1 check (days_worked between 0 and 2),
  project_id uuid references public.projects (id) on delete set null,
  notes text,
  created_by uuid references public.users (id) on delete set null default auth.uid(),
  updated_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employee_id, work_date),
  check (status = 'present' or days_worked = 0)
);
create index if not exists attendance_date_idx on public.employee_attendance (work_date);
create index if not exists attendance_project_idx on public.employee_attendance (project_id);

create or replace function public.attendance_before()
returns trigger
language plpgsql
as $$
begin
  if new.status <> 'present' then
    new.days_worked := 0;
    new.project_id := null;
  end if;
  if tg_op = 'UPDATE' then
    new.updated_by := (select auth.uid());
    if exists (select 1 from public.payroll p where p.employee_id = new.employee_id and p.status = 'paid'
               and new.work_date between p.period_start and p.period_end) then
      raise exception 'Absensi tanggal % sudah masuk slip gaji yang dibayar, tidak bisa diubah', new.work_date;
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create table if not exists public.employee_loans (
  id uuid primary key default gen_random_uuid(),
  loan_number text not null unique,
  employee_id uuid not null references public.employees (id) on delete restrict,
  loan_date date not null default public.jakarta_today(),
  kind text not null default 'kasbon' check (kind in ('kasbon', 'pinjaman')),
  amount numeric(14, 2) not null check (amount > 0),
  installment_amount numeric(14, 2) not null check (installment_amount > 0),
  repaid_amount numeric(14, 2) not null default 0 check (repaid_amount >= 0),
  outstanding numeric(14, 2) generated always as (amount - repaid_amount) stored,
  account_id uuid not null references public.cash_accounts (id) on delete restrict,
  notes text,
  created_by uuid references public.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  check (repaid_amount <= amount)
);
create index if not exists employee_loans_emp_idx on public.employee_loans (employee_id);

create table if not exists public.employee_deductions (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete restrict,
  deduction_date date not null default public.jakarta_today(),
  category text not null default 'lainnya' check (category in ('rokok', 'makan_minum', 'kerusakan', 'lainnya')),
  name text not null check (char_length(name) between 1 and 120),
  amount numeric(14, 2) not null check (amount > 0),
  notes text,
  status text not null default 'pending' check (status in ('pending', 'deducted', 'cancelled')),
  payroll_id uuid,
  created_by uuid references public.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists employee_deductions_emp_idx on public.employee_deductions (employee_id, status);

create table if not exists public.payroll (
  id uuid primary key default gen_random_uuid(),
  slip_number text not null unique,
  employee_id uuid not null references public.employees (id) on delete restrict,
  period_start date not null,
  period_end date not null,
  pay_type text not null check (pay_type in ('daily', 'monthly', 'project')),
  days_worked numeric(6, 2) not null default 0,
  daily_rate numeric(14, 2) not null default 0,
  base_amount numeric(14, 2) not null default 0,
  total_earnings numeric(14, 2) not null default 0,
  total_deductions numeric(14, 2) not null default 0,
  net_amount numeric(14, 2) generated always as (total_earnings - total_deductions) stored,
  status text not null default 'draft' check (status in ('draft', 'approved', 'paid')),
  payment_date date,
  account_id uuid references public.cash_accounts (id) on delete restrict,
  notes text,
  created_by uuid references public.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_end >= period_start),
  check (total_earnings - total_deductions >= 0),
  check (status <> 'paid' or (payment_date is not null and account_id is not null))
);
create unique index if not exists payroll_period_uidx on public.payroll (employee_id, period_start, period_end);
create index if not exists payroll_period_idx on public.payroll (period_end);

alter table public.employee_deductions drop constraint if exists employee_deductions_payroll_fk;
alter table public.employee_deductions add constraint employee_deductions_payroll_fk foreign key (payroll_id) references public.payroll (id) on delete set null;

create table if not exists public.payroll_items (
  id uuid primary key default gen_random_uuid(),
  payroll_id uuid not null references public.payroll (id) on delete cascade,
  item_type text not null check (item_type in ('earning', 'deduction')),
  category text not null check (category in ('base', 'incentive', 'allowance', 'commission', 'project_pay', 'overtime', 'other_earning', 'loan', 'deduction')),
  description text not null,
  amount numeric(14, 2) not null check (amount > 0),
  deduction_id uuid unique references public.employee_deductions (id) on delete set null,
  loan_id uuid references public.employee_loans (id) on delete restrict,
  project_id uuid references public.projects (id) on delete set null,
  sort_order int not null default 0,
  check ((item_type = 'deduction') = (category in ('loan', 'deduction'))),
  check (category <> 'loan' or loan_id is not null)
);
create index if not exists payroll_items_payroll_idx on public.payroll_items (payroll_id);

drop trigger if exists attendance_before on public.employee_attendance;
create trigger attendance_before before insert or update on public.employee_attendance
  for each row execute function public.attendance_before();

-- ---------------------------------------------------------------------
-- Trigger penggajian
-- ---------------------------------------------------------------------
create or replace function public.payroll_before()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.slip_number is null or new.slip_number = '' then
      new.slip_number := public.next_doc_number('SLIP', 'public.payroll_seq', new.period_end);
    end if;
  elsif tg_op = 'UPDATE' and old.status = 'paid' and current_setting('app.payroll_rpc', true) is distinct from 'on' then
    if new.status <> old.status or new.total_earnings <> old.total_earnings or new.total_deductions <> old.total_deductions
       or new.payment_date is distinct from old.payment_date or new.account_id is distinct from old.account_id then
      raise exception 'Slip % sudah dibayar dan terkunci', old.slip_number;
    end if;
  elsif tg_op = 'DELETE' and old.status = 'paid' then
    raise exception 'Slip % sudah dibayar, tidak bisa dihapus', old.slip_number;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists payroll_before on public.payroll;
create trigger payroll_before before insert or update or delete on public.payroll
  for each row execute function public.payroll_before();

create or replace function public.payroll_ledger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  if tg_op = 'DELETE' then
    perform public.sync_ledger('payroll', old.id, false, null, null, null, 0, null, null, null, null);
    return null;
  end if;
  select full_name into v_name from public.employees where id = new.employee_id;
  perform public.sync_ledger('payroll', new.id, new.status = 'paid', new.payment_date, new.account_id, 'out', new.net_amount, 'salary',
    null, null, 'Gaji ' || coalesce(v_name, '') || ' · ' || new.slip_number, new.slip_number);
  return null;
end;
$$;
drop trigger if exists payroll_ledger on public.payroll;
create trigger payroll_ledger after insert or update or delete on public.payroll
  for each row execute function public.payroll_ledger();

-- Item slip: kunci slip dibayar, hitung ulang total, status potongan & sisa kasbon.
create or replace function public.payroll_items_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.payroll where id = coalesce(new.payroll_id, old.payroll_id) and status <> 'draft') then
    raise exception 'Rincian slip hanya bisa diubah saat status Draft';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
drop trigger if exists payroll_items_guard on public.payroll_items;
create trigger payroll_items_guard before insert or update or delete on public.payroll_items
  for each row execute function public.payroll_items_guard();

create or replace function public.payroll_items_after()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payroll uuid := coalesce(new.payroll_id, old.payroll_id);
  v_loan uuid;
begin
  update public.payroll p set
    total_earnings = coalesce((select sum(amount) from public.payroll_items i where i.payroll_id = p.id and i.item_type = 'earning'), 0),
    total_deductions = coalesce((select sum(amount) from public.payroll_items i where i.payroll_id = p.id and i.item_type = 'deduction'), 0)
  where p.id = v_payroll;

  if tg_op in ('UPDATE', 'DELETE') and old.deduction_id is not null then
    update public.employee_deductions set status = 'pending', payroll_id = null where id = old.deduction_id;
  end if;
  if tg_op in ('INSERT', 'UPDATE') and new.deduction_id is not null then
    update public.employee_deductions set status = 'deducted', payroll_id = new.payroll_id where id = new.deduction_id;
  end if;

  foreach v_loan in array array[old.loan_id, new.loan_id] loop
    continue when v_loan is null;
    update public.employee_loans l set repaid_amount = coalesce((select sum(amount) from public.payroll_items i where i.loan_id = l.id), 0)
    where l.id = v_loan;
  end loop;
  return null;
exception
  when check_violation then
    raise exception 'Potongan melebihi pendapatan atau melebihi sisa kasbon';
end;
$$;
drop trigger if exists payroll_items_after on public.payroll_items;
create trigger payroll_items_after after insert or update or delete on public.payroll_items
  for each row execute function public.payroll_items_after();

-- Pencairan kasbon → kas keluar.
create or replace function public.employee_loans_before()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' and (new.loan_number is null or new.loan_number = '') then
    new.loan_number := public.next_doc_number('KSB', 'public.loan_seq', new.loan_date);
  end if;
  if tg_op = 'UPDATE' and old.repaid_amount > 0 and (new.amount <> old.amount or new.employee_id <> old.employee_id) then
    raise exception 'Kasbon yang sudah dicicil tidak bisa diubah nominal/pegawainya';
  end if;
  return new;
end;
$$;
drop trigger if exists employee_loans_before on public.employee_loans;
create trigger employee_loans_before before insert or update on public.employee_loans
  for each row execute function public.employee_loans_before();

create or replace function public.employee_loans_ledger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  if tg_op = 'DELETE' then
    perform public.sync_ledger('employee_loan', old.id, false, null, null, null, 0, null, null, null, null);
    return null;
  end if;
  select full_name into v_name from public.employees where id = new.employee_id;
  perform public.sync_ledger('employee_loan', new.id, true, new.loan_date, new.account_id, 'out', new.amount, 'employee_loan',
    null, null, initcap(new.kind) || ' ' || coalesce(v_name, '') || ' · ' || new.loan_number, new.loan_number);
  return null;
end;
$$;
drop trigger if exists employee_loans_ledger on public.employee_loans;
create trigger employee_loans_ledger after insert or update or delete on public.employee_loans
  for each row execute function public.employee_loans_ledger();

-- ---------------------------------------------------------------------
-- Buat / hitung ulang slip gaji satu pegawai (atomik).
-- Slip draft lama untuk periode yang sama dihitung ulang; approved/paid ditolak.
-- ---------------------------------------------------------------------
create or replace function public.generate_payroll(p_employee uuid, p_start date, p_end date)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_emp record;
  v_pay record;
  v_existing record;
  v_id uuid;
  v_days numeric := 0;
  v_rate numeric := 0;
  v_base numeric := 0;
  v_earn numeric := 0;
  v_left numeric;
  v_ord int := 0;
  r record;
  v_cut numeric;
begin
  if not public.is_super_admin() then raise exception 'Akses ditolak: penggajian khusus admin utama'; end if;
  if p_end < p_start then raise exception 'Periode tidak valid'; end if;
  select e.*, pos.name as position_name into v_emp from public.employees e left join public.positions pos on pos.id = e.position_id where e.id = p_employee;
  if v_emp.id is null then raise exception 'Pegawai tidak ditemukan'; end if;
  select * into v_pay from public.employee_pay_settings where employee_id = p_employee;
  if v_pay.employee_id is null then raise exception 'Pengaturan gaji % belum diisi', v_emp.full_name; end if;

  select * into v_existing from public.payroll where employee_id = p_employee and period_start = p_start and period_end = p_end for update;
  if v_existing.id is not null then
    if v_existing.status <> 'draft' then raise exception 'Slip % sudah %', v_existing.slip_number, case when v_existing.status = 'paid' then 'dibayar' else 'disetujui' end; end if;
    delete from public.payroll_items where payroll_id = v_existing.id;
    v_id := v_existing.id;
  end if;

  select coalesce(sum(days_worked), 0) into v_days from public.employee_attendance
  where employee_id = p_employee and status = 'present' and work_date between p_start and p_end;

  if v_pay.pay_type = 'daily' then
    v_rate := v_pay.daily_wage;
    v_base := round(v_days * v_pay.daily_wage, 2);
  elsif v_pay.pay_type = 'monthly' then
    v_rate := round(v_pay.monthly_salary / v_pay.working_days_per_month, 2);
    v_base := v_pay.monthly_salary;
  end if;

  if v_id is null then
    insert into public.payroll (employee_id, period_start, period_end, pay_type, days_worked, daily_rate, base_amount)
    values (p_employee, p_start, p_end, v_pay.pay_type, v_days, v_rate, v_base) returning id into v_id;
  else
    update public.payroll set pay_type = v_pay.pay_type, days_worked = v_days, daily_rate = v_rate, base_amount = v_base where id = v_id;
  end if;

  if v_base > 0 then
    v_ord := v_ord + 1;
    insert into public.payroll_items (payroll_id, item_type, category, description, amount, sort_order)
    values (v_id, 'earning', 'base', case v_pay.pay_type
      when 'daily' then 'Upah harian ' || trim(to_char(v_days, 'FM999990.##')) || ' hari × Rp ' || to_char(v_pay.daily_wage, 'FM999G999G999G990')
      else 'Gaji bulanan' end, v_base, v_ord);
    v_earn := v_earn + v_base;
  end if;

  -- Upah borongan: proyek yang selesai dalam periode.
  for r in
    select w.agreed_amount, w.project_id, o.order_number, o.title
    from public.project_workers w join public.projects p on p.id = w.project_id join public.orders o on o.id = p.order_id
    where w.employee_id = p_employee and w.agreed_amount > 0 and o.status = 'completed' and o.completed_at between p_start and p_end
  loop
    v_ord := v_ord + 1;
    insert into public.payroll_items (payroll_id, item_type, category, description, amount, project_id, sort_order)
    values (v_id, 'earning', 'project_pay', 'Upah proyek ' || r.order_number || ' · ' || r.title, r.agreed_amount, r.project_id, v_ord);
    v_earn := v_earn + r.agreed_amount;
  end loop;

  if v_pay.default_allowance > 0 then
    v_ord := v_ord + 1;
    insert into public.payroll_items (payroll_id, item_type, category, description, amount, sort_order)
    values (v_id, 'earning', 'allowance', 'Tunjangan', v_pay.default_allowance, v_ord);
    v_earn := v_earn + v_pay.default_allowance;
  end if;
  if v_pay.default_incentive > 0 then
    v_ord := v_ord + 1;
    insert into public.payroll_items (payroll_id, item_type, category, description, amount, sort_order)
    values (v_id, 'earning', 'incentive', 'Insentif', v_pay.default_incentive, v_ord);
    v_earn := v_earn + v_pay.default_incentive;
  end if;

  -- Potongan opsional yang belum dipotong (hanya jika masih tercukupi pendapatan).
  v_left := v_earn;
  for r in
    select * from public.employee_deductions where employee_id = p_employee and status = 'pending' and deduction_date <= p_end order by deduction_date, created_at
  loop
    exit when r.amount > v_left;
    v_ord := v_ord + 1;
    insert into public.payroll_items (payroll_id, item_type, category, description, amount, deduction_id, sort_order)
    values (v_id, 'deduction', 'deduction', r.name || ' (' || to_char(r.deduction_date, 'DD/MM') || ')', r.amount, r.id, v_ord);
    v_left := v_left - r.amount;
  end loop;

  -- Cicilan kasbon / pinjaman.
  for r in
    select * from public.employee_loans where employee_id = p_employee and outstanding > 0 and loan_date <= p_end order by loan_date
  loop
    v_cut := least(r.installment_amount, r.outstanding, v_left);
    exit when v_cut <= 0;
    v_ord := v_ord + 1;
    insert into public.payroll_items (payroll_id, item_type, category, description, amount, loan_id, sort_order)
    values (v_id, 'deduction', 'loan', 'Cicilan ' || r.kind || ' ' || r.loan_number, v_cut, r.id, v_ord);
    v_left := v_left - v_cut;
  end loop;

  return v_id;
end;
$$;

-- Ubah status slip: draft → approved → paid (bayar = kas keluar otomatis).
create or replace function public.set_payroll_status(p_id uuid, p_status text, p_date date default null, p_account uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v record;
begin
  if not public.is_super_admin() then raise exception 'Akses ditolak'; end if;
  select * into v from public.payroll where id = p_id for update;
  if v.id is null then raise exception 'Slip tidak ditemukan'; end if;
  if v.status = 'paid' then raise exception 'Slip sudah dibayar'; end if;
  if p_status = 'paid' then
    if p_account is null then raise exception 'Pilih akun kas pembayaran'; end if;
    update public.payroll set status = 'paid', payment_date = coalesce(p_date, public.jakarta_today()), account_id = p_account where id = p_id;
  elsif p_status in ('draft', 'approved') then
    update public.payroll set status = p_status where id = p_id;
  else
    raise exception 'Status tidak valid';
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- audit, RLS, grants
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['employee_attendance', 'employee_loans', 'employee_deductions', 'payroll', 'payroll_items'] loop
    perform public.attach_audit(t);
    execute format('alter table public.%I enable row level security', t);
  end loop;
  foreach t in array array['employee_loans', 'employee_deductions', 'payroll', 'payroll_items'] loop
    execute format('drop policy if exists "owner all %1$s" on public.%1$s', t);
    execute format('create policy "owner all %1$s" on public.%1$s for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin())', t);
  end loop;
end $$;

drop policy if exists "admin all employee_attendance" on public.employee_attendance;
create policy "admin all employee_attendance" on public.employee_attendance for all to authenticated using (public.is_admin()) with check (public.is_admin());

revoke all on public.employee_attendance, public.employee_loans, public.employee_deductions, public.payroll, public.payroll_items from anon;
grant select, insert, update, delete on public.employee_attendance, public.employee_loans, public.employee_deductions, public.payroll, public.payroll_items to authenticated;
grant all on public.employee_attendance, public.employee_loans, public.employee_deductions, public.payroll, public.payroll_items to service_role;
grant usage, select on sequence public.payroll_seq, public.loan_seq to authenticated, service_role;
revoke all on function public.generate_payroll(uuid, date, date) from public, anon;
grant execute on function public.generate_payroll(uuid, date, date) to authenticated, service_role;
revoke all on function public.set_payroll_status(uuid, text, date, uuid) from public, anon;
grant execute on function public.set_payroll_status(uuid, text, date, uuid) to authenticated, service_role;
