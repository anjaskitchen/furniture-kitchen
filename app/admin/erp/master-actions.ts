"use server";

import { z } from "zod";
import { check, run, zId, zMoney, zOptText, zText } from "@/lib/erp/server";
import { numifyAll } from "@/lib/erp/server";

const SUP_PATHS = ["/admin/suppliers", "/admin/bahan"];

// ---------------------------------------------------------------------------
// SUPPLIER
// ---------------------------------------------------------------------------
const supplierSchema = z.object({
  id: z.string().uuid().optional().nullable(),
  name: zText("Nama toko", 2, 160),
  contact_person: zOptText(120),
  address: zOptText(500),
  whatsapp: z
    .string()
    .trim()
    .max(30)
    .optional()
    .nullable()
    .refine((v) => !v || /^[+\d\s()-]{8,}$/.test(v), "Nomor WhatsApp tidak valid")
    .transform((v) => v || null),
  category: zOptText(80),
  notes: zOptText(1000),
  is_active: z.boolean().default(true),
});

export async function saveSupplier(input: unknown) {
  return run({ schema: supplierSchema, input, revalidate: SUP_PATHS, message: "Supplier disimpan" }, async (sb, { id, ...data }) => {
    if (id) check(await sb.from("suppliers").update(data).eq("id", id));
    else check(await sb.from("suppliers").insert(data));
  });
}

/** Hapus supplier. Jika sudah punya transaksi (PO/stok), supplier dinonaktifkan & diarsipkan agar riwayat aman. */
export async function deleteSupplier(id: string) {
  return run({ schema: zId, input: id, revalidate: SUP_PATHS }, async (sb, sid) => {
    const [po, inv] = await Promise.all([
      sb.from("purchase_orders").select("id", { count: "exact", head: true }).eq("supplier_id", sid),
      sb.from("inventory").select("id", { count: "exact", head: true }).eq("supplier_id", sid),
    ]);
    if ((po.count ?? 0) + (inv.count ?? 0) > 0) {
      check(await sb.from("suppliers").update({ is_active: false, deleted_at: new Date().toISOString() }).eq("id", sid));
      return "archived";
    }
    check(await sb.from("suppliers").delete().eq("id", sid));
    return "deleted";
  });
}

const productSchema = z.object({
  id: z.string().uuid().optional().nullable(),
  supplier_id: zId,
  material_item_id: z.string({ message: "Pilih bahan baku" }).uuid("Pilih bahan baku"),
  price: zMoney("Harga"),
  unit: zOptText(20),
  supplier_sku: zOptText(60),
  notes: zOptText(300),
  is_active: z.boolean().default(true),
});

export async function saveSupplierProduct(input: unknown) {
  return run({ schema: productSchema, input, revalidate: SUP_PATHS, message: "Harga barang disimpan" }, async (sb, { id, ...data }) => {
    if (id) check(await sb.from("supplier_products").update(data).eq("id", id));
    else check(await sb.from("supplier_products").insert(data));
  });
}

export async function deleteSupplierProduct(id: string) {
  return run({ schema: zId, input: id, revalidate: SUP_PATHS, message: "Barang dihapus dari supplier" }, async (sb, pid) => {
    check(await sb.from("supplier_products").delete().eq("id", pid));
  });
}

export async function getPriceHistory(materialItemId: string) {
  return run({ schema: zId, input: materialItemId }, async (sb, mid) => {
    const { data, error } = await sb
      .from("supplier_price_history")
      .select("id, old_price, new_price, changed_at, suppliers(name)")
      .eq("material_item_id", mid)
      .order("changed_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return numifyAll<{ id: string; old_price: number | null; new_price: number; changed_at: string }>(
      (data ?? []).map((r) => ({ ...r, supplier_name: (r.suppliers as unknown as { name: string } | null)?.name ?? "-", suppliers: undefined })),
    ) as { id: string; old_price: number | null; new_price: number; changed_at: string; supplier_name: string }[];
  });
}

