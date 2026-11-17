"use server";

import { z } from "zod";
import { FORMULA_VARS } from "@/lib/erp/constants";
import { materialQty } from "@/lib/erp/formula";
import { check, run, zId, zMoney, zOptId, zOptText, zText } from "@/lib/erp/server";
import type { createClient } from "@/lib/supabase/server";

const PATHS = ["/admin/hpp", "/admin/orders", "/admin/reports", "/admin"];
const CATEGORY = z.enum(["material", "labor", "overhead", "other"]);
const zPct = (label: string) => z.coerce.number({ message: `${label} harus angka` }).min(0, `${label} minimal 0`).max(100, `${label} maksimal 100`);

type SB = Awaited<ReturnType<typeof createClient>>;

// Catatan: kolom order_id selalu diisi ulang oleh trigger database dari item-nya;
// nilai yang dikirim dari sini hanya placeholder agar lolos NOT NULL.

async function nextSort(sb: SB, itemId: string) {
  const { data } = await sb.from("order_item_costs").select("sort_order").eq("order_item_id", itemId).order("sort_order", { ascending: false }).limit(1);
  return Number(data?.[0]?.sort_order ?? 0) + 1;
}

// ---------------------------------------------------------------------------
// BARIS BIAYA
// ---------------------------------------------------------------------------
const lineSchema = z.object({
  id: z.string().uuid().optional().nullable(),
  order_item_id: zId,
  category: CATEGORY,
  material_item_id: zOptId,
  name: zText("Nama biaya", 1, 160),
  qty: z.coerce.number({ message: "Jumlah harus angka" }).gt(0, "Jumlah harus lebih dari 0").max(1_000_000, "Jumlah terlalu besar"),
  unit: zText("Satuan", 1, 20),
  unit_cost: zMoney("Harga satuan"),
  notes: zOptText(300),
});

export async function saveCostLine(input: unknown) {
  return run({ owner: true, schema: lineSchema, input, revalidate: PATHS, message: "Biaya disimpan" }, async (sb, { id, ...d }) => {
    const row = { ...d, qty: Math.round(d.qty * 1000) / 1000, material_item_id: d.category === "material" ? d.material_item_id : null };
    if (id) check(await sb.from("order_item_costs").update(row).eq("id", id));
    else check(await sb.from("order_item_costs").insert({ ...row, order_id: d.order_item_id, sort_order: await nextSort(sb, d.order_item_id) }));
  });
}

export async function deleteCostLine(id: string) {
  return run({ owner: true, schema: zId, input: id, revalidate: PATHS, message: "Biaya dihapus" }, async (sb, lineId) => {
    check(await sb.from("order_item_costs").delete().eq("id", lineId));
  });
}

/** Kosongkan semua rincian HPP satu item. */
export async function clearItemCosts(itemId: string) {
  return run({ owner: true, schema: zId, input: itemId, revalidate: PATHS, message: "Rincian HPP item dikosongkan" }, async (sb, id) => {
    check(await sb.from("order_item_costs").delete().eq("order_item_id", id));
  });
}

/** Overhead% khusus item (null = pakai default pengaturan). */
export async function setItemOverhead(input: unknown) {
  const schema = z.object({ item_id: zId, pct: z.union([z.literal(""), z.null(), zPct("Overhead")]).transform((v) => (v === "" ? null : v)) });
  return run({ owner: true, schema, input, revalidate: PATHS, message: "Overhead item disimpan" }, async (sb, d) => {
    check(await sb.from("order_items").update({ hpp_overhead_pct: d.pct }).eq("id", d.item_id));
  });
}

// ---------------------------------------------------------------------------
// ISI OTOMATIS
// ---------------------------------------------------------------------------
const varsSchema = z.record(z.string(), z.union([z.string(), z.number()]));

