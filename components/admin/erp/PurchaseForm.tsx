"use client";
import { ArrowLeft, Ban, MessageCircle, PackageCheck, Plus, Save, Send, Trash2, Wallet } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { addPurchasePayment, deletePurchaseOrder, deletePurchasePayment, receivePurchaseOrder, savePurchaseOrder, setPurchaseStatus } from "@/app/admin/erp/inventory-actions";
import { AdminModal } from "@/components/admin/AdminModal";
import { PO_STATUSES, fmtQty, round2, specSummary } from "@/lib/erp/constants";
import type { MaterialItem, Option, PurchaseOrder, SupplierProduct } from "@/lib/erp/types";
import { formatRupiah } from "@/lib/format";
import { formatDateShort, jakartaToday } from "@/lib/orders";
import { cn } from "@/lib/utils";
import { whatsappLink } from "@/lib/whatsapp";
import { Field, FormActions, IconButton, MoneyInput, QtyInput, StatusPill, useAction } from "./kit";

export interface PoLine {
  key: string;
  material_item_id: string;
  description: string;
  qty: string;
  unit: string;
  unit_price: number;
  project_id: string;
}
export interface PoFormValues {
  id: string | null;
  supplier_id: string;
  project_id: string;
  order_date: string;
  invoice_number: string;
  status: "draft" | "ordered";
  expected_date: string;
  due_date: string;
  discount: number;
  shipping_cost: number;
  notes: string;
  items: PoLine[];
}
interface Payment {
  id: string;
  paid_at: string;
  amount: number;
  account_name: string;
  reference: string | null;
}

let seq = 0;
export const lineKey = () => `l${Date.now().toString(36)}${(seq++).toString(36)}`;

