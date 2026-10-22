-- =====================================================================
-- Supabase Realtime: website & admin menerima perubahan data secara live.
-- RLS tetap berlaku: pengunjung hanya menerima baris publik/aktif,
-- lead hanya dikirim ke admin/editor yang login.
-- =====================================================================
do $$
declare t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  foreach t in array array[
    'settings', 'home_sections', 'features', 'faqs', 'categories', 'materials', 'products',
    'portfolio', 'videos', 'reviews', 'hpl_colors', 'duco_colors', 'hardware', 'price_settings',
    'survey_requests', 'contact_messages', 'customer_submissions'
  ] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
