import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { publicEnv } from "@/lib/env";

/** Client untuk Server Component / Server Action / Route Handler — memakai sesi user (RLS berlaku). */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Dipanggil dari Server Component — middleware yang akan me-refresh sesi.
        }
      },
    },
  });
}

/** Client publik tanpa cookie — aman untuk data publik yang di-cache (ISR). */
export function createPublicClient() {
  return createSupabaseClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Client service-role — MELEWATI RLS. Hanya dipakai di server untuk insert lead
 * dari form publik (setelah validasi) dan manajemen admin user.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!publicEnv.supabaseUrl || !key) return null;
  return createSupabaseClient(publicEnv.supabaseUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
