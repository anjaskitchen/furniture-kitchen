import { BadgeCheck, CalendarClock, CalendarDays, CircleDollarSign, Clock3, Landmark, MapPin, Phone, ShieldCheck, Star, User, Wallet } from "lucide-react";
import Image from "next/image";
import type { ReactNode } from "react";
import { formatRupiah } from "@/lib/format";
import { kindName, type InvoiceData } from "@/lib/invoice";
import { durationLabel, formatDateShort, jakartaToday, methodLabel } from "@/lib/orders";
import { cn } from "@/lib/utils";

const num = (n: number) => n.toLocaleString("id-ID", { maximumFractionDigits: 3 });

/**
 * CSS cetak: margin halaman 0 agar browser tidak mencetak URL/tanggal di header & footer PDF.
 * Jarak tepi diganti padding lembar yang diulang di setiap halaman.
 */
export const INVOICE_PRINT_CSS = `@page { size: A4; margin: 0; }
@media print {
  html, body { background: #fff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .invoice-sheet { padding: 12mm !important; box-decoration-break: clone; -webkit-box-decoration-break: clone; font-size: 12px; }
  .invoice-avoid { break-inside: avoid; }
}`;

/** Warna identitas Mandiri Furniture. */
const C = { navy: "#17263C", cream: "#E8DDC8", army: "#4B5138", black: "#171717", gray: "#383A3D" };

/** Status pembayaran → warna (Lunas hijau, Sebagian kuning, Belum bayar merah). */
const PAY_STATUS: Record<string, { label: string; cls: string; dot: string }> = {
  paid: { label: "LUNAS", cls: "bg-emerald-50 text-emerald-700 ring-emerald-600/30", dot: "bg-emerald-500" },
  partial: { label: "DIBAYAR SEBAGIAN", cls: "bg-amber-50 text-amber-700 ring-amber-500/30", dot: "bg-amber-500" },
  unpaid: { label: "BELUM DIBAYAR", cls: "bg-rose-50 text-rose-700 ring-rose-500/30", dot: "bg-rose-500" },
};

/** Jenis pembayaran → warna chip (DP biru, Termin ungu, Pelunasan hijau, lainnya otomatis). */
const KIND_TONES: Record<string, string> = {
  dp: "bg-sky-100 text-sky-800 ring-sky-600/20",
  termin: "bg-violet-100 text-violet-800 ring-violet-600/20",
  pelunasan: "bg-emerald-100 text-emerald-800 ring-emerald-600/20",
  other: "bg-slate-100 text-slate-700 ring-slate-500/20",
};
const EXTRA_TONES = [
  "bg-indigo-100 text-indigo-800 ring-indigo-600/20",
  "bg-teal-100 text-teal-800 ring-teal-600/20",
  "bg-orange-100 text-orange-800 ring-orange-600/20",
  "bg-fuchsia-100 text-fuchsia-800 ring-fuchsia-600/20",
  "bg-cyan-100 text-cyan-800 ring-cyan-600/20",
];
function kindTone(code: string) {
  if (KIND_TONES[code]) return KIND_TONES[code];
  if (code.startsWith("termin")) return KIND_TONES.termin;
  let h = 0;
  for (const ch of code) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return EXTRA_TONES[h % EXTRA_TONES.length];
}

/** Status pekerjaan (order) untuk konsumen. */
const WORK_STATUS: Record<string, { label: string; cls: string }> = {
  quotation: { label: "Penawaran", cls: "bg-sky-50 text-sky-700" },
  confirmed: { label: "Order dikonfirmasi", cls: "bg-amber-50 text-amber-700" },
  production: { label: "Dalam produksi", cls: "bg-orange-50 text-orange-700" },
  installation: { label: "Tahap pemasangan", cls: "bg-violet-50 text-violet-700" },
  completed: { label: "Pekerjaan selesai", cls: "bg-emerald-50 text-emerald-700" },
  cancelled: { label: "Dibatalkan", cls: "bg-slate-100 text-slate-600" },
};

