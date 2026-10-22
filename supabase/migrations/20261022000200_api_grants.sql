-- =====================================================================
-- Hak akses eksplisit untuk role Data API (anon, authenticated, service_role).
-- Project Supabase baru tidak selalu memberi grant otomatis untuk tabel yang
-- dibuat lewat SQL, jadi grant ditulis eksplisit. Keamanan baris tetap dijaga
-- oleh RLS (semua tabel RLS aktif).
-- =====================================================================
grant usage on schema public to anon, authenticated, service_role;

grant select on
  public.categories, public.materials, public.products, public.hpl_colors, public.duco_colors,
  public.hardware, public.price_settings, public.portfolio, public.videos, public.reviews,
  public.settings, public.home_sections, public.features, public.faqs
to anon, authenticated;

grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to anon, authenticated, service_role;

grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.is_super_admin() to anon, authenticated;
grant execute on function public.increment_product_counter(uuid, text) to anon, authenticated;
