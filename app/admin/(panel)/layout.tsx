import type { Metadata } from "next";
import Link from "next/link";
import { logoutAction } from "@/app/admin/actions";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { requireAdminPage } from "@/lib/admin/auth";
import { countRows } from "@/lib/admin/data";
import { getSettings } from "@/services/data";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · Admin" }, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdminPage();
  if (!["admin", "editor"].includes(user.role)) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6 text-center">
        <div className="card max-w-md p-8">
          <h1 className="text-2xl font-bold">Akses ditolak</h1>
          <p className="mt-3 text-sm text-charcoal-700">
            Akun <strong>{user.email}</strong> belum memiliki role admin. Minta admin utama menambahkan role, atau jalankan SQL di README bagian &quot;Cara membuat admin&quot;.
          </p>
          <div className="mt-6 flex justify-center gap-2">
            <Link href="/" className="btn-outline">Ke website</Link>
            <form action={logoutAction}>
              <button className="btn-primary">Keluar</button>
            </form>
          </div>
        </div>
      </main>
    );
  }
  const [settings, pendingSubs, newSurveys, newMessages] = await Promise.all([
    getSettings(),
    countRows("customer_submissions", ["status", "pending"]),
    countRows("survey_requests", ["status", "new"]),
    countRows("contact_messages", ["status", "new"]),
  ]);
  return (
    <div className="min-h-screen bg-cream-100 text-charcoal-900">
      <AdminSidebar
        businessName={settings.business_name}
        userEmail={user.email}
        badges={{ "/admin/submissions": pendingSubs, "/admin/surveys": newSurveys, "/admin/messages": newMessages }}
      />
      <div className="lg:pl-64">
        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-10">{children}</main>
      </div>
    </div>
  );
}
