"use client";
import { ClipboardList, Copy, Eraser, Pencil, Plus, Sparkles, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import {
  applyTemplateToItem,
  clearItemCosts,
  copyItemCosts,
  deleteCostLine,
  importRabToItem,
  saveCostLine,
  setItemOverhead,
} from "@/app/admin/erp/hpp-actions";
import { FORMULA_VARS } from "@/lib/erp/constants";
import { fmtPct, HPP_CATEGORIES, HPP_LEVEL_META, hppCategoryLabel, hppLevel, priceForTarget } from "@/lib/erp/hpp-shared";
import { formatRupiah } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Field, IconButton, MoneyInput, QtyInput, SubmitButton, useAction } from "../kit";

export interface HppItem {
  item_id: string;
  name: string;
  description: string | null;
  qty: number;
  unit: string;
  unit_price: number;
  line_total: number;
  length_m: number | null;
  height_m: number | null;
  hpp_overhead_pct: number | null;
  overhead_pct: number;
  cost_lines: number;
  material: number;
  labor: number;
  overhead_lines: number;
  other: number;
  auto_overhead: number;
  hpp_total: number;
  hpp_unit: number | null;
  hpp_pct: number | null;
}
export interface HppLine {
  id: string;
  order_item_id: string;
  category: string;
  material_item_id: string | null;
  name: string;
  qty: number;
  unit: string;
  unit_cost: number;
  total: number;
  source: string;
  notes: string | null;
}
export interface MaterialOpt {
  id: string;
  label: string;
  name: string;
  unit: string;
  price: number;
}
interface Props {
  items: HppItem[];
  lines: HppLine[];
  materials: MaterialOpt[];
  templates: { id: string; name: string }[];
  hasRab: boolean;
  settings: { overheadPct: number; targetPct: number; maxPct: number };
}

const LEVEL_BADGE = "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset";

export function HppEditor({ items, lines, materials, templates, hasRab, settings }: Props) {
  return (
    <div className="space-y-6">
      {items.map((it, i) => (
        <ItemCard
          key={it.item_id}
          index={i + 1}
          item={it}
          lines={lines.filter((l) => l.order_item_id === it.item_id)}
          otherItems={items.filter((x) => x.item_id !== it.item_id && x.cost_lines > 0)}
          materials={materials}
          templates={templates}
          hasRab={hasRab}
          settings={settings}
        />
      ))}
    </div>
  );
}

type Panel = null | "line" | "template" | "copy";

