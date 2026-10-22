-- =====================================================================
-- Custom Furniture & Kitchen Set — Supabase schema
-- Jalankan di Supabase Dashboard → SQL Editor (sekali, pada project baru),
-- lalu jalankan supabase/seed.sql untuk data awal.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- USERS (profil untuk auth.users) + helper role
-- ---------------------------------------------------------------------
create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'customer' check (role in ('customer', 'editor', 'admin')),
  created_at timestamptz not null default now()
);

-- Membuat profil otomatis ketika user baru mendaftar / dibuat.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- true jika user yang login adalah admin/editor.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users
    where id = (select auth.uid()) and role in ('admin', 'editor')
  );
$$;

-- true hanya untuk role admin penuh (kelola admin user).
create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

-- Mencegah user non-admin menaikkan role-nya sendiri.
create or replace function public.protect_user_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- auth.uid() null = SQL editor / service role (boleh); user biasa harus admin.
  if new.role is distinct from old.role
     and (select auth.uid()) is not null
     and not public.is_super_admin() then
    raise exception 'Only admins can change roles';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_user_role on public.users;
create trigger protect_user_role
  before update on public.users
  for each row execute function public.protect_user_role();

-- updated_at helper
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- KATALOG
-- ---------------------------------------------------------------------
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  image_url text,
  show_on_home boolean not null default true,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.materials (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  price_per_meter numeric(14, 2) not null default 0 check (price_per_meter >= 0),
  image_url text,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  category_id uuid references public.categories (id) on delete set null,
  material_id uuid references public.materials (id) on delete set null,
  description text,
  finishing text,
  colors text[] not null default '{}',
  dimensions text,
  price_estimate numeric(14, 2) check (price_estimate >= 0),
  images text[] not null default '{}',
  video_url text,
  status text not null default 'published' check (status in ('draft', 'published')),
  is_featured boolean not null default false,
  view_count int not null default 0,
  inquiry_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists products_category_idx on public.products (category_id);
create index if not exists products_material_idx on public.products (material_id);
create index if not exists products_status_idx on public.products (status);

create table if not exists public.hpl_colors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null,
  brand text,
  category text not null default 'Wood'
    check (category in ('Wood', 'Solid', 'Marble', 'Stone', 'Pattern', 'Matte', 'Glossy')),
  hex text default '#D9C7A7',
  image_url text,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.duco_colors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null,
  category text not null default 'White'
    check (category in ('White', 'Cream', 'Grey', 'Black', 'Green', 'Blue', 'Brown', 'Custom Color')),
  finish text not null default 'Matte' check (finish in ('Glossy', 'Matte', 'Satin')),
  hex text default '#FFFFFF',
  image_url text,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- HARGA (dipakai kalkulator — tidak ada harga di frontend)
-- ---------------------------------------------------------------------
create table if not exists public.hardware (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  price numeric(14, 2) not null default 0 check (price >= 0),
  price_unit text not null default 'per_meter' check (price_unit in ('per_meter', 'fixed')),
  is_calculator_option boolean not null default true,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- group:
--   product_type : price = pengali (1 = normal), meta.standard_height (meter)
--   finishing    : price = persen dari biaya material
--   top_table    : price = rupiah per meter panjang
--   accessory    : price = rupiah per unit (fixed)
--   additional   : price = rupiah fixed, otomatis ditambahkan
create table if not exists public.price_settings (
  id uuid primary key default gen_random_uuid(),
  "group" text not null check ("group" in ('product_type', 'finishing', 'top_table', 'accessory', 'additional')),
  name text not null,
  price numeric(14, 2) not null default 0 check (price >= 0),
  unit text not null default 'fixed' check (unit in ('per_meter', 'fixed', 'percent', 'multiplier')),
  description text,
  meta jsonb not null default '{}'::jsonb,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists price_settings_group_idx on public.price_settings ("group");

-- ---------------------------------------------------------------------
-- PORTFOLIO, VIDEO, REVIEW, SUBMISSION
-- ---------------------------------------------------------------------
create table if not exists public.portfolio (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  category text not null default 'Kitchen Set'
    check (category in ('Kitchen Set', 'Wardrobe', 'Furniture', 'Office', 'Residential', 'Commercial')),
  location text,
  year int,
  material text,
  description text,
  images text[] not null default '{}',
  video_url text,
  source text not null default 'admin' check (source in ('admin', 'customer')),
  submission_id uuid,
  is_published boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.videos (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  category text not null default 'Project',
  video_url text not null,
  thumbnail_url text,
  source text not null default 'youtube' check (source in ('youtube', 'vimeo', 'upload', 'customer')),
  is_published boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.customer_submissions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  project_title text,
  location text,
  description text,
  testimonial text,
  rating int not null default 5 check (rating between 1 and 5),
  images text[] not null default '{}',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_note text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

-- Review manual (fallback jika Google Places API tidak aktif) +
-- testimoni customer yang di-approve.
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  author_name text not null,
  author_photo_url text,
  rating int not null default 5 check (rating between 1 and 5),
  content text not null,
  review_date date not null default current_date,
  source text not null default 'manual' check (source in ('manual', 'customer', 'google_manual')),
  submission_id uuid references public.customer_submissions (id) on delete set null,
  is_published boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.portfolio
  drop constraint if exists portfolio_submission_fk;
alter table public.portfolio
  add constraint portfolio_submission_fk foreign key (submission_id)
  references public.customer_submissions (id) on delete set null;

-- ---------------------------------------------------------------------
-- LEADS
-- ---------------------------------------------------------------------
create table if not exists public.survey_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  address text not null,
  preferred_date date,
  furniture_type text,
  approx_size text,
  notes text,
  estimate_total numeric(14, 2),
  estimate_detail jsonb,
  status text not null default 'new' check (status in ('new', 'contacted', 'scheduled', 'done', 'cancelled')),
  created_at timestamptz not null default now()
);

create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  furniture_type text,
  size text,
  material text,
  estimate_total numeric(14, 2),
  estimate_detail jsonb,
  message text,
  reference_images text[] not null default '{}',
  product_id uuid references public.products (id) on delete set null,
  channel text not null default 'email' check (channel in ('email', 'form')),
  status text not null default 'new' check (status in ('new', 'read', 'replied', 'archived')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- SETTINGS (satu baris)
-- ---------------------------------------------------------------------
create table if not exists public.settings (
  id boolean primary key default true check (id),
  business_name text not null default 'Kayuna Interior',
  tagline text,
  description text,
  logo_url text,
  address text,
  city text default 'Bandung',
  whatsapp_number text,
  email text,
  notification_email text,
  instagram_url text,
  facebook_url text,
  tiktok_url text,
  youtube_url text,
  google_maps_url text,
  google_maps_embed_query text,
  google_place_id text,
  opening_hours text,
  hero_title text,
  hero_subtitle text,
  hero_image_url text,
  hero_video_url text,
  cta_primary_label text default 'Hitung Harga',
  cta_secondary_label text default 'Lihat Katalog',
  footer_text text,
  about_title text,
  about_content text,
  manual_rating numeric(2, 1) default 4.9 check (manual_rating between 0 and 5),
  manual_review_count int default 0,
  whatsapp_default_message text default 'Halo, saya ingin konsultasi custom furniture.',
  updated_at timestamptz not null default now()
);

-- updated_at triggers
do $$
declare t text;
begin
  foreach t in array array['materials', 'products', 'hardware', 'price_settings', 'settings'] loop
    execute format('drop trigger if exists touch_%1$s on public.%1$s', t);
    execute format('create trigger touch_%1$s before update on public.%1$s for each row execute function public.touch_updated_at()', t);
  end loop;
end $$;

-- Hitung view & inquiry produk (dipanggil dari website, aman untuk anon).
create or replace function public.increment_product_counter(p_product_id uuid, p_field text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_field = 'view' then
    update public.products set view_count = view_count + 1 where id = p_product_id and status = 'published';
  elsif p_field = 'inquiry' then
    update public.products set inquiry_count = inquiry_count + 1 where id = p_product_id and status = 'published';
  end if;
end;
$$;
revoke all on function public.increment_product_counter(uuid, text) from public;
grant execute on function public.increment_product_counter(uuid, text) to anon, authenticated;

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================
alter table public.users enable row level security;
alter table public.categories enable row level security;
alter table public.materials enable row level security;
alter table public.products enable row level security;
alter table public.hpl_colors enable row level security;
alter table public.duco_colors enable row level security;
alter table public.hardware enable row level security;
alter table public.price_settings enable row level security;
alter table public.portfolio enable row level security;
alter table public.videos enable row level security;
alter table public.customer_submissions enable row level security;
alter table public.reviews enable row level security;
alter table public.survey_requests enable row level security;
alter table public.contact_messages enable row level security;
alter table public.settings enable row level security;

-- users
drop policy if exists "users read own or admin" on public.users;
create policy "users read own or admin" on public.users
  for select to authenticated using (id = (select auth.uid()) or public.is_admin());
drop policy if exists "users update own or super admin" on public.users;
create policy "users update own or super admin" on public.users
  for update to authenticated using (id = (select auth.uid()) or public.is_super_admin())
  with check (id = (select auth.uid()) or public.is_super_admin());
drop policy if exists "users delete super admin" on public.users;
create policy "users delete super admin" on public.users
  for delete to authenticated using (public.is_super_admin());

-- Konten publik: semua orang boleh membaca baris aktif/terbit, admin boleh semua.
do $$
declare
  t text;
  cond text;
  tables text[][] := array[
    array['categories', 'is_active'],
    array['materials', 'is_active'],
    array['products', 'status = ''published'''],
    array['hpl_colors', 'is_active'],
    array['duco_colors', 'is_active'],
    array['hardware', 'is_active'],
    array['price_settings', 'is_active'],
    array['portfolio', 'is_published'],
    array['videos', 'is_published'],
    array['reviews', 'is_published']
  ];
  i int;
begin
  for i in 1 .. array_length(tables, 1) loop
    t := tables[i][1];
    cond := tables[i][2];
    execute format('drop policy if exists "public read %1$s" on public.%1$s', t);
    execute format('create policy "public read %1$s" on public.%1$s for select to anon, authenticated using (%2$s or public.is_admin())', t, cond);
    execute format('drop policy if exists "admin write %1$s" on public.%1$s', t);
    execute format('create policy "admin write %1$s" on public.%1$s for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

-- settings: publik baca, admin ubah
drop policy if exists "public read settings" on public.settings;
create policy "public read settings" on public.settings for select to anon, authenticated using (true);
drop policy if exists "admin write settings" on public.settings;
create policy "admin write settings" on public.settings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Leads & submission: hanya admin yang bisa membaca/mengubah.
-- Insert dari website dilakukan oleh API route server (service role) setelah validasi.
do $$
declare t text;
begin
  foreach t in array array['customer_submissions', 'survey_requests', 'contact_messages'] loop
    execute format('drop policy if exists "admin all %1$s" on public.%1$s', t);
    execute format('create policy "admin all %1$s" on public.%1$s for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

-- =====================================================================
-- STORAGE
-- media   : foto/video katalog, portfolio, HPL, video (public read, admin write)
-- uploads : foto customer & referensi (public read, ditulis server via service role)
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('media', 'media', true, 52428800,
    array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime']),
  ('uploads', 'uploads', true, 5242880,
    array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "public read media" on storage.objects;
create policy "public read media" on storage.objects
  for select to anon, authenticated using (bucket_id in ('media', 'uploads'));

drop policy if exists "admin insert media" on storage.objects;
create policy "admin insert media" on storage.objects
  for insert to authenticated with check (bucket_id in ('media', 'uploads') and public.is_admin());

drop policy if exists "admin update media" on storage.objects;
create policy "admin update media" on storage.objects
  for update to authenticated using (bucket_id in ('media', 'uploads') and public.is_admin());

drop policy if exists "admin delete media" on storage.objects;
create policy "admin delete media" on storage.objects
  for delete to authenticated using (bucket_id in ('media', 'uploads') and public.is_admin());
