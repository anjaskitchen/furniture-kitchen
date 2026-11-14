import { CalendarClock, Pencil, Settings2 } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PrintButton } from "@/components/admin/orders/PrintButton";
import { requireAdminPage } from "@/lib/admin/auth";
import { getOrder } from "@/lib/admin/orders-data";
import { formatRupiah } from "@/lib/format";
import { durationLabel, formatDateShort, kindLabel, methodLabel, paymentMeta } from "@/lib/orders";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/services/data";

export const metadata: Metadata = { title: "Invoice", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

const num = (n: number) => n.toLocaleString("id-ID", { maximumFractionDigits: 3 });

/** Invoice siap cetak / simpan PDF (Ctrl+P). Tampilan diatur di Admin → Pengaturan Invoice. */
export default async function InvoicePage({ params }: { params: Params }) {
  const user = await requireAdminPage();
  if (!["admin", "editor"].includes(user.role)) redirect("/admin");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const sb = await createClient();
  const [data, s, inv, banks] = await Promise.all([
    getOrder(id),
    getSettings(),
    sb.from("settings").select("invoice_logo_url, invoice_title, invoice_footer, invoice_terms, invoice_show_bank").eq("id", true).maybeSingle(),
    sb.from("invoice_bank_accounts").select("id, bank_name, account_number, account_holder, notes").eq("is_active", true).order("sort_order").order("created_at"),
  ]);
  if (!data) notFound();
  const { order: o, items, payments } = data;
  const pay = paymentMeta(o.payment_status);
  const cfg = (inv.data ?? {}) as Record<string, unknown>;
  const logo = (cfg.invoice_logo_url as string | null) || s.logo_url || null;
  const terms = ((cfg.invoice_terms as string | null) ?? "")
    .split("\n")
    .map((t) => t.trim())
    .filter(Boolean);
  const showBank = (cfg.invoice_show_bank as boolean | undefined) ?? true;
  const bankList = showBank ? (banks.data ?? []) : [];
  const footer = (cfg.invoice_footer as string | null)?.trim() || `Terima kasih atas kepercayaan Anda. Pertanyaan terkait invoice ini dapat disampaikan melalui WhatsApp ${s.whatsapp_number ? `+${s.whatsapp_number}` : ""}.`;
  const start = o.work_start_date ?? o.order_date;

  return (
    <main className="min-h-screen bg-cream-100 px-4 py-8 print:bg-white print:p-0">
      <style>{`@page { size: A4; margin: 12mm; } @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }`}</style>
      <div className="mx-auto mb-4 flex max-w-3xl flex-wrap justify-end gap-2 print:hidden">
        <Link href={`/admin/orders/${o.id}`} className="btn-outline btn-sm bg-white !py-2.5">
          <Pencil className="h-4 w-4" /> Edit order
        </Link>
        <Link href="/admin/invoice-settings" className="btn-outline btn-sm bg-white !py-2.5">
          <Settings2 className="h-4 w-4" /> Pengaturan invoice
        </Link>
        <PrintButton />
      </div>
      <article className="mx-auto max-w-3xl bg-white p-6 text-sm text-charcoal-900 shadow-card sm:p-10 print:max-w-none print:p-0 print:shadow-none">
        <header className="flex flex-col justify-between gap-6 border-b border-charcoal-900/10 pb-6 sm:flex-row">
          <div className="flex items-start gap-4">
            {logo && (
              <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg">
                <Image src={logo} alt={s.business_name} fill sizes="64px" unoptimized className="object-contain" />
              </span>
            )}
            <div>
              <p className="font-display text-xl font-bold">{s.business_name}</p>
              {s.address && <p className="mt-1 max-w-xs text-xs text-charcoal-700">{s.address}</p>}
              <p className="mt-1 text-xs text-charcoal-700">{[s.whatsapp_number ? `WA +${s.whatsapp_number}` : null, s.email].filter(Boolean).join(" · ")}</p>
            </div>
          </div>
          <div className="sm:text-right">
            <p className="font-display text-2xl font-bold tracking-tight text-wood-600">{(cfg.invoice_title as string | undefined) || "INVOICE"}</p>
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
          {bankList.length > 0 ? (
            <section className="sm:max-w-xs">
              <p className="text-xs font-semibold uppercase tracking-wider text-charcoal-700/70">Pembayaran transfer ke</p>
              <ul className="mt-2 space-y-2">
                {bankList.map((b) => (
                  <li key={b.id as string} className="rounded-lg border border-charcoal-900/10 px-3 py-2">
                    <p className="text-xs font-semibold">{b.bank_name as string}</p>
                    <p className="font-mono text-base font-semibold tracking-wide">{b.account_number as string}</p>
                    <p className="text-xs text-charcoal-700">a.n. {b.account_holder as string}</p>
                    {b.notes && <p className="text-[11px] text-charcoal-700/70">{b.notes as string}</p>}
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

        {o.invoice_notes && (
          <section className="mt-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-charcoal-700/70">Catatan</p>
            <p className="mt-1 whitespace-pre-wrap text-charcoal-800">{o.invoice_notes}</p>
          </section>
        )}

        {terms.length > 0 && (
          <section className="mt-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-charcoal-700/70">Syarat & ketentuan</p>
            <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-xs text-charcoal-700">
              {terms.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ol>
          </section>
        )}

        <footer className="mt-10 whitespace-pre-wrap border-t border-charcoal-900/10 pt-4 text-xs text-charcoal-700">{footer}</footer>
      </article>
    </main>
  );
}
