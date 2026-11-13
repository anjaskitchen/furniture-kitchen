"use client";
import { ChevronLeft, ChevronRight, Pencil, Plus, Printer, Trash2, Wand2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { deleteDeduction, deleteLoan, generatePayrolls, saveDeduction, saveLoan } from "@/app/admin/erp/hr-actions";
import { AdminModal } from "@/components/admin/AdminModal";
import { useToast } from "@/components/Toast";
import type { DeductionRow, LoanRow, PayrollRow } from "@/lib/erp/data";
import { DEDUCTION_CATEGORIES, DEDUCTION_STATUSES, fmtQty, labelOf, PAY_TYPES, PAYROLL_STATUSES } from "@/lib/erp/constants";
import type { Employee, Option, PaySettings } from "@/lib/erp/types";
import { formatRupiah } from "@/lib/format";
import { formatDateShort, jakartaToday } from "@/lib/orders";
import { DataTable, Field, FormActions, IconButton, MoneyInput, Stat, StatusPill, useAction } from "../kit";

export function PayrollSlips({ start, end, slips, employees, pay }: { start: string; end: string; slips: PayrollRow[]; employees: Employee[]; pay: Record<string, PaySettings> }) {
  const router = useRouter();
  const toast = useToast();
  const { run, pending } = useAction();
  const [gen, setGen] = useState<{ start: string; end: string; ids: string[] } | null>(null);
  const month = start.slice(0, 7);
  const isFullMonth = start.endsWith("-01") && end === new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).toISOString().slice(0, 10);

  const shift = (n: number) => {
    const d = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1 + n, 1));
    router.push(`/admin/penggajian?month=${d.toISOString().slice(0, 7)}`);
  };
  const withSlip = new Set(slips.map((s) => s.employee_id));
  const missing = employees.filter((e) => e.status === "active" && !withSlip.has(e.id));
  const totals = useMemo(
    () => ({
      gross: slips.reduce((a, s) => a + s.total_earnings, 0),
      ded: slips.reduce((a, s) => a + s.total_deductions, 0),
      net: slips.reduce((a, s) => a + s.net_amount, 0),
      unpaid: slips.filter((s) => s.status !== "paid").reduce((a, s) => a + s.net_amount, 0),
    }),
    [slips],
  );

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <IconButton label="Bulan sebelumnya" onClick={() => shift(-1)}>
            <ChevronLeft className="h-5 w-5" />
          </IconButton>
          <input type="month" className="input !w-auto !py-2" value={month} onChange={(e) => e.target.value && router.push(`/admin/penggajian?month=${e.target.value}`)} />
          <IconButton label="Bulan berikutnya" onClick={() => shift(1)}>
            <ChevronRight className="h-5 w-5" />
          </IconButton>
          {!isFullMonth && <span className="text-xs text-charcoal-700">Periode {formatDateShort(start)} – {formatDateShort(end)}</span>}
        </div>
        <button className="btn-primary !py-2.5" onClick={() => setGen({ start, end, ids: missing.filter((e) => pay[e.id]).map((e) => e.id) })}>
          <Wand2 className="h-4 w-4" /> Hitung gaji
        </button>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total gaji kotor" value={formatRupiah(totals.gross)} sub={`${slips.length} slip`} />
        <Stat label="Total potongan" value={formatRupiah(totals.ded)} />
        <Stat label="Total gaji bersih" value={formatRupiah(totals.net)} />
        <Stat label="Belum dibayar" value={formatRupiah(totals.unpaid)} tone={totals.unpaid ? "warn" : "good"} />
      </div>

      {missing.length > 0 && (
        <p className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800 ring-1 ring-amber-200">
          {missing.length} pegawai aktif belum punya slip periode ini: {missing.map((e) => e.full_name).join(", ")}.
          {missing.some((e) => !pay[e.id]) && " Beberapa belum diatur gajinya (atur di halaman detail pegawai → Gaji & dokumen)."}
        </p>
      )}

      <DataTable
        rows={slips}
        onRowClick={(s) => router.push(`/admin/penggajian/${s.id}`)}
        empty="Belum ada slip untuk periode ini. Klik Hitung gaji."
        columns={[
          { key: "full_name", label: "Pegawai", render: (s) => <span><span className="font-semibold">{s.full_name}</span><span className="block text-xs text-charcoal-700/60">{s.slip_number} · {s.position_name ?? "-"}</span></span> },
          { key: "pay_type", label: "Sistem", render: (s) => labelOf(PAY_TYPES, s.pay_type) },
          { key: "days_worked", label: "Hari kerja", align: "right", render: (s) => fmtQty(s.days_worked) },
          { key: "total_earnings", label: "Kotor", align: "right", render: (s) => formatRupiah(s.total_earnings) },
          { key: "total_deductions", label: "Potongan", align: "right", render: (s) => (s.total_deductions ? <span className="text-red-600">−{formatRupiah(s.total_deductions)}</span> : "-") },
          { key: "net_amount", label: "Bersih", align: "right", render: (s) => <strong>{formatRupiah(s.net_amount)}</strong> },
          { key: "status", label: "Status", render: (s) => <StatusPill list={PAYROLL_STATUSES} value={s.status} /> },
        ]}
        actions={(s) => (
          <>
            <Link href={`/admin/slip/${s.id}`} target="_blank" className="rounded-lg p-2 text-charcoal-700 hover:bg-cream-200" title="Cetak / PDF" aria-label="Cetak slip">
              <Printer className="h-4 w-4" />
            </Link>
            <IconButton label="Buka" onClick={() => router.push(`/admin/penggajian/${s.id}`)}>
              <Pencil className="h-4 w-4" />
            </IconButton>
          </>
        )}
      />

      <AdminModal open={gen !== null} onClose={() => setGen(null)} title="Hitung gaji otomatis">
        {gen && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run(() => generatePayrolls({ employee_ids: gen.ids, start: gen.start, end: gen.end }), {
                onOk: (r) => {
                  const d = (r as { data?: { done: number; failed: string[] } }).data;
                  if (d?.failed.length) toast(`${d.done} slip dibuat. Gagal: ${d.failed.join("; ")}`, "error");
                  else toast(`${d?.done ?? 0} slip gaji dihitung`);
                  setGen(null);
                },
                success: "Selesai",
              });
            }}
            className="grid gap-4 sm:grid-cols-2"
          >
            <Field label="Periode mulai" required>
              <input type="date" className="input" value={gen.start} onChange={(e) => setGen({ ...gen, start: e.target.value })} />
            </Field>
            <Field label="Periode akhir" required>
              <input type="date" className="input" value={gen.end} onChange={(e) => setGen({ ...gen, end: e.target.value })} />
            </Field>
            <div className="sm:col-span-2">
              <div className="mb-2 flex items-center justify-between">
                <p className="label !mb-0">Pegawai</p>
                <button type="button" className="text-xs underline" onClick={() => setGen({ ...gen, ids: gen.ids.length ? [] : employees.filter((e) => pay[e.id]).map((e) => e.id) })}>
                  {gen.ids.length ? "Kosongkan" : "Pilih semua"}
                </button>
              </div>
              <ul className="max-h-72 space-y-1 overflow-y-auto rounded-xl border border-charcoal-900/10 p-2">
                {employees.map((e) => {
                  const p = pay[e.id];
                  const has = withSlip.has(e.id);
                  return (
                    <li key={e.id}>
                      <label className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-cream-50">
                        <input
                          type="checkbox"
                          disabled={!p}
                          checked={gen.ids.includes(e.id)}
                          onChange={(ev) => setGen({ ...gen, ids: ev.target.checked ? [...gen.ids, e.id] : gen.ids.filter((x) => x !== e.id) })}
                          className="accent-wood-500"
                        />
                        <span className="flex-1">
                          {e.full_name}
                          <span className="block text-xs text-charcoal-700/60">
                            {p ? `${labelOf(PAY_TYPES, p.pay_type)} · ${p.pay_type === "daily" ? `${formatRupiah(p.daily_wage)}/hari` : p.pay_type === "monthly" ? formatRupiah(p.monthly_salary) : "borongan"}` : "Gaji belum diatur"}
                            {has && " · slip sudah ada (draft dihitung ulang)"}
                          </span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
            <p className="text-xs text-charcoal-700/70 sm:col-span-2">
              Gaji kotor = hari hadir × upah harian (atau gaji bulanan / upah borongan proyek selesai). Tunjangan & insentif tetap, potongan yang belum dipotong, dan cicilan kasbon ikut dimasukkan otomatis. Slip draft yang sudah ada dihitung ulang; slip disetujui/dibayar tidak berubah.
            </p>
            <FormActions onCancel={() => setGen(null)} pending={pending} label="Hitung" />
          </form>
        )}
      </AdminModal>
    </div>
  );
}

