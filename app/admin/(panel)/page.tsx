import {
  ArrowUpRight,
  CalendarCheck,
  CheckCircle2,
  Circle,
  Image as ImageIcon,
  Inbox,
  LayoutTemplate,
  Mail,
  Package,
  Plus,
  TrendingUp,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { accountLabel } from "@/lib/admin/accounts";
import { requireAdminPage } from "@/lib/admin/auth";
import { countRows } from "@/lib/admin/data";
import { formatDateID, formatRupiah } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { getSettings } from "@/services/data";

export const metadata = { title: "Dashboard" };

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function greeting() {
  const h = Number(new Date().toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: "Asia/Jakarta" }));
  if (h < 11) return "Selamat pagi";
  if (h < 15) return "Selamat siang";
  if (h < 18) return "Selamat sore";
  return "Selamat malam";
}

const STATUS_STYLE: Record<string, string> = {
  new: "bg-wood-500 text-white",
  contacted: "bg-bronze-300 text-charcoal-900",
  scheduled: "bg-sky-100 text-sky-800",
  read: "bg-cream-200 text-charcoal-800",
  replied: "bg-green-100 text-green-800",
  done: "bg-green-100 text-green-800",
  archived: "bg-charcoal-900/5 text-charcoal-700",
  cancelled: "bg-charcoal-900/5 text-charcoal-700",
};

const isPlaceholder = (url: string | null | undefined) => !url || url.startsWith("/placeholders/");

