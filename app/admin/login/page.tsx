import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/admin/LoginForm";
import { SmartImage } from "@/components/SmartImage";
import { accountLabel } from "@/lib/admin/accounts";
import { getCurrentUser } from "@/lib/admin/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { getSettings } from "@/services/data";

export const metadata: Metadata = { title: "Login Admin", robots: { index: false, follow: false } };

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function LoginPage({ searchParams }: { searchParams: SP }) {
  const [sp, user, settings] = await Promise.all([searchParams, getCurrentUser(), getSettings()]);
  if (user && ["admin", "editor"].includes(user.role)) redirect("/admin");
  return (
    <main className="grid min-h-[100dvh] bg-cream-50 lg:grid-cols-2">
      {/* Panel visual (desktop) */}
      <div className="relative hidden overflow-hidden bg-charcoal-950 lg:block">
        <SmartImage src={settings.hero_image_url} alt="" fill priority sizes="50vw" className="object-cover opacity-60" />
        <div className="absolute inset-0 bg-gradient-to-t from-charcoal-950 via-charcoal-950/40 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-12 text-cream-50">
          <p className="eyebrow !text-bronze-300">Admin Panel</p>
          <p className="mt-3 max-w-md font-display text-3xl font-bold leading-tight">Kelola katalog, harga, dan tampilan website {settings.business_name} dari satu tempat.</p>
        </div>
      </div>

      <div className="flex flex-col px-5 py-6 sm:px-10">
        <Link href="/" className="inline-flex w-fit items-center gap-2 text-sm text-charcoal-700 transition hover:text-charcoal-900">
          <ArrowLeft className="h-4 w-4" /> Ke website
        </Link>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-charcoal-900 font-display text-xl font-bold text-bronze-300">{settings.business_name.charAt(0)}</span>
          <h1 className="mt-6 text-3xl font-bold">Masuk ke admin</h1>
          <p className="mt-2 text-sm text-charcoal-700">Gunakan username atau email beserta password akun Anda.</p>
          <div className="mt-8">
            {!isSupabaseConfigured ? (
              <div className="rounded-2xl bg-white p-6 text-sm leading-relaxed ring-1 ring-charcoal-900/5">
                <p className="font-semibold">Supabase belum dikonfigurasi.</p>
                <p className="mt-2 text-charcoal-700">
                  Isi <code className="rounded bg-cream-200 px-1">NEXT_PUBLIC_SUPABASE_URL</code> dan <code className="rounded bg-cream-200 px-1">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>, jalankan{" "}
                  <code>npm run db:setup</code>, lalu buat admin dengan <code>npm run admin:create</code>.
                </p>
              </div>
            ) : (
              <>
                {user && <p className="mb-4 rounded-xl bg-amber-100 p-3 text-xs text-amber-900">Akun {accountLabel(user)} belum memiliki role admin.</p>}
                <LoginForm next={typeof sp.next === "string" ? sp.next : "/admin"} />
              </>
            )}
          </div>
        </div>
        <p className="text-center text-xs text-charcoal-700/60">© {new Date().getFullYear()} {settings.business_name}</p>
      </div>
    </main>
  );
}
