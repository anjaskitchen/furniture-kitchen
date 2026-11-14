"use client";
import { Pencil, Plus, SlidersHorizontal, Undo2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { addStock, adjustStock, deleteAdjustment, updateLotInfo } from "@/app/admin/erp/inventory-actions";
import { AdminModal } from "@/components/admin/AdminModal";
import { ImageUploader } from "@/components/admin/ImageUploader";
import { ADJUST_TYPES, fmtQty, MOVEMENT_TYPES, specSummary, STOCK_STATUSES } from "@/lib/erp/constants";
import type { InventoryLot, MaterialCategory, MaterialItem, Movement, Option } from "@/lib/erp/types";
import { formatRupiah } from "@/lib/format";
import { formatDateShort, jakartaToday } from "@/lib/orders";
import { cn } from "@/lib/utils";
import { DataTable, Field, FormActions, IconButton, MoneyInput, QtyInput, SearchBox, Stat, StatusPill, useAction } from "./kit";
import { SpecInputs } from "./MaterialManager";

type StockForm = {
  material_item_id: string;
  supplier_id: string;
  invoice_number: string;
  purchase_date: string;
  qty_in: string;
  unit: string;
  unit_cost: number;
  location: string;
  specs: Record<string, string>;
  photo_url: string;
  notes: string;
};

export function InventoryManager({
  tab,
  items,
  lots,
  movements,
  categories,
  suppliers,
}: {
  tab: "ringkasan" | "lot" | "riwayat";
  items: MaterialItem[];
  lots: InventoryLot[];
  movements: Movement[];
  categories: MaterialCategory[];
  suppliers: Option[];
}) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [status, setStatus] = useState(tab === "lot" ? "in_stock" : "");
  const [mtype, setMtype] = useState("");
  const [stock, setStock] = useState<StockForm | null>(null);
  const [adjust, setAdjust] = useState<{ lot: InventoryLot; type: string; qty: string; reason: string; date: string } | null>(null);
  const [info, setInfo] = useState<{ id: string; location: string; notes: string; photo_url: string } | null>(null);
  const { run, pending, errors } = useAction();

  const totals = useMemo(
    () => ({
      value: lots.reduce((a, l) => a + l.stock_value, 0),
      lotsActive: lots.filter((l) => l.qty_on_hand > 0).length,
      low: items.filter((i) => i.is_low_stock).length,
      allocatedValue: lots.reduce((a, l) => a + l.qty_allocated * l.unit_cost, 0),
    }),
    [lots, items],
  );

  const s = q.trim().toLowerCase();
  const itemRows = items.filter((i) => (!cat || i.category_id === cat) && (!s || [i.name, i.code, i.brand, i.category_name, specSummary(i.specs)].join(" ").toLowerCase().includes(s)) && (i.qty_on_hand > 0 || i.is_low_stock || status === "all"));
  const lotRows = lots.filter((l) => {
    if (cat && l.category_id !== cat) return false;
    if (status === "in_stock" && l.qty_on_hand <= 0) return false;
    if (status && status !== "in_stock" && l.stock_status !== status) return false;
    return !s || [l.stock_code, l.item_name, l.item_code, l.brand, l.supplier_name, l.invoice_number, l.po_number, l.location, specSummary(l.specs)].join(" ").toLowerCase().includes(s);
  });
  const moveRows = movements.filter((m) => (!mtype || m.movement_type === mtype) && (!s || [m.stock_code, m.item_name, m.reason, m.order_number, m.user_label].join(" ").toLowerCase().includes(s)));

  const stockCat = categories.find((c) => c.id === items.find((i) => i.id === stock?.material_item_id)?.category_id);
  const err = (k: string) => errors[k];

  const openStock = (itemId = "") => {
    const it = items.find((i) => i.id === itemId);
    setStock({ material_item_id: itemId, supplier_id: "", invoice_number: "", purchase_date: jakartaToday(), qty_in: "1", unit: it?.unit ?? "pcs", unit_cost: it?.best_price ?? 0, location: "", specs: { ...(it?.specs ?? {}) }, photo_url: "", notes: "" });
  };

  return (
    <div>
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Nilai persediaan" value={formatRupiah(totals.value)} />
        <Stat label="Nilai dialokasikan proyek" value={formatRupiah(totals.allocatedValue)} />
        <Stat label="Lot stok aktif" value={totals.lotsActive} />
        <Stat label="Bahan stok menipis" value={totals.low} tone={totals.low ? "bad" : undefined} />
      </div>

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <SearchBox value={q} onChange={setQ} placeholder={tab === "riwayat" ? "Cari kode stok, barang, alasan, proyek..." : "Cari barang, kode stok, supplier, nota, lokasi..."} />
        {tab !== "riwayat" && (
          <select value={cat} onChange={(e) => setCat(e.target.value)} className="input !py-2.5 lg:w-48" aria-label="Kategori">
            <option value="">Semua kategori</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
        {tab === "lot" && (
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="input !py-2.5 lg:w-52" aria-label="Status">
            <option value="in_stock">Masih ada stok</option>
            <option value="">Semua lot</option>
            {STOCK_STATUSES.map((x) => (
              <option key={x.value} value={x.value}>
                {x.label}
              </option>
            ))}
          </select>
        )}
        {tab === "ringkasan" && (
          <label className="flex shrink-0 cursor-pointer items-center gap-2 rounded-xl border border-charcoal-900/15 bg-white px-3 py-2.5 text-sm">
            <input type="checkbox" checked={status === "all"} onChange={(e) => setStatus(e.target.checked ? "all" : "")} className="accent-wood-500" /> Tampilkan stok kosong
          </label>
        )}
        {tab === "riwayat" && (
          <select value={mtype} onChange={(e) => setMtype(e.target.value)} className="input !py-2.5 lg:w-56" aria-label="Jenis mutasi">
            <option value="">Semua mutasi</option>
            {MOVEMENT_TYPES.map((x) => (
              <option key={x.value} value={x.value}>
                {x.label}
              </option>
            ))}
          </select>
        )}
        <button className="btn-primary !py-2.5" onClick={() => openStock()}>
          <Plus className="h-4 w-4" /> Stok masuk manual
        </button>
      </div>

      {tab === "ringkasan" && (
        <DataTable
          rows={itemRows}
          empty="Belum ada stok. Stok bertambah otomatis saat PO diterima, atau input stok manual."
          columns={[
            {
              key: "name",
              label: "Bahan",
              render: (i) => (
                <div>
                  <p className="font-semibold">{i.name}</p>
                  <p className="text-xs text-charcoal-700/70">
                    {i.code} · {i.category_name}
                    {specSummary(i.specs) ? ` · ${specSummary(i.specs)}` : ""}
                  </p>
                </div>
              ),
            },
            { key: "qty_on_hand", label: "Stok fisik", align: "right", render: (i) => `${fmtQty(i.qty_on_hand)} ${i.unit}` },
            { key: "qty_allocated", label: "Dialokasikan", align: "right", render: (i) => (i.qty_allocated ? `${fmtQty(i.qty_allocated)} ${i.unit}` : "-") },
            {
              key: "qty_available",
              label: "Tersedia",
              align: "right",
              render: (i) => (
                <span className={cn("font-semibold", i.is_low_stock ? "text-red-600" : "text-green-700")}>
                  {fmtQty(i.qty_available)} {i.unit}
                  {i.is_low_stock && <span className="block text-xs font-normal">min. {fmtQty(i.min_stock)}</span>}
                </span>
              ),
            },
            { key: "stock_value", label: "Nilai", align: "right", render: (i) => formatRupiah(i.stock_value) },
          ]}
          actions={(i) => (
            <IconButton label="Stok masuk" onClick={() => openStock(i.id)}>
              <Plus className="h-4 w-4" />
            </IconButton>
          )}
        />
      )}

      {tab === "lot" && (
        <DataTable
          rows={lotRows}
          empty="Tidak ada lot stok yang cocok."
          columns={[
            {
              key: "stock_code",
              label: "Barang / lot",
              render: (l) => (
                <div>
                  <p className="font-semibold">{l.item_name}</p>
                  <p className="text-xs text-charcoal-700/70">
                    {l.stock_code} · {l.category_name}
                    {l.brand ? ` · ${l.brand}` : ""}
                    {specSummary(l.specs) ? ` · ${specSummary(l.specs)}` : ""}
                  </p>
                </div>
              ),
            },
            {
              key: "purchase_date",
              label: "Pembelian",
              render: (l) => (
                <div className="text-xs">
                  <p>{formatDateShort(l.purchase_date)}</p>
                  <p className="text-charcoal-700/70">
                    {l.supplier_name ?? "Tanpa supplier"}
                    {l.po_number ? ` · ${l.po_number}` : ""}
                    {l.invoice_number ? ` · Nota ${l.invoice_number}` : ""}
                  </p>
                </div>
              ),
              hideMobile: true,
            },
            {
              key: "qty",
              label: "Masuk / sisa",
              align: "right",
              render: (l) => (
                <span>
                  {fmtQty(l.qty_in)} → <strong>{fmtQty(l.qty_on_hand)}</strong> {l.unit}
                  <span className="block text-xs text-charcoal-700/60">
                    tersedia {fmtQty(l.qty_available)}
                    {l.qty_allocated ? ` · alokasi ${fmtQty(l.qty_allocated)}` : ""}
                    {l.qty_used ? ` · dipakai ${fmtQty(l.qty_used)}` : ""}
                    {l.qty_damaged ? ` · rusak ${fmtQty(l.qty_damaged)}` : ""}
                  </span>
                </span>
              ),
            },
            { key: "unit_cost", label: "Harga / total", align: "right", render: (l) => <span>{formatRupiah(l.unit_cost)}<span className="block text-xs text-charcoal-700/60">{formatRupiah(l.total_cost)}</span></span> },
            { key: "location", label: "Lokasi", render: (l) => l.location ?? "-" },
            { key: "stock_status", label: "Status", render: (l) => <StatusPill list={STOCK_STATUSES} value={l.stock_status} /> },
          ]}
          actions={(l) => (
            <>
              <IconButton label="Penyesuaian / rusak / retur" onClick={() => setAdjust({ lot: l, type: "adjustment_minus", qty: "1", reason: "", date: jakartaToday() })}>
                <SlidersHorizontal className="h-4 w-4" />
              </IconButton>
              <IconButton label="Ubah lokasi / catatan" onClick={() => setInfo({ id: l.id, location: l.location ?? "", notes: l.notes ?? "", photo_url: l.photo_url ?? "" })}>
                <Pencil className="h-4 w-4" />
              </IconButton>
            </>
          )}
        />
      )}

      {tab === "riwayat" && (
        <DataTable
          rows={moveRows}
          dense
          empty="Belum ada mutasi stok."
          columns={[
            { key: "moved_at", label: "Tanggal", render: (m) => <span className="whitespace-nowrap">{formatDateShort(m.moved_at)}</span> },
            {
              key: "item_name",
              label: "Barang",
              render: (m) => (
                <div>
                  <p className="font-medium">{m.item_name}</p>
                  <p className="text-xs text-charcoal-700/70">{m.stock_code}</p>
                </div>
              ),
            },
            { key: "movement_type", label: "Jenis", render: (m) => <StatusPill list={MOVEMENT_TYPES} value={m.movement_type} /> },
            {
              key: "qty",
              label: "Jumlah",
              align: "right",
              render: (m) => {
                const sign = MOVEMENT_TYPES.find((x) => x.value === m.movement_type)?.sign ?? 1;
                return (
                  <span className={cn("font-semibold", sign > 0 ? "text-green-700" : "text-red-600")}>
                    {sign > 0 ? "+" : "−"}
                    {fmtQty(m.qty)} {m.unit}
                  </span>
                );
              },
            },
            {
              key: "reason",
              label: "Alasan / referensi",
              render: (m) => (
                <span className="text-xs">
                  {m.reason ?? "-"}
                  {m.order_number && (
                    <Link href={`/admin/proyek/${m.project_id}`} className="ml-1 text-wood-600 underline">
                      {m.order_number}
                    </Link>
                  )}
                </span>
              ),
            },
            { key: "user_label", label: "Oleh", render: (m) => <span className="text-xs">{m.user_label ?? "Sistem"}</span>, hideMobile: true },
          ]}
          actions={(m) =>
            m.reference_type === "adjustment" ? (
              <IconButton label="Batalkan penyesuaian" danger onClick={() => run(() => deleteAdjustment(m.id), { confirm: "Batalkan penyesuaian stok ini?" })}>
                <Undo2 className="h-4 w-4" />
              </IconButton>
            ) : null
          }
        />
      )}

      <AdminModal open={stock !== null} onClose={() => setStock(null)} title="Stok masuk manual">
        {stock && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run(() => addStock({ ...stock, qty_in: stock.qty_in.replace(",", ".") }), { onOk: () => setStock(null) });
            }}
            className="grid gap-4 sm:grid-cols-2"
          >
            <p className="rounded-xl bg-cream-100 p-3 text-sm sm:col-span-2">
              Gunakan untuk stok awal atau pembelian tanpa PO. Pembelian dari supplier sebaiknya lewat menu <Link href="/admin/pembelian/new" className="font-semibold underline">Pembelian</Link> agar tercatat utang & pembayarannya.
            </p>
            <Field label="Barang" required error={err("material_item_id")} className="sm:col-span-2">
              <select
                className="input"
                value={stock.material_item_id}
                onChange={(e) => {
                  const it = items.find((i) => i.id === e.target.value);
                  setStock({ ...stock, material_item_id: e.target.value, unit: it?.unit ?? stock.unit, unit_cost: it?.best_price ?? stock.unit_cost, specs: { ...(it?.specs ?? {}) } });
                }}
              >
                <option value="">— Pilih barang —</option>
                {items.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.category_name} — {i.name}
                    {i.brand ? ` (${i.brand})` : ""}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Jumlah masuk" required error={err("qty_in")}>
              <QtyInput value={stock.qty_in} onChange={(v) => setStock({ ...stock, qty_in: v })} />
            </Field>
            <Field label="Satuan" required>
              <input className="input" value={stock.unit} onChange={(e) => setStock({ ...stock, unit: e.target.value })} />
            </Field>
            <Field label="Harga beli per satuan" error={err("unit_cost")}>
              <MoneyInput value={stock.unit_cost} onChange={(n) => setStock({ ...stock, unit_cost: n })} />
            </Field>
            <Field label="Total harga">
              <p className="input bg-cream-50 tabular-nums">{formatRupiah((Number(stock.qty_in.replace(",", ".")) || 0) * stock.unit_cost)}</p>
            </Field>
            <Field label="Supplier / toko">
              <select className="input" value={stock.supplier_id} onChange={(e) => setStock({ ...stock, supplier_id: e.target.value })}>
                <option value="">— Tidak ada —</option>
                {suppliers.map((x) => (
                  <option key={x.value} value={x.value}>
                    {x.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Nomor nota">
              <input className="input" value={stock.invoice_number} onChange={(e) => setStock({ ...stock, invoice_number: e.target.value })} />
            </Field>
            <Field label="Tanggal pembelian" required>
              <input type="date" min="1900-01-01" max="2100-12-31" className="input" value={stock.purchase_date} onChange={(e) => setStock({ ...stock, purchase_date: e.target.value })} />
            </Field>
            <Field label="Lokasi penyimpanan">
              <input className="input" value={stock.location} onChange={(e) => setStock({ ...stock, location: e.target.value })} placeholder="Gudang / rak" />
            </Field>
            {stock.material_item_id && (
              <div className="rounded-2xl bg-cream-100 p-4 sm:col-span-2">
                <p className="mb-3 text-sm font-semibold">Spesifikasi lot ini (warna, kode, ketebalan…)</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <SpecInputs category={stockCat} specs={stock.specs} onChange={(specs) => setStock({ ...stock, specs })} />
                </div>
              </div>
            )}
            <Field label="Foto (opsional)" className="sm:col-span-2">
              <ImageUploader folder="stock" value={stock.photo_url ? [stock.photo_url] : []} onChange={(u) => setStock({ ...stock, photo_url: u[0] ?? "" })} />
            </Field>
            <Field label="Keterangan" className="sm:col-span-2">
              <input className="input" value={stock.notes} onChange={(e) => setStock({ ...stock, notes: e.target.value })} />
            </Field>
            <FormActions onCancel={() => setStock(null)} pending={pending} label="Catat stok masuk" />
          </form>
        )}
      </AdminModal>

      <AdminModal open={adjust !== null} onClose={() => setAdjust(null)} title={`Ubah stok — ${adjust?.lot.item_name ?? ""}`}>
        {adjust && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run(() => adjustStock({ inventory_id: adjust.lot.id, type: adjust.type, qty: adjust.qty.replace(",", "."), reason: adjust.reason, date: adjust.date }), { onOk: () => setAdjust(null) });
            }}
            className="grid gap-4 sm:grid-cols-2"
          >
            <div className="grid grid-cols-3 gap-2 sm:col-span-2">
              <Stat label="Stok fisik" value={`${fmtQty(adjust.lot.qty_on_hand)} ${adjust.lot.unit}`} />
              <Stat label="Dialokasikan" value={fmtQty(adjust.lot.qty_allocated)} />
              <Stat label="Tersedia" value={fmtQty(adjust.lot.qty_available)} />
            </div>
            <Field label="Jenis perubahan" required className="sm:col-span-2">
              <div className="grid gap-2 sm:grid-cols-2">
                {ADJUST_TYPES.map((t) => (
                  <label key={t.value} className={cn("flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-sm", adjust.type === t.value ? "border-[#17263C] bg-[#17263C]/5" : "border-charcoal-900/10")}>
                    <input type="radio" name="adj" checked={adjust.type === t.value} onChange={() => setAdjust({ ...adjust, type: t.value })} className="accent-[#17263C]" />
                    {t.label}
                  </label>
                ))}
              </div>
            </Field>
            <Field label="Jumlah" required error={err("qty")}>
              <QtyInput value={adjust.qty} onChange={(v) => setAdjust({ ...adjust, qty: v })} />
            </Field>
            <Field label="Tanggal" required>
              <input type="date" min="1900-01-01" max="2100-12-31" className="input" value={adjust.date} onChange={(e) => setAdjust({ ...adjust, date: e.target.value })} />
            </Field>
            <Field label="Alasan" required error={err("reason")} className="sm:col-span-2">
              <input className="input" value={adjust.reason} onChange={(e) => setAdjust({ ...adjust, reason: e.target.value })} placeholder="mis. hasil stock opname, kena air, salah kirim" />
            </Field>
            <p className="text-xs text-charcoal-700/70 sm:col-span-2">
              Stok yang sudah dialokasikan ke proyek tidak bisa dikurangi — lepas alokasinya dulu di halaman proyek. Setiap perubahan tercatat di riwayat beserta pengguna & alasannya.
            </p>
            <FormActions onCancel={() => setAdjust(null)} pending={pending} />
          </form>
        )}
      </AdminModal>

      <AdminModal open={info !== null} onClose={() => setInfo(null)} title="Info lot stok">
        {info && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run(() => updateLotInfo(info), { onOk: () => setInfo(null) });
            }}
            className="grid gap-4"
          >
            <Field label="Lokasi penyimpanan">
              <input className="input" value={info.location} onChange={(e) => setInfo({ ...info, location: e.target.value })} />
            </Field>
            <Field label="Keterangan">
              <input className="input" value={info.notes} onChange={(e) => setInfo({ ...info, notes: e.target.value })} />
            </Field>
            <Field label="Foto">
              <ImageUploader folder="stock" value={info.photo_url ? [info.photo_url] : []} onChange={(u) => setInfo({ ...info, photo_url: u[0] ?? "" })} />
            </Field>
            <FormActions onCancel={() => setInfo(null)} pending={pending} />
          </form>
        )}
      </AdminModal>
    </div>
  );
}
