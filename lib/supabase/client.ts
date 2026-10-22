"use client";
import { createBrowserClient } from "@supabase/ssr";

/** Client browser (anon key, sesi via cookie). Dipakai admin untuk upload ke Storage. */
export function createClient() {
  return createBrowserClient(
    (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim().replace(/\/$/, ""),
    (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim(),
  );
}
