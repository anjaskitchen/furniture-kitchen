-- =====================================================================
-- ERP — penyempurnaan:
--   1. Transfer antar akun kas boleh dicatat langsung (dua baris, source_type 'transfer').
--   2. Format rupiah di keterangan slip memakai titik ribuan (Rp 150.000).
-- =====================================================================

drop policy if exists "owner insert manual financial_transactions" on public.financial_transactions;
create policy "owner insert manual financial_transactions" on public.financial_transactions for insert to authenticated
  with check (public.is_super_admin() and source_type in ('manual', 'transfer'));

create or replace function public.rupiah(p numeric)
returns text
language sql
immutable
as $$ select 'Rp ' || replace(to_char(round(coalesce(p, 0)), 'FM999,999,999,990'), ',', '.') $$;

-- generate_payroll: sama seperti sebelumnya, hanya format angka di keterangan.
do $$
declare
  v_src text;
begin
  select pg_get_functiondef('public.generate_payroll(uuid, date, date)'::regprocedure) into v_src;
  v_src := replace(v_src, $q$' × Rp ' || to_char(v_pay.daily_wage, 'FM999G999G999G990')$q$, $q$' × ' || public.rupiah(v_pay.daily_wage)$q$);
  v_src := replace(v_src, $q$trim(to_char(v_days, 'FM999990.##'))$q$, $q$replace(trim(trailing '.' from to_char(v_days, 'FM999990.##')), '.', ',')$q$);
  execute v_src;
end $$;

grant execute on function public.rupiah(numeric) to authenticated, service_role;
