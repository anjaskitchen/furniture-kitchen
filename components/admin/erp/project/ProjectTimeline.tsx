"use client";
import { Camera, CheckCircle2, Circle, CircleDot, Pencil, Plus, Trash2 } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { deleteStage, saveStage } from "@/app/admin/erp/project-actions";
import { AdminModal } from "@/components/admin/AdminModal";
import { ImageUploader } from "@/components/admin/ImageUploader";
import type { Stage } from "@/lib/erp/data";
import { STAGE_STATUSES } from "@/lib/erp/constants";
import type { ProjectRow } from "@/lib/erp/types";
import { formatDateShort, jakartaToday } from "@/lib/orders";
import { cn } from "@/lib/utils";
import { Field, FormActions, IconButton, ProgressBar, StatusPill, useAction } from "../kit";

type StageForm = Omit<Stage, "start_date" | "target_date" | "actual_end_date" | "notes" | "id"> & { id: string | null; start_date: string; target_date: string; actual_end_date: string; notes: string };

export function ProjectTimeline({ p, stages }: { p: ProjectRow; stages: Stage[] }) {
  const { run, pending, errors } = useAction();
  const [f, setF] = useState<StageForm | null>(null);
  const today = jakartaToday();

  const open = (s?: Stage) =>
    setF(
      s
        ? { ...s, start_date: s.start_date ?? "", target_date: s.target_date ?? "", actual_end_date: s.actual_end_date ?? "", notes: s.notes ?? "" }
        : { id: null, stage_name: "", sort_order: stages.length + 1, status: "pending", start_date: "", target_date: "", actual_end_date: "", progress: 0, notes: "", photos: [] },
    );

  const quick = (s: Stage, patch: Partial<Stage>) =>
    run(() => saveStage({ ...s, ...patch, project_id: p.id }), { success: "Tahapan diperbarui" });

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-white p-5 ring-1 ring-charcoal-900/5 sm:p-6">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold">Progres keseluruhan</h2>
          <span className="font-display text-2xl font-bold tabular-nums">{Math.round(p.progress)}%</span>
        </div>
        <ProgressBar value={p.progress} className="h-3" tone={p.indicator === "red" ? "bg-red-500" : p.indicator === "yellow" ? "bg-amber-400" : "bg-[#4B5138]"} />
        <p className="mt-2 text-xs text-charcoal-700/70">
          Rata-rata progres tahapan (tahapan yang dilewati tidak dihitung).
          {p.is_active && p.expected_progress > 0 && ` Berdasarkan jadwal, progres seharusnya sekitar ${Math.round(p.expected_progress)}%.`}
        </p>
      </section>

      <section className="rounded-2xl bg-white p-5 ring-1 ring-charcoal-900/5 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Tahapan pengerjaan</h2>
          <button className="btn-primary btn-sm" onClick={() => open()}>
            <Plus className="h-4 w-4" /> Tahapan
          </button>
        </div>
        <ol className="relative space-y-4 border-l-2 border-cream-200 pl-6">
          {stages.map((s) => {
            const late = s.status !== "done" && s.status !== "skipped" && s.target_date && s.target_date < today;
            const Icon = s.status === "done" ? CheckCircle2 : s.status === "in_progress" ? CircleDot : Circle;
            return (
              <li key={s.id} className="relative">
                <Icon className={cn("absolute -left-[35px] top-0.5 h-5 w-5 rounded-full bg-white", s.status === "done" ? "text-green-600" : s.status === "in_progress" ? "text-amber-500" : "text-charcoal-700/30")} />
                <div className={cn("rounded-xl border p-4", late ? "border-red-200 bg-red-50/40" : "border-charcoal-900/10")}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">
                        {s.sort_order}. {s.stage_name}
                      </p>
                      <p className="text-xs text-charcoal-700/70">
                        {s.start_date ? `Mulai ${formatDateShort(s.start_date)}` : "Belum mulai"}
                        {s.target_date && ` · target ${formatDateShort(s.target_date)}`}
                        {s.actual_end_date && ` · selesai ${formatDateShort(s.actual_end_date)}`}
                        {late && <span className="font-semibold text-red-600"> · terlambat</span>}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <StatusPill list={STAGE_STATUSES} value={s.status} />
                      <IconButton label="Edit" onClick={() => open(s)}>
                        <Pencil className="h-4 w-4" />
                      </IconButton>
                      <IconButton label="Hapus" danger onClick={() => run(() => deleteStage(s.id), { confirm: `Hapus tahapan ${s.stage_name}?` })}>
                        <Trash2 className="h-4 w-4" />
                      </IconButton>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={10}
                      defaultValue={s.progress}
                      disabled={pending || s.status === "skipped"}
                      onMouseUp={(e) => Number(e.currentTarget.value) !== s.progress && quick(s, { progress: Number(e.currentTarget.value), status: Number(e.currentTarget.value) === 100 ? "done" : s.status })}
                      onTouchEnd={(e) => Number(e.currentTarget.value) !== s.progress && quick(s, { progress: Number(e.currentTarget.value), status: Number(e.currentTarget.value) === 100 ? "done" : s.status })}
                      onKeyUp={(e) => Number(e.currentTarget.value) !== s.progress && quick(s, { progress: Number(e.currentTarget.value), status: Number(e.currentTarget.value) === 100 ? "done" : s.status })}
                      className="flex-1 accent-[#4B5138]"
                      aria-label={`Progres ${s.stage_name}`}
                    />
                    <span className="w-12 text-right text-sm font-semibold tabular-nums">{s.progress}%</span>
                    {s.status !== "done" && (
                      <button className="btn-outline btn-sm !px-3 !py-1.5" disabled={pending} onClick={() => quick(s, { status: "done", progress: 100 })}>
                        Selesai
                      </button>
                    )}
                  </div>
                  {s.notes && <p className="mt-2 whitespace-pre-wrap text-sm text-charcoal-700">{s.notes}</p>}
                  {s.photos.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {s.photos.map((u) => (
                        <a key={u} href={u} target="_blank" rel="noopener noreferrer" className="relative h-16 w-16 overflow-hidden rounded-lg bg-cream-200">
                          <Image src={u} alt="" fill sizes="64px" unoptimized className="object-cover" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
          {!stages.length && <li className="text-sm text-charcoal-700/70">Belum ada tahapan.</li>}
        </ol>
      </section>

      <AdminModal open={f !== null} onClose={() => setF(null)} title={f?.id ? "Edit tahapan" : "Tambah tahapan"}>
        {f && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run(() => saveStage({ ...f, project_id: p.id }), { onOk: () => setF(null) });
            }}
            className="grid gap-4 sm:grid-cols-2"
          >
            <Field label="Nama tahapan" required error={errors.stage_name}>
              <input className="input" value={f.stage_name} onChange={(e) => setF({ ...f, stage_name: e.target.value })} />
            </Field>
            <Field label="Urutan">
              <input type="number" min={0} className="input" value={f.sort_order} onChange={(e) => setF({ ...f, sort_order: Number(e.target.value) })} />
            </Field>
            <Field label="Status">
              <select className="input" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value, progress: e.target.value === "done" ? 100 : f.progress })}>
                {STAGE_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={`Progres: ${f.progress}%`}>
              <input type="range" min={0} max={100} step={5} value={f.progress} onChange={(e) => setF({ ...f, progress: Number(e.target.value) })} className="mt-3 w-full accent-[#4B5138]" />
            </Field>
            <Field label="Tanggal mulai">
              <input type="date" className="input" value={f.start_date} onChange={(e) => setF({ ...f, start_date: e.target.value })} />
            </Field>
            <Field label="Target selesai">
              <input type="date" className="input" value={f.target_date} onChange={(e) => setF({ ...f, target_date: e.target.value })} />
            </Field>
            <Field label="Tanggal selesai aktual">
              <input type="date" className="input" value={f.actual_end_date} onChange={(e) => setF({ ...f, actual_end_date: e.target.value })} />
            </Field>
            <Field label="Catatan pekerjaan" className="sm:col-span-2">
              <textarea className="input" rows={3} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
            </Field>
            <Field label="Foto dokumentasi" className="sm:col-span-2" hint={<span className="inline-flex items-center gap-1"><Camera className="h-3 w-3" /> Bisa lebih dari satu foto</span>}>
              <ImageUploader multiple folder="projects" value={f.photos} onChange={(photos) => setF({ ...f, photos })} />
            </Field>
            <FormActions onCancel={() => setF(null)} pending={pending} />
          </form>
        )}
      </AdminModal>
    </div>
  );
}
