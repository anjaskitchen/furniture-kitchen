"use client";
import { Eye, Landmark, Pencil, Plus, Save, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { deleteBankAccount, saveBankAccount, saveInvoiceSettings } from "@/app/admin/erp/invoice-actions";
import { AdminModal } from "@/components/admin/AdminModal";
import { ImageUploader } from "@/components/admin/ImageUploader";
import { Badge, Field, FormActions, IconButton, useAction } from "./kit";

export interface BankAccount {
  id: string;
  bank_name: string;
  account_number: string;
  account_holder: string;
  notes: string | null;
  is_active: boolean;
  sort_order: number;
}
export interface InvoiceSettingsValues {
  invoice_logo_url: string;
  invoice_title: string;
  invoice_footer: string;
  invoice_terms: string;
  invoice_show_bank: boolean;
  work_days_per_week: number;
}

type BankForm = { id: string | null; bank_name: string; account_number: string; account_holder: string; notes: string; is_active: boolean; sort_order: number };

export function InvoiceSettings({ initial, banks, siteLogo, previewOrderId }: { initial: InvoiceSettingsValues; banks: BankAccount[]; siteLogo: string | null; previewOrderId: string | null }) {
  const { run, pending, errors } = useAction();
  const [s, setS] = useState(initial);
  const [b, setB] = useState<BankForm | null>(null);
  const bank = useAction();

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="space-y-4 rounded-2xl bg-white p-5 ring-1 ring-charcoal-900/5 sm:p-6">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-lg font-semibold">Tampilan invoice</h2>
          {previewOrderId && (
            <Link href={`/admin/invoice/${previewOrderId}`} target="_blank" className="btn-outline btn-sm">
              <Eye className="h-4 w-4" /> Pratinjau
            </Link>
          )}
        </div>
        <Field label="Logo invoice" hint={siteLogo ? "Kosongkan untuk memakai logo dari Pengaturan Website." : "PNG/JPG/WEBP, sebaiknya latar transparan, maks 10 MB."}>
          <ImageUploader folder="invoice" value={s.invoice_logo_url ? [s.invoice_logo_url] : []} onChange={(u) => setS({ ...s, invoice_logo_url: u[0] ?? "" })} />
        </Field>
        <Field label="Judul dokumen" required error={errors.invoice_title}>
          <input className="input" value={s.invoice_title} onChange={(e) => setS({ ...s, invoice_title: e.target.value })} placeholder="INVOICE" />
        </Field>
        <Field label="Syarat & ketentuan" hint="Tampil di bagian bawah invoice. Satu poin per baris." error={errors.invoice_terms}>
          <textarea
            className="input"
            rows={5}
            value={s.invoice_terms}
            onChange={(e) => setS({ ...s, invoice_terms: e.target.value })}
            placeholder={"DP 50% sebelum produksi dimulai.\nPelunasan setelah pemasangan selesai.\nGaransi 1 tahun untuk hardware."}
          />
        </Field>
        <Field label="Catatan penutup" error={errors.invoice_footer} hint="Kosongkan untuk teks bawaan (ucapan terima kasih + nomor WhatsApp).">
          <textarea className="input" rows={2} value={s.invoice_footer} onChange={(e) => setS({ ...s, invoice_footer: e.target.value })} />
        </Field>
        <Field label="Hari kerja per minggu" hint="Dipakai untuk menghitung tanggal selesai maksimal dari jangka waktu 'hari kerja'.">
          <select className="input" value={s.work_days_per_week} onChange={(e) => setS({ ...s, work_days_per_week: Number(e.target.value) })}>
            <option value={6}>6 hari (Senin–Sabtu)</option>
            <option value={5}>5 hari (Senin–Jumat)</option>
            <option value={7}>7 hari (setiap hari)</option>
          </select>
        </Field>
        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-charcoal-900/10 px-4 py-3">
          <input type="checkbox" checked={s.invoice_show_bank} onChange={(e) => setS({ ...s, invoice_show_bank: e.target.checked })} className="h-5 w-5 accent-wood-500" />
          <span className="text-sm font-medium">Tampilkan rekening transfer di invoice</span>
        </label>
        <div className="flex justify-end">
          <button className="btn-primary" disabled={pending} onClick={() => run(() => saveInvoiceSettings(s))}>
            <Save className="h-4 w-4" /> Simpan pengaturan
          </button>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-5 ring-1 ring-charcoal-900/5 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
            <Landmark className="h-5 w-5 text-[#17263C]" /> Rekening transfer
          </h2>
          <button className="btn-primary btn-sm" onClick={() => setB({ id: null, bank_name: "", account_number: "", account_holder: "", notes: "", is_active: true, sort_order: banks.length + 1 })}>
            <Plus className="h-4 w-4" /> Rekening
          </button>
        </div>
        <ul className="space-y-3">
          {banks.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 rounded-xl border border-charcoal-900/10 p-4">
              <div className="min-w-0">
                <p className="font-semibold">
                  {a.bank_name} {!a.is_active && <Badge>Disembunyikan</Badge>}
                </p>
                <p className="font-mono text-lg tracking-wide">{a.account_number}</p>
                <p className="text-sm text-charcoal-700">a.n. {a.account_holder}</p>
                {a.notes && <p className="text-xs text-charcoal-700/70">{a.notes}</p>}
              </div>
              <div className="flex shrink-0">
                <IconButton label="Edit" onClick={() => setB({ ...a, notes: a.notes ?? "" })}>
                  <Pencil className="h-4 w-4" />
                </IconButton>
                <IconButton label="Hapus" danger onClick={() => bank.run(() => deleteBankAccount(a.id), { confirm: `Hapus rekening ${a.bank_name} ${a.account_number}?` })}>
                  <Trash2 className="h-4 w-4" />
                </IconButton>
              </div>
            </li>
          ))}
          {!banks.length && <li className="rounded-xl border border-dashed border-charcoal-900/15 p-6 text-center text-sm text-charcoal-700/70">Belum ada rekening. Tambahkan rekening agar konsumen tahu ke mana harus transfer.</li>}
        </ul>
        <p className="mt-3 text-xs text-charcoal-700/70">Rekening aktif tampil di setiap invoice sesuai urutan.</p>
      </section>

      <AdminModal open={b !== null} onClose={() => setB(null)} title={b?.id ? "Edit rekening" : "Tambah rekening transfer"}>
        {b && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              bank.run(() => saveBankAccount(b), { onOk: () => setB(null) });
            }}
            className="grid gap-4 sm:grid-cols-2"
          >
            <Field label="Nama bank" required error={bank.errors.bank_name}>
              <input className="input" list="bank-names" value={b.bank_name} onChange={(e) => setB({ ...b, bank_name: e.target.value })} placeholder="BCA" />
              <datalist id="bank-names">
                {["BCA", "BRI", "BNI", "Mandiri", "BSI", "CIMB Niaga", "Permata", "BJB", "Danamon", "Jago", "SeaBank", "DANA", "OVO", "GoPay"].map((n) => (
                  <option key={n} value={n} />
                ))}
              </datalist>
            </Field>
            <Field label="Nomor rekening" required error={bank.errors.account_number}>
              <input className="input font-mono" inputMode="numeric" value={b.account_number} onChange={(e) => setB({ ...b, account_number: e.target.value })} />
            </Field>
            <Field label="Atas nama" required error={bank.errors.account_holder} className="sm:col-span-2">
              <input className="input" value={b.account_holder} onChange={(e) => setB({ ...b, account_holder: e.target.value })} />
            </Field>
            <Field label="Keterangan (opsional)" className="sm:col-span-2">
              <input className="input" value={b.notes} onChange={(e) => setB({ ...b, notes: e.target.value })} placeholder="cth. Khusus pembayaran DP" />
            </Field>
            <Field label="Urutan">
              <input type="number" min={0} className="input" value={b.sort_order} onChange={(e) => setB({ ...b, sort_order: Number(e.target.value) })} />
            </Field>
            <label className="flex cursor-pointer items-center gap-3 self-end rounded-xl border border-charcoal-900/10 px-4 py-3">
              <input type="checkbox" checked={b.is_active} onChange={(e) => setB({ ...b, is_active: e.target.checked })} className="h-5 w-5 accent-wood-500" />
              <span className="text-sm font-medium">Tampil di invoice</span>
            </label>
            <FormActions onCancel={() => setB(null)} pending={bank.pending} />
          </form>
        )}
      </AdminModal>
    </div>
  );
}
