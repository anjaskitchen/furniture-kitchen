import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SlipActions } from "@/components/admin/erp/hr/SlipActions";
import { requireAdminPage } from "@/lib/admin/auth";
import { fmtQty, labelOf, PAY_TYPES, PAYROLL_ITEM_CATEGORIES, PAYROLL_STATUSES } from "@/lib/erp/constants";
import { getErpSettings, getPayroll } from "@/lib/erp/data";
import { formatRupiah } from "@/lib/format";
import { formatDateShort } from "@/lib/orders";

export const metadata: Metadata = { title: "Slip Gaji", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

/** Slip gaji siap cetak A4 / simpan PDF. Warna identitas: hitam, navy, cream, army green. */
export default async function SlipPage({ params }: { params: Params }) {
  const user = await requireAdminPage();
  if (user.role !== "admin") redirect("/admin");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [d, s] = await Promise.all([getPayroll(id), getErpSettings()]);
  if (!d) notFound();
  const { payroll: p, items } = d;
  const earnings = items.filter((i) => i.item_type === "earning");
  const deductions = items.filter((i) => i.item_type === "deduction");
  const company = s.business_name || "Mandiri Furniture";

  return (
    <main className="min-h-screen bg-[#E8DDC8]/40 px-4 py-8 print:bg-white print:p-0">
      {/* Margin halaman 0 → browser tidak mencetak URL/tanggal di header & footer PDF. */}
      <style>{`@page { size: A4; margin: 0; } @media print { html, body { background: #fff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; } .slip-sheet { margin: 10mm !important; } }`}</style>
      <div className="mx-auto mb-4 flex max-w-3xl flex-wrap items-center justify-between gap-2 print:hidden">
        <Link href={`/admin/penggajian/${p.id}`} className="text-sm text-charcoal-700 underline">
          ← Kembali ke slip
        </Link>
        <SlipActions fileName={`${p.slip_number} ${p.full_name}`} />
      </div>
      <article className="slip-sheet mx-auto max-w-3xl overflow-hidden bg-white text-sm text-[#171717] shadow-card print:max-w-none print:shadow-none">
        <header className="flex items-center justify-between gap-6 bg-[#17263C] px-8 py-6 text-[#E8DDC8]">
          <div className="flex items-center gap-4">
            {s.logo_url && (
              <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-white">
                <Image src={s.logo_url} alt={company} fill sizes="56px" unoptimized className="object-contain p-1" />
              </span>
            )}
            <div>
              <p className="font-display text-xl font-bold tracking-tight">{company}</p>
              {s.address && <p className="mt-0.5 max-w-sm text-xs text-[#E8DDC8]/80">{s.address}</p>}
              {s.whatsapp_number && <p className="text-xs text-[#E8DDC8]/80">WA +{s.whatsapp_number}</p>}
            </div>
          </div>
          <div className="text-right">
            <p className="font-display text-2xl font-bold tracking-[0.15em]">SLIP GAJI</p>
            <p className="mt-1 text-xs">{p.slip_number}</p>
          </div>
        </header>

        <section className="grid gap-x-8 gap-y-2 border-b border-[#383A3D]/15 px-8 py-5 sm:grid-cols-2">
          {[
            ["Periode", `${formatDateShort(p.period_start)} – ${formatDateShort(p.period_end)}`],
            ["Nomor pegawai", p.employee_number],
            ["Nama pegawai", p.full_name],
            ["Jabatan", p.position_name ?? "-"],
            ["Sistem gaji", labelOf(PAY_TYPES, p.pay_type)],
            ["Jumlah hari kerja", `${fmtQty(p.days_worked)} hari`],
            ...(p.pay_type === "daily" ? [["Upah harian", formatRupiah(p.daily_rate)]] : []),
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 border-b border-dashed border-[#383A3D]/10 py-1 sm:block sm:border-0 sm:py-0">
              <p className="text-xs uppercase tracking-wider text-[#383A3D]/70">{k}</p>
              <p className="font-semibold">{v}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-6 px-8 py-6 sm:grid-cols-2">
          <div>
            <h2 className="mb-2 border-b-2 border-[#4B5138] pb-1 text-xs font-bold uppercase tracking-wider text-[#4B5138]">Pendapatan</h2>
            <table className="w-full">
              <tbody>
                {earnings.map((i) => (
                  <tr key={i.id} className="border-b border-[#383A3D]/10">
                    <td className="py-1.5 pr-2">
                      {i.description}
                      <span className="block text-[11px] text-[#383A3D]/60">{labelOf(PAYROLL_ITEM_CATEGORIES, i.category)}</span>
                    </td>
                    <td className="py-1.5 text-right tabular-nums">{formatRupiah(i.amount)}</td>
                  </tr>
                ))}
                {!earnings.length && (
                  <tr>
                    <td className="py-1.5 text-[#383A3D]/60">-</td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="font-semibold">
                  <td className="pt-2">Total gaji kotor</td>
                  <td className="pt-2 text-right tabular-nums">{formatRupiah(p.total_earnings)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div>
            <h2 className="mb-2 border-b-2 border-red-700/70 pb-1 text-xs font-bold uppercase tracking-wider text-red-800">Potongan</h2>
            <table className="w-full">
              <tbody>
                {deductions.map((i) => (
                  <tr key={i.id} className="border-b border-[#383A3D]/10">
                    <td className="py-1.5 pr-2">{i.description}</td>
                    <td className="py-1.5 text-right tabular-nums">−{formatRupiah(i.amount)}</td>
                  </tr>
                ))}
                {!deductions.length && (
                  <tr>
                    <td className="py-1.5 text-[#383A3D]/60">Tidak ada potongan</td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="font-semibold">
                  <td className="pt-2">Total potongan</td>
                  <td className="pt-2 text-right tabular-nums">−{formatRupiah(p.total_deductions)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        <section className="mx-8 flex flex-col justify-between gap-2 rounded-xl bg-[#E8DDC8] px-6 py-4 sm:flex-row sm:items-center">
          <p className="text-xs font-bold uppercase tracking-wider text-[#383A3D]">Total gaji bersih diterima</p>
          <p className="font-display text-2xl font-bold tabular-nums text-[#17263C]">{formatRupiah(p.net_amount)}</p>
        </section>

        <section className="grid gap-2 px-8 py-4 text-xs text-[#383A3D] sm:grid-cols-2">
          <p>
            Status pembayaran: <strong>{labelOf(PAYROLL_STATUSES, p.status)}</strong>
          </p>
          <p className="sm:text-right">Tanggal pembayaran: {p.payment_date ? formatDateShort(p.payment_date) : "-"}</p>
          {p.notes && <p className="sm:col-span-2">Catatan: {p.notes}</p>}
        </section>

        <section className="grid grid-cols-2 gap-8 px-8 pb-10 pt-4 text-center text-xs">
          <div>
            <p>Penerima,</p>
            <div className="h-20" />
            <p className="border-t border-[#383A3D]/40 pt-1 font-semibold">{p.full_name}</p>
          </div>
          <div>
            <p>{company},</p>
            <div className="h-20" />
            <p className="border-t border-[#383A3D]/40 pt-1 font-semibold">{s.company_signatory || "(...........................)"}</p>
          </div>
        </section>
        <footer className="bg-[#171717] px-8 py-2 text-center text-[10px] text-[#E8DDC8]/70">Dokumen ini dibuat otomatis oleh sistem {company} · bersifat rahasia</footer>
      </article>
    </main>
  );
}
