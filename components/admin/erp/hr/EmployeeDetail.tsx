"use client";
import { ArrowLeft, Camera, FileLock2, Loader2, MessageCircle, Pencil, Phone, Printer, Trash2, Upload, User } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";
import { addEmployeeDocument, deleteEmployeeDocument, savePaySettings, setEmployeePhoto } from "@/app/admin/erp/hr-actions";
import { useToast } from "@/components/Toast";
import { StatusBadge } from "@/components/admin/orders/ui";
import type { AttendanceRow, DeductionRow, EmployeeDoc, LoanRow, PayrollRow } from "@/lib/erp/data";
import { ATTENDANCE_STATUSES, DEDUCTION_STATUSES, DOC_TYPES, EMPLOYEE_STATUSES, fmtQty, labelOf, PAY_TYPES, PAYROLL_STATUSES } from "@/lib/erp/constants";
import type { Employee, PaySettings } from "@/lib/erp/types";
import { formatRupiah } from "@/lib/format";
import { formatDateShort } from "@/lib/orders";
import { createClient } from "@/lib/supabase/client";
import { whatsappLink } from "@/lib/whatsapp";
import { DataTable, Field, IconButton, MoneyInput, Stat, StatusPill, TabLinks, useAction } from "../kit";
import { EmployeeFormModal, empForm } from "./EmployeeManager";

const MAX = 5 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

