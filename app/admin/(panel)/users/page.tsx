import { AdminHeader } from "@/components/admin/AdminHeader";
import { UserManager } from "@/components/admin/UserManager";
import { getCurrentUser } from "@/lib/admin/auth";
import { createClient } from "@/lib/supabase/server";
import type { AppUser } from "@/types";

export const metadata = { title: "Admin User" };

export default async function Page() {
  const [me, sb] = await Promise.all([getCurrentUser(), createClient()]);
  const { data } = await sb.from("users").select("*").in("role", ["admin", "editor"]).order("created_at");
  return (
    <>
      <AdminHeader title="Admin User" description="Kelola akun yang bisa masuk ke Admin Panel. Editor: konten & harga. Admin: akses penuh." />
      <UserManager users={(data ?? []) as AppUser[]} meId={me!.id} isSuperAdmin={me?.role === "admin"} />
    </>
  );
}
