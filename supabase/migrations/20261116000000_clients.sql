-- =====================================================================
-- Logo klien (instansi pemerintah & perusahaan) untuk landing page.
-- Bagian "clients" di beranda: 1 baris logo, otomatis bergerak bila banyak.
-- =====================================================================

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 160),
  logo_url text,
  category text not null default 'pemerintah' check (category in ('pemerintah', 'bumn', 'swasta', 'pendidikan', 'kesehatan', 'lainnya')),
  website_url text,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.clients enable row level security;
drop policy if exists "public read clients" on public.clients;
create policy "public read clients" on public.clients for select to anon, authenticated using (is_active or public.is_admin());
drop policy if exists "admin write clients" on public.clients;
create policy "admin write clients" on public.clients for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select on public.clients to anon, authenticated;
grant insert, update, delete on public.clients to authenticated;
grant all on public.clients to service_role;

insert into public.clients (name, category, sort_order)
select x.name, x.category, x.ord
from (values
  ('Pemerintah Provinsi Jawa Barat', 'pemerintah', 1),
  ('Labkes Jawa Barat', 'kesehatan', 2),
  ('Kementerian Kelautan dan Perikanan', 'pemerintah', 3)
) as x(name, category, ord)
where not exists (select 1 from public.clients);

-- Section beranda baru: izinkan key 'clients'.
do $$
declare c text;
begin
  for c in select conname from pg_constraint where conrelid = 'public.home_sections'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%key%' loop
    execute format('alter table public.home_sections drop constraint %I', c);
  end loop;
end $$;
alter table public.home_sections add constraint home_sections_key_check
  check (key in ('categories', 'featured_products', 'calculator', 'portfolio', 'clients', 'videos', 'reviews', 'advantages', 'faq', 'cta'));

-- Letakkan tepat setelah Portfolio.
do $$
declare p int;
begin
  if not exists (select 1 from public.home_sections where key = 'clients') then
    select coalesce(sort_order, 0) into p from public.home_sections where key = 'portfolio';
    update public.home_sections set sort_order = sort_order + 1 where sort_order > coalesce(p, 0);
    insert into public.home_sections (key, eyebrow, title, description, item_limit, sort_order, is_active)
    values ('clients', 'Klien Kami', 'Dipercaya instansi pemerintah & perusahaan',
      'Mandiri Furniture telah mengerjakan furniture custom untuk berbagai instansi pemerintah, lembaga, dan perusahaan.', 24, coalesce(p, 0) + 1, true);
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'clients') then
    alter publication supabase_realtime add table public.clients;
  end if;
end $$;
