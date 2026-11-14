"use client";
import { ArrowLeft, BadgeCheck, Banknote, MessageCircle, Plus, Printer, RotateCcw, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { addPayrollItem, deletePayroll, deletePayrollItem, generatePayrolls, setPayrollStatus, updatePayrollNotes } from "@/app/admin/erp/hr-actions";
import { AdminModal } from "@/components/admin/AdminModal";
import type { PayrollItemRow, PayrollRow } from "@/lib/erp/data";
import { fmtQty, labelOf, PAY_TYPES, PAYROLL_ITEM_CATEGORIES, PAYROLL_STATUSES } from "@/lib/erp/constants";
import type { Option } from "@/lib/erp/types";
import { formatRupiah } from "@/lib/format";
import { formatDateShort, jakartaToday } from "@/lib/orders";
import { whatsappLink } from "@/lib/whatsapp";
import { Field, FormActions, IconButton, MoneyInput, Stat, StatusPill, useAction } from "../kit";

export function PayrollEditor({ payroll: p, items, accounts }: { payroll: PayrollRow & { phone: string | null; account_name: string | null }; items: PayrollItemRow[]; accounts: Option[] }) {
  const router = useRouter();
  const { run, pending, errors } = useAction();
  const [add, setAdd] = useState<{ category: string; description: string; amount: number } | null>(null);
  const [pay, setPay] = useState<{ date: string; account_id: string } | null>(null);
  const [notes, setNotes] = useState(p.notes ?? "");
  const draft = p.status === "draft";
  const earnings = items.filter((i) => i.item_type === "earning");
  const deductions = items.filter((i) => i.item_type === "deduction");

  const list = (rows: PayrollItemRow[], sign: string) => (
    <ul className="divide-y divide-charcoal-900/5 text-sm">
      {rows.map((i) => (
        <li key={i.id} className="flex items-center justify-between gap-2 py-2">
          <span>
            {i.description}
            <span className="block text-xs text-charcoal-700/60">{labelOf(PAYROLL_ITEM_CATEGORIES, i.category)}</span>
          </span>
          <span className="flex items-center gap-1 tabular-nums">
            {sign}
            {formatRupiah(i.amount)}
            {draft && (
              <IconButton label="Hapus rincian" danger onClick={() => run(() => deletePayrollItem(i.id), { confirm: `Hapus "${i.description}" dari slip?` })}>
                <Trash2 className="h-3.5 w-3.5" />
              </IconButton>
            )}
          </span>
        </li>
      ))}
      {!rows.length && <li className="py-2 text-charcoal-700/60">-</li>}
    </ul>
  );

  return (
    <div>
      <Link href={`/admin/penggajian?month=${p.period_end.slice(0, 7)}`} className="mb-3 inline-flex items-center gap-1.5 text-sm text-charcoal-700 hover:text-charcoal-900">
        <ArrowLeft className="h-4 w-4" /> Penggajian
      </Link>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold sm:text-3xl">{p.full_name}</h1>
            <StatusPill list={PAYROLL_STATUSES} value={p.status} />
          </div>
          <p className="mt-1 text-sm text-charcoal-700">
            {p.slip_number} · {formatDateShort(p.period_start)} – {formatDateShort(p.period_end)} · {labelOf(PAY_TYPES, p.pay_type)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/admin/slip/${p.id}`} target="_blank" className="btn-outline btn-sm bg-white !py-2.5">
            <Printer className="h-4 w-4" /> Lihat / cetak / PDF
          </Link>
          {p.phone && (
            <a
              href={whatsappLink(p.phone, `Halo ${p.full_name}, slip gaji ${p.slip_number} periode ${formatDateShort(p.period_start)} – ${formatDateShort(p.period_end)}: gaji bersih ${formatRupiah(p.net_amount)}. Terima kasih atas kerja kerasnya.`)}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-outline btn-sm bg-white !py-2.5"
            >
              <MessageCircle className="h-4 w-4" /> Kirim info
            </a>
          )}
          {draft && (
            <button className="btn-outline btn-sm bg-white !py-2.5" disabled={pending} onClick={() => run(() => generatePayrolls({ employee_ids: [p.employee_id], start: p.period_start, end: p.period_end }), { confirm: "Hitung ulang slip dari absensi, potongan & kasbon terbaru? Rincian manual akan hilang.", success: "Slip dihitung ulang" })}>
              <RotateCcw className="h-4 w-4" /> Hitung ulang
            </button>
          )}
          {draft && (
            <button className="btn-accent btn-sm !py-2.5" disabled={pending} onClick={() => run(() => setPayrollStatus({ id: p.id, status: "approved" }), { success: "Slip disetujui" })}>
              <BadgeCheck className="h-4 w-4" /> Setujui
            </button>
          )}
          {p.status === "approved" && (
            <>
              <button className="btn-outline btn-sm bg-white !py-2.5" disabled={pending} onClick={() => run(() => setPayrollStatus({ id: p.id, status: "draft" }), { success: "Slip dikembalikan ke draft" })}>
                Kembali ke draft
              </button>
              <button className="btn-primary btn-sm !py-2.5" onClick={() => setPay({ date: jakartaToday(), account_id: accounts.find((a) => a.sub === "cash")?.value ?? accounts[0]?.value ?? "" })}>
                <Banknote className="h-4 w-4" /> Bayar gaji
              </button>
            </>
          )}
          {p.status !== "paid" && (
            <button
              className="btn btn-sm border border-red-200 bg-white !py-2.5 text-red-600 hover:bg-red-50"
              onClick={() => run(() => deletePayroll(p.id), { confirm: `Hapus slip ${p.slip_number}?`, onOk: () => router.push(`/admin/penggajian?month=${p.period_end.slice(0, 7)}`), refresh: false })}
            >
              <Trash2 className="h-4 w-4" /> Hapus
            </button>
          )}
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Hari kerja" value={fmtQty(p.days_worked)} sub={p.daily_rate ? `${formatRupiah(p.daily_rate)}/hari` : undefined} />
        <Stat label="Gaji kotor + tambahan" value={formatRupiah(p.total_earnings)} />
        <Stat label="Total potongan" value={formatRupiah(p.total_deductions)} />
        <Stat label="Gaji bersih" value={formatRupiah(p.net_amount)} tone="good" sub={p.status === "paid" ? `Dibayar ${formatDateShort(p.payment_date!)} · ${p.account_name ?? ""}` : undefined} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl bg-white p-5 ring-1 ring-charcoal-900/5">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Pendapatan</h2>
            {draft && (
              <button className="btn-outline btn-sm" onClick={() => setAdd({ category: "incentive", description: "Insentif", amount: 0 })}>
                <Plus className="h-4 w-4" /> Tambah
              </button>
            )}
          </div>
          {list(earnings, "")}
        </section>
        <section className="rounded-2xl bg-white p-5 ring-1 ring-charcoal-900/5">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Potongan</h2>
            {draft && (
              <button className="btn-outline btn-sm" onClick={() => setAdd({ category: "deduction", description: "", amount: 0 })}>
                <Plus className="h-4 w-4" /> Tambah
              </button>
            )}
          </div>
          {list(deductions, "−")}
          <p className="mt-2 text-xs text-charcoal-700/70">Potongan rokok/makan & cicilan kasbon diambil otomatis dari menu Potongan & Kasbon.</p>
        </section>
      </div>

      <section className="mt-6 rounded-2xl bg-white p-5 ring-1 ring-charcoal-900/5">
        <Field label="Catatan slip">
          <div className="flex gap-2">
            <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} disabled={p.status === "paid"} />
            {p.status !== "paid" && (
              <button className="btn-outline" disabled={pending || notes === (p.notes ?? "")} onClick={() => run(() => updatePayrollNotes({ id: p.id, notes }))}>
                Simpan
              </button>
            )}
          </div>
        </Field>
        {!draft && p.status !== "paid" && <p className="mt-2 text-xs text-charcoal-700/70">Kembalikan ke draft untuk mengubah rincian.</p>}
        {p.status === "paid" && <p className="mt-2 text-xs text-charcoal-700/70">Slip sudah dibayar & terkunci. Pembayaran tercatat sebagai kas keluar (gaji) di buku kas.</p>}
      </section>

      <AdminModal open={add !== null} onClose={() => setAdd(null)} title="Tambah rincian slip">
        {add && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run(() => addPayrollItem({ ...add, payroll_id: p.id }), { onOk: () => setAdd(null) });
            }}
            className="grid gap-4 sm:grid-cols-2"
          >
            <Field label="Jenis" required>
              <select
                className="input"
                value={add.category}
                onChange={(e) => setAdd({ ...add, category: e.target.value, description: add.description || labelOf(PAYROLL_ITEM_CATEGORIES, e.target.value) })}
              >
                {PAYROLL_ITEM_CATEGORIES.filter((c) => c.value !== "loan").map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.type === "earning" ? "＋ " : "− "}
                    {c.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Nominal" required error={errors.amount}>
              <MoneyInput value={add.amount} onChange={(n) => setAdd({ ...add, amount: n })} />
            </Field>
            <Field label="Keterangan" required error={errors.description} className="sm:col-span-2">
              <input className="input" value={add.description} onChange={(e) => setAdd({ ...add, description: e.target.value })} />
            </Field>
            <FormActions onCancel={() => setAdd(null)} pending={pending} label="Tambah" />
          </form>
        )}
      </AdminModal>

      <AdminModal open={pay !== null} onClose={() => setPay(null)} title={`Bayar gaji ${p.full_name}`}>
        {pay && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run(() => setPayrollStatus({ id: p.id, status: "paid", date: pay.date, account_id: pay.account_id }), { success: "Gaji dibayar & tercatat di buku kas", onOk: () => setPay(null) });
            }}
            className="grid gap-4 sm:grid-cols-2"
          >
            <p className="rounded-xl bg-cream-100 p-3 text-sm sm:col-span-2">
              Gaji bersih <strong>{formatRupiah(p.net_amount)}</strong> akan dicatat sebagai kas keluar. Setelah dibayar, slip & absensi periode ini terkunci.
            </p>
            <Field label="Tanggal pembayaran" required>
              <input type="date" min="1900-01-01" max="2100-12-31" className="input" value={pay.date} onChange={(e) => setPay({ ...pay, date: e.target.value })} />
            </Field>
            <Field label="Dibayar dari akun" required>
              <select className="input" value={pay.account_id} onChange={(e) => setPay({ ...pay, account_id: e.target.value })}>
                <option value="">— Pilih akun —</option>
                {accounts.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </select>
            </Field>
            <FormActions onCancel={() => setPay(null)} pending={pending} label="Tandai dibayar" />
          </form>
        )}
      </AdminModal>
    </div>
  );
}
