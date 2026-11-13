import { AlertTriangle, ArrowUpRight, Boxes, Briefcase, CalendarClock, ClipboardList, PiggyBank, Receipt, TrendingDown, TrendingUp, Users, Wallet } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { KpiCard, Panel } from "@/components/admin/orders/ui";
import { fmtQty, PAYROLL_STATUSES, PO_STATUSES, SCHEDULE_STATUSES } from "@/lib/erp/constants";
import { getFinanceReport, listProjects } from "@/lib/erp/data";
import { numifyAll } from "@/lib/erp/server";
import { formatRupiah } from "@/lib/format";
import { formatCompactRupiah, formatDateShort, jakartaToday, presetRange } from "@/lib/orders";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { BudgetBars, MonthlyChart } from "./charts";
import { Badge, ProgressBar, StatusPill } from "./kit";
import { Indicator } from "./project/ProjectList";

type AlertItem = { id: string; order_number?: string; title?: string; customer?: string; date?: string; progress?: number; days_left?: number; days_late?: number; names?: string; items?: number; pct?: number; budget?: number; actual?: number; expected?: number; code?: string; name?: string; unit?: string; available?: number; min?: number };
type Alerts = Record<"near_deadline" | "late" | "behind" | "material_missing" | "material_budget" | "labor_over" | "low_stock", AlertItem[]>;

function ListPanel({ title, href, empty, children, tone }: { title: string; href?: string; empty: boolean; children: ReactNode; tone?: "red" | "amber" }) {
  return (
    <Panel
      title={title}
      className={cn(tone === "red" && !empty && "ring-red-200", tone === "amber" && !empty && "ring-amber-200")}
      action={
        href ? (
          <Link href={href} className="inline-flex items-center gap-1 text-xs text-wood-600 hover:underline">
            Lihat semua <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        ) : undefined
      }
    >
      {empty ? <p className="py-4 text-center text-sm text-charcoal-700/60">Tidak ada</p> : <ul className="divide-y divide-charcoal-900/5 text-sm">{children}</ul>}
    </Panel>
  );
}