// ---------------------------------------------------------------------------
// BAHAN BAKU
// ---------------------------------------------------------------------------
const itemSchema = z.object({
  id: z.string().uuid().optional().nullable(),
  category_id: z.string({ message: "Pilih kategori" }).uuid("Pilih kategori"),
  name: zText("Nama barang", 1, 160),
  brand: zOptText(80),
  unit: zText("Satuan", 1, 20),
  min_stock: zMoney("Stok minimum"),
  specs: z.record(z.string(), z.union([z.string(), z.number()]).transform((v) => String(v).trim().slice(0, 120))).default({}),
  photo_url: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .nullable()
    .refine((v) => !v || /^https?:\/\//.test(v) || v.startsWith("/"), "URL foto tidak valid")
    .transform((v) => v || null),
  notes: zOptText(1000),
  is_active: z.boolean().default(true),
});

export async function saveMaterialItem(input: unknown) {
  return run({ schema: itemSchema, input, revalidate: SUP_PATHS.concat("/admin/stok"), message: "Bahan baku disimpan" }, async (sb, { id, specs, ...data }) => {
    // Validasi spesifikasi sesuai definisi kategori.
    const { data: defs } = await sb.from("material_specifications").select("key, label, field_type, options, is_required").eq("category_id", data.category_id);
    const clean: Record<string, string> = {};
    for (const d of defs ?? []) {
      const v = (specs[d.key as string] ?? "").trim();
      if (!v) {
        if (d.is_required) throw new Error(`${d.label} wajib diisi`);
        continue;
      }
      if (d.field_type === "number" && !Number.isFinite(Number(v.replace(",", ".")))) throw new Error(`${d.label} harus angka`);
      if (d.field_type === "select" && (d.options as string[]).length && !(d.options as string[]).includes(v)) throw new Error(`${d.label}: pilihan tidak valid`);
      clean[d.key as string] = d.field_type === "number" ? v.replace(",", ".") : v;
    }
    const row = { ...data, specs: clean };
    if (id) check(await sb.from("material_items").update(row).eq("id", id));
    else check(await sb.from("material_items").insert(row));
  });
}

export async function deleteMaterialItem(id: string) {
  return run({ schema: zId, input: id, revalidate: SUP_PATHS.concat("/admin/stok") }, async (sb, mid) => {
    const [inv, po, req] = await Promise.all([
      sb.from("inventory").select("id", { count: "exact", head: true }).eq("material_item_id", mid),
      sb.from("purchase_order_items").select("id", { count: "exact", head: true }).eq("material_item_id", mid),
      sb.from("project_material_requirements").select("id", { count: "exact", head: true }).eq("material_item_id", mid),
    ]);
    if ((inv.count ?? 0) + (po.count ?? 0) + (req.count ?? 0) > 0) {
      check(await sb.from("material_items").update({ is_active: false, deleted_at: new Date().toISOString() }).eq("id", mid));
      return "archived";
    }
    check(await sb.from("material_items").delete().eq("id", mid));
    return "deleted";
  });
}

// ---------------------------------------------------------------------------
// KATEGORI & SPESIFIKASI
// ---------------------------------------------------------------------------
const categorySchema = z.object({
  id: z.string().uuid().optional().nullable(),
  name: zText("Nama kategori", 1, 80),
  description: zOptText(300),
  default_unit: zText("Satuan default", 1, 20),
  sort_order: z.coerce.number().int().min(0).max(9999).default(0),
  is_active: z.boolean().default(true),
});

export async function saveCategory(input: unknown) {
  return run({ schema: categorySchema, input, revalidate: ["/admin/bahan"], message: "Kategori disimpan" }, async (sb, { id, ...data }) => {
    if (id) check(await sb.from("material_categories").update(data).eq("id", id));
    else check(await sb.from("material_categories").insert(data));
  });
}

export async function deleteCategory(id: string) {
  return run({ schema: zId, input: id, revalidate: ["/admin/bahan"], message: "Kategori dihapus" }, async (sb, cid) => {
    const { count } = await sb.from("material_items").select("id", { count: "exact", head: true }).eq("category_id", cid);
    if (count) throw new Error(`Kategori masih dipakai ${count} bahan baku. Pindahkan/hapus bahannya dulu atau nonaktifkan kategori.`);
    check(await sb.from("material_categories").delete().eq("id", cid));
  });
}

const specSchema = z.object({
  id: z.string().uuid().optional().nullable(),
  category_id: zId,
  label: zText("Nama spesifikasi", 1, 60),
  key: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((v) => v || ""),
  field_type: z.enum(["text", "number", "select"]),
  options: z.array(z.string().trim().min(1).max(60)).max(60).default([]),
  unit: zOptText(20),
  is_required: z.boolean().default(false),
  sort_order: z.coerce.number().int().min(0).max(999).default(0),
});

export async function saveSpecField(input: unknown) {
  return run({ schema: specSchema, input, revalidate: ["/admin/bahan"], message: "Spesifikasi disimpan" }, async (sb, { id, key, ...data }) => {
    const slug =
      key ||
      data.label
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .replace(/^(\d)/, "s_$1")
        .slice(0, 40) ||
      `spec_${Date.now()}`;
    const row = { ...data, options: data.field_type === "select" ? data.options : [] };
    if (id) check(await sb.from("material_specifications").update(row).eq("id", id));
    else check(await sb.from("material_specifications").insert({ ...row, key: slug }));
  });
}

export async function deleteSpecField(id: string) {
  return run({ schema: zId, input: id, revalidate: ["/admin/bahan"], message: "Spesifikasi dihapus (data lama di barang tetap tersimpan)" }, async (sb, sid) => {
    check(await sb.from("material_specifications").delete().eq("id", sid));
  });
}
