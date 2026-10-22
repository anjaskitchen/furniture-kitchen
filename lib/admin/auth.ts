import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type { AppUser } from "@/types";

export class AuthError extends Error {}

/** Ambil user login + profil (role). */
export const getCurrentUser = cache(async (): Promise<AppUser | null> => {
  if (!isSupabaseConfigured) return null;
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return null;
  const { data } = await sb.from("users").select("*").eq("id", user.id).maybeSingle();
  return (data as AppUser | null) ?? { id: user.id, email: user.email ?? "", username: null, full_name: null, role: "customer", created_at: user.created_at };
});

/** Untuk halaman admin: redirect ke login jika belum login. */
export async function requireAdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/admin/login");
  return user;
}

/** Untuk server action: lempar error jika bukan admin/editor. RLS di database tetap menjadi lapisan kedua. */
export async function assertAdmin(superAdmin = false) {
  const user = await getCurrentUser();
  if (!user) throw new AuthError("Silakan login terlebih dahulu");
  if (superAdmin ? user.role !== "admin" : !["admin", "editor"].includes(user.role)) {
    throw new AuthError("Akses ditolak: akun Anda bukan admin");
  }
  return user;
}