function ItemCard({
  index,
  item,
  lines,
  otherItems,
  materials,
  templates,
  hasRab,
  settings,
}: {
  index: number;
  item: HppItem;
  lines: HppLine[];
  otherItems: HppItem[];
  materials: MaterialOpt[];
  templates: { id: string; name: string }[];
  hasRab: boolean;
  settings: Props["settings"];
}) {
  const { run, pending } = useAction();
  const [panel, setPanel] = useState<Panel>(null);
  const [editing, setEditing] = useState<HppLine | null>(null);
  const level = hppLevel(item.hpp_pct, settings.targetPct, settings.maxPct);
  const meta = HPP_LEVEL_META[level];
  const profit = item.line_total - item.hpp_total;
  const suggested = item.cost_lines > 0 ? priceForTarget(item.hpp_total, settings.targetPct) : 0;

  const open = (p: Panel, line: HppLine | null = null) => {
    const wasEditing = editing !== null;
    setEditing(line);
    setPanel((cur) => (cur === p && !line && !wasEditing ? null : p));
  };

  return (
    <section className="rounded-2xl bg-white ring-1 ring-charcoal-900/5">
      {/* Ringkasan item */}
      <div className="flex flex-col gap-4 border-b border-charcoal-900/5 p-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium text-charcoal-700/70">Item {index}</p>
          <h2 className="font-display text-lg font-semibold">{item.name}</h2>
          <p className="text-sm text-charcoal-700">
            {item.qty.toLocaleString("id-ID")} {item.unit}
            {item.length_m && item.height_m ? ` (${item.length_m} × ${item.height_m} m)` : ""} × {formatRupiah(item.unit_price)} ={" "}
            <span className="font-semibold text-charcoal-900">{formatRupiah(item.line_total)}</span>
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:min-w-[520px]">
          <Mini label="HPP item" value={item.cost_lines ? formatRupiah(item.hpp_total) : "—"} sub={item.hpp_unit ? `${formatRupiah(item.hpp_unit)}/${item.unit}` : undefined} />
          <Mini label="HPP %" value={<span className={cn(LEVEL_BADGE, meta.bg)}>{fmtPct(item.hpp_pct)}</span>} sub={meta.label} />
          <Mini label="Laba kotor" value={item.cost_lines ? formatRupiah(profit) : "—"} tone={item.cost_lines ? (profit < 0 ? "bad" : "good") : undefined} />
          <Mini
            label={`Harga di HPP ${settings.targetPct}%`}
            value={suggested ? formatRupiah(suggested) : "—"}
            sub={suggested && item.qty > 0 ? `${formatRupiah(Math.ceil(suggested / item.qty / 1000) * 1000)}/${item.unit}` : undefined}
          />
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-charcoal-900/5 px-5 py-3">
        <button type="button" className={cn("btn-outline btn-sm", panel === "line" && !editing && "bg-cream-100")} onClick={() => open("line")}>
          <Plus className="h-4 w-4" /> Tambah biaya
        </button>
        <button type="button" className={cn("btn-outline btn-sm", panel === "template" && "bg-cream-100")} onClick={() => open("template")} disabled={!templates.length}>
          <Sparkles className="h-4 w-4" /> Isi dari template
        </button>
        <button
          type="button"
          className="btn-outline btn-sm"
          disabled={!hasRab || pending}
          title={hasRab ? "Salin daftar material dari RAB proyek order ini" : "RAB proyek masih kosong"}
          onClick={() =>
            run(() => importRabToItem({ item_id: item.item_id, mode: "replace" }), {
              success: "Material dari RAB proyek ditambahkan",
              confirm: lines.some((l) => l.source === "rab") ? "Ganti baris dari RAB sebelumnya dengan RAB terbaru?" : undefined,
            })
          }
        >
          <ClipboardList className="h-4 w-4" /> Ambil dari RAB
        </button>
        {otherItems.length > 0 && (
          <button type="button" className={cn("btn-outline btn-sm", panel === "copy" && "bg-cream-100")} onClick={() => open("copy")}>
            <Copy className="h-4 w-4" /> Salin dari item lain
          </button>
        )}
        <OverheadInput item={item} defaultPct={settings.overheadPct} />
        {lines.length > 0 && (
          <button
            type="button"
            className="btn btn-sm ml-auto border border-red-200 bg-white text-red-600 hover:bg-red-50"
            disabled={pending}
            onClick={() => run(() => clearItemCosts(item.item_id), { confirm: `Hapus semua rincian HPP "${item.name}"?` })}
          >
            <Eraser className="h-4 w-4" /> Kosongkan
          </button>
        )}
      </div>

      {panel === "line" && <LineForm key={editing?.id ?? "new"} itemId={item.item_id} line={editing} materials={materials} onClose={() => open(null)} />}
      {panel === "template" && <TemplateForm item={item} templates={templates} hasTemplateLines={lines.some((l) => l.source === "template")} onClose={() => setPanel(null)} />}
      {panel === "copy" && <CopyForm item={item} sources={otherItems} onClose={() => setPanel(null)} />}

      {/* Rincian biaya */}
      {lines.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-cream-50 text-left text-xs text-charcoal-700">
              <tr>
                <th className="px-5 py-2 font-medium">Jenis</th>
                <th className="px-3 py-2 font-medium">Uraian</th>
                <th className="px-3 py-2 text-right font-medium">Jumlah</th>
                <th className="px-3 py-2 text-right font-medium">Harga satuan</th>
                <th className="px-3 py-2 text-right font-medium">Total</th>
                <th className="px-5 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-charcoal-900/5">
              {HPP_CATEGORIES.flatMap((cat) =>
                lines
                  .filter((l) => l.category === cat.value)
                  .map((l) => (
                    <tr key={l.id} className={cn(editing?.id === l.id && "bg-amber-50/60")}>
                      <td className="px-5 py-2">
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                          <span className="h-2 w-2 rounded-full" style={{ background: cat.color }} /> {cat.label}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <p className="font-medium">{l.name}</p>
                        {(l.notes || l.source !== "manual") && (
                          <p className="text-xs text-charcoal-700/70">
                            {l.source === "template" ? "Template" : l.source === "rab" ? "RAB proyek" : ""}
                            {l.notes ? `${l.source !== "manual" ? " · " : ""}${l.notes}` : ""}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {l.qty.toLocaleString("id-ID")} {l.unit}
                      </td>
                      <td className={cn("px-3 py-2 text-right tabular-nums", !l.unit_cost && "text-red-600")}>{l.unit_cost ? formatRupiah(l.unit_cost) : "Harga kosong"}</td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatRupiah(l.total)}</td>
                      <td className="px-5 py-2">
                        <div className="flex justify-end gap-1">
                          <IconButton label="Ubah" onClick={() => open("line", l)}>
                            <Pencil className="h-4 w-4" />
                          </IconButton>
                          <IconButton label="Hapus" danger disabled={pending} onClick={() => run(() => deleteCostLine(l.id), { confirm: `Hapus "${l.name}"?` })}>
                            <Trash2 className="h-4 w-4" />
                          </IconButton>
                        </div>
                      </td>
                    </tr>
                  )),
              )}
            </tbody>
            <tfoot className="border-t border-charcoal-900/10 bg-cream-50/60 text-sm">
              {[
                { label: "Bahan baku", v: item.material },
                { label: "Tenaga kerja", v: item.labor },
                { label: "Overhead (baris)", v: item.overhead_lines },
                { label: "Lainnya", v: item.other },
                { label: `Overhead otomatis ${fmtPct(item.overhead_pct)} × (bahan + tenaga kerja)`, v: item.auto_overhead },
              ]
                .filter((r) => r.v)
                .map((r) => (
                  <tr key={r.label}>
                    <td colSpan={4} className="px-5 py-1.5 text-right text-charcoal-700">
                      {r.label}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{formatRupiah(r.v)}</td>
                    <td />
                  </tr>
                ))}
              <tr className="font-semibold">
                <td colSpan={4} className="px-5 py-2 text-right">
                  HPP item
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{formatRupiah(item.hpp_total)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <p className="px-5 py-8 text-center text-sm text-charcoal-700/70">
          Belum ada rincian biaya. Mulai dengan <strong>Isi dari template</strong> (bahan baku otomatis dari ukuran), <strong>Ambil dari RAB</strong>, atau{" "}
          <strong>Tambah biaya</strong> manual (bahan, upah tukang, transport, dll.).
        </p>
      )}
    </section>
  );
}

function Mini({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub?: string; tone?: "good" | "bad" }) {
  return (
    <div className="rounded-xl bg-cream-50 p-3 ring-1 ring-charcoal-900/5">
      <p className="text-xs text-charcoal-700/70">{label}</p>
      <p className={cn("mt-0.5 font-display text-sm font-bold tabular-nums sm:text-base", tone === "good" && "text-green-700", tone === "bad" && "text-red-600")}>{value}</p>
      {sub && <p className="text-xs text-charcoal-700/70">{sub}</p>}
    </div>
  );
}

function OverheadInput({ item, defaultPct }: { item: HppItem; defaultPct: number }) {
  const { run, pending } = useAction();
  const [val, setVal] = useState(item.hpp_overhead_pct === null ? "" : String(item.hpp_overhead_pct));
  const save = () => {
    const next = val.trim() === "" ? "" : val.replace(",", ".");
    const cur = item.hpp_overhead_pct === null ? "" : String(item.hpp_overhead_pct);
    if (next === cur) return;
    run(() => setItemOverhead({ item_id: item.item_id, pct: next }));
  };
  return (
    <label className="flex items-center gap-2 text-xs text-charcoal-700">
      Overhead
      <input
        className="input !w-20 !py-1.5 text-right tabular-nums"
        inputMode="decimal"
        placeholder={String(defaultPct)}
        value={val}
        disabled={pending}
        onChange={(e) => setVal(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), save())}
        aria-label="Overhead persen item"
      />
      %{item.hpp_overhead_pct === null && <span className="text-charcoal-700/60">(default)</span>}
    </label>
  );
}

