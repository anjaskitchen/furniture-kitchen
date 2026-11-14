"use client";
import { AlertTriangle, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { deleteWorker, saveWorker } from "@/app/admin/erp/project-actions";
import { AdminModal } from "@/components/admin/AdminModal";
import type { Worker } from "@/lib/erp/data";
import { fmtQty, labelOf, PAY_TYPES } from "@/lib/erp/constants";
import type { Option, ProjectRow } from "@/lib/erp/types";
import { formatRupiah } from "@/lib/format";
import { formatDateShort } from "@/lib/orders";
import { DataTable, Field, FormActions, IconButton, MoneyInput, ProgressBar, QtyInput, Stat, useAction } from "../kit";

type WForm = { id: string | null; employee_id: string; role: string; start_date: string; end_date: string; estimated_days: string; agreed_amount: number; notes: string };

export function ProjectWorkers({ p, workers, employees, showMoney }: { p: ProjectRow; workers: Worker[]; employees: Option[]; showMoney: boolean }) {
  const { run, pending, errors } = useAction();
  const [f, setF] = useState<WForm | null>(null);
  const laborBudget = Math.max(p.budget_labor, 0);
  const ref = laborBudget || p.labor_estimate;
  const pct = ref > 0 ? (p.labor_actual / ref) * 100 : 0;
  const assigned = new Set(workers.map((w) => w.employee_id));

  const estimate = (w: Worker) => (w.pay_type === "project" || w.agreed_amount > 0 ? w.agreed_amount : w.estimated_days * (w.daily_rate ?? 0));
  const running = (w: Worker) => (w.pay_type === "project" ? 0 : w.days_worked * (w.daily_rate ?? 0));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Pekerja ditugaskan" value={workers.length} />
        <Stat label="Hari kerja tercatat" value={`${fmtQty(p.labor_days)} hari`} sub="dari absensi dengan proyek ini" />
        {showMoney && <Stat label="Estimasi upah" value={formatRupiah(p.labor_estimate)} sub={laborBudget ? `Anggaran ${formatRupiah(laborBudget)}` : "anggaran upah belum diisi"} />}
        {showMoney && <Stat label="Realisasi upah" value={formatRupiah(p.labor_actual)} tone={ref && p.labor_actual > ref ? "bad" : pct >= 90 ? "warn" : undefined} sub={ref ? `${Math.round(pct)}% dari ${laborBudget ? "anggaran" : "estimasi"}` : undefined} />}
      </div>

      {showMoney && ref > 0 && (
        <div>
          <ProgressBar value={pct} className="h-3" tone={pct > 100 ? "bg-red-500" : pct >= 90 ? "bg-amber-400" : "bg-[#4B5138]"} />
          {p.labor_actual > ref && (
            <p className="mt-2 flex items-center gap-2 text-sm font-medium text-red-600">
              <AlertTriangle className="h-4 w-4" /> Biaya upah sudah melebihi {laborBudget ? "anggaran" : "estimasi"} sebesar {formatRupiah(p.labor_actual - ref)}.
            </p>
          )}
        </div>
      )}

      <section className="rounded-2xl bg-white p-5 ring-1 ring-charcoal-900/5 sm:p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-lg font-semibold">Pekerja proyek</h2>
            <p className="text-xs text-charcoal-700/70">
              Hari kerja dihitung dari{" "}
              <Link href="/admin/absensi" className="underline">
                absensi
              </Link>{" "}
              yang memilih proyek ini. Upah borongan masuk otomatis ke slip gaji saat order berstatus Selesai.
            </p>
          </div>
          <button className="btn-primary btn-sm" onClick={() => setF({ id: null, employee_id: "", role: "", start_date: p.start_date ?? "", end_date: p.target_end_date ?? "", estimated_days: String(p.estimated_days ?? 0), agreed_amount: 0, notes: "" })}>
            <Plus className="h-4 w-4" /> Tugaskan pegawai
          </button>
        </div>
        <DataTable
          rows={workers}
          empty="Belum ada pegawai yang ditugaskan."
          columns={[
            { key: "full_name", label: "Pegawai", render: (w) => <span><span className="font-semibold">{w.full_name}</span><span className="block text-xs text-charcoal-700/60">{[w.position_name, w.role].filter(Boolean).join(" · ") || w.employee_number}</span></span> },
            { key: "period", label: "Periode", render: (w) => <span className="text-xs">{w.start_date ? formatDateShort(w.start_date) : "-"} – {w.end_date ? formatDateShort(w.end_date) : "-"}</span>, hideMobile: true },
            { key: "days", label: "Hari (est. / aktual)", align: "right", render: (w) => `${fmtQty(w.estimated_days)} / ${fmtQty(w.days_worked)}` },
            ...(showMoney
              ? [
                  { key: "rate", label: "Sistem upah", render: (w: Worker) => <span className="text-xs">{w.pay_type ? labelOf(PAY_TYPES, w.pay_type) : "Gaji belum diatur"}{w.daily_rate ? ` · ${formatRupiah(w.daily_rate)}/hari` : ""}</span> },
                  { key: "estimate", label: "Estimasi upah", align: "right" as const, render: (w: Worker) => formatRupiah(estimate(w)) },
                  { key: "running", label: "Upah berjalan", align: "right" as const, render: (w: Worker) => (w.pay_type === "project" || w.agreed_amount > 0 ? <span className="text-xs">borongan {formatRupiah(w.agreed_amount)}</span> : formatRupiah(running(w))) },
                ]
              : []),
          ]}
          actions={(w) => (
            <>
              <IconButton label="Edit" onClick={() => setF({ id: w.id, employee_id: w.employee_id, role: w.role ?? "", start_date: w.start_date ?? "", end_date: w.end_date ?? "", estimated_days: String(w.estimated_days), agreed_amount: w.agreed_amount, notes: w.notes ?? "" })}>
                <Pencil className="h-4 w-4" />
              </IconButton>
              <IconButton label="Lepas dari proyek" danger onClick={() => run(() => deleteWorker(w.id), { confirm: `Lepas ${w.full_name} dari proyek?` })}>
                <Trash2 className="h-4 w-4" />
              </IconButton>
            </>
          )}
        />
      </section>

      <AdminModal open={f !== null} onClose={() => setF(null)} title={f?.id ? "Edit penugasan" : "Tugaskan pegawai"}>
        {f && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run(() => saveWorker({ ...f, project_id: p.id, estimated_days: f.estimated_days.replace(",", ".") }), { onOk: () => setF(null) });
            }}
            className="grid gap-4 sm:grid-cols-2"
          >
            <Field label="Pegawai" required error={errors.employee_id} className="sm:col-span-2">
              <select className="input" value={f.employee_id} disabled={!!f.id} onChange={(e) => setF({ ...f, employee_id: e.target.value })}>
                <option value="">— Pilih pegawai —</option>
                {employees
                  .filter((e) => e.value === f.employee_id || !assigned.has(e.value))
                  .map((e) => (
                    <option key={e.value} value={e.value}>
                      {e.label} {e.sub ? `(${e.sub})` : ""}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Peran di proyek">
              <input className="input" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })} placeholder="mis. Tukang utama, finishing" />
            </Field>
            <Field label="Estimasi hari kerja">
              <QtyInput value={f.estimated_days} onChange={(v) => setF({ ...f, estimated_days: v })} />
            </Field>
            <Field label="Mulai">
              <input type="date" min="1900-01-01" max="2100-12-31" className="input" value={f.start_date} onChange={(e) => setF({ ...f, start_date: e.target.value })} />
            </Field>
            <Field label="Selesai">
              <input type="date" min="1900-01-01" max="2100-12-31" className="input" value={f.end_date} onChange={(e) => setF({ ...f, end_date: e.target.value })} />
            </Field>
            {showMoney && (
              <Field label="Upah borongan proyek (opsional)" className="sm:col-span-2" hint="Isi hanya untuk pegawai sistem per proyek/borongan. Pegawai harian dihitung dari absensi × upah harian.">
                <MoneyInput value={f.agreed_amount} onChange={(n) => setF({ ...f, agreed_amount: n })} />
              </Field>
            )}
            <Field label="Catatan" className="sm:col-span-2">
              <input className="input" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
            </Field>
            <FormActions onCancel={() => setF(null)} pending={pending} />
          </form>
        )}
      </AdminModal>
    </div>
  );
}
