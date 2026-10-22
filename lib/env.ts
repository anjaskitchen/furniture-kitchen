/**
 * Normalisasi URL situs agar build tidak gagal karena isian env yang kurang rapi:
 * "domain.com", " https://domain.com/ ", atau kosong. Jika kosong, memakai domain
 * otomatis dari Vercel (production → deployment), lalu localhost.
 */
function resolveSiteUrl(): string {
  const candidates = [
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL,
    process.env.VERCEL_URL,
  ];
  for (const raw of candidates) {
    const value = raw?.trim().replace(/^["']|["']$/g, "");
    if (!value) continue;
    const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    try {
      return new URL(withProtocol).origin;
    } catch {
      console.warn(`[env] URL situs tidak valid diabaikan: "${value}"`);
    }
  }
  return "http://localhost:3000";
}

/** Akses environment variable terpusat. Variabel tanpa NEXT_PUBLIC_ hanya tersedia di server. */
export const publicEnv = {
  supabaseUrl: (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim().replace(/\/$/, ""),
  supabaseAnonKey: (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim(),
  siteUrl: resolveSiteUrl(),
  gaId: (process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? "").trim(),
};

/** true jika Supabase sudah dikonfigurasi. Jika false website berjalan dalam "mode demo". */
export const isSupabaseConfigured = Boolean(publicEnv.supabaseUrl && publicEnv.supabaseAnonKey);
