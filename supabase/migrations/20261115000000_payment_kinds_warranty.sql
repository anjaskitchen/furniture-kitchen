-- =====================================================================
-- 1. Jenis pembayaran (DP, Termin, Pelunasan, …) bisa diatur admin.
-- 2. Catatan garansi + link ulasan Google untuk invoice order Selesai.
-- =====================================================================

create table if not exists public.payment_kinds (
  code text primary key check (code ~ '^[a-z][a-z0-9_]{0,39}$'),
  label text not null check (char_length(label) between 1 and 60),
  sort_order int not null default 0,
  is_active boolean not null default true,
  is_system boolean not null default false,
  created_at timestamptz not null default now()
);

insert into public.payment_kinds (code, label, sort_order, is_system) values
  ('dp', 'DP', 1, true), ('termin', 'Termin', 2, true), ('pelunasan', 'Pelunasan', 3, true), ('other', 'Lainnya', 9, true)
on conflict (code) do nothing;

-- Jenis pembayaran sekarang mengikuti tabel (bukan daftar tetap).
alter table public.order_payments drop constraint if exists order_payments_kind_check;
alter table public.order_payments drop constraint if exists order_payments_kind_fk;
alter table public.order_payments add constraint order_payments_kind_fk foreign key (kind) references public.payment_kinds (code) on update cascade on delete restrict;

alter table public.payment_kinds enable row level security;
drop policy if exists "admin all payment_kinds" on public.payment_kinds;
create policy "admin all payment_kinds" on public.payment_kinds for all to authenticated using (public.is_admin()) with check (public.is_admin());
revoke all on public.payment_kinds from anon;
grant select, insert, update, delete on public.payment_kinds to authenticated;
grant all on public.payment_kinds to service_role;

-- Keterangan buku kas memakai label jenis pembayaran.
create or replace function public.order_payments_ledger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project uuid;
  v_label text;
  v_kind text;
begin
  if tg_op = 'DELETE' then
    perform public.sync_ledger('order_payment', old.id, false, null, null, null, 0, null, null, null, null);
    return null;
  end if;
  select p.id, o.order_number || ' · ' || o.customer_name into v_project, v_label
  from public.orders o left join public.projects p on p.order_id = o.id where o.id = new.order_id;
  select label into v_kind from public.payment_kinds where code = new.kind;
  perform public.sync_ledger('order_payment', new.id, true, new.paid_at,
    coalesce(new.account_id, public.default_cash_account(new.method)), 'in', new.amount, 'customer_payment',
    v_project, new.order_id, 'Pembayaran ' || coalesce(v_kind, new.kind) || ' ' || coalesce(v_label, ''), new.reference);
  return null;
end;
$$;

-- Laporan keuangan: "lainnya" = semua jenis selain DP/termin/pelunasan.
do $$
declare
  v_src text;
begin
  select pg_get_functiondef('public.finance_report(date, date)'::regprocedure) into v_src;
  v_src := replace(v_src, $q$'other', coalesce(sum(amount) filter (where kind = 'other'), 0)$q$,
                          $q$'other', coalesce(sum(amount) filter (where kind not in ('dp', 'termin', 'pelunasan')), 0)$q$);
  if position($q$kind not in ('dp', 'termin', 'pelunasan')$q$ in v_src) = 0 then
    raise exception 'Pola laporan pembayaran tidak ditemukan';
  end if;
  execute v_src;
end $$;

-- Catatan garansi & ulasan Google (tampil di invoice saat order Selesai).
alter table public.settings
  add column if not exists invoice_review_url text default 'https://maps.app.goo.gl/ttVPRQ59oYodjSpR8',
  add column if not exists invoice_completed_note text default
    'Untuk mengaktifkan garansi 1 tahun, mohon berikan ulasan pengalaman Anda membuat furniture custom bersama kami di Google Maps melalui tautan di bawah ini, dan sertakan foto hasil pekerjaan pada ulasan Google tersebut. Garansi aktif setelah ulasan kami terima. Terima kasih atas kepercayaan dan dukungan Anda.';
