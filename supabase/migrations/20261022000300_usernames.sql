-- =====================================================================
-- Username untuk login admin (selain email). Akun boleh dibuat tanpa email:
-- aplikasi memberi alamat internal (@akun.internal) yang tidak ditampilkan.
-- =====================================================================

alter table public.users add column if not exists username text;

alter table public.users drop constraint if exists users_username_format;
alter table public.users add constraint users_username_format
  check (username is null or username ~ '^[a-z0-9][a-z0-9._-]{2,29}$');

create unique index if not exists users_username_key on public.users (username);

-- Profil otomatis: ambil username dari metadata saat user dibuat lewat Admin API.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, full_name, username)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(lower(new.raw_user_meta_data ->> 'username'), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Sinkronkan email profil jika email login diubah lewat Auth.
create or replace function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.users set email = new.email where id = new.id and email is distinct from new.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function public.handle_user_email_change();
