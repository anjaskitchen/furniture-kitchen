import { CalendarClock, ShieldCheck } from "lucide-react";
import Image from "next/image";
import { formatRupiah } from "@/lib/format";
import { kindName, type InvoiceData } from "@/lib/invoice";
import { durationLabel, formatDateShort, methodLabel, paymentMeta } from "@/lib/orders";

const num = (n: number) => n.toLocaleString("id-ID", { maximumFractionDigits: 3 });

/**
 * CSS cetak: margin halaman 0 agar browser tidak mencetak URL/tanggal di header & footer PDF.
 * Jarak tepi diganti padding lembar yang diulang di setiap halaman.
 */
export const INVOICE_PRINT_CSS = `@page { size: A4; margin: 0; }
@media print {
  html, body { background: #fff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .invoice-sheet { padding: 14mm !important; box-decoration-break: clone; -webkit-box-decoration-break: clone; }
}`;

/** Dokumen invoice (dipakai halaman admin & link publik konsumen). */
export function InvoiceDocument({ inv }: { inv: InvoiceData }) {
  const { order: o, items, payments } = inv;
  const pay = paymentMeta(o.payment_status);
  const start = o.work_start_date ?? o.order_date;
  return (
  <article className="invoice-sheet mx-auto max-w-3xl bg-white p-6 text-sm text-charcoal-900 shadow-card sm:p-10 print:max-w-none print:shadow-none">
    <header className="flex flex-col justify-between gap-6 border-b border-charcoal-900/10 pb-6 sm:flex-row">
      <div className="flex items-start gap-4">
        {inv.logo && (
          <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg">
            <Image src={inv.logo} alt={inv.settings.business_name} fill sizes="64px" unoptimized className="object-contain" />
          </span>
        )}
        <div>
          <p className="font-display text-xl font-bold">{inv.settings.business_name}</p>
          {inv.settings.address && <p className="mt-1 max-w-xs text-xs text-charcoal-700">{inv.settings.address}</p>}
          <p className="mt-1 text-xs text-charcoal-700">{[inv.settings.whatsapp_number ? `WA +${inv.settings.whatsapp_number}` : null, inv.settings.email].filter(Boolean).join(" · ")}</p>
        </div>
      </div>
      <div className="sm:text-right">
        <p className="font-display text-2xl font-bold tracking-tight text-wood-600">{inv.title}</p>
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

    {o.work_duration && o.estimated_finish_date && (
      <section className="mb-6 flex flex-col gap-2 rounded-xl bg-cream-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between print:border print:border-charcoal-900/15 print:bg-transparent">
        <p className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-wood-600 print:hidden" />
          <span>
            Jangka waktu pengerjaan <strong>{durationLabel(o.work_duration, o.work_duration_unit)}</strong>, mulai {formatDateShort(start)}
          </span>
        </p>
        <p>
          Selesai maksimal: <strong>{formatDateShort(o.estimated_finish_date)}</strong>
        </p>
      </section>
    )}

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
              {it.length_m && it.height_m ? (
                <p className="text-xs text-charcoal-700">
                  Ukuran {num(it.length_m)} m × {num(it.height_m)} m = {num(it.qty)} m²
                </p>
              ) : null}
              {it.description && <p className="text-xs text-charcoal-700">{it.description}</p>}
            </td>
            <td className="whitespace-nowrap px-2 py-2.5 text-right tabular-nums">
              {num(it.qty)} {it.unit}
            </td>
            <td className="whitespace-nowrap px-2 py-2.5 text-right tabular-nums">
              {formatRupiah(it.unit_price)}
              {it.length_m && it.height_m ? <span className="block text-xs text-charcoal-700">/m²</span> : null}
            </td>
            <td className="whitespace-nowrap py-2.5 pl-2 text-right font-medium tabular-nums">{formatRupiah(it.line_total)}</td>
          </tr>
        ))}
      </tbody>
    </table>

    <div className="mt-4 flex flex-col-reverse gap-6 sm:flex-row sm:items-start sm:justify-between">
      {inv.banks.length > 0 ? (
        <section className="sm:max-w-xs">
          <p className="text-xs font-semibold uppercase tracking-wider text-charcoal-700/70">Pembayaran transfer ke</p>
          <ul className="mt-2 space-y-2">
            {inv.banks.map((b) => (
              <li key={b.id} className="rounded-lg border border-charcoal-900/10 px-3 py-2">
                <p className="text-xs font-semibold">{b.bank_name}</p>
                <p className="font-mono text-base font-semibold tracking-wide">{b.account_number}</p>
                <p className="text-xs text-charcoal-700">a.n. {b.account_holder}</p>
                {b.notes && <p className="text-[11px] text-charcoal-700/70">{b.notes}</p>}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-charcoal-700/70">Cantumkan nomor {o.order_number} pada berita transfer.</p>
        </section>
      ) : (
        <span />
      )}
      <dl className="w-full max-w-xs space-y-1.5 sm:ml-auto">
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
                <td className="py-1.5">{kindName(inv, p.kind)}</td>
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

    {o.invoice_notes && (
      <section className="mt-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-charcoal-700/70">Catatan</p>
        <p className="mt-1 whitespace-pre-wrap text-charcoal-800">{o.invoice_notes}</p>
      </section>
    )}

    {o.status === "completed" && (inv.warrantyNote || inv.reviewUrl) && (
      <section className="mt-6 rounded-xl border-2 border-[#4B5138]/40 bg-[#4B5138]/5 p-4 print:break-inside-avoid">
        <p className="flex items-center gap-2 text-sm font-bold text-[#4B5138]">
          <ShieldCheck className="h-5 w-5" /> Aktivasi garansi 1 tahun
        </p>
        {o.completed_at && <p className="mt-0.5 text-xs text-charcoal-700">Pekerjaan selesai pada {formatDateShort(o.completed_at)}</p>}
        {inv.warrantyNote && <p className="mt-2 whitespace-pre-wrap text-sm text-charcoal-800">{inv.warrantyNote}</p>}
        {inv.reviewUrl && (
          <p className="mt-3 text-sm">
            Beri ulasan di Google Maps:{" "}
            <a href={inv.reviewUrl} target="_blank" rel="noopener noreferrer" className="break-all font-semibold text-[#17263C] underline">
              {inv.reviewUrl}
            </a>
          </p>
        )}
      </section>
    )}

    {inv.terms.length > 0 && (
      <section className="mt-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-charcoal-700/70">Syarat & ketentuan</p>
        <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-xs text-charcoal-700">
          {inv.terms.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ol>
      </section>
    )}

    <footer className="mt-10 whitespace-pre-wrap border-t border-charcoal-900/10 pt-4 text-xs text-charcoal-700">{inv.footer}</footer>
  </article>
  );
}