function LineForm({ itemId, line, materials, onClose }: { itemId: string; line: HppLine | null; materials: MaterialOpt[]; onClose: () => void }) {
  const { run, pending, errors } = useAction();
  const [v, setV] = useState({
    category: line?.category ?? "material",
    material_item_id: line?.material_item_id ?? "",
    name: line?.name ?? "",
    qty: line ? String(line.qty) : "1",
    unit: line?.unit ?? "pcs",
    unit_cost: line?.unit_cost ?? 0,
    notes: line?.notes ?? "",
  });
  const set = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) => setV((s) => ({ ...s, [k]: val }));
  const total = useMemo(() => Math.round((Number(v.qty.replace(",", ".")) || 0) * v.unit_cost), [v.qty, v.unit_cost]);
  const pickMaterial = (id: string) => {
    const m = materials.find((x) => x.id === id);
    setV((s) => ({ ...s, material_item_id: id, ...(m ? { name: m.name, unit: m.unit, unit_cost: m.price || s.unit_cost } : {}) }));
  };
  const presets: Record<string, string[]> = {
    labor: ["Upah tukang", "Upah finishing", "Upah pemasangan", "Borongan"],
    overhead: ["Listrik & workshop", "Penyusutan mesin", "Transport", "Konsumsi"],
    other: ["Desain 3D", "Ongkos kirim", "Komisi", "Lain-lain"],
  };

  return (
    <form
      className="grid gap-3 border-b border-charcoal-900/5 bg-cream-50/60 p-5 sm:grid-cols-2 lg:grid-cols-6"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => saveCostLine({ ...v, id: line?.id ?? null, order_item_id: itemId, qty: v.qty.replace(",", ".") }), { onOk: onClose });
      }}
    >
      <div className="flex items-center justify-between sm:col-span-2 lg:col-span-6">
        <p className="font-semibold">{line ? "Ubah biaya" : "Tambah biaya"}</p>
        <IconButton label="Tutup" onClick={onClose}>
          <X className="h-4 w-4" />
        </IconButton>
      </div>
      <Field label="Jenis biaya" className="lg:col-span-1">
        <select className="input" value={v.category} onChange={(e) => set("category", e.target.value)}>
          {HPP_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </Field>
      {v.category === "material" ? (
        <Field label="Bahan baku (dari master)" hint="Harga terisi dari harga supplier termurah / rata-rata stok." className="lg:col-span-2">
          <select className="input" value={v.material_item_id} onChange={(e) => pickMaterial(e.target.value)}>
            <option value="">— Ketik manual —</option>
            {materials.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
                {m.price ? ` · ${formatRupiah(m.price)}/${m.unit}` : ""}
              </option>
            ))}
          </select>
        </Field>
      ) : (
        <Field label="Pilihan cepat" className="lg:col-span-2">
          <select className="input" value="" onChange={(e) => e.target.value && set("name", e.target.value)}>
            <option value="">— Pilih —</option>
            {(presets[v.category] ?? []).map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </Field>
      )}
      <Field label="Uraian" required error={errors.name} className="sm:col-span-2 lg:col-span-3">
        <input className="input" value={v.name} maxLength={160} onChange={(e) => set("name", e.target.value)} placeholder={hppCategoryLabel(v.category)} />
      </Field>
      <Field label="Jumlah" required error={errors.qty}>
        <QtyInput value={v.qty} onChange={(x) => set("qty", x)} />
      </Field>
      <Field label="Satuan" required error={errors.unit}>
        <input className="input" value={v.unit} maxLength={20} onChange={(e) => set("unit", e.target.value)} list="hpp-units" />
        <datalist id="hpp-units">
          {["pcs", "lembar", "meter", "m²", "kg", "set", "hari", "orang", "titik", "paket", "liter", "box"].map((u) => (
            <option key={u} value={u} />
          ))}
        </datalist>
      </Field>
      <Field label="Harga satuan" error={errors.unit_cost} className="lg:col-span-2">
        <MoneyInput value={v.unit_cost} onChange={(n) => set("unit_cost", n)} />
      </Field>
      <Field label="Catatan" className="lg:col-span-2">
        <input className="input" value={v.notes} maxLength={300} onChange={(e) => set("notes", e.target.value)} />
      </Field>
      <div className="flex items-end justify-between gap-3 sm:col-span-2 lg:col-span-6">
        <p className="text-sm">
          Total: <span className="font-semibold tabular-nums">{formatRupiah(total)}</span>
        </p>
        <div className="flex gap-2">
          <button type="button" className="btn-outline" onClick={onClose}>
            Batal
          </button>
          <SubmitButton pending={pending}>{line ? "Simpan" : "Tambah"}</SubmitButton>
        </div>
      </div>
    </form>
  );
}

