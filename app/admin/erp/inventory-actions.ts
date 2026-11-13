"use server";

import { z } from "zod";
import { check, run, zDate, zId, zMoney, zOptDate, zOptId, zOptText, zPositive } from "@/lib/erp/server";

const PATHS = ["/admin/pembelian", "/admin/stok", "/admin/bahan", "/admin/proyek", "/admin/keuangan", "/admin"];

// ---------------------------------------------------------------------------
// PURCHASE ORDER
// ---------------------------------------------------------------------------
const poItem = z.object({
  material_item_id: z.string({ message: "Pilih barang" }).uuid("Pilih barang"),
  description: zOptText(300),
  qty: zPositive("Jumlah"),
  unit: z.string().trim().min(1, "Satuan wajib").max(20),
  unit_price: zMoney("Harga satuan"),
  project_id: zOptId,
});

const poSchema = z
  .object({
    id: z.string().uuid().optional().nullable(),
    supplier_id: z.string({ message: "Pilih supplier" }).uuid("Pilih supplier"),
    project_id: zOptId,
    order_date: zDate,
    invoice_number: zOptText(60),
    status: z.enum(["draft", "ordered"]),
    expected_date: zOptDate,
    due_date: zOptDate,
    discount: zMoney("Diskon"),
    shipping_cost: zMoney("Ongkos kirim"),
    notes: zOptText(1000),
    items: z.array(poItem).min(1, "Tambahkan minimal 1 barang").max(200),
  })
  .superRefine((p, ctx) => {
    const sub = p.items.reduce((a, i) => a + Math.round(i.qty * i.unit_price * 100) / 100, 0);
    if (p.discount > sub + p.shipping_cost) ctx.addIssue({ code: "custom", path: ["discount"], message: "Diskon melebihi nilai PO" });
  });

export async function savePurchaseOrder(input: unknown) {
  return run({ schema: poSchema, input, revalidate: PATHS, message: "PO disimpan" }, async (sb, data) => {
    const { data: id, error } = await sb.rpc("save_purchase_order", { p: data });
    if (error) throw new Error(error.message);
    return id as string;
  });
}

/** Simpan PO baru dari halaman proyek — PO berstatus draft untuk dicek dulu. */
export async function createPoFromProject(input: unknown) {
  return savePurchaseOrder(input);
}

export async function receivePurchaseOrder(input: unknown) {
  const schema = z.object({ id: zId, date: zDate, location: zOptText(120) });
  return run({ schema, input, revalidate: PATHS }, async (sb, d) => {
    const { data, error } = await sb.rpc("receive_purchase_order", { p_po: d.id, p_date: d.date, p_location: d.location });
    if (error) throw new Error(error.message);
    return data as number;
  });
}

export async function setPurchaseStatus(id: string, status: "ordered" | "cancelled" | "draft") {
  return run({ schema: z.object({ id: zId, status: z.enum(["ordered", "cancelled", "draft"]) }), input: { id, status }, revalidate: PATHS }, async (sb, d) => {
    const { data: po } = await sb.from("purchase_orders").select("status").eq("id", d.id).maybeSingle();
    if (!po) throw new Error("PO tidak ditemukan");
    if (po.status === "received") throw new Error("PO sudah diterima. Gunakan retur ke supplier di menu Stok.");
    check(await sb.from("purchase_orders").update({ status: d.status }).eq("id", d.id));
  });
}

export async function deletePurchaseOrder(id: string) {
  return run({ schema: zId, input: id, revalidate: PATHS, message: "PO dihapus" }, async (sb, pid) => {
    const { data: po } = await sb.from("purchase_orders").select("status, paid_amount").eq("id", pid).maybeSingle();
    if (!po) throw new Error("PO tidak ditemukan");
    if (po.status === "received") throw new Error("PO yang sudah diterima tidak bisa dihapus");
    if (Number(po.paid_amount) > 0) throw new Error("PO sudah ada pembayaran. Hapus pembayaran dulu.");
    check(await sb.from("purchase_orders").delete().eq("id", pid));
  });
}

const paySchema = z.object({
  purchase_order_id: zId,
  paid_at: zDate,
  amount: zPositive("Jumlah bayar", 100_000_000_000),
  account_id: z.string({ message: "Pilih akun kas" }).uuid("Pilih akun kas"),
  reference: zOptText(100),
  note: zOptText(300),
});

export async function addPurchasePayment(input: unknown) {
  return run({ owner: true, schema: paySchema, input, revalidate: PATHS, message: "Pembayaran supplier dicatat" }, async (sb, d) => {
    check(await sb.from("purchase_payments").insert(d));
  });
}

export async function deletePurchasePayment(id: string) {
  return run({ owner: true, schema: zId, input: id, revalidate: PATHS, message: "Pembayaran dihapus" }, async (sb, pid) => {
    check(await sb.from("purchase_payments").delete().eq("id", pid));
  });
}

