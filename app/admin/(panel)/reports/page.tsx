import {
  BadgeCheck,
  Banknote,
  ClipboardList,
  FileSpreadsheet,
  HandCoins,
  Percent,
  Receipt,
  Target,
  TrendingUp,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { PeriodPicker } from "@/components/admin/orders/PeriodPicker";
import { TargetForm } from "@/components/admin/orders/TargetForm";
import { BreakdownList, Delta, KpiCard, Panel, StatusBadge, TrendChart } from "@/components/admin/orders/ui";
import { getCurrentUser } from "@/lib/admin/auth";
import { getMonthlyTarget, getOrderReport } from "@/lib/admin/orders-data";
import { formatRupiah } from "@/lib/format";
import {
  daysBetween,
  formatCompactRupiah,
  jakartaToday,
  periodLabel,
  resolvePeriod,
  sourceLabel,
  statusMeta,
  targetForPeriod,
} from "@/lib/orders";
import { cn } from "@/lib/utils";

export const metadata = { title: "Laporan & KPI" };

type SP = Promise<Record<string, string | string[] | undefined>>;

const pct = (n: number) => `${(n * 100).toLocaleString("id-ID", { maximumFractionDigits: 1 })}%`;

export default async function ReportsPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const period = resolvePeriod(sp);
  const [report, monthlyTarget, user] = await Promise.all([getOrderReport(period.from, period.to), getMonthlyTarget(), getCurrentUser()]);
  const periodQs = period.preset === "custom" ? `from=${period.from}&to=${period.to}` : `preset=${period.preset}`;

  if (!report) {
    return (
      <div className="rounded-2xl bg-white p-8 text-center ring-1 ring-charcoal-900/5">
        <p className="font-semibold">Laporan belum bisa dimuat.</p>
        <p className="mt-1 text-sm text-charcoal-700">Pastikan migrasi database terbaru sudah dijalankan (npm run db:migrate).</p>
      </div>
    );
  }

  const cur = report.current;
  const prev = report.previous;
  const aov = cur.orders ? cur.revenue / cur.orders : 0;
  const prevAov = prev.orders ? prev.revenue / prev.orders : 0;
  const margin = cur.revenue ? cur.gross_profit / cur.revenue : 0;
  const prevMargin = prev.revenue ? prev.gross_profit / prev.revenue : 0;
  const conv = cur.leads ? cur.orders / cur.leads : 0;
  const hasCost = cur.cost > 0;

  // Target: pro-rata per hari dalam bulan yang tercakup periode.
  const target = targetForPeriod(monthlyTarget, period.from, period.to);
  const achieved = target ? cur.revenue / target : 0;
  const today = jakartaToday();
  const remainingDays = today >= period.from && today <= period.to ? daysBetween(today, period.to) : 0;
  const perDayNeeded = target > cur.revenue && remainingDays ? (target - cur.revenue) / remainingDays : 0;
  const elapsedShare = today < period.from ? 0 : today > period.to ? 1 : daysBetween(period.from, today) / report.range.days;

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Laporan & KPI</h1>
          <p className="mt-1 text-sm text-charcoal-700">
            Dibanding periode sebelumnya: {periodLabel(report.range.prev_from, report.range.prev_to)}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/orders" className="btn-outline btn-sm bg-white !py-2.5">
            <ClipboardList className="h-4 w-4" /> Daftar order
          </Link>
          <a href={`/admin/reports/export?${periodQs}`} className="btn-primary btn-sm !py-2.5">
            <FileSpreadsheet className="h-4 w-4" /> Export Excel
          </a>
        </div>
      </div>

      <div className="mb-6">
        <Suspense>
          <PeriodPicker preset={period.preset} from={period.from} to={period.to} rangeLabel={periodLabel(period.from, period.to)} />
        </Suspense>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          emphasis
          icon={TrendingUp}
          label="Omset"
          hint="Nilai order terkonfirmasi (Deal, Produksi, Instalasi, Selesai) berdasarkan tanggal order"
          value={formatCompactRupiah(cur.revenue)}
          delta={<Delta current={cur.revenue} previous={prev.revenue} />}
          sub={`dari ${formatCompactRupiah(prev.revenue)}`}
        />
        <KpiCard
          icon={Banknote}
          label="Kas masuk"
          hint="Total pembayaran (DP, termin, pelunasan) yang diterima pada periode ini"
          value={formatCompactRupiah(cur.cash_in)}
          delta={<Delta current={cur.cash_in} previous={prev.cash_in} />}
          sub={`${cur.payments} transaksi`}
        />
        <KpiCard
          icon={HandCoins}
          label="Laba kotor"
          hint="Omset dikurangi HPP yang diisi di setiap order. Order tanpa HPP dianggap HPP 0."
          value={hasCost ? formatCompactRupiah(cur.gross_profit) : "—"}
          delta={hasCost ? <Delta current={cur.gross_profit} previous={prev.gross_profit} /> : undefined}
          sub={hasCost ? `margin ${pct(margin)}${prev.revenue ? ` (sebelumnya ${pct(prevMargin)})` : ""}` : "isi HPP di order"}
        />
        <KpiCard
          icon={Receipt}
          label="Jumlah order"
          value={cur.orders.toLocaleString("id-ID")}
          delta={<Delta current={cur.orders} previous={prev.orders} />}
          sub={`${cur.quotations} penawaran · ${cur.cancelled} batal`}
        />
        <KpiCard
          icon={Wallet}
          label="Rata-rata nilai order"
          hint="Omset ÷ jumlah order"
          value={formatCompactRupiah(aov)}
          delta={<Delta current={aov} previous={prevAov} />}
        />
        <KpiCard
          icon={Wallet}
          label="Piutang (per hari ini)"
          hint="Sisa tagihan semua order terkonfirmasi, tidak tergantung periode"
          value={formatCompactRupiah(report.receivables.amount)}
          sub={
            report.receivables.overdue_orders ? (
              <span className="font-medium text-red-600">
                {formatCompactRupiah(report.receivables.overdue_amount)} lewat jatuh tempo ({report.receivables.overdue_orders})
              </span>
            ) : (
              `${report.receivables.orders} order belum lunas`
            )
          }
        />
        <KpiCard icon={BadgeCheck} label="Order selesai" hint="Berdasarkan tanggal selesai" value={cur.completed.toLocaleString("id-ID")} delta={<Delta current={cur.completed} previous={prev.completed} />} />
        <KpiCard
          icon={Percent}
          label="Rasio order / leads"
          hint="Order terkonfirmasi ÷ leads website (request survey + pesan kontak). Order dari WA/IG juga terhitung, jadi bisa > 100%."
          value={cur.leads ? pct(conv) : "—"}
          sub={`${cur.leads} leads masuk`}
          delta={cur.leads && prev.leads ? <Delta current={conv} previous={prev.leads ? prev.orders / prev.leads : 0} /> : undefined}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Panel
          title="Tren omset & kas masuk"
          className="lg:col-span-2"
          action={
            <div className="flex gap-3 text-xs text-charcoal-700">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-wood-500" /> Omset
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-0.5 w-3 rounded bg-bronze-400" /> Kas masuk
              </span>
            </div>
          }
        >
          <TrendChart report={report} />
          <p className="mt-2 text-xs text-charcoal-700/70">
            Per {report.range.grain === "day" ? "hari" : report.range.grain === "week" ? "minggu" : "bulan"} · arahkan kursor ke batang untuk detail.
          </p>
        </Panel>

        <Panel title="Target omset" action={user?.role === "admin" ? <TargetForm value={monthlyTarget} /> : undefined}>
          {target ? (
            <>
              <div className="flex items-end justify-between gap-2">
                <p className="font-display text-3xl font-bold tabular-nums">{pct(achieved)}</p>
                <Target className="mb-1 h-5 w-5 text-wood-500" />
              </div>
              <div className="relative mt-3 h-3 overflow-hidden rounded-full bg-cream-100">
                <div className={cn("h-full rounded-full", achieved >= 1 ? "bg-green-600" : "bg-wood-500")} style={{ width: `${Math.min(100, achieved * 100)}%` }} />
                {elapsedShare > 0 && elapsedShare < 1 && (
                  <span className="absolute inset-y-0 w-0.5 bg-charcoal-900/50" style={{ left: `${elapsedShare * 100}%` }} title="Posisi hari ini dalam periode" />
                )}
              </div>
              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-charcoal-700">Target periode</dt>
                  <dd className="font-medium tabular-nums">{formatRupiah(target)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-charcoal-700">Tercapai</dt>
                  <dd className="font-medium tabular-nums">{formatRupiah(cur.revenue)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-charcoal-700">{target > cur.revenue ? "Kurang" : "Lebih"}</dt>
                  <dd className={cn("font-semibold tabular-nums", target > cur.revenue ? "text-red-600" : "text-green-700")}>{formatRupiah(Math.abs(target - cur.revenue))}</dd>
                </div>
                {perDayNeeded > 0 && (
                  <p className="rounded-lg bg-cream-100 px-3 py-2 text-xs text-charcoal-800">
                    Butuh rata-rata <strong>{formatCompactRupiah(perDayNeeded)}/hari</strong> selama {remainingDays} hari tersisa.
                  </p>
                )}
              </dl>
              <p className="mt-3 text-xs text-charcoal-700/70">Target bulanan {formatRupiah(monthlyTarget)}, dihitung pro-rata sesuai jumlah hari periode.</p>
            </>
          ) : (
            <p className="text-sm text-charcoal-700">
              Belum ada target. {user?.role === "admin" ? "Atur target omset bulanan untuk memantau pencapaian." : "Minta admin mengatur target omset bulanan."}
            </p>
          )}
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        <Panel title="Omset per kategori">
          <BreakdownList rows={report.by_category.map((c) => ({ label: c.label, value: Number(c.revenue), sub: `${c.orders} order` }))} />
        </Panel>
        <Panel title="Omset per sumber order">
          <BreakdownList rows={report.by_source.map((c) => ({ label: sourceLabel(c.label), value: Number(c.revenue), sub: `${c.orders} order` }))} />
        </Panel>
        <Panel title="Status order (periode ini)">
          {report.by_status.length ? (
            <ul className="space-y-2.5">
              {report.by_status.map((s) => (
                <li key={s.label} className="flex items-center justify-between gap-3 text-sm">
                  <StatusBadge status={s.label} />
                  <span className="tabular-nums text-charcoal-700">
                    {s.orders} order · <span className="font-medium text-charcoal-900">{formatCompactRupiah(Number(s.value))}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-6 text-center text-sm text-charcoal-700/70">Belum ada data</p>
          )}
        </Panel>
        <Panel title="Order berjalan (per hari ini)">
          {report.pipeline.length ? (
            <ul className="space-y-2.5">
              {report.pipeline.map((p) => (
                <li key={p.status}>
                  <Link href={`/admin/orders?preset=this_year&status=${p.status}`} className="-mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-sm transition hover:bg-cream-50">
                    <span className="flex items-center gap-2">
                      <span className={cn("h-2 w-2 rounded-full", statusMeta(p.status).dot)} />
                      {statusMeta(p.status).label}
                    </span>
                    <span className="tabular-nums">
                      {p.orders} · <span className="font-medium">{formatCompactRupiah(Number(p.value))}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-6 text-center text-sm text-charcoal-700/70">Tidak ada order berjalan</p>
          )}
        </Panel>
        <Panel title="Top customer" className="xl:col-span-2">
          {report.top_customers.length ? (
            <ol className="divide-y divide-charcoal-900/5">
              {report.top_customers.map((c, i) => (
                <li key={`${c.name}-${i}`} className="flex items-center gap-3 py-2.5 text-sm">
                  <span className="w-5 text-center font-display font-bold text-charcoal-700/40">{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{c.name}</span>
                    {c.phone && <span className="block text-xs text-charcoal-700">{c.phone}</span>}
                  </span>
                  <span className="text-right tabular-nums">
                    <span className="block font-semibold">{formatCompactRupiah(Number(c.revenue))}</span>
                    <span className="block text-xs text-charcoal-700">{c.orders} order</span>
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="py-6 text-center text-sm text-charcoal-700/70">Belum ada data</p>
          )}
        </Panel>
      </div>

      <details className="mt-6 rounded-2xl bg-white p-5 text-sm ring-1 ring-charcoal-900/5">
        <summary className="cursor-pointer font-semibold">Cara perhitungan</summary>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-charcoal-700">
          <li><strong>Omset</strong> = total order berstatus Deal, Produksi, Instalasi, atau Selesai berdasarkan tanggal order. Penawaran & Batal tidak dihitung.</li>
          <li><strong>Total order</strong> = jumlah item − diskon + biaya tambahan (dihitung otomatis oleh database).</li>
          <li><strong>Kas masuk</strong> = pembayaran yang diterima pada periode, berdasarkan tanggal bayar.</li>
          <li><strong>Piutang</strong> = total − dibayar untuk order terkonfirmasi, per hari ini.</li>
          <li><strong>Laba kotor</strong> = omset − HPP; <strong>margin</strong> = laba kotor ÷ omset.</li>
          <li><strong>Perbandingan</strong> memakai periode dengan jumlah hari yang sama tepat sebelumnya ({periodLabel(report.range.prev_from, report.range.prev_to)}).</li>
          <li>Semua tanggal memakai zona waktu WIB (Asia/Jakarta).</li>
        </ul>
      </details>
    </>
  );
}
