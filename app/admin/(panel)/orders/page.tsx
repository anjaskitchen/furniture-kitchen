import { ChevronLeft, ChevronRight, FileSpreadsheet, Plus, Receipt } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { OrderFilters } from "@/components/admin/orders/OrderFilters";
import { PeriodPicker } from "@/components/admin/orders/PeriodPicker";
import { Delta, KpiCard, PaymentBadge, StatusBadge } from "@/components/admin/orders/ui";
import { getOrderReport, listOrders, PAGE_SIZE } from "@/lib/admin/orders-data";
import { formatRupiah } from "@/lib/format";
import { formatCompactRupiah, formatDateShort, jakartaToday, periodLabel, resolvePeriod } from "@/lib/orders";
import { cn } from "@/lib/utils";

export const metadata = { title: "Order" };

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function OrdersPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const period = resolvePeriod(sp);
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const page = Math.max(1, Number(str("page")) || 1);
  const [{ rows, count }, report] = await Promise.all([
    listOrders({ from: period.from, to: period.to, q: str("q"), status: str("status"), payment: str("payment"), sort: str("sort"), page }),
    getOrderReport(period.from, period.to),
  ]);
  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const periodQs = period.preset === "custom" ? `from=${period.from}&to=${period.to}` : `preset=${period.preset}`;
  const pageHref = (p: number) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) if (typeof v === "string" && k !== "page") q.set(k, v);
    if (p > 1) q.set("page", String(p));
    return `/admin/orders?${q.toString()}`;
  };
  const today = jakartaToday();

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Order</h1>
          <p className="mt-1 text-sm text-charcoal-700">Catat order, item pekerjaan, dan pembayaran customer. Omset & laporan dihitung otomatis.</p>
        </div>
        <div className="flex gap-2">
          <a href={`/admin/reports/export?${periodQs}`} className="btn-outline btn-sm bg-white !py-2.5">
            <FileSpreadsheet className="h-4 w-4" /> Export Excel
          </a>
          <Link href="/admin/orders/new" className="btn-primary btn-sm !py-2.5">
            <Plus className="h-4 w-4" /> Order baru
          </Link>
        </div>
      </div>

      <div className="mb-5">
        <Suspense>
          <PeriodPicker preset={period.preset} from={period.from} to={period.to} rangeLabel={periodLabel(period.from, period.to)} />
        </Suspense>
      </div>

      {report && (
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard
            emphasis
            label="Omset"
            hint="Nilai order terkonfirmasi (Deal s.d. Selesai) berdasarkan tanggal order"
            value={formatCompactRupiah(report.current.revenue)}
            delta={<Delta current={report.current.revenue} previous={report.previous.revenue} />}
            sub="vs periode lalu"
          />
          <KpiCard
            label="Kas masuk"
            hint="Pembayaran yang diterima pada periode ini"
            value={formatCompactRupiah(report.current.cash_in)}
            delta={<Delta current={report.current.cash_in} previous={report.previous.cash_in} />}
          />
          <KpiCard label="Jumlah order" value={report.current.orders.toLocaleString("id-ID")} delta={<Delta current={report.current.orders} previous={report.previous.orders} />} sub={`${report.current.quotations} penawaran`} />
          <KpiCard
            label="Piutang"
            hint="Sisa tagihan semua order terkonfirmasi per hari ini"
            value={formatCompactRupiah(report.receivables.amount)}
            sub={report.receivables.overdue_orders ? <span className="font-medium text-red-600">{report.receivables.overdue_orders} lewat jatuh tempo</span> : `${report.receivables.orders} order`}
          />
        </div>
      )}

      <div className="mb-4">
        <Suspense>
          <OrderFilters />
        </Suspense>
      </div>

      <p className="mb-3 text-xs text-charcoal-700/70">
        {count.toLocaleString("id-ID")} order · berdasarkan tanggal order {periodLabel(period.from, period.to)}
      </p>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-charcoal-900/15 bg-white px-6 py-16 text-center">
          <Receipt className="h-10 w-10 text-wood-400" />
          <h2 className="mt-4 text-lg font-semibold">Belum ada order pada filter ini</h2>
          <p className="mt-1 max-w-sm text-sm text-charcoal-700">Catat order pertama Anda — omset, kas masuk, dan piutang akan terhitung otomatis.</p>
          <Link href="/admin/orders/new" className="btn-primary btn-sm mt-6 !py-2.5">
            <Plus className="h-4 w-4" /> Order baru
          </Link>
        </div>
      ) : (
        <>
          {/* HP: kartu */}
          <ul className="space-y-3 md:hidden">
            {rows.map((o) => (
              <li key={o.id}>
                <Link href={`/admin/orders/${o.id}`} className="block rounded-2xl bg-white p-4 ring-1 ring-charcoal-900/5 active:bg-cream-50">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs text-charcoal-700">
                        {o.order_number} · {formatDateShort(o.order_date)}
                      </p>
                      <p className="mt-0.5 truncate font-semibold">{o.customer_name}</p>
                      <p className="truncate text-sm text-charcoal-700">{o.title}</p>
                    </div>
                    <StatusBadge status={o.status} />
                  </div>
                  <div className="mt-3 flex items-end justify-between gap-3 border-t border-charcoal-900/5 pt-3">
                    <div>
                      <p className="font-display text-lg font-bold tabular-nums">{formatRupiah(o.total)}</p>
                      {o.balance > 0 && o.is_booked && <p className="text-xs text-red-600">Sisa {formatRupiah(o.balance)}</p>}
                    </div>
                    <PaymentBadge status={o.payment_status} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          {/* Desktop: tabel */}
          <div className="hidden overflow-x-auto rounded-2xl bg-white ring-1 ring-charcoal-900/5 md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-charcoal-900/5 bg-cream-50 text-xs uppercase tracking-wider text-charcoal-700">
                <tr>
                  <th className="px-4 py-3 font-semibold">Order</th>
                  <th className="px-4 py-3 font-semibold">Customer & project</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 text-right font-semibold">Total</th>
                  <th className="px-4 py-3 text-right font-semibold">Sisa</th>
                  <th className="px-4 py-3 font-semibold">Bayar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-charcoal-900/5">
                {rows.map((o) => {
                  const overdue = o.is_booked && o.balance > 0 && o.due_date && o.due_date < today;
                  return (
                    <tr key={o.id} className="group relative transition hover:bg-cream-50/70">
                      <td className="whitespace-nowrap px-4 py-3">
                        <Link href={`/admin/orders/${o.id}`} className="font-semibold after:absolute after:inset-0 group-hover:text-wood-600">
                          {o.order_number}
                        </Link>
                        <p className="text-xs text-charcoal-700">{formatDateShort(o.order_date)}</p>
                      </td>
                      <td className="max-w-xs px-4 py-3">
                        <p className="truncate font-medium">{o.customer_name}</p>
                        <p className="truncate text-xs text-charcoal-700">
                          {o.title}
                          {o.category ? ` · ${o.category}` : ""}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={o.status} />
                      </td>
                      <td className={cn("whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums", !o.is_booked && "text-charcoal-700/60")}>{formatRupiah(o.total)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                        {o.balance > 0 ? <span className={cn(overdue && "font-semibold text-red-600")}>{formatRupiah(o.balance)}</span> : <span className="text-charcoal-700/50">—</span>}
                        {overdue && <p className="text-[11px] text-red-600">Jatuh tempo {formatDateShort(o.due_date!)}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <PaymentBadge status={o.payment_status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {pages > 1 && (
            <nav className="mt-5 flex items-center justify-between text-sm" aria-label="Halaman">
              <span className="text-charcoal-700">
                Halaman {page} dari {pages}
              </span>
              <div className="flex gap-2">
                <Link
                  aria-disabled={page <= 1}
                  href={pageHref(page - 1)}
                  className={cn("btn-outline btn-sm bg-white !py-2", page <= 1 && "pointer-events-none opacity-40")}
                >
                  <ChevronLeft className="h-4 w-4" /> Sebelumnya
                </Link>
                <Link
                  aria-disabled={page >= pages}
                  href={pageHref(page + 1)}
                  className={cn("btn-outline btn-sm bg-white !py-2", page >= pages && "pointer-events-none opacity-40")}
                >
                  Berikutnya <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
            </nav>
          )}
        </>
      )}
    </>
  );
}
