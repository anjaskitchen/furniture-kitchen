"use client";
import { Archive, MapPin, MessageCircle, Pencil, Plus, Store, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { deleteSupplier, deleteSupplierProduct, saveSupplier, saveSupplierProduct } from "@/app/admin/erp/master-actions";
import { AdminModal } from "@/components/admin/AdminModal";
import { SUPPLIER_CATEGORIES, specSummary } from "@/lib/erp/constants";
import type { MaterialItem, Supplier, SupplierProduct } from "@/lib/erp/types";
import { formatRupiah } from "@/lib/format";
import { formatDateShort } from "@/lib/orders";
import { whatsappLink } from "@/lib/whatsapp";
import { Badge, DataTable, Field, FormActions, IconButton, MoneyInput, SearchBox, useAction } from "./kit";

type SupplierForm = { id: string | null; name: string; contact_person: string; address: string; whatsapp: string; category: string; notes: string; is_active: boolean };
const emptySupplier: SupplierForm = { id: null, name: "", contact_person: "", address: "", whatsapp: "", category: "", notes: "", is_active: true };

type ProductForm = { id: string | null; supplier_id: string; material_item_id: string; price: number; unit: string; supplier_sku: string; notes: string; is_active: boolean };

export function SupplierManager({ suppliers, products, items }: { suppliers: Supplier[]; products: SupplierProduct[]; items: MaterialItem[] }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [form, setForm] = useState<SupplierForm | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const [product, setProduct] = useState<ProductForm | null>(null);
  const { run, pending, errors } = useAction();

  const productsBySupplier = useMemo(() => {
    const m = new Map<string, SupplierProduct[]>();
    for (const p of products) m.set(p.supplier_id, [...(m.get(p.supplier_id) ?? []), p]);
    return m;
  }, [products]);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return suppliers.filter((x) => {
      if (cat && x.category !== cat) return false;
      if (!s) return true;
      const goods = (productsBySupplier.get(x.id) ?? []).map((p) => p.item_name).join(" ");
      return [x.name, x.code, x.contact_person, x.address, x.category, goods].join(" ").toLowerCase().includes(s);
    });
  }, [suppliers, q, cat, productsBySupplier]);

  const categories = useMemo(() => [...new Set([...SUPPLIER_CATEGORIES, ...suppliers.map((s) => s.category).filter(Boolean)])] as string[], [suppliers]);
  const current = suppliers.find((s) => s.id === detail) ?? null;
  const currentProducts = current ? (productsBySupplier.get(current.id) ?? []) : [];

  const submitSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    run(() => saveSupplier(form), { onOk: () => setForm(null) });
  };
  const submitProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) return;
    run(() => saveSupplierProduct(product), { onOk: () => setProduct(null) });
  };
  const remove = (s: Supplier) =>
    run(() => deleteSupplier(s.id), {
      confirm: s.po_count
        ? `"${s.name}" sudah punya ${s.po_count} transaksi pembelian. Supplier akan diarsipkan (nonaktif) agar riwayat tetap aman. Lanjutkan?`
        : `Hapus supplier "${s.name}"?`,
      success: s.po_count ? "Supplier diarsipkan" : "Supplier dihapus",
      onOk: () => setDetail(null),
    });

  const usedItemIds = new Set(currentProducts.map((p) => p.material_item_id));
  const err = (k: string) => errors[k];

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchBox value={q} onChange={setQ} placeholder="Cari nama toko, kontak, alamat, atau nama barang..." />
        <select value={cat} onChange={(e) => setCat(e.target.value)} className="input !py-2.5 sm:w-56" aria-label="Kategori supplier">
          <option value="">Semua kategori</option>
          {categories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <button onClick={() => setForm({ ...emptySupplier })} className="btn-primary !py-2.5">
          <Plus className="h-4 w-4" /> Tambah supplier
        </button>
      </div>
      <p className="mb-3 text-xs text-charcoal-700/70">{list.length} supplier</p>

      <DataTable
        rows={list}
        onRowClick={(s) => setDetail(s.id)}
        empty="Belum ada supplier. Tambahkan toko material langganan Anda."
        columns={[
          {
            key: "name",
            label: "Toko / Supplier",
            render: (s) => (
              <div>
                <p className="font-semibold">{s.name}</p>
                <p className="text-xs text-charcoal-700/70">
                  {s.code}
                  {s.contact_person ? ` · ${s.contact_person}` : ""}
                </p>
              </div>
            ),
          },
          { key: "category", label: "Kategori", render: (s) => s.category ?? "-" },
          { key: "address", label: "Alamat", render: (s) => <span className="line-clamp-2 max-w-xs">{s.address ?? "-"}</span>, hideMobile: true },
          { key: "products_count", label: "Barang", align: "right", render: (s) => s.products_count },
          { key: "po_count", label: "Transaksi", align: "right", render: (s) => s.po_count },
          { key: "is_active", label: "Status", render: (s) => (s.is_active ? <Badge tone="bg-green-50 text-green-800 ring-green-200">Aktif</Badge> : <Badge>Nonaktif</Badge>) },
        ]}
        actions={(s) => (
          <>
            {s.whatsapp && (
              <a href={whatsappLink(s.whatsapp, `Halo ${s.name}, saya dari Mandiri Furniture ingin menanyakan stok & harga barang.`)} target="_blank" rel="noopener noreferrer" className="rounded-lg p-2 text-[#1FAF38] hover:bg-green-50" title="WhatsApp" aria-label="WhatsApp">
                <MessageCircle className="h-4 w-4" />
              </a>
            )}
            <IconButton label="Edit" onClick={() => setForm({ ...emptySupplier, ...nullsToEmpty(s), id: s.id })}>
              <Pencil className="h-4 w-4" />
            </IconButton>
            <IconButton label={s.po_count ? "Arsipkan" : "Hapus"} danger onClick={() => remove(s)}>
              {s.po_count ? <Archive className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
            </IconButton>
          </>
        )}
      />

      {/* Form supplier */}
      <AdminModal open={form !== null} onClose={() => setForm(null)} title={form?.id ? "Edit supplier" : "Tambah supplier"}>
        {form && (
          <form onSubmit={submitSupplier} className="grid gap-4 sm:grid-cols-2">
            <Field label="Nama toko / supplier" required error={err("name")} className="sm:col-span-2">
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
            </Field>
            <Field label="Nama pemilik / kontak person" error={err("contact_person")}>
              <input className="input" value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} />
            </Field>
            <Field label="Nomor WhatsApp" error={err("whatsapp")}>
              <input className="input" inputMode="tel" placeholder="08xxxxxxxxxx" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} />
            </Field>
            <Field label="Kategori supplier" error={err("category")}>
              <input className="input" list="supplier-cats" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
              <datalist id="supplier-cats">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </Field>
            <label className="flex cursor-pointer items-center gap-3 self-end rounded-xl border border-charcoal-900/10 px-4 py-3">
              <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="h-5 w-5 accent-wood-500" />
              <span className="text-sm font-medium">Supplier aktif</span>
            </label>
            <Field label="Alamat toko" error={err("address")} className="sm:col-span-2">
              <textarea className="input" rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </Field>
            <Field label="Catatan" error={err("notes")} className="sm:col-span-2">
              <textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Jam buka, termin pembayaran, kualitas, dll." />
            </Field>
            <FormActions onCancel={() => setForm(null)} pending={pending} />
          </form>
        )}
      </AdminModal>

      {/* Detail supplier + daftar barang */}
      <AdminModal open={current !== null && product === null && form === null} onClose={() => setDetail(null)} title={current?.name ?? "Supplier"}>
        {current && (
          <div className="space-y-5">
            <div className="grid gap-3 rounded-2xl bg-cream-100 p-4 text-sm sm:grid-cols-2">
              <p className="flex items-center gap-2">
                <Store className="h-4 w-4 text-wood-600" /> {current.code} · {current.category ?? "Tanpa kategori"}
              </p>
              <p>Kontak: {current.contact_person ?? "-"}</p>
              <p className="flex items-start gap-2 sm:col-span-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-wood-600" /> {current.address ?? "Alamat belum diisi"}
              </p>
              {current.notes && <p className="text-charcoal-700 sm:col-span-2">{current.notes}</p>}
              <div className="flex flex-wrap gap-2 sm:col-span-2">
                {current.whatsapp && (
                  <a href={whatsappLink(current.whatsapp, `Halo ${current.name}, saya dari Mandiri Furniture ingin menanyakan stok & harga barang.`)} target="_blank" rel="noopener noreferrer" className="btn-whatsapp btn-sm">
                    <MessageCircle className="h-4 w-4" /> Hubungi via WhatsApp
                  </a>
                )}
                <button className="btn-outline btn-sm" onClick={() => setForm({ ...emptySupplier, ...nullsToEmpty(current), id: current.id })}>
                  <Pencil className="h-4 w-4" /> Edit profil
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <h3 className="font-display font-semibold">Barang & harga ({currentProducts.length})</h3>
              <button
                className="btn-primary btn-sm"
                onClick={() => setProduct({ id: null, supplier_id: current.id, material_item_id: "", price: 0, unit: "", supplier_sku: "", notes: "", is_active: true })}
              >
                <Plus className="h-4 w-4" /> Tambah barang
              </button>
            </div>
            <DataTable
              rows={currentProducts}
              dense
              empty="Belum ada barang. Tambahkan barang yang dijual toko ini beserta harganya."
              columns={[
                {
                  key: "item_name",
                  label: "Barang",
                  render: (p) => (
                    <div>
                      <p className="font-medium">{p.item_name}</p>
                      <p className="text-xs text-charcoal-700/70">
                        {p.category_name}
                        {p.supplier_sku ? ` · ${p.supplier_sku}` : ""}
                      </p>
                    </div>
                  ),
                },
                { key: "price", label: "Harga", align: "right", render: (p) => `${formatRupiah(p.price)} / ${p.unit || p.item_unit}` },
                { key: "price_updated_at", label: "Update harga", render: (p) => formatDateShort(p.price_updated_at) },
                { key: "is_active", label: "Status", render: (p) => (p.is_active ? "Dijual" : <Badge>Tidak tersedia</Badge>) },
              ]}
              actions={(p) => (
                <>
                  <IconButton label="Edit harga" onClick={() => setProduct({ ...nullsToEmpty(p), id: p.id, unit: p.unit ?? "" } as ProductForm)}>
                    <Pencil className="h-4 w-4" />
                  </IconButton>
                  <IconButton label="Hapus" danger onClick={() => run(() => deleteSupplierProduct(p.id), { confirm: `Hapus ${p.item_name} dari ${current.name}?` })}>
                    <Trash2 className="h-4 w-4" />
                  </IconButton>
                </>
              )}
            />
          </div>
        )}
      </AdminModal>

      {/* Form barang supplier */}
      <AdminModal open={product !== null} onClose={() => setProduct(null)} title={product?.id ? "Edit harga barang" : `Tambah barang — ${current?.name ?? ""}`}>
        {product && (
          <form onSubmit={submitProduct} className="grid gap-4 sm:grid-cols-2">
            <Field label="Bahan baku" required error={err("material_item_id")} className="sm:col-span-2" hint="Belum ada di daftar? Tambahkan dulu di menu Bahan Baku.">
              <select
                className="input"
                value={product.material_item_id}
                disabled={!!product.id}
                onChange={(e) => {
                  const it = items.find((i) => i.id === e.target.value);
                  setProduct({ ...product, material_item_id: e.target.value, unit: product.unit || it?.unit || "" });
                }}
              >
                <option value="">— Pilih bahan baku —</option>
                {items
                  .filter((i) => i.id === product.material_item_id || !usedItemIds.has(i.id))
                  .map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.category_name} — {i.name}
                      {i.brand ? ` (${i.brand})` : ""} {specSummary(i.specs) ? `· ${specSummary(i.specs)}` : ""}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Harga beli" required error={err("price")}>
              <MoneyInput value={product.price} onChange={(n) => setProduct({ ...product, price: n })} />
            </Field>
            <Field label="Satuan pembelian" error={err("unit")}>
              <input className="input" value={product.unit} onChange={(e) => setProduct({ ...product, unit: e.target.value })} placeholder="lembar, pcs, kg..." />
            </Field>
            <Field label="Kode / nama di toko" error={err("supplier_sku")}>
              <input className="input" value={product.supplier_sku} onChange={(e) => setProduct({ ...product, supplier_sku: e.target.value })} />
            </Field>
            <label className="flex cursor-pointer items-center gap-3 self-end rounded-xl border border-charcoal-900/10 px-4 py-3">
              <input type="checkbox" checked={product.is_active} onChange={(e) => setProduct({ ...product, is_active: e.target.checked })} className="h-5 w-5 accent-wood-500" />
              <span className="text-sm font-medium">Masih dijual</span>
            </label>
            <Field label="Keterangan" error={err("notes")} className="sm:col-span-2">
              <input className="input" value={product.notes} onChange={(e) => setProduct({ ...product, notes: e.target.value })} />
            </Field>
            <p className="text-xs text-charcoal-700/70 sm:col-span-2">Setiap perubahan harga otomatis tercatat di riwayat harga beserta tanggalnya.</p>
            <FormActions onCancel={() => setProduct(null)} pending={pending} />
          </form>
        )}
      </AdminModal>
    </div>
  );
}

/** Ubah null → "" agar aman untuk input terkontrol. */
type NoNull<T> = { [K in keyof T]: null extends T[K] ? Exclude<T[K], null> | "" : T[K] };
export function nullsToEmpty<T extends object>(o: T): NoNull<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) out[k] = v === null ? "" : v;
  return out as NoNull<T>;
}
