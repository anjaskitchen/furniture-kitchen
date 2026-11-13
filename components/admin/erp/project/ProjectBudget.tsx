"use client";
import { AlertTriangle, Pencil, Plus, Save, Sparkles, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { autoBudget, deleteExpense, saveBudgets, saveExpense } from "@/app/admin/erp/project-actions";
import { AdminModal } from "@/components/admin/AdminModal";
import type { Budget, Expense } from "@/lib/erp/data";
import { BUDGET_CATEGORIES, EXPENSE_CATEGORIES, labelOf } from "@/lib/erp/constants";
import type { Option, ProjectRow } from "@/lib/erp/types";
import { formatRupiah } from "@/lib/format";
import { formatDateShort, jakartaToday } from "@/lib/orders";
import { cn } from "@/lib/utils";
import { DataTable, Field, FormActions, IconButton, MoneyInput, ProgressBar, Stat, useAction } from "../kit";

type ExpForm = { id: string | null; expense_date: string; category: string; description: string; amount: number; account_id: string; vendor: string; receipt_url: string };

export function ProjectBudget({ p, budgets, expenses, accounts }: { p: ProjectRow; budgets: Budget[]; expenses: Expense[]; accounts: Option[] }) {
  const { run, pending, errors } = useAction();
  const [draft, setDraft] = useState<Record<string, number>>(() => Object.fromEntries(BUDGET_CATEGORIES.map((c) => [c.value, budgets.find((b) => b.category === c.value)?.amount ?? 0])));
  const [exp, setExp] = useState<ExpForm | null>(null);

  const expByCat = useMemo(() => {
    const m: Record<string, number> = {};
    for (const e of expenses) m[e.category] = (m[e.category] ?? 0) + e.amount;
    return m;
  }, [expenses]);
  const actual = (cat: string) => (cat === "material" ? p.material_actual : cat === "labor" ? p.labor_actual : cat === "profit" ? p.actual_profit : (expByCat[cat] ?? 0));

  const totalDraft = Object.values(draft).reduce((a, b) => a + b, 0);
  const diff = p.contract_value - totalDraft;
  const dirty = BUDGET_CATEGORIES.some((c) => (budgets.find((b) => b.category === c.value)?.amount ?? 0) !== draft[c.value]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Nilai kontrak" value={formatRupiah(p.contract_value)} />
        <Stat label="Biaya langsung (realisasi)" value={formatRupiah(p.actual_total_cost)} sub={p.budget_cost_total ? `${Math.round((p.actual_total_cost / p.budget_cost_total) * 100)}% dari anggaran` : undefined} tone={p.budget_status === "over" ? "bad" : p.budget_status === "near" ? "warn" : undefined} />
        <Stat label="Estimasi laba kotor" value={formatRupiah(p.estimated_profit)} />
        <Stat label="Laba kotor aktual" value={formatRupiah(p.actual_profit)} tone={p.actual_profit < 0 ? "bad" : "good"} sub="Nilai kontrak − biaya langsung" />
      </div>

      {p.budget_status === "over" && (
        <p className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700 ring-1 ring-red-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> Realisasi biaya sudah melewati anggaran (total, material, atau upah). Periksa pengeluaran proyek.
        </p>
      )}

      <section className="rounded-2xl bg-white p-5 ring-1 ring-charcoal-900/5 sm:p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-lg font-semibold">Anggaran vs realisasi</h2>
            <p className="text-xs text-charcoal-700/70">Anggaran = rencana penggunaan dana proyek. Realisasi material dari pemakaian stok, upah dari absensi & slip gaji, lainnya dari biaya proyek.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn-outline btn-sm" onClick={() => run(() => autoBudget(p.id), { confirm: budgets.length ? "Timpa anggaran saat ini dengan hitungan otomatis?" : undefined })}>
              <Sparkles className="h-4 w-4" /> Susun otomatis
            </button>
            <button className="btn-primary btn-sm" disabled={!dirty || pending} onClick={() => run(() => saveBudgets({ project_id: p.id, rows: BUDGET_CATEGORIES.map((c) => ({ category: c.value, amount: draft[c.value] })) }))}>
              <Save className="h-4 w-4" /> Simpan anggaran
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-charcoal-700">
              <tr className="border-b border-charcoal-900/10">
                <th className="py-2 pr-3">Komponen</th>
                <th className="py-2 pr-3 text-right">Anggaran</th>
                <th className="py-2 pr-3 text-right">% kontrak</th>
                <th className="py-2 pr-3 text-right">Realisasi</th>
                <th className="py-2 pr-3 text-right">Selisih</th>
                <th className="w-32 py-2">Pemakaian</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-charcoal-900/5">
              {BUDGET_CATEGORIES.map((c) => {
                const b = draft[c.value];
                const a = actual(c.value);
                const isProfit = c.value === "profit";
                const pct = b > 0 ? (a / b) * 100 : 0;
                const sel = isProfit ? a - b : b - a;
                return (
                  <tr key={c.value} className={cn(isProfit && "bg-[#4B5138]/5 font-semibold")}>
                    <td className="py-2 pr-3">{c.label}</td>
                    <td className="w-44 py-1.5 pr-3">
                      <MoneyInput value={b} onChange={(n) => setDraft((d) => ({ ...d, [c.value]: n }))} className="!py-1.5" ariaLabel={`Anggaran ${c.label}`} />
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums text-charcoal-700/70">{p.contract_value ? ((b / p.contract_value) * 100).toFixed(1) : "0"}%</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{formatRupiah(a)}</td>
                    <td className={cn("py-2 pr-3 text-right tabular-nums", sel < 0 ? "text-red-600" : "text-green-700")}>{b || a ? formatRupiah(sel) : "-"}</td>
                    <td className="py-2">{!isProfit && b > 0 && <ProgressBar value={pct} tone={pct > 100 ? "bg-red-500" : pct >= 90 ? "bg-amber-400" : "bg-[#4B5138]"} />}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t border-charcoal-900/10 font-semibold">
              <tr>
                <td className="py-2 pr-3">Total</td>
                <td className="py-2 pr-3 text-right tabular-nums">{formatRupiah(totalDraft)}</td>
                <td colSpan={4} className={cn("py-2 text-right text-xs", Math.abs(diff) > 1 ? "text-amber-700" : "text-green-700")}>
                  {Math.abs(diff) > 1 ? `${diff > 0 ? "Belum dialokasikan" : "Melebihi kontrak"} ${formatRupiah(Math.abs(diff))}` : "Sesuai nilai kontrak"}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="mt-4 grid gap-2 rounded-xl bg-cream-100 p-3 text-xs text-charcoal-700 sm:grid-cols-3">
          <p>
            Material: pemakaian stok {formatRupiah(p.material_used_cost)} + beli langsung {formatRupiah(p.material_direct)} (RAB {formatRupiah(p.rab_total)})
          </p>
          <p>
            Upah: absensi {p.labor_days} hari {formatRupiah(p.labor_attendance_cost)} + borongan {formatRupiah(p.labor_project_pay)} + tenaga lepas {formatRupiah(p.labor_direct)}
          </p>
          <p>Estimasi upah dari penugasan pekerja: {formatRupiah(p.labor_estimate)}</p>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-5 ring-1 ring-charcoal-900/5 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold">Biaya langsung proyek</h2>
            <p className="text-xs text-charcoal-700/70">Transport, pemasangan, tenaga lepas, beli material langsung, dll. Otomatis tercatat sebagai kas keluar.</p>
          </div>
          <button
            className="btn-primary btn-sm"
            onClick={() => setExp({ id: null, expense_date: jakartaToday(), category: "transport", description: "", amount: 0, account_id: accounts.find((a) => a.sub === "cash")?.value ?? accounts[0]?.value ?? "", vendor: "", receipt_url: "" })}
          >
            <Plus className="h-4 w-4" /> Catat biaya
          </button>
        </div>
        <DataTable
          rows={expenses}
          dense
          empty="Belum ada biaya langsung."
          columns={[
            { key: "expense_date", label: "Tanggal", render: (e) => formatDateShort(e.expense_date) },
            { key: "category", label: "Kategori", render: (e) => labelOf(EXPENSE_CATEGORIES, e.category) },
            { key: "description", label: "Keterangan", render: (e) => <span>{e.description}{e.vendor && <span className="block text-xs text-charcoal-700/60">{e.vendor}</span>}</span> },
            { key: "account_name", label: "Dari akun" },
            { key: "amount", label: "Jumlah", align: "right", render: (e) => formatRupiah(e.amount) },
          ]}
          actions={(e) => (
            <>
              <IconButton label="Edit" onClick={() => setExp({ ...e, vendor: e.vendor ?? "", receipt_url: e.receipt_url ?? "" })}>
                <Pencil className="h-4 w-4" />
              </IconButton>
              <IconButton label="Hapus" danger onClick={() => run(() => deleteExpense(e.id), { confirm: "Hapus biaya ini? Catatan kas keluar juga dihapus." })}>
                <Trash2 className="h-4 w-4" />
              </IconButton>
            </>
          )}
          footer={expenses.length ? <span className="flex justify-between"><span>Total</span><span className="tabular-nums">{formatRupiah(expenses.reduce((a, e) => a + e.amount, 0))}</span></span> : undefined}
        />
      </section>

      <AdminModal open={exp !== null} onClose={() => setExp(null)} title={exp?.id ? "Edit biaya proyek" : "Catat biaya proyek"}>
        {exp && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run(() => saveExpense({ ...exp, project_id: p.id }), { onOk: () => setExp(null) });
            }}
            className="grid gap-4 sm:grid-cols-2"
          >
            <Field label="Tanggal" required error={errors.expense_date}>
              <input type="date" className="input" value={exp.expense_date} onChange={(e) => setExp({ ...exp, expense_date: e.target.value })} />
            </Field>
            <Field label="Kategori" required>
              <select className="input" value={exp.category} onChange={(e) => setExp({ ...exp, category: e.target.value })}>
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Keterangan" required error={errors.description} className="sm:col-span-2">
              <input className="input" value={exp.description} onChange={(e) => setExp({ ...exp, description: e.target.value })} placeholder="mis. Sewa pickup antar barang" />
            </Field>
            <Field label="Jumlah" required error={errors.amount}>
              <MoneyInput value={exp.amount} onChange={(n) => setExp({ ...exp, amount: n })} />
            </Field>
            <Field label="Dibayar dari akun" required error={errors.account_id}>
              <select className="input" value={exp.account_id} onChange={(e) => setExp({ ...exp, account_id: e.target.value })}>
                <option value="">— Pilih akun —</option>
                {accounts.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Vendor / penerima" className="sm:col-span-2">
              <input className="input" value={exp.vendor} onChange={(e) => setExp({ ...exp, vendor: e.target.value })} />
            </Field>
            <FormActions onCancel={() => setExp(null)} pending={pending} />
          </form>
        )}
      </AdminModal>
    </div>
  );
}
