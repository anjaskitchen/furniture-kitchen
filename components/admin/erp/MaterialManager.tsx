"use client";
import { Archive, BadgeCheck, History, MessageCircle, Pencil, Plus, Trash2 } from "lucide-react";
import Image from "next/image";
import { useMemo, useState } from "react";
import { deleteMaterialItem, deleteSupplierProduct, getPriceHistory, saveMaterialItem, saveSupplierProduct } from "@/app/admin/erp/master-actions";
import { AdminModal } from "@/components/admin/AdminModal";
import { ImageUploader } from "@/components/admin/ImageUploader";
import { useToast } from "@/components/Toast";
import { fmtQty, MATERIAL_UNITS, specSummary } from "@/lib/erp/constants";
import type { MaterialCategory, MaterialItem, Option, SupplierProduct } from "@/lib/erp/types";
import { formatRupiah } from "@/lib/format";
import { formatDateShort } from "@/lib/orders";
import { cn } from "@/lib/utils";
import { whatsappLink } from "@/lib/whatsapp";
import { Badge, DataTable, Field, FormActions, IconButton, MoneyInput, SearchBox, Stat, useAction } from "./kit";

type ItemForm = {
  id: string | null;
  category_id: string;
  name: string;
  brand: string;
  unit: string;
  min_stock: string;
  specs: Record<string, string>;
  photo_url: string;
  notes: string;
  is_active: boolean;
};

type PriceForm = { id: string | null; supplier_id: string; material_item_id: string; price: number; unit: string; supplier_sku: string; notes: string; is_active: boolean };

export function SpecInputs({ category, specs, onChange }: { category?: MaterialCategory; specs: Record<string, string>; onChange: (s: Record<string, string>) => void }) {
  if (!category) return <p className="text-sm text-charcoal-700/70 sm:col-span-2">Pilih kategori untuk menampilkan spesifikasi.</p>;
  if (!category.specs.length) return <p className="text-sm text-charcoal-700/70 sm:col-span-2">Kategori ini belum punya field spesifikasi. Atur di tab Kategori & Spesifikasi.</p>;
  return (
    <>
      {category.specs.map((s) => {
        const id = `spec-${s.key}`;
        const v = specs[s.key] ?? "";
        const set = (val: string) => onChange({ ...specs, [s.key]: val });
        return (
          <Field key={s.id} label={`${s.label}${s.unit ? ` (${s.unit})` : ""}`} required={s.is_required} htmlFor={id}>
            {s.field_type === "select" ? (
              <>
                <input id={id} className="input" list={`${id}-list`} value={v} onChange={(e) => set(e.target.value)} placeholder="Pilih atau ketik" />
                <datalist id={`${id}-list`}>
                  {s.options.map((o) => (
                    <option key={o} value={o} />
                  ))}
                </datalist>
              </>
            ) : (
              <input id={id} className="input" inputMode={s.field_type === "number" ? "decimal" : undefined} value={v} onChange={(e) => set(e.target.value)} />
            )}
          </Field>
        );
      })}
    </>
  );
}