function TemplateForm({ item, templates, hasTemplateLines, onClose }: { item: HppItem; templates: { id: string; name: string }[]; hasTemplateLines: boolean; onClose: () => void }) {
  const { run, pending } = useAction();
  const [tpl, setTpl] = useState(templates[0]?.id ?? "");
  const [mode, setMode] = useState<"replace" | "append">("replace");
  const [vars, setVars] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const f of FORMULA_VARS) init[f.key] = "";
    if (item.length_m) init.panjang = String(item.length_m);
    if (item.height_m) init.tinggi = String(item.height_m);
    if (!item.length_m && ["meter", "m", "m1"].includes(item.unit.toLowerCase())) init.panjang = String(item.qty);
    return init;
  });
  return (
    <form
      className="grid gap-3 border-b border-charcoal-900/5 bg-cream-50/60 p-5 sm:grid-cols-2 lg:grid-cols-4"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => applyTemplateToItem({ item_id: item.item_id, template_id: tpl, mode, vars }), {
          onOk: (r) => {
            onClose();
            const d = (r as { data?: { added: number; noPrice: number } }).data;
            if (d?.noPrice) window.setTimeout(() => window.alert(`${d.noPrice} bahan belum punya harga. Isi harga supplier di menu Bahan Baku, atau ubah harga barisnya.`), 300);
          },
          success: "Bahan baku dihitung dari template",
        });
      }}
    >
      <div className="flex items-center justify-between sm:col-span-2 lg:col-span-4">
        <div>
          <p className="font-semibold">Hitung bahan baku dari template</p>
          <p className="text-xs text-charcoal-700/70">Rumus sama dengan RAB proyek (sudah termasuk sisa potong). Harga dari supplier termurah / rata-rata stok.</p>
        </div>
        <IconButton label="Tutup" onClick={onClose}>
          <X className="h-4 w-4" />
        </IconButton>
      </div>
      <Field label="Template" className="sm:col-span-2">
        <select className="input" value={tpl} onChange={(e) => setTpl(e.target.value)} required>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Jika sudah ada baris dari template" className="sm:col-span-2">
        <select className="input" value={mode} onChange={(e) => setMode(e.target.value as "replace" | "append")}>
          <option value="replace">{hasTemplateLines ? "Ganti baris template lama" : "Isi baru"}</option>
          <option value="append">Tambahkan (jangan hapus)</option>
        </select>
      </Field>
      {FORMULA_VARS.map((f) => (
        <Field key={f.key} label={f.label}>
          <QtyInput value={vars[f.key]} step={f.step} onChange={(x) => setVars((s) => ({ ...s, [f.key]: x }))} />
        </Field>
      ))}
      <div className="flex items-end justify-end gap-2 sm:col-span-2 lg:col-span-4">
        <button type="button" className="btn-outline" onClick={onClose}>
          Batal
        </button>
        <SubmitButton pending={pending} disabled={!tpl}>
          Hitung
        </SubmitButton>
      </div>
    </form>
  );
}

