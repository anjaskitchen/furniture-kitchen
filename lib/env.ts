/** Akses environment variable terpusat. Variabel tanpa NEXT_PUBLIC_ hanya tersedia di server. */
export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  siteUrl: (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  gaId: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? "",
};

/** true jika Supabase sudah dikonfigurasi. Jika false website berjalan dalam "mode demo". */
export const isSupabaseConfigured = Boolean(publicEnv.supabaseUrl && publicEnv.supabaseAnonKey);