export function MaterialManager({ items, categories, products, suppliers }: { items: MaterialItem[]; categories: MaterialCategory[]; products: SupplierProduct[]; suppliers: Option[] }) {
  const toast = useToast();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [onlyLow, setOnlyLow] = useState(false);
  const [form, setForm] = useState<ItemForm | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const [price, setPrice] = useState<PriceForm | null>(null);
  const [history, setHistory] = useState<{ id: string; old_price: number | null; new_price: number; changed_at: string; supplier_name: string }[] | null>(null);
  const { run, pending, errors } = useAction();

  const byItem = useMemo(() => {
    const m = new Map<string, SupplierProduct[]>();
    for (const p of products) m.set(p.material_item_id, [...(m.get(p.material_item_id) ?? []), p]);
    return m;
  }, [products]);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return items.filter((i) => {
      if (cat && i.category_id !== cat) return false;
      if (onlyLow && !i.is_low_stock) return false;
      if (!s) return true;
      const shops = (byItem.get(i.id) ?? []).map((p) => p.supplier_name).join(" ");
      return [i.name, i.code, i.brand, i.category_name, specSummary(i.specs), shops].join(" ").toLowerCase().includes(s);
    });
  }, [items, q, cat, onlyLow, byItem]);

  const current = items.find((i) => i.id === detail) ?? null;
  const currentPrices = current ? [...(byItem.get(current.id) ?? [])].sort((a, b) => Number(b.is_active) - Number(a.is_active) || a.price - b.price) : [];
  const cheapest = currentPrices.find((p) => p.is_active && p.supplier_active)?.price ?? null;
  const formCat = categories.find((c) => c.id === form?.category_id);

  const openNew = () =>
    setForm({ id: null, category_id: cat || "", name: "", brand: "", unit: categories.find((c) => c.id === cat)?.default_unit ?? "pcs", min_stock: "0", specs: {}, photo_url: "", notes: "", is_active: true });
  const openEdit = (i: MaterialItem) =>
    setForm({ id: i.id, category_id: i.category_id, name: i.name, brand: i.brand ?? "", unit: i.unit, min_stock: String(i.min_stock), specs: { ...i.specs }, photo_url: i.photo_url ?? "", notes: i.notes ?? "", is_active: i.is_active });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (form) run(() => saveMaterialItem(form), { onOk: () => setForm(null) });
  };
  const submitPrice = (e: React.FormEvent) => {
    e.preventDefault();
    if (price) run(() => saveSupplierProduct(price), { onOk: () => setPrice(null) });
  };
  const remove = (i: MaterialItem) =>
    run(() => deleteMaterialItem(i.id), {
      confirm: `Hapus "${i.name}"? Jika barang sudah dipakai di transaksi, barang akan diarsipkan (riwayat tetap aman).`,
      onOk: (r) => {
        setDetail(null);
        if ("data" in r && r.data === "archived") toast("Barang sudah punya transaksi — diarsipkan");
      },
      success: "Selesai",
    });
  const loadHistory = async (id: string) => {
    const r = await getPriceHistory(id);
    if (r.ok) setHistory((r.data as typeof history) ?? []);
    else toast(r.error, "error");
  };

  const err = (k: string) => errors[k];
  const usedSuppliers = new Set(currentPrices.map((p) => p.supplier_id));

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center">
        <SearchBox value={q} onChange={setQ} placeholder="Cari nama barang, kategori, merek, spesifikasi, atau nama toko..." />
        <div className="flex gap-2">
          <select value={cat} onChange={(e) => setCat(e.target.value)} className="input !py-2.5 lg:w-52" aria-label="Kategori">
            <option value="">Semua kategori</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <label className="flex shrink-0 cursor-pointer items-center gap-2 rounded-xl border border-charcoal-900/15 bg-white px-3 text-sm">
            <input type="checkbox" checked={onlyLow} onChange={(e) => setOnlyLow(e.target.checked)} className="accent-wood-500" /> Stok menipis
          </label>
        </div>
        <button onClick={openNew} className="btn-primary !py-2.5">
          <Plus className="h-4 w-4" /> Tambah bahan
        </button>
      </div>
      <p className="mb-3 text-xs text-charcoal-700/70">{list.length} bahan baku</p>

      <DataTable
        rows={list}
        onRowClick={(i) => {
          setHistory(null);
          setDetail(i.id);
        }}
        empty="Belum ada bahan baku yang cocok."
        columns={[
          {
            key: "name",
            label: "Bahan baku",
            render: (i) => (
              <div className="flex items-center gap-3">
                {i.photo_url ? (
                  <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-cream-200">
                    <Image src={i.photo_url} alt="" fill sizes="40px" unoptimized className="object-cover" />
                  </div>
                ) : null}
                <div className="min-w-0">
                  <p className="font-semibold">
                    {i.name} {!i.is_active && <Badge>Nonaktif</Badge>}
                  </p>
                  <p className="text-xs text-charcoal-700/70">
                    {i.code}
                    {i.brand ? ` · ${i.brand}` : ""}
                    {specSummary(i.specs, categories.find((c) => c.id === i.category_id)?.specs) ? ` · ${specSummary(i.specs, categories.find((c) => c.id === i.category_id)?.specs)}` : ""}
                  </p>
                </div>
              </div>
            ),
          },
          { key: "category_name", label: "Kategori" },
          {
            key: "qty_available",
            label: "Stok tersedia",
            align: "right",
            render: (i) => (
              <span className={cn(i.is_low_stock && "font-semibold text-red-600")}>
                {fmtQty(i.qty_available)} {i.unit}
                {i.qty_allocated > 0 && <span className="block text-xs font-normal text-charcoal-700/60">+{fmtQty(i.qty_allocated)} dialokasikan</span>}
              </span>
            ),
          },
          {
            key: "best_price",
            label: "Harga termurah",
            align: "right",
            render: (i) =>
              i.best_price !== null ? (
                <span>
                  {formatRupiah(i.best_price)}
                  <span className="block text-xs text-charcoal-700/60">{i.best_supplier_name}</span>
                </span>
              ) : (
                <span className="text-charcoal-700/50">Belum ada harga</span>
              ),
          },
          { key: "supplier_count", label: "Supplier", align: "right", render: (i) => i.supplier_count },
        ]}
        actions={(i) => (
          <>
            <IconButton label="Edit" onClick={() => openEdit(i)}>
              <Pencil className="h-4 w-4" />
            </IconButton>
            <IconButton label="Hapus / arsipkan" danger onClick={() => remove(i)}>
              <Archive className="h-4 w-4" />
            </IconButton>
          </>
        )}
      />

      {/* Form bahan */}
      <AdminModal open={form !== null} onClose={() => setForm(null)} title={form?.id ? "Edit bahan baku" : "Tambah bahan baku"}>
        {form && (
          <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
            <Field label="Kategori" required error={err("category_id")}>
              <select
                className="input"
                value={form.category_id}
                onChange={(e) => {
                  const c = categories.find((x) => x.id === e.target.value);
                  setForm({ ...form, category_id: e.target.value, unit: form.id ? form.unit : (c?.default_unit ?? form.unit) });
                }}
              >
                <option value="">— Pilih kategori —</option>
                {categories
                  .filter((c) => c.is_active || c.id === form.category_id)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Nama barang" required error={err("name")}>
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="mis. Multiplek 18 mm" />
            </Field>
            <Field label="Merek / brand" error={err("brand")}>
              <input className="input" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} placeholder="mis. Taco, Huben, Avian" />
            </Field>
            <Field label="Satuan" required error={err("unit")}>
              <input className="input" list="unit-list" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
              <datalist id="unit-list">
                {MATERIAL_UNITS.map((u) => (
                  <option key={u} value={u} />
                ))}
              </datalist>
            </Field>
            <div className="rounded-2xl bg-cream-100 p-4 sm:col-span-2">
              <p className="mb-3 text-sm font-semibold">Spesifikasi {formCat ? `— ${formCat.name}` : ""}</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <SpecInputs category={formCat} specs={form.specs} onChange={(specs) => setForm({ ...form, specs })} />
              </div>
            </div>
            <Field label="Stok minimum (peringatan)" error={err("min_stock")} hint="Dashboard memberi peringatan bila stok tersedia ≤ angka ini. Isi 0 untuk mematikan.">
              <input className="input" type="number" min={0} step="any" value={form.min_stock} onChange={(e) => setForm({ ...form, min_stock: e.target.value })} />
            </Field>
            <label className="flex cursor-pointer items-center gap-3 self-end rounded-xl border border-charcoal-900/10 px-4 py-3">
              <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="h-5 w-5 accent-wood-500" />
              <span className="text-sm font-medium">Aktif dipakai</span>
            </label>
            <Field label="Foto barang (opsional)" className="sm:col-span-2">
              <ImageUploader folder="materials" value={form.photo_url ? [form.photo_url] : []} onChange={(u) => setForm({ ...form, photo_url: u[0] ?? "" })} />
            </Field>
            <Field label="Keterangan" className="sm:col-span-2">
              <textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </Field>
            <FormActions onCancel={() => setForm(null)} pending={pending} />
          </form>
        )}
      </AdminModal>

      {/* Detail: perbandingan harga */}
      <AdminModal open={current !== null && form === null && price === null} onClose={() => setDetail(null)} title={current?.name ?? "Bahan"}>
        {current && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Stok fisik" value={`${fmtQty(current.qty_on_hand)} ${current.unit}`} />
              <Stat label="Dialokasikan" value={`${fmtQty(current.qty_allocated)} ${current.unit}`} />
              <Stat label="Tersedia" value={`${fmtQty(current.qty_available)} ${current.unit}`} tone={current.is_low_stock ? "bad" : undefined} />
              <Stat label="Nilai stok" value={formatRupiah(current.stock_value)} />
            </div>
            <p className="text-sm text-charcoal-700">
              {current.code} · {current.category_name}
              {current.brand ? ` · ${current.brand}` : ""} · {specSummary(current.specs, categories.find((c) => c.id === current.category_id)?.specs) || "tanpa spesifikasi"}
            </p>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-display font-semibold">Perbandingan harga supplier</h3>
              <div className="flex gap-2">
                <button className="btn-outline btn-sm" onClick={() => loadHistory(current.id)}>
                  <History className="h-4 w-4" /> Riwayat harga
                </button>
                <button
                  className="btn-primary btn-sm"
                  onClick={() => setPrice({ id: null, supplier_id: "", material_item_id: current.id, price: current.best_price ?? 0, unit: current.unit, supplier_sku: "", notes: "", is_active: true })}
                >
                  <Plus className="h-4 w-4" /> Harga dari supplier
                </button>
              </div>
            </div>
            <DataTable
              rows={currentPrices}
              dense
              empty="Belum ada supplier untuk barang ini."
              columns={[
                {
                  key: "supplier_name",
                  label: "Supplier",
                  render: (p) => (
                    <span className="flex flex-wrap items-center gap-1.5 font-medium">
                      {p.supplier_name}
                      {cheapest !== null && p.price === cheapest && p.is_active && (
                        <Badge tone="bg-green-50 text-green-800 ring-green-200">
                          <BadgeCheck className="h-3 w-3" /> Paling ekonomis
                        </Badge>
                      )}
                      {(!p.is_active || !p.supplier_active) && <Badge>Tidak tersedia</Badge>}
                    </span>
                  ),
                },
                {
                  key: "price",
                  label: "Harga",
                  align: "right",
                  render: (p) => (
                    <span>
                      {formatRupiah(p.price)} / {p.unit || p.item_unit}
                      {cheapest !== null && p.price > cheapest && (
                        <span className="block text-xs text-red-600">+{formatRupiah(p.price - cheapest)} ({(((p.price - cheapest) / Math.max(cheapest, 1)) * 100).toFixed(1)}%)</span>
                      )}
                    </span>
                  ),
                },
                { key: "price_updated_at", label: "Update", render: (p) => formatDateShort(p.price_updated_at) },
              ]}
              actions={(p) => (
                <>
                  {p.supplier_whatsapp && (
                    <a
                      href={whatsappLink(p.supplier_whatsapp, `Halo ${p.supplier_name}, apakah ${current.name} masih tersedia? Berapa harga terbarunya?`)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg p-2 text-[#1FAF38] hover:bg-green-50"
                      aria-label="WhatsApp supplier"
                    >
                      <MessageCircle className="h-4 w-4" />
                    </a>
                  )}
                  <IconButton label="Ubah harga" onClick={() => setPrice({ id: p.id, supplier_id: p.supplier_id, material_item_id: p.material_item_id, price: p.price, unit: p.unit ?? "", supplier_sku: p.supplier_sku ?? "", notes: p.notes ?? "", is_active: p.is_active })}>
                    <Pencil className="h-4 w-4" />
                  </IconButton>
                  <IconButton label="Hapus" danger onClick={() => run(() => deleteSupplierProduct(p.id), { confirm: `Hapus harga dari ${p.supplier_name}?` })}>
                    <Trash2 className="h-4 w-4" />
                  </IconButton>
                </>
              )}
            />
            <p className="text-xs text-charcoal-700/70">Sistem menandai harga paling ekonomis, namun Anda tetap bebas memilih supplier berdasarkan kualitas, lokasi, atau pertimbangan lain saat membuat PO.</p>

            {history && (
              <div>
                <h3 className="mb-2 font-display font-semibold">Riwayat perubahan harga</h3>
                {history.length ? (
                  <ul className="divide-y divide-charcoal-900/5 rounded-2xl bg-white text-sm ring-1 ring-charcoal-900/5">
                    {history.map((h) => (
                      <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                        <span>
                          <span className="font-medium">{h.supplier_name}</span>
                          <span className="ml-2 text-xs text-charcoal-700/60">{new Date(h.changed_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}</span>
                        </span>
                        <span className="tabular-nums">
                          {h.old_price === null ? "Harga awal" : formatRupiah(h.old_price)} → <strong>{formatRupiah(h.new_price)}</strong>
                          {h.old_price !== null && (
                            <span className={cn("ml-2 text-xs", h.new_price > h.old_price ? "text-red-600" : "text-green-700")}>
                              {h.new_price > h.old_price ? "▲" : "▼"} {formatRupiah(Math.abs(h.new_price - h.old_price))}
                            </span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-charcoal-700/70">Belum ada riwayat.</p>
                )}
              </div>
            )}
          </div>
        )}
      </AdminModal>

      {/* Form harga per supplier */}
      <AdminModal open={price !== null} onClose={() => setPrice(null)} title={price?.id ? "Ubah harga supplier" : `Harga ${current?.name ?? ""} dari supplier`}>
        {price && (
          <form onSubmit={submitPrice} className="grid gap-4 sm:grid-cols-2">
            <Field label="Supplier" required error={err("supplier_id")} className="sm:col-span-2">
              <select className="input" value={price.supplier_id} disabled={!!price.id} onChange={(e) => setPrice({ ...price, supplier_id: e.target.value })}>
                <option value="">— Pilih supplier —</option>
                {suppliers
                  .filter((s) => s.value === price.supplier_id || !usedSuppliers.has(s.value))
                  .map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Harga beli" required error={err("price")}>
              <MoneyInput value={price.price} onChange={(n) => setPrice({ ...price, price: n })} />
            </Field>
            <Field label="Satuan" error={err("unit")}>
              <input className="input" value={price.unit} onChange={(e) => setPrice({ ...price, unit: e.target.value })} />
            </Field>
            <Field label="Kode / nama di toko">
              <input className="input" value={price.supplier_sku} onChange={(e) => setPrice({ ...price, supplier_sku: e.target.value })} />
            </Field>
            <label className="flex cursor-pointer items-center gap-3 self-end rounded-xl border border-charcoal-900/10 px-4 py-3">
              <input type="checkbox" checked={price.is_active} onChange={(e) => setPrice({ ...price, is_active: e.target.checked })} className="h-5 w-5 accent-wood-500" />
              <span className="text-sm font-medium">Masih dijual</span>
            </label>
            <FormActions onCancel={() => setPrice(null)} pending={pending} />
          </form>
        )}
      </AdminModal>
    </div>
  );
}