function CopyForm({ item, sources, onClose }: { item: HppItem; sources: HppItem[]; onClose: () => void }) {
  const { run, pending } = useAction();
  const [from, setFrom] = useState(sources[0]?.item_id ?? "");
  const src = sources.find((s) => s.item_id === from);
  const [scale, setScale] = useState("1");
  return (
    <form
      className="grid gap-3 border-b border-charcoal-900/5 bg-cream-50/60 p-5 sm:grid-cols-3"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => copyItemCosts({ from_item_id: from, to_item_id: item.item_id, scale: scale.replace(",", ".") }), { onOk: onClose, success: "Rincian disalin" });
      }}
    >
      <Field label="Salin rincian dari" className="sm:col-span-2">
        <select
          className="input"
          value={from}
          onChange={(e) => {
            setFrom(e.target.value);
            const s = sources.find((x) => x.item_id === e.target.value);
            if (s && s.qty > 0 && s.unit === item.unit) setScale(String(Math.round((item.qty / s.qty) * 100) / 100));
          }}
        >
          {sources.map((s) => (
            <option key={s.item_id} value={s.item_id}>
              {s.name} · {formatRupiah(s.hpp_total)}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Kalikan jumlah" hint={src && src.unit === item.unit ? `Perbandingan ukuran: ${item.qty} ÷ ${src.qty} ${item.unit}` : "1 = sama persis"}>
        <QtyInput value={scale} step={0.01} onChange={setScale} />
      </Field>
      <div className="flex justify-end gap-2 sm:col-span-3">
        <button type="button" className="btn-outline" onClick={onClose}>
          Batal
        </button>
        <SubmitButton pending={pending} disabled={!from}>
          Salin
        </SubmitButton>
      </div>
    </form>
  );
}