/** Hitung bahan baku item dari template material + ukuran (formula yang sama dengan RAB proyek). */
export async function applyTemplateToItem(input: unknown) {
  const schema = z.object({ item_id: zId, template_id: zId, mode: z.enum(["replace", "append"]), vars: varsSchema.default({}) });
  return run({ owner: true, schema, input, revalidate: PATHS }, async (sb, d) => {
    const vars: Record<string, number> = {};
    for (const f of FORMULA_VARS) {
      const n = Number(String(d.vars[f.key] ?? 0).replace(",", "."));
      vars[f.key] = Number.isFinite(n) && n >= 0 ? n : 0;
    }
    const { data: tpl } = await sb.from("material_templates").select("name, material_template_items(*)").eq("id", d.template_id).maybeSingle();
    if (!tpl) throw new Error("Template tidak ditemukan");
    const tItems = ((tpl.material_template_items as Record<string, unknown>[]) ?? []).sort((a, b) => Number(a.sort_order) - Number(b.sort_order));
    if (!tItems.length) throw new Error("Template belum berisi barang");
    const ids = tItems.map((t) => t.material_item_id).filter(Boolean) as string[];
    const { data: prices } = ids.length ? await sb.from("material_stock_view").select("id, best_price, stock_value, qty_on_hand, unit").in("id", ids) : { data: [] };

    const rows: Record<string, unknown>[] = [];
    const skipped: string[] = [];
    let sort = d.mode === "append" ? await nextSort(sb, d.item_id) : 1;
    for (const t of tItems) {
      let qty: number;
      try {
        qty = materialQty(String(t.formula), vars, Number(t.waste_pct), Boolean(t.round_up));
      } catch (e) {
        throw new Error(`Formula "${t.name}" salah: ${(e as Error).message}`);
      }
      if (qty <= 0) {
        skipped.push(String(t.name));
        continue;
      }
      const p = (prices ?? []).find((x) => x.id === t.material_item_id);
      const onHand = Number(p?.qty_on_hand ?? 0);
      const price = Number(p?.best_price ?? 0) || (onHand > 0 ? Math.round(Number(p?.stock_value ?? 0) / onHand) : 0);
      rows.push({
        order_item_id: d.item_id,
        order_id: d.item_id,
        category: "material",
        material_item_id: t.material_item_id ?? null,
        name: t.name,
        qty,
        unit: t.unit || p?.unit || "pcs",
        unit_cost: price,
        source: "template",
        sort_order: sort++,
      });
    }
    if (d.mode === "replace") check(await sb.from("order_item_costs").delete().eq("order_item_id", d.item_id).eq("source", "template"));
    if (rows.length) check(await sb.from("order_item_costs").insert(rows));
    return { added: rows.length, skipped, noPrice: rows.filter((r) => !r.unit_cost).length };
  });
}

/** Salin kebutuhan material (RAB) proyek order ini ke satu item. */
export async function importRabToItem(input: unknown) {
  const schema = z.object({ item_id: zId, mode: z.enum(["replace", "append"]) });
  return run({ owner: true, schema, input, revalidate: PATHS }, async (sb, d) => {
    const { data: item } = await sb.from("order_items").select("order_id").eq("id", d.item_id).maybeSingle();
    if (!item) throw new Error("Item tidak ditemukan");
    const { data: project } = await sb.from("projects").select("id").eq("order_id", item.order_id).maybeSingle();
    if (!project) throw new Error("Proyek order ini belum ada");
    const { data: reqs } = await sb.from("project_material_requirements").select("*").eq("project_id", project.id).order("sort_order");
    if (!reqs?.length) throw new Error("RAB proyek masih kosong. Isi dulu di menu Proyek & RAB → Material.");
    if (d.mode === "replace") check(await sb.from("order_item_costs").delete().eq("order_item_id", d.item_id).eq("source", "rab"));
    let sort = await nextSort(sb, d.item_id);
    check(
      await sb.from("order_item_costs").insert(
        reqs.map((r) => ({
          order_item_id: d.item_id,
          order_id: d.item_id,
          category: "material",
          material_item_id: r.material_item_id,
          name: r.name,
          qty: Number(r.qty),
          unit: r.unit,
          unit_cost: Number(r.est_unit_price),
          source: "rab",
          notes: r.spec_text,
          sort_order: sort++,
        })),
      ),
    );
    return { added: reqs.length };
  });
}

/** Salin rincian HPP dari item lain (mis. item serupa di order lama). */
export async function copyItemCosts(input: unknown) {
  const schema = z.object({ from_item_id: zId, to_item_id: zId, scale: z.coerce.number().gt(0).max(1000).default(1) });
  return run({ owner: true, schema, input, revalidate: PATHS }, async (sb, d) => {
    if (d.from_item_id === d.to_item_id) throw new Error("Pilih item yang berbeda");
    const { data: src } = await sb.from("order_item_costs").select("*").eq("order_item_id", d.from_item_id).order("sort_order");
    if (!src?.length) throw new Error("Item sumber belum punya rincian HPP");
    let sort = await nextSort(sb, d.to_item_id);
    check(
      await sb.from("order_item_costs").insert(
        src.map((r) => ({
          order_item_id: d.to_item_id,
          order_id: d.to_item_id,
          category: r.category,
          material_item_id: r.material_item_id,
          name: r.name,
          qty: Math.max(0.001, Math.round(Number(r.qty) * d.scale * 1000) / 1000),
          unit: r.unit,
          unit_cost: Number(r.unit_cost),
          source: "manual",
          notes: r.notes,
          sort_order: sort++,
        })),
      ),
    );
    return { added: src.length };
  });
}

// ---------------------------------------------------------------------------
// PENGATURAN
// ---------------------------------------------------------------------------
export async function saveHppSettings(input: unknown) {
  const schema = z
    .object({ hpp_overhead_pct: zPct("Overhead default"), hpp_target_pct: zPct("Target HPP"), hpp_max_pct: zPct("Batas HPP") })
    .refine((v) => v.hpp_max_pct >= v.hpp_target_pct, { path: ["hpp_max_pct"], message: "Batas maksimal harus ≥ target" });
  return run({ owner: true, schema, input, revalidate: PATHS, message: "Pengaturan HPP disimpan" }, async (sb, d) => {
    check(await sb.from("settings").update(d).eq("id", true));
  });
}
