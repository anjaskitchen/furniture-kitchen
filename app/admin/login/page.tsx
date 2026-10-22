import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/admin/LoginForm";
import { accountLabel } from "@/lib/admin/accounts";
import { getCurrentUser } from "@/lib/admin/auth";
import { isSupabaseConfigured } from "@/lib/env";

export const metadata: Metadata = { title: "Login Admin", robots: { index: false, follow: false } };

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function LoginPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const user = await getCurrentUser();
  if (user && ["admin", "editor"].includes(user.role)) redirect("/admin");
  return (
    <main className="flex min-h-screen items-center justify-center bg-cream-100 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="eyebrow">Admin Panel</p>
          <h1 className="mt-2 text-3xl font-bold">Masuk</h1>
        </div>
        {!isSupabaseConfigured ? (
          <div className="card p-6 text-sm leading-relaxed">
            <p className="font-semibold">Supabase belum dikonfigurasi.</p>
            <p className="mt-2 text-charcoal-700">
              Isi <code className="rounded bg-cream-200 px-1">NEXT_PUBLIC_SUPABASE_URL</code> dan{" "}
              <code className="rounded bg-cream-200 px-1">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> di file <code>.env.local</code>, jalankan schema & seed SQL, lalu buat user admin.
              Lihat README bagian &quot;Cara membuat admin&quot;.
            </p>
          </div>
        ) : (
          <div className="card p-6">
            {user && <p className="mb-4 rounded-lg bg-amber-100 p-3 text-xs text-amber-900">Akun {accountLabel(user)} belum memiliki role admin.</p>}
            <LoginForm next={typeof sp.next === "string" ? sp.next : "/admin"} />
          </div>
        )}
      </div>
    </main>
  );
}