// ---------------------------------------------------------------------------
// STOK
// ---------------------------------------------------------------------------
const stockSchema = z.object({
  material_item_id: z.string({ message: "Pilih barang" }).uuid("Pilih barang"),
  supplier_id: zOptId,
  invoice_number: zOptText(60),
  purchase_date: zDate,
  qty_in: zPositive("Jumlah masuk"),
  unit: z.string().trim().min(1).max(20),
  unit_cost: zMoney("Harga beli per satuan"),
  location: zOptText(120),
  specs: z.record(z.string(), z.string().max(120)).default({}),
  photo_url: zOptText(2000),
  notes: zOptText(500),
});

export async function addStock(input: unknown) {
  return run({ schema: stockSchema, input, revalidate: PATHS, message: "Stok masuk dicatat" }, async (sb, d) => {
    const specs = Object.fromEntries(Object.entries(d.specs).filter(([, v]) => v.trim()));
    const { error } = await sb.rpc("add_stock", { p: { ...d, specs } });
    if (error) throw new Error(error.message);
  });
}

const adjustSchema = z.object({
  inventory_id: zId,
  type: z.enum(["adjustment_plus", "adjustment_minus", "damaged", "return_supplier"]),
  qty: zPositive("Jumlah"),
  reason: z.string().trim().min(3, "Alasan wajib diisi").max(300),
  date: zDate,
});

export async function adjustStock(input: unknown) {
  return run({ schema: adjustSchema, input, revalidate: PATHS, message: "Perubahan stok dicatat" }, async (sb, d) => {
    const { error } = await sb.rpc("stock_adjust", { p_inventory: d.inventory_id, p_type: d.type, p_qty: d.qty, p_reason: d.reason, p_date: d.date });
    if (error) throw new Error(error.message);
  });
}

export async function deleteAdjustment(movementId: string) {
  return run({ schema: zId, input: movementId, revalidate: PATHS, message: "Penyesuaian dibatalkan" }, async (sb, id) => {
    const { error } = await sb.rpc("delete_adjustment", { p_movement: id });
    if (error) throw new Error(error.message);
  });
}

const lotInfo = z.object({ id: zId, location: zOptText(120), notes: zOptText(500), photo_url: zOptText(2000) });
export async function updateLotInfo(input: unknown) {
  return run({ schema: lotInfo, input, revalidate: ["/admin/stok"], message: "Info stok diperbarui" }, async (sb, { id, ...d }) => {
    check(await sb.from("inventory").update(d).eq("id", id));
  });
}

// ---------------------------------------------------------------------------
// ALOKASI & PEMAKAIAN PROYEK
// ---------------------------------------------------------------------------
const allocSchema = z.object({ project_id: zId, inventory_id: zId, qty: zPositive("Jumlah"), notes: zOptText(300) });
export async function allocateStock(input: unknown) {
  return run({ schema: allocSchema, input, revalidate: PATHS, message: "Stok dialokasikan ke proyek" }, async (sb, d) => {
    const { error } = await sb.rpc("allocate_stock", { p_project: d.project_id, p_inventory: d.inventory_id, p_qty: d.qty, p_notes: d.notes });
    if (error) throw new Error(error.message);
  });
}

export async function releaseAllocation(input: unknown) {
  const schema = z.object({ id: zId, qty: z.coerce.number().positive().optional().nullable() });
  return run({ schema, input, revalidate: PATHS, message: "Alokasi dilepas, stok kembali tersedia" }, async (sb, d) => {
    const { error } = await sb.rpc("release_allocation", { p_allocation: d.id, p_qty: d.qty ?? null });
    if (error) throw new Error(error.message);
  });
}

const usageSchema = z.object({
  project_id: zId,
  inventory_id: zId,
  kind: z.enum(["used", "damaged", "returned"]),
  qty: zPositive("Jumlah"),
  date: zDate,
  notes: zOptText(300),
});
export async function recordUsage(input: unknown) {
  return run({ schema: usageSchema, input, revalidate: PATHS, message: "Pemakaian material dicatat" }, async (sb, d) => {
    const { error } = await sb.rpc("record_usage", { p_project: d.project_id, p_inventory: d.inventory_id, p_kind: d.kind, p_qty: d.qty, p_date: d.date, p_notes: d.notes });
    if (error) throw new Error(error.message);
  });
}

export async function deleteUsage(id: string) {
  return run({ schema: zId, input: id, revalidate: PATHS, message: "Catatan pemakaian dibatalkan, stok dikembalikan" }, async (sb, uid) => {
    const { error } = await sb.rpc("delete_usage", { p_usage: uid });
    if (error) throw new Error(error.message);
  });
}
