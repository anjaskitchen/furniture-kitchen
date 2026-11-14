"use client";
import { Calculator, PackageMinus, PackagePlus, Pencil, Plus, ShoppingCart, Trash2, Undo2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { allocateStock, deleteUsage, recordUsage, releaseAllocation } from "@/app/admin/erp/inventory-actions";
import { applyTemplate, deleteRequirement, previewTemplate, saveRequirement } from "@/app/admin/erp/project-actions";
import { AdminModal } from "@/components/admin/AdminModal";
import { useToast } from "@/components/Toast";
import type { Allocation, Template, Usage } from "@/lib/erp/data";
import { fmtQty, PROCUREMENT_STATUSES, specSummary, USAGE_KINDS } from "@/lib/erp/constants";
import type { InventoryLot, MaterialItem, Option, ProjectRow, Requirement } from "@/lib/erp/types";
import { formatRupiah } from "@/lib/format";
import { formatDateShort, jakartaToday } from "@/lib/orders";
import { cn } from "@/lib/utils";
import { DataTable, Field, FormActions, IconButton, MoneyInput, QtyInput, Stat, StatusPill, useAction } from "../kit";
import { SpecFields } from "./ProjectOverview";

type ReqForm = { id: string | null; material_item_id: string; name: string; spec_text: string; qty: string; unit: string; est_unit_price: number; preferred_supplier_id: string; notes: string };

export function ProjectMaterials({
  p,
  requirements,
  allocations,
  usage,
  lots,
  items,
  templates,
  suppliers,
  showMoney,
}: {
  p: ProjectRow;
  requirements: Requirement[];
  allocations: Allocation[];
  usage: Usage[];
  lots: InventoryLot[];
  items: MaterialItem[];
  templates: Template[];
  suppliers: Option[];
  showMoney: boolean;
}) {
  const toast = useToast();
  const { run, pending, errors } = useAction();
  const [req, setReq] = useState<ReqForm | null>(null);
  const [tpl, setTpl] = useState<{ template_id: string; mode: "replace" | "append"; specs: Record<string, string>; preview: { name: string; unit: string; qty: number; error: string | null }[] | null } | null>(null);
  const [alloc, setAlloc] = useState<{ inventory_id: string; qty: string; notes: string; itemFilter: string } | null>(null);
  const [use, setUse] = useState<{ inventory_id: string; kind: string; qty: string; date: string; notes: string } | null>(null);

  const rabTotal = requirements.reduce((a, r) => a + r.est_total, 0);
  const shortages = requirements.filter((r) => r.material_item_id && (r.shortage_qty > 0 || r.procurement_status === "to_buy" || r.procurement_status === "partial"));
  const shortageTotal = shortages.reduce((a, r) => a + r.shortage_qty * (r.recommended_price ?? r.est_unit_price), 0);
  const inStock = requirements.filter((r) => r.procurement_status === "in_stock" || (r.still_needed > 0 && r.stock_available > 0));
  const usedCost = usage.reduce((a, u) => a + (u.kind === "returned" ? -1 : 1) * u.qty * u.unit_cost, 0);

  // Kelompokkan kekurangan per supplier rekomendasi → tombol "Buat PO".
  const bySupplier = useMemo(() => {
    const m = new Map<string, Requirement[]>();
    for (const r of shortages.filter((x) => x.shortage_qty > 0)) {
      const k = r.recommended_supplier_id ?? "";
      m.set(k, [...(m.get(k) ?? []), r]);
    }
    return [...m.entries()];
  }, [shortages]);

  const availableLots = lots.filter((l) => l.qty_available > 0);
  const projectLots = useMemo(() => {
    const ids = new Set(allocations.filter((a) => a.remaining > 0).map((a) => a.inventory_id));
    return lots.filter((l) => ids.has(l.id) || l.qty_available > 0);
  }, [lots, allocations]);
  const usedLots = useMemo(() => {
    const ids = new Set(usage.map((u) => u.inventory_id));
    return lots.filter((l) => ids.has(l.id));
  }, [lots, usage]);

  const openReq = (r?: Requirement) =>
    setReq(
      r
        ? { id: r.id, material_item_id: r.material_item_id ?? "", name: r.name, spec_text: r.spec_text ?? "", qty: String(r.qty), unit: r.unit, est_unit_price: r.est_unit_price, preferred_supplier_id: r.preferred_supplier_id ?? "", notes: r.notes ?? "" }
        : { id: null, material_item_id: "", name: "", spec_text: "", qty: "1", unit: "pcs", est_unit_price: 0, preferred_supplier_id: "", notes: "" },
    );

  const runPreview = async (template_id: string, specs: Record<string, string>) => {
    if (!template_id) return;
    const r = await previewTemplate({ template_id, specs });
    if (r.ok) setTpl((t) => (t ? { ...t, preview: (r.data as NonNullable<typeof t.preview>) ?? [] } : t));
    else toast(r.error, "error");
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Item kebutuhan" value={requirements.length} />
        {showMoney && <Stat label="Estimasi biaya material (RAB)" value={formatRupiah(rabTotal)} />}
        <Stat label="Perlu dibeli" value={`${shortages.filter((s) => s.shortage_qty > 0).length} item`} sub={showMoney && shortageTotal ? `± ${formatRupiah(shortageTotal)}` : undefined} tone={shortages.length ? "bad" : "good"} />
        {showMoney && <Stat label="Material terpakai (realisasi)" value={formatRupiah(usedCost)} />}
      </div>

      {/* RAB */}
      <section className="rounded-2xl bg-white p-5 ring-1 ring-charcoal-900/5 sm:p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-lg font-semibold">Rencana Anggaran & Kebutuhan Material (RAB)</h2>
            <p className="text-xs text-charcoal-700/70">Status dihitung dari alokasi stok, PO yang sedang dipesan, dan stok gudang. Semua angka bisa diubah sesuai kondisi proyek.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn-outline btn-sm" onClick={() => setTpl({ template_id: p.template_id ?? "", mode: "replace", specs: Object.fromEntries(Object.entries(p.specs ?? {}).map(([k, v]) => [k, String(v)])), preview: null })}>
              <Calculator className="h-4 w-4" /> Hitung dari template
            </button>
            <button className="btn-primary btn-sm" onClick={() => openReq()}>
              <Plus className="h-4 w-4" /> Tambah kebutuhan
            </button>
          </div>
        </div>
        <DataTable
          rows={requirements}
          dense
          empty="Belum ada kebutuhan material. Hitung otomatis dari template atau tambahkan manual."
          columns={[
            {
              key: "name",
              label: "Bahan",
              render: (r) => (
                <div>
                  <p className="font-medium">{r.name}</p>
                  <p className="text-xs text-charcoal-700/70">
                    {[r.category_name, r.spec_text].filter(Boolean).join(" · ") || (r.material_item_id ? "" : "Tidak terhubung ke stok")}
                    {r.source === "template" && " · template"}
                  </p>
                </div>
              ),
            },
            { key: "qty", label: "Kebutuhan", align: "right", render: (r) => `${fmtQty(r.qty)} ${r.unit}` },
            ...(showMoney
              ? [
                  { key: "est_unit_price", label: "Harga est.", align: "right" as const, render: (r: Requirement) => formatRupiah(r.est_unit_price) },
                  { key: "est_total", label: "Total est.", align: "right" as const, render: (r: Requirement) => <strong>{formatRupiah(r.est_total)}</strong> },
                ]
              : []),
            {
              key: "covered",
              label: "Terpenuhi / stok",
              align: "right",
              render: (r) =>
                r.material_item_id ? (
                  <span className="text-xs">
                    <strong className="text-sm">{fmtQty(r.covered_qty)}</strong> teralokasi
                    <span className="block text-charcoal-700/60">
                      gudang {fmtQty(r.stock_available)}
                      {r.on_order_qty ? ` · dipesan ${fmtQty(r.on_order_qty)}` : ""}
                    </span>
                  </span>
                ) : (
                  "-"
                ),
            },
            {
              key: "shortage_qty",
              label: "Kekurangan",
              align: "right",
              render: (r) => (r.shortage_qty > 0 ? <span className="font-semibold text-red-600">{fmtQty(r.shortage_qty)} {r.unit}</span> : <span className="text-green-700">-</span>),
            },
            {
              key: "supplier",
              label: "Supplier rekomendasi",
              render: (r) => (r.recommended_supplier_name ? <span className="text-xs">{r.recommended_supplier_name}{showMoney && r.recommended_price !== null ? ` · ${formatRupiah(r.recommended_price)}` : ""}</span> : <span className="text-xs text-charcoal-700/50">-</span>),
              hideMobile: true,
            },
            { key: "status", label: "Pengadaan", render: (r) => <StatusPill list={PROCUREMENT_STATUSES} value={r.procurement_status} /> },
          ]}
          actions={(r) => (
            <>
              <IconButton label="Edit" onClick={() => openReq(r)}>
                <Pencil className="h-4 w-4" />
              </IconButton>
              <IconButton label="Hapus" danger onClick={() => run(() => deleteRequirement(r.id), { confirm: `Hapus kebutuhan ${r.name}?` })}>
                <Trash2 className="h-4 w-4" />
              </IconButton>
            </>
          )}
          footer={showMoney && requirements.length ? <span className="flex justify-between"><span>Total estimasi material</span><span className="tabular-nums">{formatRupiah(rabTotal)}</span></span> : undefined}
        />
      </section>

      {/* Perencanaan pembelian */}
      {(bySupplier.length > 0 || inStock.length > 0) && (
        <section className="rounded-2xl bg-white p-5 ring-1 ring-red-100 sm:p-6">
          <h2 className="font-display text-lg font-semibold">Perencanaan pembelian</h2>
          {inStock.length > 0 && (
            <p className="mt-2 rounded-xl bg-[#17263C]/5 p-3 text-sm">
              {inStock.length} bahan sudah tersedia di gudang — klik <strong>Alokasikan stok</strong> di bawah agar stok disisihkan untuk proyek ini sebelum membeli.
            </p>
          )}
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {bySupplier.map(([sid, rows]) => {
              const total = rows.reduce((a, r) => a + r.shortage_qty * (r.recommended_price ?? r.est_unit_price), 0);
              const name = rows[0].recommended_supplier_name ?? "Belum ada supplier";
              return (
                <div key={sid || "none"} className="rounded-xl border border-charcoal-900/10 p-4">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="font-semibold">{name}</p>
                    {showMoney && <p className="text-sm font-semibold tabular-nums">± {formatRupiah(total)}</p>}
                  </div>
                  <ul className="mb-3 space-y-1 text-sm">
                    {rows.map((r) => (
                      <li key={r.id} className="flex justify-between gap-2">
                        <span>{r.name}</span>
                        <span className="tabular-nums text-red-600">
                          {fmtQty(r.shortage_qty)} {r.unit}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <Link href={`/admin/pembelian/new?project=${p.id}${sid ? `&supplier=${sid}` : ""}&req=${rows.map((r) => r.id).join(",")}`} className="btn-accent btn-sm">
                    <ShoppingCart className="h-4 w-4" /> Buat permintaan pembelian
                  </Link>
                </div>
              );
            })}
          </div>
          {!suppliers.length && <p className="mt-3 text-xs text-charcoal-700/70">Tambahkan supplier & harga di menu Bahan Baku agar sistem bisa merekomendasikan toko termurah.</p>}
        </section>
      )}

      {/* Alokasi */}
      <section className="rounded-2xl bg-white p-5 ring-1 ring-charcoal-900/5 sm:p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-lg font-semibold">Stok dialokasikan untuk proyek</h2>
            <p className="text-xs text-charcoal-700/70">Alokasi menyisihkan stok untuk proyek ini — stok fisik baru berkurang saat pemakaian dicatat.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn-outline btn-sm" onClick={() => setAlloc({ inventory_id: "", qty: "1", notes: "", itemFilter: "" })}>
              <PackagePlus className="h-4 w-4" /> Alokasikan stok
            </button>
            <button className="btn-primary btn-sm" onClick={() => setUse({ inventory_id: "", kind: "used", qty: "1", date: jakartaToday(), notes: "" })}>
              <PackageMinus className="h-4 w-4" /> Catat pemakaian
            </button>
          </div>
        </div>
        <DataTable
          rows={allocations}
          dense
          empty="Belum ada stok yang dialokasikan."
          columns={[
            { key: "item_name", label: "Barang", render: (a) => <span><span className="font-medium">{a.item_name}</span><span className="block text-xs text-charcoal-700/60">{a.stock_code}{a.notes ? ` · ${a.notes}` : ""}</span></span> },
            { key: "qty_allocated", label: "Dialokasikan", align: "right", render: (a) => `${fmtQty(a.qty_allocated)} ${a.unit}` },
            { key: "qty_consumed", label: "Terpakai", align: "right", render: (a) => fmtQty(a.qty_consumed) },
            { key: "qty_released", label: "Dilepas", align: "right", render: (a) => fmtQty(a.qty_released) },
            { key: "remaining", label: "Sisa alokasi", align: "right", render: (a) => <strong className={cn(a.remaining > 0 ? "text-[#17263C]" : "text-charcoal-700/50")}>{fmtQty(a.remaining)}</strong> },
          ]}
          actions={(a) =>
            a.remaining > 0 ? (
              <IconButton label="Lepas sisa alokasi" onClick={() => run(() => releaseAllocation({ id: a.id }), { confirm: `Lepas sisa ${fmtQty(a.remaining)} ${a.unit} ${a.item_name} kembali ke stok tersedia?` })}>
                <Undo2 className="h-4 w-4" />
              </IconButton>
            ) : null
          }
        />
      </section>

      {/* Pemakaian */}
      <section className="rounded-2xl bg-white p-5 ring-1 ring-charcoal-900/5 sm:p-6">
        <h2 className="mb-4 font-display text-lg font-semibold">Riwayat pemakaian material</h2>
        <DataTable
          rows={usage}
          dense
          empty="Belum ada pemakaian yang dicatat."
          columns={[
            { key: "usage_date", label: "Tanggal", render: (u) => formatDateShort(u.usage_date) },
            { key: "item_name", label: "Barang", render: (u) => <span><span className="font-medium">{u.item_name}</span><span className="block text-xs text-charcoal-700/60">{u.stock_code}{u.notes ? ` · ${u.notes}` : ""}</span></span> },
            { key: "kind", label: "Jenis", render: (u) => <StatusPill list={USAGE_KINDS} value={u.kind} /> },
            { key: "qty", label: "Jumlah", align: "right", render: (u) => `${u.kind === "returned" ? "−" : ""}${fmtQty(u.qty)} ${u.unit}` },
            ...(showMoney ? [{ key: "cost", label: "Nilai", align: "right" as const, render: (u: Usage) => formatRupiah((u.kind === "returned" ? -1 : 1) * u.qty * u.unit_cost) }] : []),
          ]}
          actions={(u) => (
            <IconButton label="Batalkan" danger onClick={() => run(() => deleteUsage(u.id), { confirm: "Batalkan catatan ini? Stok & alokasi akan dikembalikan." })}>
              <Trash2 className="h-4 w-4" />
            </IconButton>
          )}
        />
      </section>

      {/* Modal kebutuhan */}
      <AdminModal open={req !== null} onClose={() => setReq(null)} title={req?.id ? "Edit kebutuhan material" : "Tambah kebutuhan material"}>
        {req && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run(() => saveRequirement({ ...req, project_id: p.id, qty: req.qty.replace(",", ".") }), { onOk: () => setReq(null) });
            }}
            className="grid gap-4 sm:grid-cols-2"
          >
            <Field label="Bahan dari database" className="sm:col-span-2" hint="Pilih agar stok, alokasi & harga supplier bisa dilacak. Kosongkan untuk bahan non-stok.">
              <select
                className="input"
                value={req.material_item_id}
                onChange={(e) => {
                  const it = items.find((i) => i.id === e.target.value);
                  setReq({ ...req, material_item_id: e.target.value, name: it?.name ?? req.name, unit: it?.unit ?? req.unit, est_unit_price: it?.best_price ?? req.est_unit_price, spec_text: it ? specSummary(it.specs) : req.spec_text, preferred_supplier_id: it?.best_supplier_id ?? req.preferred_supplier_id });
                }}
              >
                <option value="">— Bahan lain (tidak dilacak stok) —</option>
                {items.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.category_name} — {i.name} · tersedia {fmtQty(i.qty_available)} {i.unit}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Nama bahan" required error={errors.name}>
              <input className="input" value={req.name} onChange={(e) => setReq({ ...req, name: e.target.value })} />
            </Field>
            <Field label="Spesifikasi">
              <input className="input" value={req.spec_text} onChange={(e) => setReq({ ...req, spec_text: e.target.value })} placeholder="warna, kode, ketebalan…" />
            </Field>
            <Field label="Jumlah kebutuhan" required error={errors.qty}>
              <QtyInput value={req.qty} onChange={(v) => setReq({ ...req, qty: v })} />
            </Field>
            <Field label="Satuan" required>
              <input className="input" value={req.unit} onChange={(e) => setReq({ ...req, unit: e.target.value })} />
            </Field>
            <Field label="Harga satuan estimasi">
              <MoneyInput value={req.est_unit_price} onChange={(n) => setReq({ ...req, est_unit_price: n })} />
            </Field>
            <Field label="Supplier pilihan">
              <select className="input" value={req.preferred_supplier_id} onChange={(e) => setReq({ ...req, preferred_supplier_id: e.target.value })}>
                <option value="">Otomatis (termurah)</option>
                {suppliers.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Catatan" className="sm:col-span-2">
              <input className="input" value={req.notes} onChange={(e) => setReq({ ...req, notes: e.target.value })} />
            </Field>
            <FormActions onCancel={() => setReq(null)} pending={pending} />
          </form>
        )}
      </AdminModal>

      {/* Modal template */}
      <AdminModal open={tpl !== null} onClose={() => setTpl(null)} title="Hitung kebutuhan dari template">
        {tpl && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run(() => applyTemplate({ project_id: p.id, template_id: tpl.template_id, mode: tpl.mode, specs: tpl.specs }), {
                onOk: (r) => {
                  const d = (r as { data?: { added: number; skipped: string[] } }).data;
                  toast(`${d?.added ?? 0} kebutuhan material dibuat${d?.skipped.length ? ` (${d.skipped.length} bernilai 0 dilewati)` : ""}`);
                  setTpl(null);
                },
                success: "Kebutuhan dihitung",
              });
            }}
            className="grid gap-4 sm:grid-cols-2"
          >
            <Field label="Template pekerjaan" required className="sm:col-span-2">
              <select
                className="input"
                value={tpl.template_id}
                onChange={(e) => {
                  setTpl({ ...tpl, template_id: e.target.value, preview: null });
                  runPreview(e.target.value, tpl.specs);
                }}
              >
                <option value="">— Pilih template —</option>
                {templates
                  .filter((t) => t.is_active)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.items.length} barang)
                    </option>
                  ))}
              </select>
            </Field>
            <SpecFields specs={tpl.specs} onChange={(specs) => setTpl({ ...tpl, specs, preview: null })} />
            <div className="sm:col-span-2">
              <button type="button" className="btn-outline btn-sm" disabled={!tpl.template_id} onClick={() => runPreview(tpl.template_id, tpl.specs)}>
                <Calculator className="h-4 w-4" /> Lihat hasil hitungan
              </button>
              {tpl.preview && (
                <ul className="mt-3 divide-y divide-charcoal-900/5 rounded-xl bg-cream-50 text-sm ring-1 ring-charcoal-900/5">
                  {tpl.preview.map((x) => (
                    <li key={x.name} className="flex justify-between gap-2 px-3 py-2">
                      <span>{x.name}</span>
                      {x.error ? <span className="text-xs text-red-600">{x.error}</span> : <strong className="tabular-nums">{fmtQty(x.qty)} {x.unit}</strong>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <Field label="Cara menyimpan" className="sm:col-span-2">
              <select className="input" value={tpl.mode} onChange={(e) => setTpl({ ...tpl, mode: e.target.value as "replace" | "append" })}>
                <option value="replace">Ganti hasil template sebelumnya (kebutuhan manual tetap)</option>
                <option value="append">Tambahkan ke daftar yang sudah ada</option>
              </select>
            </Field>
            <p className="text-xs text-charcoal-700/70 sm:col-span-2">Ukuran yang diisi juga disimpan ke data proyek. Formula template bisa diubah di menu Template Material.</p>
            <FormActions onCancel={() => setTpl(null)} pending={pending} label="Hitung & simpan" />
          </form>
        )}
      </AdminModal>

      {/* Modal alokasi */}
      <AdminModal open={alloc !== null} onClose={() => setAlloc(null)} title="Alokasikan stok ke proyek">
        {alloc && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run(() => allocateStock({ project_id: p.id, inventory_id: alloc.inventory_id, qty: alloc.qty.replace(",", "."), notes: alloc.notes }), { onOk: () => setAlloc(null) });
            }}
            className="grid gap-4 sm:grid-cols-2"
          >
            <Field label="Filter kebutuhan" className="sm:col-span-2">
              <select className="input" value={alloc.itemFilter} onChange={(e) => setAlloc({ ...alloc, itemFilter: e.target.value, inventory_id: "" })}>
                <option value="">Semua stok tersedia</option>
                {requirements
                  .filter((r) => r.material_item_id)
                  .map((r) => (
                    <option key={r.id} value={r.material_item_id!}>
                      {r.name} — butuh {fmtQty(r.still_needed)} {r.unit}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Lot stok" required className="sm:col-span-2" error={errors.inventory_id}>
              <select
                className="input"
                value={alloc.inventory_id}
                onChange={(e) => {
                  const l = lots.find((x) => x.id === e.target.value);
                  const r = requirements.find((x) => x.material_item_id === l?.material_item_id);
                  const qty = l ? Math.min(l.qty_available, r?.still_needed || l.qty_available) : 1;
                  setAlloc({ ...alloc, inventory_id: e.target.value, qty: String(qty || 1) });
                }}
              >
                <option value="">— Pilih lot —</option>
                {availableLots
                  .filter((l) => !alloc.itemFilter || l.material_item_id === alloc.itemFilter)
                  .map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.item_name} · {l.stock_code} · tersedia {fmtQty(l.qty_available)} {l.unit}
                      {specSummary(l.specs) ? ` · ${specSummary(l.specs)}` : ""}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Jumlah dialokasikan" required error={errors.qty}>
              <QtyInput value={alloc.qty} onChange={(v) => setAlloc({ ...alloc, qty: v })} />
            </Field>
            <Field label="Catatan">
              <input className="input" value={alloc.notes} onChange={(e) => setAlloc({ ...alloc, notes: e.target.value })} />
            </Field>
            <FormActions onCancel={() => setAlloc(null)} pending={pending} label="Alokasikan" />
          </form>
        )}
      </AdminModal>

      {/* Modal pemakaian */}
      <AdminModal open={use !== null} onClose={() => setUse(null)} title="Catat pemakaian material">
        {use && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run(() => recordUsage({ project_id: p.id, inventory_id: use.inventory_id, kind: use.kind, qty: use.qty.replace(",", "."), date: use.date, notes: use.notes }), { onOk: () => setUse(null) });
            }}
            className="grid gap-4 sm:grid-cols-2"
          >
            <Field label="Jenis" required className="sm:col-span-2">
              <div className="grid gap-2 sm:grid-cols-3">
                {USAGE_KINDS.map((k) => (
                  <label key={k.value} className={cn("flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-sm", use.kind === k.value ? "border-[#17263C] bg-[#17263C]/5" : "border-charcoal-900/10")}>
                    <input type="radio" checked={use.kind === k.value} onChange={() => setUse({ ...use, kind: k.value, inventory_id: "" })} className="accent-[#17263C]" />
                    {k.label}
                  </label>
                ))}
              </div>
            </Field>
            <Field label="Lot stok" required className="sm:col-span-2">
              <select className="input" value={use.inventory_id} onChange={(e) => setUse({ ...use, inventory_id: e.target.value })}>
                <option value="">— Pilih lot —</option>
                {(use.kind === "returned" ? usedLots : projectLots).map((l) => {
                  const a = allocations.filter((x) => x.inventory_id === l.id).reduce((s, x) => s + x.remaining, 0);
                  return (
                    <option key={l.id} value={l.id}>
                      {l.item_name} · {l.stock_code} · {a > 0 ? `alokasi proyek ${fmtQty(a)}` : `tersedia ${fmtQty(l.qty_available)}`} {l.unit}
                    </option>
                  );
                })}
              </select>
            </Field>
            <Field label="Jumlah" required error={errors.qty}>
              <QtyInput value={use.qty} onChange={(v) => setUse({ ...use, qty: v })} />
            </Field>
            <Field label="Tanggal" required>
              <input type="date" min="1900-01-01" max="2100-12-31" className="input" value={use.date} onChange={(e) => setUse({ ...use, date: e.target.value })} />
            </Field>
            <Field label="Catatan" className="sm:col-span-2">
              <input className="input" value={use.notes} onChange={(e) => setUse({ ...use, notes: e.target.value })} placeholder={use.kind === "damaged" ? "Penyebab rusak / terbuang" : ""} />
            </Field>
            <p className="text-xs text-charcoal-700/70 sm:col-span-2">
              Pemakaian diambil dari alokasi proyek lebih dulu, lalu dari stok tersedia. &quot;Sisa kembali ke stok&quot; untuk bahan sisa proyek yang masih bisa dipakai ulang.
            </p>
            <FormActions onCancel={() => setUse(null)} pending={pending} label="Catat" />
          </form>
        )}
      </AdminModal>
    </div>
  );
}
