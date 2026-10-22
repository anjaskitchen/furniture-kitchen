-- =====================================================================
-- Landing page CMS: urutan & teks section homepage, poin keunggulan /
-- proses / statistik hero, FAQ, dan field pengaturan tambahan.
-- Idempoten — aman dijalankan ulang.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Pengaturan tambahan (satu baris settings)
-- ---------------------------------------------------------------------
alter table public.settings
  add column if not exists announcement_text text,
  add column if not exists announcement_url text,
  add column if not exists hero_card_title text default 'Harga transparan per meter',
  add column if not exists hero_card_text text default 'Mulai dari',
  add column if not exists cta_eyebrow text default 'Konsultasi Gratis',
  add column if not exists cta_title text default 'Siap mewujudkan ruang impian Anda?',
  add column if not exists cta_text text default 'Ceritakan kebutuhan Anda. Tim kami membantu dari desain, pemilihan material, hingga estimasi biaya.',
  add column if not exists about_image_url text,
  add column if not exists about_image_2_url text;

-- ---------------------------------------------------------------------
-- Section homepage: admin mengatur urutan, tampil/sembunyi, dan teks.
-- key tetap (dipetakan ke komponen), baris dibuat oleh seed.
-- ---------------------------------------------------------------------
create table if not exists public.home_sections (
  id uuid primary key default gen_random_uuid(),
  key text not null unique
    check (key in ('categories', 'featured_products', 'calculator', 'portfolio', 'videos', 'reviews', 'advantages', 'faq', 'cta')),
  eyebrow text,
  title text,
  description text,
  cta_label text,
  cta_url text,
  item_limit int not null default 6 check (item_limit between 1 and 24),
  sort_order int not null default 0,
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Poin konten berulang:
--   hero_stat   : angka di bawah hero (value = "4.9", "1 Thn", ...)
--   process     : langkah kerja (homepage, section kalkulator)
--   advantage   : keunggulan (homepage)
--   about_value : nilai perusahaan (halaman Tentang Kami)
-- ---------------------------------------------------------------------
create table if not exists public.features (
  id uuid primary key default gen_random_uuid(),
  section text not null check (section in ('hero_stat', 'process', 'advantage', 'about_value')),
  icon text not null default 'sparkles',
  title text not null,
  description text,
  value text,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists features_section_idx on public.features (section, sort_order);

create table if not exists public.faqs (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  answer text not null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['home_sections', 'features', 'faqs'] loop
    execute format('drop trigger if exists touch_%1$s on public.%1$s', t);
    execute format('create trigger touch_%1$s before update on public.%1$s for each row execute function public.touch_updated_at()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- RLS: publik baca baris aktif, admin/editor tulis.
-- ---------------------------------------------------------------------
alter table public.home_sections enable row level security;
alter table public.features enable row level security;
alter table public.faqs enable row level security;

do $$
declare t text;
begin
  foreach t in array array['home_sections', 'features', 'faqs'] loop
    execute format('drop policy if exists "public read %1$s" on public.%1$s', t);
    execute format('create policy "public read %1$s" on public.%1$s for select to anon, authenticated using (is_active or public.is_admin())', t);
    execute format('drop policy if exists "admin write %1$s" on public.%1$s', t);
    execute format('create policy "admin write %1$s" on public.%1$s for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

-- Hak akses tabel untuk role API (eksplisit, tidak bergantung default privileges).
grant select on public.home_sections, public.features, public.faqs to anon, authenticated;
grant insert, update, delete on public.home_sections, public.features, public.faqs to authenticated;
