import { CalendarCheck, Image as ImageIcon, Inbox, Mail, Package, TrendingUp, Video } from "lucide-react";
import Link from "next/link";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { countRows } from "@/lib/admin/data";
import { formatDateID, formatRupiah } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Dashboard" };

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default async function Dashboard() {
  const sb = await createClient();
  const since = new Date();
  since.setMonth(since.getMonth() - 5, 1);
  since.setHours(0, 0, 0, 0);

  const [products, portfolio, videos, pendingSubs, totalSubs, surveys, messages, popular, surveyDates, messageDates, latestSurveys, latestMessages] = await Promise.all([
    countRows("products"),
    countRows("portfolio"),
    countRows("videos"),
    countRows("customer_submissions", ["status", "pending"]),
    countRows("customer_submissions"),
    countRows("survey_requests"),
    countRows("contact_messages"),
    sb.from("products").select("id,name,slug,view_count,inquiry_count").order("view_count", { ascending: false }).limit(5),
    sb.from("survey_requests").select("created_at").gte("created_at", since.toISOString()),
    sb.from("contact_messages").select("created_at").gte("created_at", since.toISOString()),
    sb.from("survey_requests").select("id,name,furniture_type,estimate_total,created_at,status").order("created_at", { ascending: false }).limit(5),
    sb.from("contact_messages").select("id,name,furniture_type,estimate_total,created_at,status").order("created_at", { ascending: false }).limit(5),
  ]);

  // Grafik leads 6 bulan terakhir
  const months: { key: string; label: string; survey: number; message: number }[] = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(since);
    d.setMonth(since.getMonth() + i);
    months.push({ key: monthKey(d), label: d.toLocaleDateString("id-ID", { month: "short" }), survey: 0, message: 0 });
  }
  for (const r of surveyDates.data ?? []) {
    const m = months.find((x) => x.key === monthKey(new Date(r.created_at)));
    if (m) m.survey++;
  }
  for (const r of messageDates.data ?? []) {
    const m = months.find((x) => x.key === monthKey(new Date(r.created_at)));
    if (m) m.message++;
  }
  const maxLeads = Math.max(1, ...months.map((m) => m.survey + m.message));
  const popularList = popular.data ?? [];
  const maxViews = Math.max(1, ...popularList.map((p) => p.view_count));

  const stats = [
    { label: "Total Produk", value: products, icon: Package, href: "/admin/products" },
    { label: "Total Portfolio", value: portfolio, icon: ImageIcon, href: "/admin/portfolio" },
    { label: "Total Video", value: videos, icon: Video, href: "/admin/videos" },
    { label: "Customer Submission", value: totalSubs, sub: `${pendingSubs} pending`, icon: Inbox, href: "/admin/submissions" },
    { label: "Request Survey", value: surveys, icon: CalendarCheck, href: "/admin/surveys" },
    { label: "Total Leads", value: surveys + messages, sub: `${messages} pesan email`, icon: TrendingUp, href: "/admin/messages" },
  ];

  return (
    <>
      <AdminHeader title="Dashboard" description="Ringkasan konten dan leads website." />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {stats.map(({ label, value, sub, icon: Icon, href }) => (
          <Link key={label} href={href} className="card p-5 transition hover:shadow-soft">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-charcoal-700 sm:text-sm">{label}</p>
              <Icon className="h-5 w-5 text-wood-500" />
            </div>
            <p className="mt-3 font-display text-3xl font-bold">{value}</p>
            {sub && <p className="mt-1 text-xs text-charcoal-700/70">{sub}</p>}
          </Link>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="card p-6">
          <h2 className="font-display text-lg font-semibold">Leads 6 bulan terakhir</h2>
          <div className="mt-2 flex gap-4 text-xs text-charcoal-700">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-wood-500" /> Survey</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-bronze-300" /> Email</span>
          </div>
          <div className="mt-6 flex h-48 items-end gap-3" role="img" aria-label="Grafik leads per bulan">
            {months.map((m) => (
              <div key={m.key} className="flex flex-1 flex-col items-center gap-2">
                <span className="text-xs font-semibold">{m.survey + m.message}</span>
                <div className="flex w-full max-w-10 flex-col-reverse overflow-hidden rounded-md bg-cream-200" style={{ height: "100%" }}>
                  <div className="bg-wood-500" style={{ height: `${(m.survey / maxLeads) * 100}%` }} />
                  <div className="bg-bronze-300" style={{ height: `${(m.message / maxLeads) * 100}%` }} />
                </div>
                <span className="text-xs text-charcoal-700">{m.label}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="card p-6">
          <h2 className="font-display text-lg font-semibold">Produk terpopuler</h2>
          <ul className="mt-5 space-y-4">
            {popularList.map((p) => (
              <li key={p.id}>
                <div className="flex justify-between text-sm">
                  <Link href={`/katalog/${p.slug}`} target="_blank" className="font-medium hover:text-wood-600">{p.name}</Link>
                  <span className="text-xs text-charcoal-700">{p.view_count} dilihat · {p.inquiry_count} inquiry</span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-cream-200">
                  <div className="h-full rounded-full bg-wood-500" style={{ width: `${(p.view_count / maxViews) * 100}%` }} />
                </div>
              </li>
            ))}
            {!popularList.length && <li className="text-sm text-charcoal-700">Belum ada data.</li>}
          </ul>
        </section>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {[
          { title: "Request survey terbaru", rows: latestSurveys.data ?? [], href: "/admin/surveys", icon: CalendarCheck },
          { title: "Pesan email terbaru", rows: latestMessages.data ?? [], href: "/admin/messages", icon: Mail },
        ].map(({ title, rows, href, icon: Icon }) => (
          <section key={title} className="card p-6">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-display text-lg font-semibold"><Icon className="h-4 w-4 text-wood-500" /> {title}</h2>
              <Link href={href} className="text-sm text-wood-600 hover:underline">Semua</Link>
            </div>
            <ul className="mt-4 divide-y divide-charcoal-900/5 text-sm">
              {rows.map((r) => (
                <li key={r.id} className="flex justify-between gap-3 py-3">
                  <span>
                    <span className="font-medium">{r.name}</span>
                    <span className="block text-xs text-charcoal-700">{r.furniture_type ?? "-"} · {formatDateID(r.created_at)}</span>
                  </span>
                  <span className="text-right text-xs">
                    {r.estimate_total ? formatRupiah(Number(r.estimate_total)) : "-"}
                    <span className="mt-1 block rounded-full bg-cream-200 px-2 py-0.5">{r.status}</span>
                  </span>
                </li>
              ))}
              {!rows.length && <li className="py-3 text-charcoal-700">Belum ada data.</li>}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