function Label({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("text-[10px] font-bold uppercase tracking-[0.14em] text-[#383A3D]/60", className)}>{children}</p>;
}

function MetaCard({ icon: Icon, label, value, sub, tone }: { icon: typeof CalendarDays; label: string; value: ReactNode; sub?: ReactNode; tone?: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-white p-3.5 ring-1 ring-[#17263C]/10">
      <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl", tone ?? "bg-[#E8DDC8]/60 text-[#17263C]")}>
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <Label>{label}</Label>
        <p className="mt-0.5 font-semibold leading-tight text-[#171717]">{value}</p>
        {sub && <p className="mt-0.5 text-xs text-[#383A3D]/70">{sub}</p>}
      </div>
    </div>
  );
}

/** Dokumen invoice (dipakai halaman admin & link publik konsumen). */
export function InvoiceDocument({ inv }: { inv: InvoiceData }) {
  const { order: o, items, payments } = inv;
  const s = inv.settings;
  const status = PAY_STATUS[o.payment_status] ?? PAY_STATUS.unpaid;
  const work = WORK_STATUS[o.status] ?? WORK_STATUS.confirmed;
  const start = o.work_start_date ?? o.order_date;
  const paidPct = o.total > 0 ? Math.min(100, Math.round((o.paid_amount / o.total) * 100)) : 0;
  const today = jakartaToday();
  const overdue = o.balance > 0 && o.due_date && o.due_date < today;

  return (
    <article className="invoice-sheet mx-auto max-w-3xl overflow-hidden rounded-3xl bg-[#FBF9F5] p-4 text-sm text-[#171717] shadow-card sm:p-6 print:max-w-none print:rounded-none print:shadow-none">
      {/* ===== Kepala invoice ===== */}
      <header className="invoice-avoid relative overflow-hidden rounded-2xl p-6 text-[#E8DDC8] sm:p-7" style={{ background: `linear-gradient(135deg, ${C.navy} 0%, #0F1A2B 100%)` }}>
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[#E8DDC8]/5" aria-hidden />
        <div className="pointer-events-none absolute -bottom-20 right-24 h-40 w-40 rounded-full bg-[#4B5138]/30" aria-hidden />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            {inv.logo && (
              <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-white/95 ring-1 ring-white/20">
                <Image src={inv.logo} alt={s.business_name} fill sizes="64px" unoptimized className="object-contain p-1.5" />
              </span>
            )}
            <div>
              <p className="font-display text-2xl font-bold tracking-tight text-white">{s.business_name}</p>
              {s.tagline && <p className="text-xs text-[#E8DDC8]/70">{s.tagline}</p>}
              {s.address && <p className="mt-2 max-w-sm text-xs leading-relaxed text-[#E8DDC8]/80">{s.address}</p>}
              <p className="mt-1 text-xs text-[#E8DDC8]/80">{[s.whatsapp_number ? `WA +${s.whatsapp_number}` : null, s.email].filter(Boolean).join("  ·  ")}</p>
            </div>
          </div>
          <div className="sm:text-right">
            <p className="font-display text-3xl font-extrabold tracking-[0.18em] text-white">{inv.title}</p>
            <p className="mt-1 font-mono text-base font-semibold tracking-wide text-[#E8DDC8]">#{o.order_number}</p>
            <span className={cn("mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-extrabold tracking-wider ring-1 ring-inset", status.cls)}>
              <span className={cn("h-2 w-2 rounded-full", status.dot)} aria-hidden />
              {status.label}
            </span>
          </div>
        </div>
      </header>

      {/* ===== Ringkasan cepat ===== */}
      <section className="invoice-avoid mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetaCard icon={CalendarDays} label="Tanggal invoice" value={formatDateShort(o.order_date)} />
        <MetaCard
          icon={Clock3}
          label="Jatuh tempo"
          value={o.due_date ? formatDateShort(o.due_date) : "-"}
          sub={overdue ? <span className="font-semibold text-rose-600">Lewat jatuh tempo</span> : undefined}
          tone={overdue ? "bg-rose-50 text-rose-600" : undefined}
        />
        <MetaCard icon={BadgeCheck} label="Status pekerjaan" value={<span className={cn("rounded-md px-1.5 py-0.5 text-xs", work.cls)}>{work.label}</span>} />
        <MetaCard
          icon={Wallet}
          label="Sisa tagihan"
          value={<span className={o.balance > 0 ? "text-rose-600" : "text-emerald-600"}>{o.balance > 0 ? formatRupiah(o.balance) : "Lunas"}</span>}
          tone={o.balance > 0 ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"}
        />
      </section>

      {/* ===== Konsumen & proyek ===== */}
      <section className="invoice-avoid mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl bg-white p-4 ring-1 ring-[#17263C]/10">
          <Label>Ditagihkan kepada</Label>
          <p className="mt-1.5 flex items-center gap-2 text-base font-bold">
            <User className="h-4 w-4 text-[#4B5138]" /> {o.customer_name}
          </p>
          <div className="mt-1.5 space-y-1 text-[#383A3D]">
            {o.customer_phone && (
              <p className="flex items-center gap-2">
                <Phone className="h-3.5 w-3.5 text-[#383A3D]/50" /> {o.customer_phone}
              </p>
            )}
            {o.customer_email && <p className="pl-[22px] lowercase">{o.customer_email}</p>}
            {o.customer_address && (
              <p className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#383A3D]/50" /> {o.customer_address}
              </p>
            )}
          </div>
        </div>
        <div className="rounded-2xl bg-white p-4 ring-1 ring-[#17263C]/10">
          <Label>Proyek</Label>
          <p className="mt-1.5 text-base font-bold leading-snug">{o.title}</p>
          {o.category && <span className="mt-2 inline-block rounded-full bg-[#4B5138]/10 px-2.5 py-0.5 text-xs font-semibold text-[#4B5138]">{o.category}</span>}
          {o.work_duration && o.estimated_finish_date && (
            <div className="mt-3 rounded-xl bg-[#E8DDC8]/45 p-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-[#17263C]">
                <CalendarClock className="h-3.5 w-3.5" /> Jangka waktu {durationLabel(o.work_duration, o.work_duration_unit)}
              </p>
              <div className="mt-2 flex items-center gap-2 text-xs">
                <span className="rounded-md bg-white px-2 py-1 font-semibold">{formatDateShort(start)}</span>
                <span className="h-px flex-1 bg-[#17263C]/25" aria-hidden />
                <span className="rounded-md bg-[#17263C] px-2 py-1 font-semibold text-white">Maks. {formatDateShort(o.estimated_finish_date)}</span>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ===== Rincian pekerjaan ===== */}
      <section className="mt-4 overflow-hidden rounded-2xl bg-white ring-1 ring-[#17263C]/10">
        <table className="w-full border-collapse [&_td]:border-0 [&_th]:border-0">
          <thead>
            <tr className="bg-[#17263C] text-left text-[10px] uppercase tracking-[0.14em] text-[#E8DDC8]">
              <th className="py-3 pl-4 pr-2 font-bold">Rincian pekerjaan</th>
              <th className="px-2 py-3 text-right font-bold">Qty</th>
              <th className="px-2 py-3 text-right font-bold">Harga</th>
              <th className="py-3 pl-2 pr-4 text-right font-bold">Jumlah</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={it.id} className={cn("invoice-avoid align-top", i % 2 === 1 && "bg-[#E8DDC8]/20")}>
                <td className="py-3 pl-4 pr-2">
                  <p className="font-semibold">{it.name}</p>
                  {it.length_m && it.height_m ? (
                    <p className="mt-1 inline-flex items-center gap-1 rounded-md bg-[#4B5138]/10 px-2 py-0.5 text-[11px] font-medium text-[#4B5138]">
                      {num(it.length_m)} m × {num(it.height_m)} m = {num(it.qty)} m²
                    </p>
                  ) : null}
                  {it.description && <p className="mt-1 text-xs text-[#383A3D]/80">{it.description}</p>}
                </td>
                <td className="whitespace-nowrap px-2 py-3 text-right tabular-nums">
                  {num(it.qty)} {it.unit}
                </td>
                <td className="whitespace-nowrap px-2 py-3 text-right tabular-nums">
                  {formatRupiah(it.unit_price)}
                  {it.length_m && it.height_m ? <span className="block text-[10px] text-[#383A3D]/60">per m²</span> : null}
                </td>
                <td className="whitespace-nowrap py-3 pl-2 pr-4 text-right font-semibold tabular-nums">{formatRupiah(it.line_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* ===== Rekening & total ===== */}
      <section className="mt-4 grid gap-4 md:grid-cols-[1fr_320px]">
        <div className="order-2 space-y-3 md:order-1">
          {inv.banks.length > 0 && o.balance > 0 && (
            <div className="invoice-avoid rounded-2xl bg-white p-4 ring-1 ring-[#17263C]/10">
              <Label className="flex items-center gap-1.5">
                <Landmark className="h-3.5 w-3.5" /> Pembayaran transfer ke
              </Label>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2">
                {inv.banks.map((b) => (
                  <li key={b.id} className="rounded-xl border border-dashed border-[#17263C]/25 bg-[#FBF9F5] p-3">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-[#17263C]">{b.bank_name}</p>
                    <p className="mt-0.5 font-mono text-lg font-bold tracking-wider">{b.account_number}</p>
                    <p className="text-xs text-[#383A3D]">a.n. {b.account_holder}</p>
                    {b.notes && <p className="text-[11px] text-[#383A3D]/60">{b.notes}</p>}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[11px] text-[#383A3D]/70">
                Mohon cantumkan <strong>{o.order_number}</strong> pada berita transfer.
              </p>
            </div>
          )}
          {o.invoice_notes && (
            <div className="invoice-avoid rounded-2xl bg-white p-4 ring-1 ring-[#17263C]/10">
              <Label>Catatan</Label>
              <p className="mt-1.5 whitespace-pre-wrap text-[#383A3D]">{o.invoice_notes}</p>
            </div>
          )}
          {o.balance <= 0 && o.total > 0 && (
            <div className="invoice-avoid flex items-center gap-3 rounded-2xl bg-emerald-50 p-4 ring-1 ring-emerald-600/20">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-emerald-500 text-white">
                <BadgeCheck className="h-6 w-6" />
              </span>
              <div>
                <p className="font-bold text-emerald-800">Pembayaran telah lunas</p>
                <p className="text-xs text-emerald-700/80">Terima kasih telah mempercayakan proyek Anda kepada {s.business_name}.</p>
              </div>
            </div>
          )}
        </div>

        <div className="invoice-avoid order-1 rounded-2xl bg-white p-4 ring-1 ring-[#17263C]/10 md:order-2">
          <dl className="space-y-2">
            <div className="flex justify-between text-[#383A3D]">
              <dt>Subtotal</dt>
              <dd className="tabular-nums">{formatRupiah(o.subtotal)}</dd>
            </div>
            {o.discount > 0 && (
              <div className="flex justify-between text-emerald-700">
                <dt>Diskon</dt>
                <dd className="tabular-nums">− {formatRupiah(o.discount)}</dd>
              </div>
            )}
            {o.additional_fee > 0 && (
              <div className="flex justify-between text-[#383A3D]">
                <dt>Biaya tambahan</dt>
                <dd className="tabular-nums">{formatRupiah(o.additional_fee)}</dd>
              </div>
            )}
          </dl>
          <div className="mt-3 rounded-xl bg-[#17263C] px-4 py-3 text-white">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#E8DDC8]/70">Total tagihan</p>
            <p className="font-display text-2xl font-extrabold tabular-nums">{formatRupiah(o.total)}</p>
          </div>
          <div className="mt-3">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-emerald-700">Dibayar {formatRupiah(o.paid_amount)}</span>
              <span className="text-[#383A3D]/70">{paidPct}%</span>
            </div>
            <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-[#E8DDC8]/70">
              <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600" style={{ width: `${paidPct}%` }} />
            </div>
          </div>
          <div className={cn("mt-3 flex items-center justify-between rounded-xl px-4 py-3 font-bold", o.balance > 0 ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700")}>
            <span className="flex items-center gap-1.5">
              <CircleDollarSign className="h-4 w-4" /> {o.balance > 0 ? "Sisa tagihan" : "Status"}
            </span>
            <span className="tabular-nums">{o.balance > 0 ? formatRupiah(o.balance) : "LUNAS ✓"}</span>
          </div>
        </div>
      </section>

      {/* ===== Riwayat pembayaran ===== */}
      {payments.length > 0 && (
        <section className="invoice-avoid mt-4 rounded-2xl bg-white p-4 ring-1 ring-[#17263C]/10">
          <Label>Riwayat pembayaran</Label>
          <ul className="mt-2 divide-y divide-[#17263C]/5">
            {payments.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                <span className={cn("inline-flex min-w-[88px] justify-center rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ring-1 ring-inset", kindTone(p.kind))}>
                  {kindName(inv, p.kind)}
                </span>
                <span className="text-[#383A3D]">{formatDateShort(p.paid_at)}</span>
                <span className="text-xs text-[#383A3D]/60">
                  {methodLabel(p.method)}
                  {p.reference ? ` · ${p.reference}` : ""}
                </span>
                <span className="ml-auto font-semibold tabular-nums">{formatRupiah(p.amount)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ===== Garansi (order selesai) ===== */}
      {o.status === "completed" && (inv.warrantyNote || inv.reviewUrl) && (
        <section className="invoice-avoid mt-4 overflow-hidden rounded-2xl ring-1 ring-[#4B5138]/30">
          <div className="flex items-center gap-2 bg-[#4B5138] px-4 py-2.5 text-white">
            <ShieldCheck className="h-5 w-5" />
            <p className="font-bold">Aktivasi Garansi 1 Tahun</p>
            {o.completed_at && <span className="ml-auto text-xs text-white/80">Selesai {formatDateShort(o.completed_at)}</span>}
          </div>
          <div className="bg-[#4B5138]/5 p-4">
            {inv.warrantyNote && <p className="whitespace-pre-wrap text-[#171717]">{inv.warrantyNote}</p>}
            {inv.reviewUrl && (
              <a href={inv.reviewUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-[#17263C] ring-1 ring-[#17263C]/15">
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                Beri ulasan Google: <span className="break-all underline">{inv.reviewUrl}</span>
              </a>
            )}
          </div>
        </section>
      )}

      {/* ===== Syarat ===== */}
      {inv.terms.length > 0 && (
        <section className="invoice-avoid mt-4 rounded-2xl bg-white p-4 ring-1 ring-[#17263C]/10">
          <Label>Syarat & ketentuan</Label>
          <ol className="mt-2 space-y-1 text-xs text-[#383A3D]">
            {inv.terms.map((t, i) => (
              <li key={i} className="flex gap-2">
                <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-[#E8DDC8] text-[9px] font-bold text-[#17263C]">{i + 1}</span>
                <span>{t}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <footer className="mt-5 flex flex-col items-center gap-1 border-t border-[#17263C]/10 pt-4 text-center text-xs text-[#383A3D]/80">
        <p className="whitespace-pre-wrap">{inv.footer}</p>
        <p className="font-display text-[11px] font-semibold tracking-[0.2em] text-[#17263C]/50">{s.business_name.toUpperCase()}</p>
      </footer>
    </article>
  );
}