type DedForm = { id: string | null; employee_id: string; deduction_date: string; category: string; name: string; amount: number; notes: string };
type LoanForm = { id: string | null; employee_id: string; loan_date: string; kind: string; amount: number; installment_amount: number; account_id: string; notes: string };

export function DeductionsAndLoans({ tab, deductions, loans, employees, accounts }: { tab: "potongan" | "kasbon"; deductions: DeductionRow[]; loans: LoanRow[]; employees: Option[]; accounts: Option[] }) {
  const { run, pending, errors } = useAction();
  const [d, setD] = useState<DedForm | null>(null);
  const [l, setL] = useState<LoanForm | null>(null);
  const [onlyOpen, setOnlyOpen] = useState(true);
  const empSelect = (value: string, onChange: (v: string) => void, disabled?: boolean) => (
    <select className="input" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
      <option value="">— Pilih pegawai —</option>
      {employees.map((e) => (
        <option key={e.value} value={e.value}>
          {e.label}
        </option>
      ))}
    </select>
  );

  if (tab === "potongan") {
    const rows = onlyOpen ? deductions.filter((x) => x.status === "pending") : deductions;
    return (
      <div>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} className="accent-wood-500" /> Hanya yang belum dipotong
          </label>
          <button className="btn-primary !py-2.5" onClick={() => setD({ id: null, employee_id: "", deduction_date: jakartaToday(), category: "rokok", name: "Pembelian rokok", amount: 0, notes: "" })}>
            <Plus className="h-4 w-4" /> Catat potongan
          </button>
        </div>
        <p className="mb-3 text-xs text-charcoal-700/70">Potongan bersifat opsional — hanya muncul di slip bila ada transaksi. Kasbon dicatat terpisah di tab Kasbon agar tidak tercatat ganda.</p>
        <DataTable
          rows={rows}
          empty="Tidak ada potongan."
          columns={[
            { key: "deduction_date", label: "Tanggal", render: (x) => formatDateShort(x.deduction_date) },
            { key: "full_name", label: "Pegawai", render: (x) => <span className="font-medium">{x.full_name}</span> },
            { key: "name", label: "Potongan", render: (x) => <span>{x.name}<span className="block text-xs text-charcoal-700/60">{labelOf(DEDUCTION_CATEGORIES, x.category)}{x.notes ? ` · ${x.notes}` : ""}</span></span> },
            { key: "amount", label: "Nominal", align: "right", render: (x) => formatRupiah(x.amount) },
            { key: "status", label: "Status", render: (x) => (x.payroll_id ? <Link href={`/admin/penggajian/${x.payroll_id}`}><StatusPill list={DEDUCTION_STATUSES} value={x.status} /></Link> : <StatusPill list={DEDUCTION_STATUSES} value={x.status} />) },
          ]}
          actions={(x) =>
            x.status === "pending" ? (
              <>
                <IconButton label="Edit" onClick={() => setD({ id: x.id, employee_id: x.employee_id, deduction_date: x.deduction_date, category: x.category, name: x.name, amount: x.amount, notes: x.notes ?? "" })}>
                  <Pencil className="h-4 w-4" />
                </IconButton>
                <IconButton label="Hapus" danger onClick={() => run(() => deleteDeduction(x.id), { confirm: "Hapus potongan ini?" })}>
                  <Trash2 className="h-4 w-4" />
                </IconButton>
              </>
            ) : null
          }
        />
        <AdminModal open={d !== null} onClose={() => setD(null)} title={d?.id ? "Edit potongan" : "Catat potongan gaji"}>
          {d && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                run(() => saveDeduction(d), { onOk: () => setD(null) });
              }}
              className="grid gap-4 sm:grid-cols-2"
            >
              <Field label="Pegawai" required error={errors.employee_id} className="sm:col-span-2">
                {empSelect(d.employee_id, (v) => setD({ ...d, employee_id: v }), !!d.id)}
              </Field>
              <Field label="Jenis" required>
                <select className="input" value={d.category} onChange={(e) => setD({ ...d, category: e.target.value, name: d.name && d.name !== labelOf(DEDUCTION_CATEGORIES, d.category) ? d.name : labelOf(DEDUCTION_CATEGORIES, e.target.value) })}>
                  {DEDUCTION_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Tanggal" required>
                <input type="date" className="input" value={d.deduction_date} onChange={(e) => setD({ ...d, deduction_date: e.target.value })} />
              </Field>
              <Field label="Nama potongan" required error={errors.name}>
                <input className="input" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} />
              </Field>
              <Field label="Nominal" required error={errors.amount}>
                <MoneyInput value={d.amount} onChange={(n) => setD({ ...d, amount: n })} />
              </Field>
              <Field label="Keterangan" className="sm:col-span-2">
                <input className="input" value={d.notes} onChange={(e) => setD({ ...d, notes: e.target.value })} />
              </Field>
              <FormActions onCancel={() => setD(null)} pending={pending} />
            </form>
          )}
        </AdminModal>
      </div>
    );
  }

  const rows = onlyOpen ? loans.filter((x) => x.outstanding > 0) : loans;
  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} className="accent-wood-500" /> Hanya yang belum lunas
        </label>
        <button className="btn-primary !py-2.5" onClick={() => setL({ id: null, employee_id: "", loan_date: jakartaToday(), kind: "kasbon", amount: 0, installment_amount: 0, account_id: accounts.find((a) => a.sub === "cash")?.value ?? accounts[0]?.value ?? "", notes: "" })}>
          <Plus className="h-4 w-4" /> Catat kasbon
        </button>
      </div>
      <p className="mb-3 text-xs text-charcoal-700/70">Kasbon = piutang perusahaan ke pegawai. Uang keluar dicatat di buku kas saat kasbon diberikan, lalu dicicil otomatis lewat potongan slip gaji.</p>
      <DataTable
        rows={rows}
        empty="Tidak ada kasbon."
        columns={[
          { key: "loan_number", label: "No.", render: (x) => <span><span className="font-medium">{x.loan_number}</span><span className="block text-xs text-charcoal-700/60">{formatDateShort(x.loan_date)} · {x.kind}</span></span> },
          { key: "full_name", label: "Pegawai" },
          { key: "amount", label: "Nominal", align: "right", render: (x) => formatRupiah(x.amount) },
          { key: "installment_amount", label: "Cicilan/gajian", align: "right", render: (x) => formatRupiah(x.installment_amount) },
          { key: "repaid_amount", label: "Sudah dicicil", align: "right", render: (x) => formatRupiah(x.repaid_amount) },
          { key: "outstanding", label: "Sisa", align: "right", render: (x) => <strong className={x.outstanding ? "text-amber-700" : "text-green-700"}>{x.outstanding ? formatRupiah(x.outstanding) : "Lunas"}</strong> },
        ]}
        actions={(x) => (
          <>
            <IconButton label="Edit" onClick={() => setL({ id: x.id, employee_id: x.employee_id, loan_date: x.loan_date, kind: x.kind, amount: x.amount, installment_amount: x.installment_amount, account_id: x.account_id, notes: x.notes ?? "" })}>
              <Pencil className="h-4 w-4" />
            </IconButton>
            {x.repaid_amount === 0 && (
              <IconButton label="Hapus" danger onClick={() => run(() => deleteLoan(x.id), { confirm: "Hapus kasbon ini? Catatan kas keluar juga dihapus." })}>
                <Trash2 className="h-4 w-4" />
              </IconButton>
            )}
          </>
        )}
      />
      <AdminModal open={l !== null} onClose={() => setL(null)} title={l?.id ? "Edit kasbon" : "Catat kasbon / pinjaman"}>
        {l && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run(() => saveLoan(l), { onOk: () => setL(null) });
            }}
            className="grid gap-4 sm:grid-cols-2"
          >
            <Field label="Pegawai" required error={errors.employee_id} className="sm:col-span-2">
              {empSelect(l.employee_id, (v) => setL({ ...l, employee_id: v }), !!l.id)}
            </Field>
            <Field label="Jenis">
              <select className="input" value={l.kind} onChange={(e) => setL({ ...l, kind: e.target.value })}>
                <option value="kasbon">Kasbon</option>
                <option value="pinjaman">Pinjaman</option>
              </select>
            </Field>
            <Field label="Tanggal" required>
              <input type="date" className="input" value={l.loan_date} onChange={(e) => setL({ ...l, loan_date: e.target.value })} />
            </Field>
            <Field label="Nominal" required error={errors.amount}>
              <MoneyInput value={l.amount} onChange={(n) => setL({ ...l, amount: n, installment_amount: l.installment_amount || n })} />
            </Field>
            <Field label="Cicilan per gajian" required error={errors.installment_amount}>
              <MoneyInput value={l.installment_amount} onChange={(n) => setL({ ...l, installment_amount: n })} />
            </Field>
            <Field label="Dibayar dari akun kas" required error={errors.account_id} className="sm:col-span-2">
              <select className="input" value={l.account_id} onChange={(e) => setL({ ...l, account_id: e.target.value })}>
                <option value="">— Pilih akun —</option>
                {accounts.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Keterangan" className="sm:col-span-2">
              <input className="input" value={l.notes} onChange={(e) => setL({ ...l, notes: e.target.value })} />
            </Field>
            <FormActions onCancel={() => setL(null)} pending={pending} />
          </form>
        )}
      </AdminModal>
    </div>
  );
}
