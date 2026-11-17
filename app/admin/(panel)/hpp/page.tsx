import { AlertTriangle, Calculator, Coins, FileSpreadsheet, Percent, TrendingUp } from "lucide-react";
import Link from "next/link";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { OwnerOnly } from "@/components/admin/erp/OwnerOnly";
import { CompositionBar, HppPctBars, MonthlyHppChart, type PctRow } from "@/components/admin/erp/hpp/HppCharts";
import { HppSettingsForm } from "@/components/admin/erp/hpp/HppSettingsForm";
import { PeriodPicker } from "@/components/admin/orders/PeriodPicker";
import { KpiCard, Panel, StatusBadge } from "@/components/admin/orders/ui";
import { getCurrentUser } from "@/lib/admin/auth";
import { getHppSettings, listItemHpp, listOrderHpp, type OrderHpp } from "@/lib/erp/hpp";
import { fmtPct, HPP_CATEGORIES, HPP_LEVEL_META, hppLevel, pct } from "@/lib/erp/hpp-shared";
import { formatRupiah } from "@/lib/format";
import { formatCompactRupiah, formatDateShort, resolvePeriod } from "@/lib/orders";
import { cn } from "@/lib/utils";

export const metadata = { title: "HPP & Margin" };

type SP = Promise<Record<string, string | string[] | undefined>>;
type Basis = "estimasi" | "aktual";

const BADGE = "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset tabular-nums";

