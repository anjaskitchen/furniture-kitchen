"use client";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { deleteCategory, deleteSpecField, saveCategory, saveSpecField } from "@/app/admin/erp/master-actions";
import { AdminModal } from "@/components/admin/AdminModal";
import type { MaterialCategory, SpecDef } from "@/lib/erp/types";
import { Badge, Field, FormActions, IconButton, useAction } from "./kit";

type CatForm = { id: string | null; name: string; description: string; default_unit: string; sort_order: number; is_active: boolean };
type SpecForm = { id: string | null; category_id: string; label: string; field_type: SpecDef["field_type"]; options: string; unit: string; is_required: boolean; sort_order: number };

const TYPE_LABEL = { text: "Teks bebas", number: "Angka", select: "Pilihan" } as const;

export function CategoryManager({ categories }: { categories: MaterialCategory[] }) {
  const [cat, setCat] = useState<CatForm | null>(null);
  const [spec, setSpec] = useState<SpecForm | null>(null);
  const { run, pending, errors } = useAction();

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-2xl text-sm text-charcoal-700">
          Atur kategori bahan dan field spesifikasinya (mis. ketebalan multiplek, kode warna HPL, jenis engsel). Field baru langsung muncul di form bahan baku tanpa mengubah aplikasi.
        </p>
        <button className="btn-primary !py-2.5" onClick={() => setCat({ id: null, name: "", description: "", default_unit: "pcs", sort_order: categories.length + 1, is_active: true })}>
          <Plus className="h-4 w-4" /> Tambah kategori
        </button>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {categories.map((c) => (
          <section key={c.id} className="rounded-2xl bg-white p-5 ring-1 ring-charcoal-900/5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-display font-semibold">
                  {c.name} {!c.is_active && <Badge>Nonaktif</Badge>}
                </h3>
                <p className="text-xs text-charcoal-700/70">
                  Satuan default: {c.default_unit} · {c.items_count ?? 0} bahan
                </p>
              </div>
              <div className="flex">
                <IconButton label="Edit kategori" onClick={() => setCat({ id: c.id, name: c.name, description: c.description ?? "", default_unit: c.default_unit, sort_order: c.sort_order, is_active: c.is_active })}>
                  <Pencil className="h-4 w-4" />
                </IconButton>
                <IconButton label="Hapus kategori" danger onClick={() => run(() => deleteCategory(c.id), { confirm: `Hapus kategori ${c.name}?` })}>
                  <Trash2 className="h-4 w-4" />
                </IconButton>
              </div>
            </div>
            <ul className="mt-3 divide-y divide-charcoal-900/5 text-sm">
              {c.specs.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-2 py-2">
                  <span>
                    <span className="font-medium">{s.label}</span>
                    {s.unit && <span className="text-charcoal-700/60"> ({s.unit})</span>}
                    <span className="ml-2 text-xs text-charcoal-700/60">
                      {TYPE_LABEL[s.field_type]}
                      {s.field_type === "select" && s.options.length ? `: ${s.options.join(", ")}` : ""}
                      {s.is_required ? " · wajib" : ""}
                    </span>
                  </span>
                  <span className="flex shrink-0">
                    <IconButton
                      label="Edit"
                      onClick={() => setSpec({ id: s.id, category_id: c.id, label: s.label, field_type: s.field_type, options: s.options.join(", "), unit: s.unit ?? "", is_required: s.is_required, sort_order: s.sort_order })}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </IconButton>
                    <IconButton label="Hapus" danger onClick={() => run(() => deleteSpecField(s.id), { confirm: `Hapus field "${s.label}"?` })}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </IconButton>
                  </span>
                </li>
              ))}
              {!c.specs.length && <li className="py-2 text-charcoal-700/60">Belum ada field spesifikasi.</li>}
            </ul>
            <button
              className="btn-outline btn-sm mt-3"
              onClick={() => setSpec({ id: null, category_id: c.id, label: "", field_type: "text", options: "", unit: "", is_required: false, sort_order: c.specs.length + 1 })}
            >
              <Plus className="h-4 w-4" /> Field spesifikasi
            </button>
          </section>
        ))}
      </div>

      <AdminModal open={cat !== null} onClose={() => setCat(null)} title={cat?.id ? "Edit kategori" : "Tambah kategori"}>
        {cat && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run(() => saveCategory(cat), { onOk: () => setCat(null) });
            }}
            className="grid gap-4 sm:grid-cols-2"
          >
            <Field label="Nama kategori" required error={errors.name}>
              <input className="input" value={cat.name} onChange={(e) => setCat({ ...cat, name: e.target.value })} autoFocus />
            </Field>
            <Field label="Satuan default" required error={errors.default_unit}>
              <input className="input" value={cat.default_unit} onChange={(e) => setCat({ ...cat, default_unit: e.target.value })} />
            </Field>
            <Field label="Urutan">
              <input className="input" type="number" min={0} value={cat.sort_order} onChange={(e) => setCat({ ...cat, sort_order: Number(e.target.value) })} />
            </Field>
            <label className="flex cursor-pointer items-center gap-3 self-end rounded-xl border border-charcoal-900/10 px-4 py-3">
              <input type="checkbox" checked={cat.is_active} onChange={(e) => setCat({ ...cat, is_active: e.target.checked })} className="h-5 w-5 accent-wood-500" />
              <span className="text-sm font-medium">Aktif</span>
            </label>
            <Field label="Deskripsi" className="sm:col-span-2">
              <input className="input" value={cat.description} onChange={(e) => setCat({ ...cat, description: e.target.value })} />
            </Field>
            <FormActions onCancel={() => setCat(null)} pending={pending} />
          </form>
        )}
      </AdminModal>

      <AdminModal open={spec !== null} onClose={() => setSpec(null)} title={spec?.id ? "Edit field spesifikasi" : "Tambah field spesifikasi"}>
        {spec && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const options = spec.options
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean);
              run(() => saveSpecField({ ...spec, options }), { onOk: () => setSpec(null) });
            }}
            className="grid gap-4 sm:grid-cols-2"
          >
            <Field label="Nama field" required error={errors.label}>
              <input className="input" value={spec.label} onChange={(e) => setSpec({ ...spec, label: e.target.value })} placeholder="mis. Ketebalan" autoFocus />
            </Field>
            <Field label="Jenis isian" required>
              <select className="input" value={spec.field_type} onChange={(e) => setSpec({ ...spec, field_type: e.target.value as SpecForm["field_type"] })}>
                <option value="text">Teks bebas</option>
                <option value="number">Angka</option>
                <option value="select">Pilihan</option>
              </select>
            </Field>
            {spec.field_type === "select" && (
              <Field label="Daftar pilihan" hint="Pisahkan dengan koma. Admin tetap bisa mengetik nilai lain bila perlu." className="sm:col-span-2">
                <input className="input" value={spec.options} onChange={(e) => setSpec({ ...spec, options: e.target.value })} placeholder="3, 9, 12, 15, 18" />
              </Field>
            )}
            <Field label="Satuan (opsional)">
              <input className="input" value={spec.unit} onChange={(e) => setSpec({ ...spec, unit: e.target.value })} placeholder="mm, cm, kg" />
            </Field>
            <Field label="Urutan">
              <input className="input" type="number" min={0} value={spec.sort_order} onChange={(e) => setSpec({ ...spec, sort_order: Number(e.target.value) })} />
            </Field>
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-charcoal-900/10 px-4 py-3 sm:col-span-2">
              <input type="checkbox" checked={spec.is_required} onChange={(e) => setSpec({ ...spec, is_required: e.target.checked })} className="h-5 w-5 accent-wood-500" />
              <span className="text-sm font-medium">Wajib diisi</span>
            </label>
            <FormActions onCancel={() => setSpec(null)} pending={pending} />
          </form>
        )}
      </AdminModal>
    </div>
  );
}