/** Pusat kontrol perusahaan: ringkasan proyek, material, pekerja, keuangan & peringatan. */
export async function ErpDashboard({ isOwner }: { isOwner: boolean }) {
  const sb = await createClient();
  const month = presetRange("this_month");
  const today = jakartaToday();
  const [alertsRes, projects, report, invValue, employees, monthOrders, latestPo, unpaid, slips] = await Promise.all([
    sb.rpc("dashboard_alerts"),
    listProjects(sb),
    isOwner ? getFinanceReport(month.from, month.to, sb) : Promise.resolve(null),
    sb.from("inventory").select("qty_on_hand, unit_cost").gt("qty_on_hand", 0),
    sb.from("employees").select("id", { count: "exact", head: true }).eq("status", "active").is("deleted_at", null),
    sb.from("orders").select("id", { count: "exact", head: true }).gte("order_date", month.from).lte("order_date", month.to).in("status", ["confirmed", "production", "installation", "completed"]),
    sb.from("purchase_orders").select("id, po_number, order_date, status, total, paid_amount, suppliers(name)").order("created_at", { ascending: false }).limit(5),
    sb.from("orders_view").select("id, order_number, customer_name, title, balance, due_date").eq("is_booked", true).gt("balance", 0).order("due_date", { ascending: true, nullsFirst: false }).limit(6),
    isOwner ? sb.from("payroll").select("id, slip_number, period_end, net_amount, status, employees(full_name)").in("status", ["draft", "approved"]).order("period_end").limit(6) : Promise.resolve({ data: [] }),
  ]);
  const alerts = (alertsRes.data ?? {}) as Alerts;
  const A = (k: keyof Alerts) => alerts[k] ?? [];
  const active = projects.filter((p) => p.is_active);
  const inventoryValue = (invValue.data ?? []).reduce((a, r) => a + Number(r.qty_on_hand) * Number(r.unit_cost), 0);
  const n = (v: unknown) => Number(v) || 0;
  const warnings = [
    ...A("material_missing").map((x) => ({ key: `mm${x.id}`, href: `/admin/proyek/${x.id}?tab=material`, text: `${x.order_number} — material belum tersedia (${x.items} item: ${x.names})`, red: false })),
    ...A("material_budget").map((x) => ({ key: `mb${x.id}`, href: `/admin/proyek/${x.id}?tab=anggaran`, text: `${x.order_number} — anggaran material terpakai ${x.pct}%`, red: n(x.pct) > 100 })),
    ...A("labor_over").map((x) => ({ key: `lo${x.id}`, href: `/admin/proyek/${x.id}?tab=pekerja`, text: `${x.order_number} — biaya upah ${formatRupiah(n(x.actual))} melebihi estimasi ${formatRupiah(n(x.budget))}`, red: true })),
    ...A("behind").map((x) => ({ key: `bh${x.id}`, href: `/admin/proyek/${x.id}?tab=jadwal`, text: `${x.order_number} — progres ${Math.round(n(x.progress))}% (seharusnya ${Math.round(n(x.expected))}%)`, red: false })),
  ];

  return (
    <section aria-label="Pusat kontrol perusahaan" className="mb-8 space-y-6">
      <div className="flex items-end justify-between gap-3">
        <h2 className="font-display text-xl font-bold">Pusat kontrol operasional</h2>
        <div className="flex gap-2 text-xs">
          <Link href="/admin/proyek" className="btn-outline btn-sm bg-white">
            Proyek
          </Link>
          {isOwner && (
            <Link href="/admin/keuangan" className="btn-outline btn-sm bg-white">
              Keuangan
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Proyek aktif" value={active.length} icon={Briefcase} sub={`${active.filter((p) => p.indicator === "red").length} merah · ${active.filter((p) => p.indicator === "yellow").length} kuning`} emphasis />
        <KpiCard label="Order bulan ini" value={monthOrders.count ?? 0} icon={ClipboardList} sub="order deal" />
        {isOwner && report ? (
          <>
            <KpiCard label="Omzet bulan ini" value={formatCompactRupiah(n(report.revenue))} icon={TrendingUp} />
            <KpiCard label="Pengeluaran bulan ini" value={formatCompactRupiah(n(report.cash_out))} icon={TrendingDown} sub="kas keluar" />
            <KpiCard label="Estimasi keuntungan" value={formatCompactRupiah(n(report.estimated_profit))} icon={PiggyBank} sub={`aktual ${formatCompactRupiah(n(report.gross_profit))}`} hint="Estimasi laba kotor order bulan ini (kontrak − anggaran biaya)" />
            <KpiCard label="Saldo kas" value={formatCompactRupiah(n(report.cash_balance))} icon={Wallet} />
          </>
        ) : null}
        <KpiCard label="Nilai persediaan" value={formatCompactRupiah(inventoryValue)} icon={Boxes} sub={`${A("low_stock").length} bahan menipis`} />
        <KpiCard label="Pegawai aktif" value={employees.count ?? 0} icon={Users} />
      </div>

      {warnings.length > 0 && (
        <div className="rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200">
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-900">
            <AlertTriangle className="h-4 w-4" /> Peringatan proyek ({warnings.length})
          </p>
          <ul className="grid gap-1.5 text-sm sm:grid-cols-2">
            {warnings.slice(0, 10).map((w) => (
              <li key={w.key}>
                <Link href={w.href} className={cn("hover:underline", w.red ? "text-red-700" : "text-amber-900")}>
                  • {w.text}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {isOwner && report && (
        <div className="grid gap-6 xl:grid-cols-2">
          <Panel title="Omzet, pengeluaran & keuntungan bulanan">
            <MonthlyChart
              data={report.series}
              series={[
                { key: "revenue", label: "Omzet", color: "#17263C", type: "bar" },
                { key: "cash_out", label: "Pengeluaran", color: "#C9A27E", type: "bar" },
                { key: "gross_profit", label: "Laba kotor", color: "#4B5138", type: "line" },
              ]}
            />
          </Panel>
          <Panel title="Penggunaan bahan baku & biaya upah">
            <MonthlyChart
              data={report.series}
              series={[
                { key: "material_usage", label: "Bahan baku terpakai", color: "#383A3D", type: "bar" },
                { key: "payroll", label: "Biaya upah (slip gaji)", color: "#4B5138", type: "bar" },
              ]}
            />
          </Panel>
          <Panel title="Anggaran vs realisasi proyek" className="xl:col-span-2">
            <BudgetBars rows={active.filter((p) => p.has_budget).slice(0, 8).map((p) => ({ id: p.id, label: `${p.order_number} · ${p.title}`, budget: p.budget_cost_total, actual: p.actual_total_cost, href: `/admin/proyek/${p.id}?tab=anggaran` }))} />
          </Panel>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
        <ListPanel title="Proyek sedang dikerjakan" href="/admin/proyek" empty={!active.length}>
          {active.slice(0, 6).map((p) => (
            <li key={p.id} className="py-2">
              <Link href={`/admin/proyek/${p.id}`} className="flex items-center gap-2 hover:underline">
                <Indicator value={p.indicator} />
                <span className="flex-1 truncate font-medium">{p.title}</span>
                <span className="text-xs tabular-nums">{Math.round(p.progress)}%</span>
              </Link>
              <ProgressBar value={p.progress} className="mt-1.5 h-1.5" tone={p.indicator === "red" ? "bg-red-500" : p.indicator === "yellow" ? "bg-amber-400" : "bg-[#4B5138]"} />
            </li>
          ))}
        </ListPanel>
        <ListPanel title="Mendekati deadline (7 hari)" empty={!A("near_deadline").length} tone="amber">
          {A("near_deadline").map((x) => (
            <li key={x.id} className="flex items-center justify-between gap-2 py-2">
              <Link href={`/admin/proyek/${x.id}`} className="truncate hover:underline">
                {x.order_number} · {x.title}
              </Link>
              <Badge tone="bg-amber-50 text-amber-800 ring-amber-200">{x.days_left === 0 ? "hari ini" : `${x.days_left} hari`}</Badge>
            </li>
          ))}
        </ListPanel>
        <ListPanel title="Proyek terlambat" empty={!A("late").length} tone="red">
          {A("late").map((x) => (
            <li key={x.id} className="flex items-center justify-between gap-2 py-2">
              <Link href={`/admin/proyek/${x.id}`} className="truncate hover:underline">
                {x.order_number} · {x.title}
              </Link>
              <Badge tone="bg-red-50 text-red-700 ring-red-200">+{x.days_late} hari</Badge>
            </li>
          ))}
        </ListPanel>
        <ListPanel title="Material hampir habis" href="/admin/stok" empty={!A("low_stock").length} tone="red">
          {A("low_stock").slice(0, 8).map((x) => (
            <li key={x.id} className="flex items-center justify-between gap-2 py-2">
              <span className="truncate">{x.name}</span>
              <span className="text-xs tabular-nums text-red-600">
                {fmtQty(x.available)} / min {fmtQty(x.min)} {x.unit}
              </span>
            </li>
          ))}
        </ListPanel>
        <ListPanel title="Pembelian terbaru" href="/admin/pembelian" empty={!latestPo.data?.length}>
          {(latestPo.data ?? []).map((po) => (
            <li key={po.id as string} className="flex items-center justify-between gap-2 py-2">
              <Link href={`/admin/pembelian/${po.id}`} className="min-w-0 truncate hover:underline">
                {po.po_number as string} · {(po.suppliers as unknown as { name: string } | null)?.name}
              </Link>
              <span className="flex shrink-0 items-center gap-2">
                {isOwner && <span className="text-xs tabular-nums">{formatCompactRupiah(Number(po.total))}</span>}
                <StatusPill list={PO_STATUSES} value={po.status as string} />
              </span>
            </li>
          ))}
        </ListPanel>
        <ListPanel title="Tagihan konsumen belum lunas" href="/admin/orders?payment=partial" empty={!unpaid.data?.length}>
          {numifyAll<{ id: string; order_number: string; customer_name: string; balance: number; due_date: string | null }>(unpaid.data).map((o) => (
            <li key={o.id} className="flex items-center justify-between gap-2 py-2">
              <Link href={`/admin/orders/${o.id}`} className="min-w-0 truncate hover:underline">
                {o.order_number} · {o.customer_name}
              </Link>
              <span className={cn("shrink-0 text-xs tabular-nums", o.due_date && o.due_date < today ? "font-semibold text-red-600" : "")}>
                {formatCompactRupiah(o.balance)}
                {o.due_date && <span className="block text-right text-[10px] text-charcoal-700/60">{formatDateShort(o.due_date)}</span>}
              </span>
            </li>
          ))}
        </ListPanel>
        {isOwner && (
          <ListPanel title="Jadwal pembayaran gaji" href="/admin/penggajian" empty={!slips.data?.length}>
            {numifyAll<{ id: string; slip_number: string; period_end: string; net_amount: number; status: string; employees: { full_name: string } }>(slips.data as Record<string, unknown>[]).map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-2 py-2">
                <Link href={`/admin/penggajian/${s.id}`} className="min-w-0 truncate hover:underline">
                  {s.employees.full_name}
                  <span className="block text-xs text-charcoal-700/60">periode s/d {formatDateShort(s.period_end)}</span>
                </Link>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="text-xs tabular-nums">{formatCompactRupiah(s.net_amount)}</span>
                  <StatusPill list={PAYROLL_STATUSES} value={s.status} />
                </span>
              </li>
            ))}
          </ListPanel>
        )}
        {!isOwner && (
          <ListPanel title="Status jadwal proyek" empty={!active.length}>
            {active.slice(0, 6).map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 py-2">
                <span className="truncate">{p.order_number}</span>
                <StatusPill list={SCHEDULE_STATUSES} value={p.schedule_status} />
              </li>
            ))}
          </ListPanel>
        )}
      </div>
      <p className="flex items-center gap-1.5 text-xs text-charcoal-700/60">
        <CalendarClock className="h-3.5 w-3.5" /> Indikator: hijau = sesuai anggaran & jadwal · kuning = mendekati batas · merah = melewati anggaran / terlambat.
        <Receipt className="ml-2 h-3.5 w-3.5" /> Angka keuangan bulan berjalan.
      </p>
    </section>
  );
}