export default async function Dashboard() {
  const user = await requireAdminPage();
  const sb = await createClient();
  const since = new Date();
  since.setMonth(since.getMonth() - 5, 1);
  since.setHours(0, 0, 0, 0);

  const [
    settings,
    products,
    portfolio,
    pendingSubs,
    surveys,
    newSurveys,
    messages,
    newMessages,
    popular,
    surveyDates,
    messageDates,
    latestSurveys,
    latestMessages,
    productImages,
    portfolioImages,
  ] = await Promise.all([
    getSettings(),
    countRows("products"),
    countRows("portfolio"),
    countRows("customer_submissions", ["status", "pending"]),
    countRows("survey_requests"),
    countRows("survey_requests", ["status", "new"]),
    countRows("contact_messages"),
    countRows("contact_messages", ["status", "new"]),
    sb.from("products").select("id,name,slug,view_count,inquiry_count").order("view_count", { ascending: false }).limit(5),
    sb.from("survey_requests").select("created_at").gte("created_at", since.toISOString()),
    sb.from("contact_messages").select("created_at").gte("created_at", since.toISOString()),
    sb.from("survey_requests").select("id,name,furniture_type,estimate_total,created_at,status").order("created_at", { ascending: false }).limit(5),
    sb.from("contact_messages").select("id,name,furniture_type,estimate_total,created_at,status").order("created_at", { ascending: false }).limit(5),
    sb.from("products").select("images"),
    sb.from("portfolio").select("images"),
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
  const leads6 = months.reduce((a, m) => a + m.survey + m.message, 0);
  const popularList = popular.data ?? [];
  const maxViews = Math.max(1, ...popularList.map((p) => p.view_count));

  const latest = [
    ...(latestSurveys.data ?? []).map((r) => ({ ...r, kind: "Survey" as const, href: "/admin/surveys" })),
    ...(latestMessages.data ?? []).map((r) => ({ ...r, kind: "Pesan" as const, href: "/admin/messages" })),
  ]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 6);

  const placeholderProducts = (productImages.data ?? []).filter((p) => !p.images?.length || p.images.every(isPlaceholder)).length;
  const placeholderPortfolio = (portfolioImages.data ?? []).filter((p) => !p.images?.length || p.images.every(isPlaceholder)).length;
  const readiness = [
    { done: Boolean(settings.whatsapp_number && settings.whatsapp_number !== "6281234567890"), label: "Nomor WhatsApp bisnis", href: "/admin/settings" },
    { done: Boolean(settings.logo_url), label: "Logo diunggah", href: "/admin/settings" },
    { done: !isPlaceholder(settings.hero_image_url), label: "Foto hero asli", href: "/admin/settings" },
    { done: Boolean(settings.address && !settings.address.includes("Contoh")), label: "Alamat workshop", href: "/admin/settings" },
    { done: placeholderProducts === 0, label: placeholderProducts ? `Foto asli produk (${placeholderProducts} masih contoh)` : "Foto asli produk", href: "/admin/products" },
    { done: placeholderPortfolio === 0, label: placeholderPortfolio ? `Foto asli portfolio (${placeholderPortfolio} masih contoh)` : "Foto asli portfolio", href: "/admin/portfolio" },
    { done: Boolean(settings.google_place_id), label: "Google Review live (Place ID)", href: "/admin/settings" },
  ];
  const readyCount = readiness.filter((r) => r.done).length;

  const attention = [
    { count: newSurveys, label: "request survey baru", href: "/admin/surveys", icon: CalendarCheck },
    { count: newMessages, label: "pesan kontak baru", href: "/admin/messages", icon: Mail },
    { count: pendingSubs, label: "submission menunggu approval", href: "/admin/submissions", icon: Inbox },
  ].filter((a) => a.count > 0);

  const stats = [
    { label: "Total leads", value: surveys + messages, sub: `${leads6} dalam 6 bulan`, icon: TrendingUp, href: "/admin/surveys" },
    { label: "Request survey", value: surveys, sub: `${newSurveys} baru`, icon: CalendarCheck, href: "/admin/surveys" },
    { label: "Produk", value: products, sub: "di katalog", icon: Package, href: "/admin/products" },
    { label: "Portfolio", value: portfolio, sub: "project", icon: ImageIcon, href: "/admin/portfolio" },
  ];

  const quick = [
    { label: "Tambah produk", href: "/admin/products", icon: Plus },
    { label: "Ubah harga", href: "/admin/prices", icon: Wallet },
    { label: "Atur landing page", href: "/admin/landing", icon: LayoutTemplate },
  ];

  return (
    <>
      <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-charcoal-700">
            {new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" })}
          </p>
          <h1 className="mt-1 text-2xl font-bold sm:text-3xl">
            {greeting()}, {accountLabel(user)}
          </h1>
        </div>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0 sm:pb-0">
          {quick.map(({ label, href, icon: Icon }) => (
            <Link key={href} href={href} className="btn-outline btn-sm shrink-0 bg-white !py-2.5">
              <Icon className="h-3.5 w-3.5" /> {label}
            </Link>
          ))}
        </div>
      </div>

      {attention.length > 0 && (
        <section aria-label="Perlu tindakan" className="mb-6 grid gap-3 sm:grid-cols-3">
          {attention.map(({ count, label, href, icon: Icon }) => (
            <Link key={href} href={href} className="group flex items-center gap-3 rounded-2xl bg-charcoal-900 p-4 text-cream-50 transition hover:bg-wood-600">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/10">
                <Icon className="h-5 w-5 text-bronze-300" />
              </span>
              <span className="flex-1 text-sm">
                <strong className="block font-display text-xl">{count}</strong>
                {label}
              </span>
              <ArrowUpRight className="h-4 w-4 opacity-60 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100" />
            </Link>
          ))}
        </section>
      )}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {stats.map(({ label, value, sub, icon: Icon, href }) => (
          <Link key={label} href={href} className="group rounded-2xl bg-white p-4 ring-1 ring-charcoal-900/5 transition hover:-translate-y-0.5 hover:shadow-soft sm:p-5">
            <div className="flex items-center justify-between">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-cream-100 text-wood-600">
                <Icon className="h-[18px] w-[18px]" />
              </span>
              <ArrowUpRight className="h-4 w-4 text-charcoal-700/30 transition group-hover:text-wood-600" />
            </div>
            <p className="mt-4 font-display text-2xl font-bold tabular-nums sm:text-3xl">{value}</p>
            <p className="text-sm font-medium">{label}</p>
            <p className="mt-0.5 text-xs text-charcoal-700/70">{sub}</p>
          </Link>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <section className="rounded-2xl bg-white p-5 ring-1 ring-charcoal-900/5 sm:p-6 lg:col-span-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="font-display text-lg font-semibold">Leads 6 bulan terakhir</h2>
              <p className="text-sm text-charcoal-700">{leads6} leads dari form survey & kontak</p>
            </div>
            <div className="flex gap-4 text-xs text-charcoal-700">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-wood-500" /> Survey
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-bronze-300" /> Kontak
              </span>
            </div>
          </div>
          <div className="mt-6 flex h-44 items-end gap-2 sm:gap-4" role="img" aria-label={`Grafik leads per bulan, total ${leads6}`}>
            {months.map((m) => {
              const total = m.survey + m.message;
              return (
                <div key={m.key} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                  <span className={cn("text-xs font-semibold tabular-nums", !total && "text-charcoal-700/40")}>{total}</span>
                  <div className="flex w-full max-w-12 flex-col-reverse overflow-hidden rounded-lg bg-cream-100" style={{ height: `${Math.max(6, (total / maxLeads) * 100)}%` }}>
                    <div className="bg-wood-500" style={{ height: total ? `${(m.survey / total) * 100}%` : 0 }} />
                    <div className="bg-bronze-300" style={{ height: total ? `${(m.message / total) * 100}%` : 0 }} />
                  </div>
                  <span className="text-xs text-charcoal-700">{m.label}</span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-2xl bg-white p-5 ring-1 ring-charcoal-900/5 sm:p-6 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Kesiapan website</h2>
            <span className="rounded-full bg-cream-100 px-2.5 py-1 text-xs font-semibold tabular-nums">
              {readyCount}/{readiness.length}
            </span>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-cream-100">
            <div className="h-full rounded-full bg-wood-500 transition-all" style={{ width: `${(readyCount / readiness.length) * 100}%` }} />
          </div>
          <ul className="mt-4 space-y-1">
            {readiness.map((r) => (
              <li key={r.label}>
                <Link href={r.href} className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm transition hover:bg-cream-100">
                  {r.done ? <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" /> : <Circle className="h-4 w-4 shrink-0 text-charcoal-700/30" />}
                  <span className={cn("flex-1", r.done && "text-charcoal-700/60 line-through decoration-charcoal-700/30")}>{r.label}</span>
                  {!r.done && <ArrowUpRight className="h-3.5 w-3.5 text-wood-600" />}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl bg-white p-5 ring-1 ring-charcoal-900/5 sm:p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Leads terbaru</h2>
            <Link href="/admin/surveys" className="text-sm font-medium text-wood-600 hover:underline">
              Lihat semua
            </Link>
          </div>
          <ul className="mt-3 divide-y divide-charcoal-900/5">
            {latest.map((r) => (
              <li key={`${r.kind}-${r.id}`}>
                <Link href={r.href} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-3 transition hover:bg-cream-50">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-cream-100 text-xs font-bold uppercase text-wood-700">{r.name.slice(0, 2)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{r.name}</span>
                    <span className="block truncate text-xs text-charcoal-700">
                      {r.kind} · {r.furniture_type ?? "-"} · {formatDateID(r.created_at)}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    {r.estimate_total ? <span className="block text-xs font-semibold tabular-nums">{formatRupiah(Number(r.estimate_total))}</span> : null}
                    <span className={cn("mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium", STATUS_STYLE[r.status] ?? "bg-cream-200")}>{r.status}</span>
                  </span>
                </Link>
              </li>
            ))}
            {!latest.length && <li className="py-6 text-center text-sm text-charcoal-700">Belum ada leads. Leads dari form survey & kontak akan muncul di sini secara realtime.</li>}
          </ul>
        </section>

        <section className="rounded-2xl bg-white p-5 ring-1 ring-charcoal-900/5 sm:p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Produk terpopuler</h2>
            <Link href="/admin/products" className="text-sm font-medium text-wood-600 hover:underline">
              Kelola
            </Link>
          </div>
          <ul className="mt-4 space-y-4">
            {popularList.map((p, i) => (
              <li key={p.id} className="flex items-center gap-3">
                <span className="w-5 text-center font-display text-sm font-bold text-charcoal-700/40">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <Link href={`/katalog/${p.slug}`} target="_blank" className="truncate font-medium hover:text-wood-600">
                      {p.name}
                    </Link>
                    <span className="shrink-0 text-xs tabular-nums text-charcoal-700">
                      {p.view_count} lihat · {p.inquiry_count} tanya
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-cream-100">
                    <div className="h-full rounded-full bg-wood-500" style={{ width: `${(p.view_count / maxViews) * 100}%` }} />
                  </div>
                </div>
              </li>
            ))}
            {!popularList.length && <li className="text-sm text-charcoal-700">Belum ada data.</li>}
          </ul>
        </section>
      </div>
    </>
  );
}