async function uploadPrivate(employeeId: string, file: File, folder: string) {
  if (!TYPES.includes(file.type)) throw new Error("Format harus JPG, PNG, WEBP, atau PDF");
  if (file.size > MAX) throw new Error("Ukuran file maksimal 5 MB");
  const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
  const path = `employees/${employeeId}/${folder}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
  const { error } = await createClient().storage.from("hr-private").upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(`Upload gagal: ${error.message}`);
  return path;
}

type Pos = { id: string; name: string; description: string | null; sort_order: number; is_active: boolean; employees: number };

export function EmployeeDetail({
  tab,
  isOwner,
  employee: e,
  photoUrl,
  pay,
  documents,
  payrolls,
  deductions,
  loans,
  attendance,
  projects,
  positions,
}: {
  tab: string;
  isOwner: boolean;
  employee: Employee;
  photoUrl: string | null;
  pay: PaySettings | null;
  documents: EmployeeDoc[];
  payrolls: PayrollRow[];
  deductions: DeductionRow[];
  loans: LoanRow[];
  attendance: AttendanceRow[];
  projects: { id: string; order_number: string; title: string; status: string; role: string | null }[];
  positions: Pos[];
}) {
  const toast = useToast();
  const { run, pending, errors } = useAction();
  const [edit, setEdit] = useState(false);
  const [busy, setBusy] = useState(false);
  const [docType, setDocType] = useState("ktp");
  const photoInput = useRef<HTMLInputElement>(null);
  const docInput = useRef<HTMLInputElement>(null);
  const [p, setP] = useState({
    pay_type: pay?.pay_type ?? "daily",
    daily_wage: pay?.daily_wage ?? 0,
    monthly_salary: pay?.monthly_salary ?? 0,
    working_days_per_month: pay?.working_days_per_month ?? 26,
    default_allowance: pay?.default_allowance ?? 0,
    default_incentive: pay?.default_incentive ?? 0,
    commission_note: pay?.commission_note ?? "",
  });

  const onPhoto = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    try {
      if (!file.type.startsWith("image/")) throw new Error("Foto harus berupa gambar");
      const path = await uploadPrivate(e.id, file, "photo");
      run(() => setEmployeePhoto({ id: e.id, path }));
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };
  const onDoc = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    try {
      const path = await uploadPrivate(e.id, file, "docs");
      run(() => addEmployeeDocument({ employee_id: e.id, doc_type: docType, file_path: path, file_name: file.name.slice(0, 200), mime_type: file.type, size_bytes: file.size }));
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setBusy(false);
      if (docInput.current) docInput.current.value = "";
    }
  };

  const present = attendance.filter((a) => a.status === "present");
  const loanOutstanding = loans.reduce((a, l) => a + l.outstanding, 0);
  const pendingDed = deductions.filter((d) => d.status === "pending").reduce((a, d) => a + d.amount, 0);
  const tabs = [
    { key: "profil", label: "Profil" },
    ...(isOwner ? [{ key: "gaji", label: "Gaji & dokumen" }, { key: "riwayat-gaji", label: "Riwayat gaji", count: payrolls.length }, { key: "potongan", label: "Potongan & kasbon" }] : []),
    { key: "absensi", label: "Riwayat absensi" },
  ];

  return (
    <div>
      <Link href="/admin/pegawai" className="mb-3 inline-flex items-center gap-1.5 text-sm text-charcoal-700 hover:text-charcoal-900">
        <ArrowLeft className="h-4 w-4" /> Semua pegawai
      </Link>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-cream-200 ring-1 ring-charcoal-900/10">
          {photoUrl ? <Image src={photoUrl} alt={e.full_name} fill sizes="80px" unoptimized className="object-cover" /> : <User className="absolute inset-0 m-auto h-9 w-9 text-charcoal-700/40" />}
          {isOwner && (
            <button onClick={() => photoInput.current?.click()} className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-charcoal-900/70 py-1 text-[11px] text-white" disabled={busy}>
              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Camera className="h-3 w-3" />} Foto
            </button>
          )}
          <input ref={photoInput} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(ev) => onPhoto(ev.target.files?.[0])} />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold sm:text-3xl">{e.full_name}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-charcoal-700">
            {e.employee_number} · {e.position_name ?? "Tanpa jabatan"} <StatusPill list={EMPLOYEE_STATUSES} value={e.status} />
            {e.deleted_at && <span className="text-xs text-red-600">diarsipkan</span>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {e.phone && (
            <a href={whatsappLink(e.phone, `Halo ${e.full_name},`)} target="_blank" rel="noopener noreferrer" className="btn-outline btn-sm bg-white !py-2.5">
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </a>
          )}
          <button className="btn-primary btn-sm !py-2.5" onClick={() => setEdit(true)}>
            <Pencil className="h-4 w-4" /> Edit data
          </button>
        </div>
      </div>

      <TabLinks base={`/admin/pegawai/${e.id}`} active={tab} tabs={tabs} />

      {tab === "profil" && (
        <div className="grid gap-6 lg:grid-cols-3">
          <section className="rounded-2xl bg-white p-5 text-sm ring-1 ring-charcoal-900/5 lg:col-span-2">
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {[
                ["Jenis kelamin", e.gender === "L" ? "Laki-laki" : e.gender === "P" ? "Perempuan" : "-"],
                ["Tempat, tanggal lahir", [e.birth_place, e.birth_date ? formatDateShort(e.birth_date) : null].filter(Boolean).join(", ") || "-"],
                ["Nomor HP", e.phone ?? "-"],
                ["Mulai bekerja", e.start_date ? formatDateShort(e.start_date) : "-"],
                ["Kontak darurat", [e.emergency_contact_name, e.emergency_contact_relation ? `(${e.emergency_contact_relation})` : null].filter(Boolean).join(" ") || "-"],
                ["HP kontak darurat", e.emergency_contact_phone ?? "-"],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs text-charcoal-700/70">{k}</dt>
                  <dd className="font-medium">{v}</dd>
                </div>
              ))}
              <div className="sm:col-span-2">
                <dt className="text-xs text-charcoal-700/70">Alamat</dt>
                <dd className="font-medium">{e.address ?? "-"}</dd>
              </div>
              {e.notes && (
                <div className="sm:col-span-2">
                  <dt className="text-xs text-charcoal-700/70">Catatan administrasi</dt>
                  <dd className="whitespace-pre-wrap">{e.notes}</dd>
                </div>
              )}
            </dl>
            {e.emergency_contact_phone && (
              <a href={`tel:${e.emergency_contact_phone}`} className="btn-outline btn-sm mt-4">
                <Phone className="h-4 w-4" /> Telepon kontak darurat
              </a>
            )}
          </section>
          <section className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Hari hadir (120 hari)" value={fmtQty(present.reduce((a, x) => a + x.days_worked, 0))} />
              <Stat label="Proyek" value={projects.length} />
              {isOwner && <Stat label="Sisa kasbon" value={formatRupiah(loanOutstanding)} tone={loanOutstanding ? "warn" : undefined} />}
              {isOwner && <Stat label="Potongan belum dipotong" value={formatRupiah(pendingDed)} />}
            </div>
            <div className="rounded-2xl bg-white p-4 ring-1 ring-charcoal-900/5">
              <p className="mb-2 text-sm font-semibold">Riwayat proyek</p>
              <ul className="space-y-1.5 text-sm">
                {projects.map((pr) => (
                  <li key={pr.id} className="flex items-center justify-between gap-2">
                    <Link href={`/admin/proyek/${pr.id}`} className="truncate underline-offset-2 hover:underline">
                      {pr.order_number} · {pr.title}
                    </Link>
                    <StatusBadge status={pr.status} />
                  </li>
                ))}
                {!projects.length && <li className="text-charcoal-700/60">Belum ditugaskan ke proyek.</li>}
              </ul>
            </div>
          </section>
        </div>
      )}

      {tab === "gaji" && isOwner && (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl bg-white p-5 ring-1 ring-charcoal-900/5">
            <h2 className="mb-4 font-display text-lg font-semibold">Pengaturan penggajian</h2>
            <form
              onSubmit={(ev) => {
                ev.preventDefault();
                run(() => savePaySettings({ ...p, employee_id: e.id }));
              }}
              className="grid gap-4 sm:grid-cols-2"
            >
              <Field label="Sistem penggajian" required className="sm:col-span-2">
                <div className="grid gap-2 sm:grid-cols-3">
                  {PAY_TYPES.map((t) => (
                    <label key={t.value} className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-sm ${p.pay_type === t.value ? "border-[#17263C] bg-[#17263C]/5" : "border-charcoal-900/10"}`}>
                      <input type="radio" checked={p.pay_type === t.value} onChange={() => setP({ ...p, pay_type: t.value })} className="accent-[#17263C]" /> {t.label}
                    </label>
                  ))}
                </div>
              </Field>
              {p.pay_type === "daily" && (
                <Field label="Upah per hari" required error={errors.daily_wage}>
                  <MoneyInput value={p.daily_wage} onChange={(n) => setP({ ...p, daily_wage: n })} />
                </Field>
              )}
              {p.pay_type === "monthly" && (
                <>
                  <Field label="Gaji per bulan" required error={errors.monthly_salary}>
                    <MoneyInput value={p.monthly_salary} onChange={(n) => setP({ ...p, monthly_salary: n })} />
                  </Field>
                  <Field label="Hari kerja per bulan" hint="Untuk menghitung biaya per hari di proyek">
                    <input type="number" min={1} max={31} className="input" value={p.working_days_per_month} onChange={(ev) => setP({ ...p, working_days_per_month: Number(ev.target.value) })} />
                  </Field>
                </>
              )}
              {p.pay_type === "project" && <p className="rounded-xl bg-cream-100 p-3 text-sm sm:col-span-2">Upah borongan diisi per proyek di tab Pekerja pada halaman proyek, dan otomatis masuk slip saat proyek selesai.</p>}
              <Field label="Tunjangan tetap per periode">
                <MoneyInput value={p.default_allowance} onChange={(n) => setP({ ...p, default_allowance: n })} />
              </Field>
              <Field label="Insentif tetap per periode">
                <MoneyInput value={p.default_incentive} onChange={(n) => setP({ ...p, default_incentive: n })} />
              </Field>
              <Field label="Catatan komisi (opsional)" className="sm:col-span-2">
                <input className="input" value={p.commission_note} onChange={(ev) => setP({ ...p, commission_note: ev.target.value })} placeholder="mis. 2% dari order yang dibawa" />
              </Field>
              {p.pay_type === "daily" && p.daily_wage > 0 && <p className="text-sm text-charcoal-700 sm:col-span-2">Contoh: 24 hari × {formatRupiah(p.daily_wage)} = <strong>{formatRupiah(24 * p.daily_wage)}</strong></p>}
              <div className="flex justify-end sm:col-span-2">
                <button className="btn-primary" disabled={pending}>
                  {pending && <Loader2 className="h-4 w-4 animate-spin" />} Simpan pengaturan gaji
                </button>
              </div>
            </form>
          </section>

          <section className="rounded-2xl bg-white p-5 ring-1 ring-charcoal-900/5">
            <h2 className="mb-1 flex items-center gap-2 font-display text-lg font-semibold">
              <FileLock2 className="h-5 w-5 text-[#17263C]" /> Dokumen pegawai
            </h2>
            <p className="mb-4 text-xs text-charcoal-700/70">Disimpan di penyimpanan privat — hanya admin utama yang bisa membuka (link berlaku 1 jam).</p>
            <div className="mb-4 flex flex-col gap-2 sm:flex-row">
              <select className="input sm:w-48" value={docType} onChange={(ev) => setDocType(ev.target.value)} aria-label="Jenis dokumen">
                {DOC_TYPES.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
              <button className="btn-outline" disabled={busy} onClick={() => docInput.current?.click()}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Upload (JPG/PNG/PDF, maks 5 MB)
              </button>
              <input ref={docInput} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" hidden onChange={(ev) => onDoc(ev.target.files?.[0])} />
            </div>
            <ul className="divide-y divide-charcoal-900/5 text-sm">
              {documents.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-2 py-2">
                  <span className="min-w-0">
                    <span className="font-medium">{labelOf(DOC_TYPES, d.doc_type)}</span>
                    <span className="block truncate text-xs text-charcoal-700/60">
                      {d.file_name} · {formatDateShort(d.created_at.slice(0, 10))}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1">
                    {d.url && (
                      <a href={d.url} target="_blank" rel="noopener noreferrer" className="btn-outline btn-sm !px-3 !py-1.5">
                        Lihat
                      </a>
                    )}
                    <IconButton label="Hapus dokumen" danger onClick={() => run(() => deleteEmployeeDocument(d.id), { confirm: `Hapus ${d.file_name}?` })}>
                      <Trash2 className="h-4 w-4" />
                    </IconButton>
                  </span>
                </li>
              ))}
              {!documents.length && <li className="py-2 text-charcoal-700/60">Belum ada dokumen. Upload KTP pegawai di sini.</li>}
            </ul>
          </section>
        </div>
      )}

      {tab === "riwayat-gaji" && isOwner && (
        <DataTable
          rows={payrolls}
          empty="Belum ada slip gaji."
          columns={[
            { key: "slip_number", label: "Slip", render: (r) => <Link href={`/admin/penggajian/${r.id}`} className="font-semibold underline-offset-2 hover:underline">{r.slip_number}</Link> },
            { key: "period", label: "Periode", render: (r) => `${formatDateShort(r.period_start)} – ${formatDateShort(r.period_end)}` },
            { key: "days_worked", label: "Hari kerja", align: "right", render: (r) => fmtQty(r.days_worked) },
            { key: "total_earnings", label: "Kotor", align: "right", render: (r) => formatRupiah(r.total_earnings) },
            { key: "total_deductions", label: "Potongan", align: "right", render: (r) => formatRupiah(r.total_deductions) },
            { key: "net_amount", label: "Bersih", align: "right", render: (r) => <strong>{formatRupiah(r.net_amount)}</strong> },
            { key: "status", label: "Status", render: (r) => <StatusPill list={PAYROLL_STATUSES} value={r.status} /> },
          ]}
          actions={(r) => (
            <Link href={`/admin/slip/${r.id}`} target="_blank" className="rounded-lg p-2 text-charcoal-700 hover:bg-cream-200" aria-label="Cetak slip">
              <Printer className="h-4 w-4" />
            </Link>
          )}
        />
      )}

      {tab === "potongan" && isOwner && (
        <div className="grid gap-6 lg:grid-cols-2">
          <section>
            <h2 className="mb-3 font-display text-lg font-semibold">Riwayat potongan</h2>
            <DataTable
              rows={deductions}
              dense
              empty="Tidak ada potongan."
              columns={[
                { key: "deduction_date", label: "Tanggal", render: (d) => formatDateShort(d.deduction_date) },
                { key: "name", label: "Potongan" },
                { key: "amount", label: "Nominal", align: "right", render: (d) => formatRupiah(d.amount) },
                { key: "status", label: "Status", render: (d) => <StatusPill list={DEDUCTION_STATUSES} value={d.status} /> },
              ]}
            />
          </section>
          <section>
            <h2 className="mb-3 font-display text-lg font-semibold">Kasbon / pinjaman</h2>
            <DataTable
              rows={loans}
              dense
              empty="Tidak ada kasbon."
              columns={[
                { key: "loan_number", label: "No.", render: (l) => <span>{l.loan_number}<span className="block text-xs text-charcoal-700/60">{formatDateShort(l.loan_date)}</span></span> },
                { key: "amount", label: "Nominal", align: "right", render: (l) => formatRupiah(l.amount) },
                { key: "repaid_amount", label: "Sudah dicicil", align: "right", render: (l) => formatRupiah(l.repaid_amount) },
                { key: "outstanding", label: "Sisa", align: "right", render: (l) => <strong className={l.outstanding ? "text-amber-700" : "text-green-700"}>{formatRupiah(l.outstanding)}</strong> },
              ]}
            />
            <Link href="/admin/penggajian?tab=kasbon" className="btn-outline btn-sm mt-3">
              Kelola potongan & kasbon
            </Link>
          </section>
        </div>
      )}

      {tab === "absensi" && (
        <DataTable
          rows={attendance}
          dense
          empty="Belum ada absensi."
          columns={[
            { key: "work_date", label: "Tanggal", render: (a) => formatDateShort(a.work_date) },
            { key: "status", label: "Status", render: (a) => <StatusPill list={ATTENDANCE_STATUSES} value={a.status} /> },
            { key: "days_worked", label: "Hari kerja", align: "right", render: (a) => fmtQty(a.days_worked) },
            { key: "time", label: "Jam", render: (a) => (a.check_in ? `${a.check_in.slice(0, 5)}–${a.check_out?.slice(0, 5) ?? "?"}` : "-") },
            { key: "order_number", label: "Proyek", render: (a) => a.order_number ?? "-" },
            { key: "notes", label: "Catatan", render: (a) => a.notes ?? "-", hideMobile: true },
          ]}
        />
      )}

      {edit && <EmployeeFormModal value={empForm(e)} onClose={() => setEdit(false)} positions={positions} />}
    </div>
  );
}