export function PurchaseForm({
  initial,
  po,
  suppliers,
  items,
  products,
  projects,
  payments = [],
  accounts = [],
  isOwner,
}: {
  initial: PoFormValues;
  po: PurchaseOrder | null;
  suppliers: Option[];
  items: MaterialItem[];
  products: SupplierProduct[];
  projects: Option[];
  payments?: Payment[];
  accounts?: Option[];
  isOwner: boolean;
}) {
  const router = useRouter();
  const [v, setV] = useState<PoFormValues>(initial);
  const [receive, setReceive] = useState<{ date: string; location: string } | null>(null);
  const [pay, setPay] = useState<{ paid_at: string; amount: number; account_id: string; reference: string; note: string } | null>(null);
  const { run, pending, errors } = useAction();
  const locked = po?.status === "received" || po?.status === "cancelled";

  const priceOf = (itemId: string, supplierId = v.supplier_id) => products.find((p) => p.material_item_id === itemId && p.supplier_id === supplierId && p.is_active);
  const supplierItemIds = useMemo(() => new Set(products.filter((p) => p.supplier_id === v.supplier_id).map((p) => p.material_item_id)), [products, v.supplier_id]);
  const sortedItems = useMemo(
    () => [...items].sort((a, b) => Number(supplierItemIds.has(b.id)) - Number(supplierItemIds.has(a.id)) || a.category_name.localeCompare(b.category_name) || a.name.localeCompare(b.name)),
    [items, supplierItemIds],
  );

  const subtotal = v.items.reduce((a, i) => a + round2((Number(i.qty.replace(",", ".")) || 0) * i.unit_price), 0);
  const total = Math.max(subtotal - v.discount + v.shipping_cost, 0);
  const paid = po?.paid_amount ?? 0;

  const setLine = (key: string, patch: Partial<PoLine>) => setV((s) => ({ ...s, items: s.items.map((i) => (i.key === key ? { ...i, ...patch } : i)) }));
  const addLine = () => setV((s) => ({ ...s, items: [...s.items, { key: lineKey(), material_item_id: "", description: "", qty: "1", unit: "pcs", unit_price: 0, project_id: "" }] }));
  const changeSupplier = (sid: string) =>
    setV((s) => ({
      ...s,
      supplier_id: sid,
      // Harga mengikuti daftar harga supplier baru bila tersedia.
      items: s.items.map((i) => {
        const p = products.find((x) => x.material_item_id === i.material_item_id && x.supplier_id === sid && x.is_active);
        return p ? { ...i, unit_price: p.price, unit: p.unit || i.unit } : i;
      }),
    }));

  const submit = (status?: "draft" | "ordered") => {
    const payload = { ...v, status: status ?? v.status, items: v.items.map((i) => ({ ...i, qty: i.qty.replace(",", ".") })) };
    run(() => savePurchaseOrder(payload), {
      success: status === "ordered" ? "PO disimpan sebagai Dipesan" : "PO disimpan",
      onOk: (r) => {
        if (!v.id && "data" in r && r.data) router.push(`/admin/pembelian/${r.data}`);
      },
    });
  };

  const supplier = suppliers.find((s) => s.value === v.supplier_id);
  const supplierWa = po?.supplier_whatsapp;
  const waText = () => {
    const lines = v.items
      .map((i, n) => {
        const it = items.find((x) => x.id === i.material_item_id);
        return `${n + 1}. ${it?.name ?? "-"}${i.description ? ` (${i.description})` : ""} — ${i.qty} ${i.unit}`;
      })
      .join("\n");
    return `Halo ${supplier?.label ?? ""}, kami dari Mandiri Furniture ingin memesan (${po?.po_number ?? "PO"}):\n${lines}\n\nMohon info ketersediaan & total harganya. Terima kasih.`;
  };
  const err = (k: string) => errors[k];

  return (
    <div className="pb-24 lg:pb-0">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/admin/pembelian" className="mb-2 inline-flex items-center gap-1.5 text-sm text-charcoal-700 hover:text-charcoal-900">
            <ArrowLeft className="h-4 w-4" /> Semua pembelian
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold sm:text-3xl">{po ? po.po_number : "Pembelian baru"}</h1>
            {po && <StatusPill list={PO_STATUSES} value={po.status} />}
          </div>
          {po?.received_at && <p className="mt-1 text-sm text-charcoal-700">Diterima {formatDateShort(po.received_at)} — barang sudah masuk stok.</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {po && supplierWa && (
            <a href={whatsappLink(supplierWa, waText())} target="_blank" rel="noopener noreferrer" className="btn-outline btn-sm bg-white !py-2.5">
              <MessageCircle className="h-4 w-4" /> Kirim ke supplier
            </a>
          )}
          {po && !locked && (
            <button type="button" className="btn-accent btn-sm !py-2.5" onClick={() => setReceive({ date: jakartaToday(), location: "" })}>
              <PackageCheck className="h-4 w-4" /> Terima barang
            </button>
          )}
          {po && !locked && (
            <button type="button" className="btn btn-sm border border-red-200 bg-white !py-2.5 text-red-600 hover:bg-red-50" onClick={() => run(() => setPurchaseStatus(po.id, "cancelled"), { confirm: "Batalkan PO ini?", success: "PO dibatalkan" })}>
              <Ban className="h-4 w-4" /> Batalkan
            </button>
          )}
          {po && po.status !== "received" && paid === 0 && (
            <button
              type="button"
              className="btn btn-sm border border-red-200 bg-white !py-2.5 text-red-600 hover:bg-red-50"
              onClick={() => run(() => deletePurchaseOrder(po.id), { confirm: `Hapus ${po.po_number}?`, onOk: () => router.push("/admin/pembelian"), refresh: false })}
            >
              <Trash2 className="h-4 w-4" /> Hapus
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <section className="grid gap-4 rounded-2xl bg-white p-5 ring-1 ring-charcoal-900/5 sm:grid-cols-2 sm:p-6">
            <Field label="Supplier" required error={err("supplier_id")}>
              <select className="input" value={v.supplier_id} disabled={locked} onChange={(e) => changeSupplier(e.target.value)}>
                <option value="">— Pilih supplier —</option>
                {suppliers.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Untuk proyek (opsional)" hint="Barang otomatis dialokasikan ke proyek saat diterima.">
              <select className="input" value={v.project_id} disabled={locked} onChange={(e) => setV({ ...v, project_id: e.target.value })}>
                <option value="">Stok umum (tidak untuk proyek tertentu)</option>
                {projects.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label} — {p.sub}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Tanggal pembelian" required error={err("order_date")}>
              <input type="date" className="input" value={v.order_date} disabled={locked} onChange={(e) => setV({ ...v, order_date: e.target.value })} />
            </Field>
            <Field label="Nomor nota supplier" error={err("invoice_number")}>
              <input className="input" value={v.invoice_number} disabled={po?.status === "cancelled"} onChange={(e) => setV({ ...v, invoice_number: e.target.value })} />
            </Field>
            <Field label="Perkiraan barang datang">
              <input type="date" className="input" value={v.expected_date} disabled={locked} onChange={(e) => setV({ ...v, expected_date: e.target.value })} />
            </Field>
            <Field label="Jatuh tempo pembayaran" error={err("due_date")}>
              <input type="date" className="input" value={v.due_date} disabled={po?.status === "cancelled"} onChange={(e) => setV({ ...v, due_date: e.target.value })} />
            </Field>
          </section>

          <section className="rounded-2xl bg-white p-5 ring-1 ring-charcoal-900/5 sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">Barang dibeli</h2>
              {!locked && (
                <button type="button" onClick={addLine} className="btn-outline btn-sm">
                  <Plus className="h-4 w-4" /> Barang
                </button>
              )}
            </div>
            {err("items") && <p className="mb-3 text-sm text-red-600">{err("items")}</p>}
            <div className="space-y-3">
              {v.items.map((line, idx) => {
                const it = items.find((x) => x.id === line.material_item_id);
                const sp = line.material_item_id ? priceOf(line.material_item_id) : undefined;
                return (
                  <div key={line.key} className="rounded-xl border border-charcoal-900/10 p-3">
                    <div className="grid gap-3 sm:grid-cols-12">
                      <div className="sm:col-span-6">
                        <label className="label !text-xs">Barang #{idx + 1}</label>
                        <select
                          className="input"
                          value={line.material_item_id}
                          disabled={locked}
                          onChange={(e) => {
                            const m = items.find((x) => x.id === e.target.value);
                            const p = priceOf(e.target.value);
                            setLine(line.key, { material_item_id: e.target.value, unit: p?.unit || m?.unit || line.unit, unit_price: p?.price ?? m?.best_price ?? line.unit_price });
                          }}
                        >
                          <option value="">— Pilih barang —</option>
                          {sortedItems.map((m) => (
                            <option key={m.id} value={m.id}>
                              {supplierItemIds.has(m.id) ? "★ " : ""}
                              {m.name}
                              {m.brand ? ` (${m.brand})` : ""} — {m.category_name}
                            </option>
                          ))}
                        </select>
                        {it && (
                          <p className="mt-1 text-xs text-charcoal-700/70">
                            {specSummary(it.specs) || "Tanpa spesifikasi"} · stok tersedia {fmtQty(it.qty_available)} {it.unit}
                            {sp ? ` · harga toko ini ${formatRupiah(sp.price)}` : it.best_price ? ` · termurah ${formatRupiah(it.best_price)} (${it.best_supplier_name})` : ""}
                          </p>
                        )}
                        {err(`items.${idx}.material_item_id`) && <p className="mt-1 text-xs text-red-600">{err(`items.${idx}.material_item_id`)}</p>}
                      </div>
                      <div className="sm:col-span-2">
                        <label className="label !text-xs">Jumlah</label>
                        <QtyInput value={line.qty} disabled={locked} onChange={(q) => setLine(line.key, { qty: q })} />
                      </div>
                      <div className="sm:col-span-1">
                        <label className="label !text-xs">Satuan</label>
                        <input className="input !px-2" value={line.unit} disabled={locked} onChange={(e) => setLine(line.key, { unit: e.target.value })} />
                      </div>
                      <div className="sm:col-span-3">
                        <label className="label !text-xs">Harga satuan</label>
                        <MoneyInput value={line.unit_price} disabled={locked} onChange={(n) => setLine(line.key, { unit_price: n })} />
                      </div>
                      <div className="sm:col-span-6">
                        <input className="input !py-2 text-sm" placeholder="Keterangan / warna / kode (opsional)" value={line.description} disabled={locked} onChange={(e) => setLine(line.key, { description: e.target.value })} />
                      </div>
                      <div className="sm:col-span-4">
                        <select className="input !py-2 text-sm" value={line.project_id} disabled={locked} onChange={(e) => setLine(line.key, { project_id: e.target.value })} aria-label="Proyek tujuan barang">
                          <option value="">{v.project_id ? "Ikuti proyek PO" : "Stok umum"}</option>
                          {projects.map((p) => (
                            <option key={p.value} value={p.value}>
                              {p.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex items-center justify-between gap-2 sm:col-span-2 sm:justify-end">
                        <span className="font-semibold tabular-nums">{formatRupiah((Number(line.qty.replace(",", ".")) || 0) * line.unit_price)}</span>
                        {!locked && v.items.length > 1 && (
                          <IconButton label="Hapus baris" danger onClick={() => setV((s) => ({ ...s, items: s.items.filter((x) => x.key !== line.key) }))}>
                            <Trash2 className="h-4 w-4" />
                          </IconButton>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-xs text-charcoal-700/70">★ = barang terdaftar di supplier ini (harga otomatis dari daftar harga supplier).</p>
          </section>

          <Field label="Catatan">
            <textarea className="input" rows={2} value={v.notes} disabled={po?.status === "cancelled"} onChange={(e) => setV({ ...v, notes: e.target.value })} />
          </Field>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <section className="rounded-2xl bg-white p-5 ring-1 ring-charcoal-900/5">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt>Subtotal</dt>
                <dd className="tabular-nums">{formatRupiah(subtotal)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt>Diskon</dt>
                <dd className="w-40">
                  <MoneyInput value={v.discount} disabled={locked} onChange={(n) => setV({ ...v, discount: n })} className="!py-1.5" invalid={!!err("discount")} />
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt>Ongkos kirim</dt>
                <dd className="w-40">
                  <MoneyInput value={v.shipping_cost} disabled={locked} onChange={(n) => setV({ ...v, shipping_cost: n })} className="!py-1.5" />
                </dd>
              </div>
              <div className="flex justify-between border-t border-charcoal-900/10 pt-2 text-base font-bold">
                <dt>Total</dt>
                <dd className="tabular-nums">{formatRupiah(total)}</dd>
              </div>
              {po && (
                <>
                  <div className="flex justify-between text-green-700">
                    <dt>Sudah dibayar</dt>
                    <dd className="tabular-nums">{formatRupiah(paid)}</dd>
                  </div>
                  <div className={cn("flex justify-between font-semibold", po.total - paid > 0 ? "text-red-600" : "text-green-700")}>
                    <dt>Utang ke supplier</dt>
                    <dd className="tabular-nums">{formatRupiah(Math.max(po.total - paid, 0))}</dd>
                  </div>
                </>
              )}
            </dl>
            {(v.discount > 0 || v.shipping_cost > 0) && <p className="mt-3 text-xs text-charcoal-700/70">Diskon & ongkir dibagi proporsional ke harga pokok tiap barang saat diterima.</p>}
            {po?.status !== "cancelled" && (
              <div className="mt-4 grid gap-2">
                {!locked && (
                  <button type="button" className="btn-primary w-full" disabled={pending} onClick={() => submit("ordered")}>
                    <Send className="h-4 w-4" /> {v.status === "ordered" ? "Simpan PO" : "Simpan & tandai dipesan"}
                  </button>
                )}
                {!locked && v.status === "draft" && (
                  <button type="button" className="btn-outline w-full" disabled={pending} onClick={() => submit("draft")}>
                    <Save className="h-4 w-4" /> Simpan draft
                  </button>
                )}
                {locked && (
                  <button type="button" className="btn-outline w-full" disabled={pending} onClick={() => submit()}>
                    <Save className="h-4 w-4" /> Simpan nota & catatan
                  </button>
                )}
              </div>
            )}
          </section>

          {po && po.status !== "draft" && po.status !== "cancelled" && (
            <section className="rounded-2xl bg-white p-5 ring-1 ring-charcoal-900/5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-display font-semibold">Pembayaran supplier</h2>
                {isOwner && po.total - paid > 0 && (
                  <button className="btn-outline btn-sm" onClick={() => setPay({ paid_at: jakartaToday(), amount: Math.max(po.total - paid, 0), account_id: accounts[0]?.value ?? "", reference: "", note: "" })}>
                    <Wallet className="h-4 w-4" /> Bayar
                  </button>
                )}
              </div>
              {!isOwner && <p className="text-xs text-charcoal-700/70">Pencatatan pembayaran hanya untuk admin utama.</p>}
              <ul className="divide-y divide-charcoal-900/5 text-sm">
                {payments.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 py-2">
                    <span>
                      {formatDateShort(p.paid_at)} · {p.account_name}
                      {p.reference && <span className="block text-xs text-charcoal-700/60">{p.reference}</span>}
                    </span>
                    <span className="flex items-center gap-1 tabular-nums">
                      {formatRupiah(p.amount)}
                      {isOwner && (
                        <IconButton label="Hapus pembayaran" danger onClick={() => run(() => deletePurchasePayment(p.id), { confirm: "Hapus pembayaran ini? Kas akan dikembalikan." })}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </IconButton>
                      )}
                    </span>
                  </li>
                ))}
                {!payments.length && <li className="py-2 text-charcoal-700/60">Belum ada pembayaran.</li>}
              </ul>
            </section>
          )}
        </aside>
      </div>

      <AdminModal open={receive !== null} onClose={() => setReceive(null)} title="Terima barang">
        {receive && po && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run(() => receivePurchaseOrder({ id: po.id, date: receive.date, location: receive.location }), {
                success: "Barang diterima dan masuk stok",
                onOk: () => setReceive(null),
              });
            }}
            className="grid gap-4 sm:grid-cols-2"
          >
            <p className="rounded-xl bg-cream-100 p-3 text-sm sm:col-span-2">
              Semua barang di PO ini akan dicatat sebagai stok masuk (satu lot per barang). Barang untuk proyek otomatis dialokasikan ke proyeknya. Simpan perubahan PO dulu bila ada yang diubah.
            </p>
            <Field label="Tanggal diterima" required>
              <input type="date" className="input" value={receive.date} onChange={(e) => setReceive({ ...receive, date: e.target.value })} />
            </Field>
            <Field label="Lokasi penyimpanan">
              <input className="input" value={receive.location} onChange={(e) => setReceive({ ...receive, location: e.target.value })} placeholder="mis. Gudang A / Rak 2" />
            </Field>
            <FormActions onCancel={() => setReceive(null)} pending={pending} label="Terima & masukkan stok" />
          </form>
        )}
      </AdminModal>

      <AdminModal open={pay !== null} onClose={() => setPay(null)} title="Bayar supplier">
        {pay && po && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run(() => addPurchasePayment({ ...pay, purchase_order_id: po.id }), { onOk: () => setPay(null) });
            }}
            className="grid gap-4 sm:grid-cols-2"
          >
            <Field label="Tanggal bayar" required error={err("paid_at")}>
              <input type="date" className="input" value={pay.paid_at} onChange={(e) => setPay({ ...pay, paid_at: e.target.value })} />
            </Field>
            <Field label="Jumlah" required error={err("amount")}>
              <MoneyInput value={pay.amount} onChange={(n) => setPay({ ...pay, amount: n })} />
            </Field>
            <Field label="Dibayar dari akun" required error={err("account_id")}>
              <select className="input" value={pay.account_id} onChange={(e) => setPay({ ...pay, account_id: e.target.value })}>
                <option value="">— Pilih akun —</option>
                {accounts.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="No. referensi / bukti">
              <input className="input" value={pay.reference} onChange={(e) => setPay({ ...pay, reference: e.target.value })} />
            </Field>
            <p className="text-xs text-charcoal-700/70 sm:col-span-2">Pembayaran otomatis tercatat sebagai kas keluar (pembelian material) di buku kas.</p>
            <FormActions onCancel={() => setPay(null)} pending={pending} label="Catat pembayaran" />
          </form>
        )}
      </AdminModal>
    </div>
  );
}