export default async function HppDashboardPage({ searchParams }: { searchParams: SP }) {
  const user = await getCurrentUser();
  if (user?.role !== "admin") return <OwnerOnly title="HPP & Margin" />;
  const sp = await searchParams;
  const period = resolvePeriod(sp, "this_year");
  const basis: Basis = sp.basis === "aktual" ? "aktual" : "estimasi";
  const [orders, settings] = await Promise.all([listOrderHpp(period.from, period.to), getHppSettings()]);
  const { targetPct: target, maxPct: max } = settings;

  const hppOf = (o: OrderHpp) => (basis === "aktual" ? o.hpp_actual : o.hpp_estimate);
  const counted = orders.filter((o) => hppOf(o) > 0 && o.total > 0);
  const missing = orders.filter((o) => !(hppOf(o) > 0) && o.total > 0);
  const revenue = counted.reduce((a, o) => a + o.total, 0);
  const hpp = counted.reduce((a, o) => a + hppOf(o), 0);
  const hppPct = pct(hpp, revenue);
  const profit = revenue - hpp;
  const level = hppLevel(hppPct, target, max);
  const overMax = counted.filter((o) => (pct(hppOf(o), o.total) ?? 0) > max);

  // Per bulan
  const months = new Map<string, { revenue: number; hpp: number }>();
  {
    const [fy, fm] = period.from.slice(0, 7).split("-").map(Number);
    const [ty, tm] = period.to.slice(0, 7).split("-").map(Number);
    for (let y = fy, m = fm; y < ty || (y === ty && m <= tm); m === 12 ? ((m = 1), y++) : m++) months.set(`${y}-${String(m).padStart(2, "0")}`, { revenue: 0, hpp: 0 });
  }
  for (const o of counted) {
    const k = o.order_date.slice(0, 7);
    const m = months.get(k) ?? { revenue: 0, hpp: 0 };
    m.revenue += o.total;
    m.hpp += hppOf(o);
    months.set(k, m);
  }
  const monthly = [...months.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, m]) => ({ month, ...m, pct: pct(m.hpp, m.revenue) }));

  // Per kategori
  const cats = new Map<string, { revenue: number; hpp: number; n: number }>();
  for (const o of counted) {
    const k = o.category?.trim() || "Tanpa kategori";
    const c = cats.get(k) ?? { revenue: 0, hpp: 0, n: 0 };
    c.revenue += o.total;
    c.hpp += hppOf(o);
    c.n++;
    cats.set(k, c);
  }
  const categoryRows: PctRow[] = [...cats.entries()]
    .map(([label, c]) => ({ key: label, label, revenue: c.revenue, hpp: c.hpp, pct: pct(c.hpp, c.revenue), sub: `${c.n} order` }))
    .sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0));

  // Komposisi
  const detailOrders = counted.filter((o) => (basis === "aktual" ? o.hpp_actual > 0 : o.has_detail));
  const compParts =
    basis === "aktual"
      ? [
          { label: "Bahan baku", value: detailOrders.reduce((a, o) => a + o.actual_material, 0), color: HPP_CATEGORIES[0].color },
          { label: "Tenaga kerja", value: detailOrders.reduce((a, o) => a + o.actual_labor, 0), color: HPP_CATEGORIES[1].color },
          { label: "Biaya proyek lain", value: detailOrders.reduce((a, o) => a + o.actual_other, 0), color: HPP_CATEGORIES[2].color },
        ]
      : [
          { label: "Bahan baku", value: detailOrders.reduce((a, o) => a + o.material, 0), color: HPP_CATEGORIES[0].color },
          { label: "Tenaga kerja", value: detailOrders.reduce((a, o) => a + o.labor, 0), color: HPP_CATEGORIES[1].color },
          { label: "Overhead", value: detailOrders.reduce((a, o) => a + o.overhead, 0), color: HPP_CATEGORIES[2].color },
          { label: "Lainnya", value: detailOrders.reduce((a, o) => a + o.other, 0), color: HPP_CATEGORIES[3].color },
        ];
  const manualOnly = counted.filter((o) => basis === "estimasi" && !o.has_detail).length;

  // Item (hanya estimasi — rincian per item)
  const items = basis === "estimasi" ? await listItemHpp(counted.filter((o) => o.has_detail).map((o) => o.order_id)) : [];
  const orderNo = new Map(orders.map((o) => [o.order_id, o.order_number]));
  const itemRows: PctRow[] = items
    .filter((i) => i.line_total > 0)
    .sort((a, b) => (b.hpp_pct ?? 0) - (a.hpp_pct ?? 0))
    .slice(0, 12)
    .map((i) => ({ key: i.item_id, label: i.name, revenue: i.line_total, hpp: i.hpp_total, pct: i.hpp_pct, sub: orderNo.get(i.order_id), href: `/admin/hpp/${i.order_id}` }));

  const tableRows = [...orders].sort((a, b) => {
    const pa = pct(hppOf(a), a.total);
    const pb = pct(hppOf(b), b.total);
    if ((pa === null || !hppOf(a)) !== (pb === null || !hppOf(b))) return pa === null || !hppOf(a) ? 1 : -1;
    return (pb ?? 0) - (pa ?? 0);
  });

  const qs = (b: Basis) => {
    const p = new URLSearchParams();
    if (period.preset === "custom") {
      p.set("from", period.from);
      p.set("to", period.to);
    } else p.set("preset", period.preset);
    if (b === "aktual") p.set("basis", "aktual");
    return `/admin/hpp?${p.toString()}`;
  };
  const exportHref = qs(basis).replace("/admin/hpp?", "/admin/hpp/export?");

  return (
    <>
      <AdminHeader
        title="HPP & Margin"
        description="Harga pokok tiap barang yang dipesan, dihitung dari order masuk: bahan baku, tenaga kerja, dan overhead. Persentase HPP = HPP ÷ harga jual."
        action={
          <a href={exportHref} className="btn-outline btn-sm bg-white !py-2.5">
            <FileSpreadsheet className="h-4 w-4" /> Export Excel
          </a>
        }
      />

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex rounded-xl bg-white p-1 ring-1 ring-charcoal-900/5" role="tablist" aria-label="Dasar perhitungan">
          {(
            [
              ["estimasi", "Estimasi (rincian per item)"],
              ["aktual", "Aktual (biaya proyek)"],
            ] as const
          ).map(([b, label]) => (
            <Link
              key={b}
              href={qs(b)}
              role="tab"
              aria-selected={basis === b}
              className={cn("rounded-lg px-3 py-1.5 text-sm font-medium", basis === b ? "bg-charcoal-900 text-cream-50" : "text-charcoal-700 hover:bg-cream-100")}
              scroll={false}
            >
              {label}
            </Link>
          ))}
        </div>
        <PeriodPicker preset={period.preset} from={period.from} to={period.to} rangeLabel={period.label} />
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="HPP % rata-rata" icon={Percent} emphasis value={<span>{fmtPct(hppPct)}</span>} sub={<span>{HPP_LEVEL_META[level].label} · target ≤ {target}%</span>} hint="Total HPP ÷ total nilai order (tertimbang nilai order)" />
        <KpiCard label="Total HPP" icon={Coins} value={formatCompactRupiah(hpp)} sub={<span>dari penjualan {formatCompactRupiah(revenue)}</span>} />
        <KpiCard label="Laba kotor" icon={TrendingUp} value={<span className={profit < 0 ? "text-red-600" : undefined}>{formatCompactRupiah(profit)}</span>} sub={<span>Margin {fmtPct(pct(profit, revenue))}</span>} />
        <KpiCard
          label="Order sudah dihitung"
          icon={Calculator}
          value={`${counted.length}/${orders.length}`}
          sub={overMax.length ? <span className="text-red-600">{overMax.length} order HPP &gt; {max}%</span> : <span>Tidak ada order di atas {max}%</span>}
        />
      </section>

      {missing.length > 0 && (
        <p className="mt-4 flex items-start gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-600/20">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {missing.length} order ({formatCompactRupiah(missing.reduce((a, o) => a + o.total, 0))}) belum punya {basis === "aktual" ? "biaya proyek tercatat" : "HPP"} dan tidak ikut dihitung.
            {basis === "estimasi" && " Klik \"Hitung\" pada tabel di bawah untuk mengisinya."}
          </span>
        </p>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Panel title="HPP % per bulan" className="xl:col-span-2">
          <MonthlyHppChart data={monthly} target={target} max={max} />
        </Panel>
        <Panel title="Komposisi HPP">
          <CompositionBar
            parts={compParts}
            note={
              basis === "aktual"
                ? "Dari pemakaian stok, upah (absensi & borongan), dan biaya proyek."
                : manualOnly
                  ? `${manualOnly} order hanya punya HPP manual (tanpa rincian) sehingga tidak masuk komposisi.`
                  : "Overhead termasuk overhead otomatis per item."
            }
          />
        </Panel>
        <Panel title="HPP % per kategori">
          <HppPctBars rows={categoryRows} target={target} max={max} />
        </Panel>
        <Panel title={basis === "estimasi" ? "Item dengan HPP % tertinggi" : "Item"} className="xl:col-span-2">
          {basis === "estimasi" ? (
            <HppPctBars rows={itemRows} target={target} max={max} empty="Belum ada item dengan rincian HPP" />
          ) : (
            <p className="py-6 text-center text-sm text-charcoal-700/70">Biaya aktual tercatat per proyek (order), bukan per item. Pilih “Estimasi” untuk melihat HPP per item.</p>
          )}
        </Panel>
      </div>

      <Panel title="HPP per order" className="mt-6">
        {orders.length ? (
          <div className="-mx-5 overflow-x-auto sm:-mx-6">
            <table className="w-full min-w-[880px] text-sm">
              <thead className="bg-cream-50 text-left text-xs text-charcoal-700">
                <tr>
                  <th className="px-5 py-2 font-medium sm:px-6">Order</th>
                  <th className="px-3 py-2 text-right font-medium">Nilai order</th>
                  <th className="px-3 py-2 text-right font-medium">HPP estimasi</th>
                  <th className="px-3 py-2 text-right font-medium">% est.</th>
                  <th className="px-3 py-2 text-right font-medium">HPP aktual</th>
                  <th className="px-3 py-2 text-right font-medium">% aktual</th>
                  <th className="px-3 py-2 text-right font-medium">Laba kotor</th>
                  <th className="px-5 py-2 sm:px-6" />
                </tr>
              </thead>
              <tbody className="divide-y divide-charcoal-900/5">
                {tableRows.map((o) => {
                  const pe = o.hpp_estimate > 0 ? pct(o.hpp_estimate, o.total) : null;
                  const pa = o.hpp_actual > 0 ? pct(o.hpp_actual, o.total) : null;
                  const base = hppOf(o);
                  return (
                    <tr key={o.order_id} className="hover:bg-cream-50/60">
                      <td className="px-5 py-2.5 sm:px-6">
                        <Link href={`/admin/hpp/${o.order_id}`} className="font-semibold hover:underline">
                          {o.order_number}
                        </Link>{" "}
                        <StatusBadge status={o.status} className="ml-1 align-middle" />
                        <p className="max-w-[280px] truncate text-xs text-charcoal-700/70">
                          {formatDateShort(o.order_date)} · {o.customer_name} · {o.title}
                        </p>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{formatRupiah(o.total)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {o.hpp_estimate > 0 ? formatRupiah(o.hpp_estimate) : "—"}
                        {o.hpp_estimate > 0 && !o.has_detail && <p className="text-xs text-charcoal-700/60">manual</p>}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <span className={cn(BADGE, HPP_LEVEL_META[hppLevel(pe, target, max)].bg)}>{fmtPct(pe)}</span>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{o.hpp_actual > 0 ? formatRupiah(o.hpp_actual) : "—"}</td>
                      <td className="px-3 py-2.5 text-right">
                        <span className={cn(BADGE, HPP_LEVEL_META[hppLevel(pa, target, max)].bg)}>{fmtPct(pa)}</span>
                      </td>
                      <td className={cn("px-3 py-2.5 text-right tabular-nums", base > 0 && o.total - base < 0 && "text-red-600")}>{base > 0 ? formatRupiah(o.total - base) : "—"}</td>
                      <td className="px-5 py-2.5 text-right sm:px-6">
                        <Link href={`/admin/hpp/${o.order_id}`} className={cn("btn-sm", o.has_detail ? "btn-outline" : "btn-primary")}>
                          {o.has_detail ? "Rincian" : "Hitung"}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-charcoal-700/70">Belum ada order terkonfirmasi di periode ini.</p>
        )}
      </Panel>

      <Panel title="Pengaturan HPP" className="mt-6">
        <HppSettingsForm initial={settings} />
      </Panel>
    </>
  );
}
