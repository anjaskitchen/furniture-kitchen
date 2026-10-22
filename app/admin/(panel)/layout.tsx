import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { logoutAction } from "@/app/admin/actions";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminLive } from "@/components/LiveRefresh";
import { accountLabel } from "@/lib/admin/accounts";
import { requireAdminPage } from "@/lib/admin/auth";
import { countRows } from "@/lib/admin/data";
import { SIDEBAR_COOKIE } from "@/lib/admin/navigation";
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
            Akun <strong>{accountLabel(user)}</strong> belum memiliki role admin. Minta admin utama mengubah role di menu Akun Admin, atau jalankan{" "}
            <code>npm run admin:create</code> (README bagian &quot;Cara membuat admin&quot;).
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
  const [settings, cookieStore, pendingSubs, newSurveys, newMessages] = await Promise.all([
    getSettings(),
    cookies(),
    countRows("customer_submissions", ["status", "pending"]),
    countRows("survey_requests", ["status", "new"]),
    countRows("contact_messages", ["status", "new"]),
  ]);
  return (
    <AdminShell
      businessName={settings.business_name}
      userLabel={accountLabel(user)}
      role={user.role}
      initialCollapsed={cookieStore.get(SIDEBAR_COOKIE)?.value === "collapsed"}
      badges={{ "/admin/submissions": pendingSubs, "/admin/surveys": newSurveys, "/admin/messages": newMessages }}
    >
      {children}
      <AdminLive />
    </AdminShell>
  );
}
