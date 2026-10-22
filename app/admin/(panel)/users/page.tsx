import { AdminHeader } from "@/components/admin/AdminHeader";
import { UserManager } from "@/components/admin/UserManager";
import { getCurrentUser } from "@/lib/admin/auth";
import { createClient } from "@/lib/supabase/server";
import type { AppUser } from "@/types";

export const metadata = { title: "Akun Admin" };

export default async function Page() {
  const [me, sb] = await Promise.all([getCurrentUser(), createClient()]);
  const { data } = await sb.from("users").select("*").order("created_at");
  // Admin melihat semua akun; editor hanya akunnya sendiri.
  const users = ((data ?? []) as AppUser[]).filter((u) => me?.role === "admin" || u.id === me?.id);
  return (
    <>
      <AdminHeader title="Akun Admin" description="Tambah, ubah, dan hapus akun yang bisa masuk ke Admin Panel. Editor: konten, harga & leads. Admin: akses penuh." />
      <UserManager users={users} meId={me!.id} isSuperAdmin={me?.role === "admin"} />
    </>
  );
}
