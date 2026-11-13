"use client";
import { Copy, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { deleteTemplate, saveTemplate } from "@/app/admin/erp/project-actions";
import { AdminModal } from "@/components/admin/AdminModal";
import type { Template } from "@/lib/erp/data";
import { FORMULA_VARS } from "@/lib/erp/constants";
import { evaluateFormula } from "@/lib/erp/formula";
import type { MaterialItem } from "@/lib/erp/types";
import { Badge, Field, FormActions, IconButton, useAction } from "./kit";

type Line = { key: string; material_item_id: string; name: string; formula: string; waste_pct: string; round_up: boolean; unit: string; notes: string };
type TForm = { id: string | null; name: string; work_type: string; description: string; is_active: boolean; sort_order: number; items: Line[] };

let n = 0;
const k = () => `t${Date.now().toString(36)}${n++}`;
const SAMPLE = Object.fromEntries(FORMULA_VARS.map((f) => [f.key, 2]));

function formulaError(f: string) {
  if (!f.trim()) return "Formula wajib diisi";
  try {
    evaluateFormula(f, SAMPLE);
    return null;
  } catch (e) {
    return (e as Error).message;
  }
}

export function TemplateManager({ templates, items }: { templates: Template[]; items: MaterialItem[] }) {
  const { run, pending, errors } = useAction();
  const [f, setF] = useState<TForm | null>(null);

  const open = (t?: Template, copy = false) =>
    setF(
      t
        ? {
            id: copy ? null : t.id,
            name: copy ? `${t.name} (salinan)` : t.name,
            work_type: t.work_type ?? "",
            description: t.description ?? "",
            is_active: t.is_active,
            sort_order: t.sort_order,
            items: t.items.map((i) => ({ key: k(), material_item_id: i.material_item_id ?? "", name: i.name, formula: i.formula, waste_pct: String(i.waste_pct), round_up: i.round_up, unit: i.unit, notes: i.notes ?? "" })),
          }
        : { id: null, name: "", work_type: "", description: "", is_active: true, sort_order: templates.length + 1, items: [] },
    );
  const setLine = (key: string, patch: Partial<Line>) => setF((s) => (s ? { ...s, items: s.items.map((i) => (i.key === key ? { ...i, ...patch } : i)) } : s));

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-3xl text-sm text-charcoal-700">
          <p>Template menghitung kebutuhan material dari ukuran proyek. Gunakan variabel berikut di formula:</p>
          <p className="mt-2 flex flex-wrap gap-1.5">
            {FORMULA_VARS.map((v) => (
              <code key={v.key} className="rounded bg-cream-200 px-1.5 py-0.5 text-xs" title={v.label}>
                {v.key}
              </code>
            ))}
            <span className="text-xs text-charcoal-700/70">+ fungsi ceil(), floor(), round(), min(), max(). Desimal pakai titik, mis. panjang * 2.2</span>
          </p>
        </div>
        <button className="btn-primary !py-2.5" onClick={() => open()}>
          <Plus className="h-4 w-4" /> Template baru
        </button>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {templates.map((t) => (
          <section key={t.id} className="rounded-2xl bg-white p-5 ring-1 ring-charcoal-900/5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-display font-semibold">
                  {t.name} {!t.is_active && <Badge>Nonaktif</Badge>}
                </h3>
                <p className="text-xs text-charcoal-700/70">
                  {t.work_type ?? "Umum"} · {t.items.length} barang
                </p>
                {t.description && <p className="mt-1 text-sm text-charcoal-700">{t.description}</p>}
              </div>
              <div className="flex">
                <IconButton label="Duplikat" onClick={() => open(t, true)}>
                  <Copy className="h-4 w-4" />
                </IconButton>
                <IconButton label="Edit" onClick={() => open(t)}>
                  <Pencil className="h-4 w-4" />
                </IconButton>
                <IconButton label="Hapus" danger onClick={() => run(() => deleteTemplate(t.id), { confirm: `Hapus template ${t.name}?` })}>
                  <Trash2 className="h-4 w-4" />
                </IconButton>
              </div>
            </div>
            <ul className="mt-3 divide-y divide-charcoal-900/5 text-sm">
              {t.items.map((i) => (
                <li key={i.id} className="flex flex-wrap justify-between gap-2 py-1.5">
                  <span>{i.name}</span>
                  <code className="text-xs text-charcoal-700">
                    {i.formula}
                    {i.waste_pct ? ` +${i.waste_pct}%` : ""} {i.unit}
                  </code>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <AdminModal open={f !== null} onClose={() => setF(null)} title={f?.id ? "Edit template" : "Template baru"}>
        {f && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run(() => saveTemplate({ ...f, items: f.items.map((i) => ({ ...i, waste_pct: i.waste_pct.replace(",", ".") || "0" })) }), { onOk: () => setF(null) });
            }}
            className="grid gap-4 sm:grid-cols-2"
          >
            <Field label="Nama template" required error={errors.name}>
              <input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
            </Field>
            <Field label="Jenis pekerjaan">
              <input className="input" value={f.work_type} onChange={(e) => setF({ ...f, work_type: e.target.value })} placeholder="Kitchen Set, Wardrobe…" />
            </Field>
            <Field label="Deskripsi" className="sm:col-span-2">
              <input className="input" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
            </Field>
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-charcoal-900/10 px-4 py-3 sm:col-span-2">
              <input type="checkbox" checked={f.is_active} onChange={(e) => setF({ ...f, is_active: e.target.checked })} className="h-5 w-5 accent-wood-500" />
              <span className="text-sm font-medium">Aktif</span>
            </label>
            <div className="space-y-3 sm:col-span-2">
              <div className="flex items-center justify-between">
                <p className="font-semibold">Barang & formula</p>
                <button type="button" className="btn-outline btn-sm" onClick={() => setF({ ...f, items: [...f.items, { key: k(), material_item_id: "", name: "", formula: "panjang", waste_pct: "0", round_up: true, unit: "pcs", notes: "" }] })}>
                  <Plus className="h-4 w-4" /> Barang
                </button>
              </div>
              {f.items.map((i) => {
                const fe = formulaError(i.formula);
                return (
                  <div key={i.key} className="grid gap-2 rounded-xl border border-charcoal-900/10 p-3 sm:grid-cols-12">
                    <select
                      className="input !py-2 text-sm sm:col-span-5"
                      value={i.material_item_id}
                      onChange={(e) => {
                        const it = items.find((x) => x.id === e.target.value);
                        setLine(i.key, { material_item_id: e.target.value, name: it?.name ?? i.name, unit: it?.unit ?? i.unit });
                      }}
                      aria-label="Bahan"
                    >
                      <option value="">— Bahan (opsional) —</option>
                      {items.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.category_name} — {m.name}
                        </option>
                      ))}
                    </select>
                    <input className="input !py-2 text-sm sm:col-span-4" value={i.name} onChange={(e) => setLine(i.key, { name: e.target.value })} placeholder="Nama di RAB" aria-label="Nama" />
                    <input className="input !py-2 text-sm sm:col-span-2" value={i.unit} onChange={(e) => setLine(i.key, { unit: e.target.value })} placeholder="Satuan" aria-label="Satuan" />
                    <div className="flex justify-end sm:col-span-1">
                      <IconButton label="Hapus" danger onClick={() => setF({ ...f, items: f.items.filter((x) => x.key !== i.key) })}>
                        <Trash2 className="h-4 w-4" />
                      </IconButton>
                    </div>
                    <div className="sm:col-span-7">
                      <input className={`input !py-2 font-mono text-sm ${fe ? "!border-red-400" : ""}`} value={i.formula} onChange={(e) => setLine(i.key, { formula: e.target.value })} aria-label="Formula" />
                      {fe && <p className="mt-1 text-xs text-red-600">{fe}</p>}
                    </div>
                    <label className="flex items-center gap-1 text-sm sm:col-span-2">
                      +
                      <input className="input !px-2 !py-2 text-sm" type="number" min={0} max={100} step="any" value={i.waste_pct} onChange={(e) => setLine(i.key, { waste_pct: e.target.value })} aria-label="Sisa potong %" />%
                    </label>
                    <label className="flex items-center gap-2 text-xs sm:col-span-3">
                      <input type="checkbox" checked={i.round_up} onChange={(e) => setLine(i.key, { round_up: e.target.checked })} className="accent-wood-500" /> Bulatkan ke atas
                    </label>
                  </div>
                );
              })}
              {!f.items.length && <p className="text-sm text-charcoal-700/70">Belum ada barang.</p>}
              <p className="text-xs text-charcoal-700/70">&quot;+%&quot; = cadangan sisa potong/waste. Contoh: multiplek 18 mm untuk kitchen bawah ≈ ceil(panjang * 2.2) lembar.</p>
            </div>
            <FormActions onCancel={() => setF(null)} pending={pending} />
          </form>
        )}
      </AdminModal>
    </div>
  );
}
