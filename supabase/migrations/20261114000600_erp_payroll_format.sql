-- Keterangan upah harian di slip: "Upah harian 24 hari × Rp 150.000" (format rupiah Indonesia).
do $$
declare
  v_src text;
begin
  select pg_get_functiondef('public.generate_payroll(uuid, date, date)'::regprocedure) into v_src;
  v_src := replace(v_src, $q$× Rp ' || to_char(v_pay.daily_wage, 'FM999G999G999G990')$q$, $q$× ' || public.rupiah(v_pay.daily_wage)$q$);
  if position('public.rupiah(v_pay.daily_wage)' in v_src) = 0 then
    raise exception 'Pola keterangan upah tidak ditemukan';
  end if;
  execute v_src;
end $$;
