-- Tulisan di samping logo navbar (2 baris: atas & bawah), diatur di Admin → Pengaturan Website.
alter table public.settings
  add column if not exists brand_title text default 'Kitchen Set Custom',
  add column if not exists brand_subtitle text default 'Bandung';
