import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PrintButton } from "@/components/admin/orders/PrintButton";
import { requireAdminPage } from "@/lib/admin/auth";
import { getOrder } from "@/lib/admin/orders-data";
import { formatRupiah } from "@/lib/format";
import { formatDateShort, kindLabel, methodLabel, paymentMeta } from "@/lib/orders";
import { getSettings } from "@/services/data";

export const metadata: Metadata = { title: "Invoice", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

/** Invoice siap cetak / simpan PDF (Ctrl+P). */
export default async function InvoicePage({ params }: { params: Params }) {
  const user = await requireAdminPage();
  if (!["admin", "editor"].includes(user.role)) redirect("/admin");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [data, s] = await Promise.all([getOrder(id), getSettings()]);
  if (!data) notFound();
  const { order: o, items, payments } = data;
  const pay = paymentMeta(o.payment_status);

  return (
    <main className="min-h-screen bg-cream-100 px-4 py-8 print:bg-white print:p-0">
      <div className="mx-auto mb-4 flex max-w-3xl justify-end gap-2 print:hidden">
        <PrintButton />
      </div>
      <article className="mx-auto max-w-3xl bg-white p-6 text-sm text-charcoal-900 shadow-card sm:p-10 print:max-w-none print:p-0 print:shadow-none">
        <header className="flex flex-col justify-between gap-6 border-b border-charcoal-900/10 pb-6 sm:flex-row">
          <div>
            <p className="font-display text-xl font-bold">{s.business_name}</p>
            {s.address && <p className="mt-1 max-w-xs text-xs text-charcoal-700">{s.address}</p>}
            <p className="mt-1 text-xs text-charcoal-700">
              {[s.whatsapp_number ? `WA +${s.whatsapp_number}` : null, s.email].filter(Boolean).join(" · ")}
            </p>
          </div>
          <div className="sm:text-right">
            <p className="font-display text-2xl font-bold tracking-tight text-wood-600">INVOICE</p>
            <p className="mt-1 font-semibold">{o.order_number}</p>
            <p className="text-xs text-charcoal-700">Tanggal: {formatDateShort(o.order_date)}</p>
            {o.due_date && <p className="text-xs text-charcoal-700">Jatuh tempo: {formatDateShort(o.due_date)}</p>}
          </div>
        </header>

        <section className="grid gap-6 py-6 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-charcoal-700/70">Ditagihkan kepada</p>
            <p className="mt-1 font-semibold">{o.customer_name}</p>
            {o.customer_phone && <p className="text-charcoal-700">{o.customer_phone}</p>}
            {o.customer_email && <p className="text-charcoal-700">{o.customer_email}</p>}
            {o.customer_address && <p className="mt-1 text-charcoal-700">{o.customer_address}</p>}
          </div>
          <div className="sm:text-right">
            <p className="text-xs font-semibold uppercase tracking-wider text-charcoal-700/70">Project</p>
            <p className="mt-1 font-semibold">{o.title}</p>
            {o.category && <p className="text-charcoal-700">{o.category}</p>}
            <p className="mt-2 inline-block rounded-full border border-charcoal-900/15 px-3 py-0.5 text-xs font-semibold">{pay.label}</p>
          </div>
        </section>

        <table className="w-full border-collapse">
          <thead>
            <tr className="border-y border-charcoal-900/15 text-left text-xs uppercase tracking-wider text-charcoal-700">
              <th className="py-2 pr-2 font-semibold">Item</th>
              <th className="px-2 py-2 text-right font-semibold">Qty</th>
              <th className="px-2 py-2 text-right font-semibold">Harga</th>
              <th className="py-2 pl-2 text-right font-semibold">Jumlah</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id} className="border-b border-charcoal-900/5 align-top">
                <td className="py-2.5 pr-2">
                  <p className="font-medium">{it.name}</p>
                  {it.description && <p className="text-xs text-charcoal-700">{it.description}</p>}
                </td>
                <td className="whitespace-nowrap px-2 py-2.5 text-right tabular-nums">
                  {it.qty.toLocaleString("id-ID")} {it.unit}
                </td>
                <td className="whitespace-nowrap px-2 py-2.5 text-right tabular-nums">{formatRupiah(it.unit_price)}</td>
                <td className="whitespace-nowrap py-2.5 pl-2 text-right font-medium tabular-nums">{formatRupiah(it.line_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 flex justify-end">
          <dl className="w-full max-w-xs space-y-1.5">
            <div className="flex justify-between">
              <dt className="text-charcoal-700">Subtotal</dt>
              <dd className="tabular-nums">{formatRupiah(o.subtotal)}</dd>
            </div>
            {o.discount > 0 && (
              <div className="flex justify-between">
                <dt className="text-charcoal-700">Diskon</dt>
                <dd className="tabular-nums">− {formatRupiah(o.discount)}</dd>
              </div>
            )}
            {o.additional_fee > 0 && (
              <div className="flex justify-between">
                <dt className="text-charcoal-700">Biaya tambahan</dt>
                <dd className="tabular-nums">{formatRupiah(o.additional_fee)}</dd>
              </div>
            )}
            <div className="flex justify-between border-t border-charcoal-900/15 pt-2 text-base font-bold">
              <dt>Total</dt>
              <dd className="tabular-nums">{formatRupiah(o.total)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-charcoal-700">Sudah dibayar</dt>
              <dd className="tabular-nums">{formatRupiah(o.paid_amount)}</dd>
            </div>
            <div className="flex justify-between rounded-lg bg-cream-100 px-3 py-2 font-semibold print:bg-transparent print:px-0">
              <dt>Sisa tagihan</dt>
              <dd className="tabular-nums">{formatRupiah(o.balance)}</dd>
            </div>
          </dl>
        </div>

        {payments.length > 0 && (
          <section className="mt-8">
            <p className="text-xs font-semibold uppercase tracking-wider text-charcoal-700/70">Riwayat pembayaran</p>
            <table className="mt-2 w-full text-xs">
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-b border-charcoal-900/5">
                    <td className="py-1.5">{formatDateShort(p.paid_at)}</td>
                    <td className="py-1.5">{kindLabel(p.kind)}</td>
                    <td className="py-1.5">
                      {methodLabel(p.method)}
                      {p.reference ? ` · ${p.reference}` : ""}
                    </td>
                    <td className="py-1.5 text-right tabular-nums">{formatRupiah(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <footer className="mt-10 border-t border-charcoal-900/10 pt-4 text-xs text-charcoal-700">
          Terima kasih atas kepercayaan Anda. Pertanyaan terkait invoice ini dapat disampaikan melalui WhatsApp {s.whatsapp_number ? `+${s.whatsapp_number}` : ""}.
        </footer>
      </article>
    </main>
  );
}
