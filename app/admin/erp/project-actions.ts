"use server";

import { z } from "zod";
import { FORMULA_VARS, PERCENT_BUDGET_KEYS } from "@/lib/erp/constants";
import { materialQty } from "@/lib/erp/formula";
import { check, run, zDate, zId, zMoney, zOptDate, zOptId, zOptText, zPositive, zQty, zText } from "@/lib/erp/server";

const PATHS = ["/admin/proyek", "/admin/stok", "/admin/keuangan", "/admin"];

// ---------------------------------------------------------------------------
// INFO PROYEK
// ---------------------------------------------------------------------------
const specsSchema = z.record(z.string(), z.union([z.string(), z.number()]).transform((v) => (typeof v === "number" ? v : v.trim().slice(0, 200))));

const projectSchema = z
  .object({
    id: zId,
    work_type: zOptText(80),
    template_id: zOptId,
    manager_id: zOptId,
    start_date: zOptDate,
    target_end_date: zOptDate,
    actual_end_date: zOptDate,
    estimated_days: z.union([z.literal(""), z.null(), z.coerce.number().int().min(0).max(3650)]).transform((v) => (v === "" ? null : v)),
    specs: specsSchema.default({}),
    notes: zOptText(2000),
  })
  .superRefine((p, ctx) => {
    if (p.start_date && p.target_end_date && p.target_end_date < p.start_date) ctx.addIssue({ code: "custom", path: ["target_end_date"], message: "Target selesai tidak boleh sebelum tanggal mulai" });
  });

function cleanSpecs(specs: Record<string, string | number>) {
  const out: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(specs)) {
    if (v === "" || v === null || v === undefined) continue;
    const isNum = FORMULA_VARS.some((f) => f.key === k);
    if (isNum) {
      const n = Number(String(v).replace(",", "."));
      if (Number.isFinite(n) && n >= 0) out[k] = n;
    } else out[k] = String(v);
  }
  return out;
}

export async function saveProjectInfo(input: unknown) {
  return run({ schema: projectSchema, input, revalidate: PATHS, message: "Data proyek disimpan" }, async (sb, { id, specs, ...d }) => {
    // Estimasi durasi otomatis dari tanggal jika kosong.
    let est = d.estimated_days;
    if (est === null && d.start_date && d.target_end_date) est = Math.round((Date.parse(d.target_end_date) - Date.parse(d.start_date)) / 86_400_000) + 1;
    check(await sb.from("projects").update({ ...d, estimated_days: est, specs: cleanSpecs(specs) }).eq("id", id));
  });
}

// ---------------------------------------------------------------------------
// RAB / KEBUTUHAN MATERIAL
// ---------------------------------------------------------------------------
function varsFrom(specs: Record<string, unknown>) {
  const vars: Record<string, number> = {};
  for (const f of FORMULA_VARS) vars[f.key] = Number(specs[f.key] ?? 0) || 0;
  return vars;
}

/** Hitung kebutuhan material dari template + ukuran proyek. */
export async function applyTemplate(input: unknown) {
  const schema = z.object({ project_id: zId, template_id: zId, mode: z.enum(["replace", "append"]), specs: specsSchema.default({}) });
  return run({ schema, input, revalidate: PATHS }, async (sb, d) => {
    const specs = cleanSpecs(d.specs);
    const vars = varsFrom(specs);
    const { data: tpl } = await sb.from("material_templates").select("name, work_type, material_template_items(*)").eq("id", d.template_id).maybeSingle();
    if (!tpl) throw new Error("Template tidak ditemukan");
    const tItems = ((tpl.material_template_items as Record<string, unknown>[]) ?? []).sort((a, b) => Number(a.sort_order) - Number(b.sort_order));
    if (!tItems.length) throw new Error("Template belum berisi barang");
    const itemIds = tItems.map((t) => t.material_item_id).filter(Boolean) as string[];
    const { data: prices } = itemIds.length ? await sb.from("material_stock_view").select("id, best_price, best_supplier_id, unit").in("id", itemIds) : { data: [] };

    const rows: Record<string, unknown>[] = [];
    const skipped: string[] = [];
    for (const [i, t] of tItems.entries()) {
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
      rows.push({
        project_id: d.project_id,
        material_item_id: t.material_item_id ?? null,
        name: t.name,
        qty,
        unit: t.unit || p?.unit || "pcs",
        est_unit_price: Number(p?.best_price ?? 0),
        preferred_supplier_id: p?.best_supplier_id ?? null,
        source: "template",
        notes: t.notes ?? null,
        sort_order: i + 1,
      });
    }
    if (d.mode === "replace") check(await sb.from("project_material_requirements").delete().eq("project_id", d.project_id).eq("source", "template"));
    if (rows.length) check(await sb.from("project_material_requirements").insert(rows));
    check(await sb.from("projects").update({ template_id: d.template_id, specs, work_type: tpl.work_type }).eq("id", d.project_id));
    return { added: rows.length, skipped };
  });
}

const reqSchema = z.object({
  id: z.string().uuid().optional().nullable(),
  project_id: zId,
  material_item_id: zOptId,
  name: zText("Nama bahan", 1, 160),
  spec_text: zOptText(300),
  qty: zPositive("Jumlah kebutuhan"),
  unit: zText("Satuan", 1, 20),
  est_unit_price: zMoney("Harga estimasi"),
  preferred_supplier_id: zOptId,
  notes: zOptText(300),
});

export async function saveRequirement(input: unknown) {
  return run({ schema: reqSchema, input, revalidate: PATHS, message: "Kebutuhan material disimpan" }, async (sb, { id, ...d }) => {
    if (id) check(await sb.from("project_material_requirements").update(d).eq("id", id));
    else {
      const { count } = await sb.from("project_material_requirements").select("id", { count: "exact", head: true }).eq("project_id", d.project_id);
      check(await sb.from("project_material_requirements").insert({ ...d, source: "manual", sort_order: (count ?? 0) + 1 }));
    }
  });
}

export async function deleteRequirement(id: string) {
  return run({ schema: zId, input: id, revalidate: PATHS, message: "Kebutuhan dihapus" }, async (sb, rid) => {
    check(await sb.from("project_material_requirements").delete().eq("id", rid));
  });
}

// ---------------------------------------------------------------------------
// ANGGARAN & BIAYA (admin utama)
// ---------------------------------------------------------------------------
const CATS = ["material", "labor", "workshop", "transport", "installation", "utilities", "marketing", "admin", "contingency", "profit"] as const;

export async function saveBudgets(input: unknown) {
  const schema = z.object({ project_id: zId, rows: z.array(z.object({ category: z.enum(CATS), amount: zMoney("Anggaran"), notes: zOptText(200) })).max(20) });
  return run({ owner: true, schema, input, revalidate: PATHS, message: "Anggaran proyek disimpan" }, async (sb, d) => {
    const rows = d.rows.map((r) => ({ ...r, project_id: d.project_id, updated_at: new Date().toISOString() }));
    check(await sb.from("project_budgets").upsert(rows, { onConflict: "project_id,category" }));
  });
}

/** Susun anggaran otomatis: material = RAB, upah = estimasi pekerja, lainnya = % kontrak, laba = sisa. */
export async function autoBudget(projectId: string) {
  return run({ owner: true, schema: zId, input: projectId, revalidate: PATHS, message: "Anggaran disusun otomatis — silakan sesuaikan" }, async (sb, id) => {
    const [{ data: p }, { data: s }] = await Promise.all([
      sb.from("projects_view").select("contract_value, rab_total, labor_estimate").eq("id", id).maybeSingle(),
      sb.from("settings").select("budget_defaults").eq("id", true).maybeSingle(),
    ]);
    if (!p) throw new Error("Proyek tidak ditemukan");
    const contract = Number(p.contract_value);
    const pct = (s?.budget_defaults ?? {}) as Record<string, number>;
    const rows: { category: string; amount: number }[] = [
      { category: "material", amount: Math.round(Number(p.rab_total)) },
      { category: "labor", amount: Math.round(Number(p.labor_estimate)) },
      ...PERCENT_BUDGET_KEYS.map((k) => ({ category: k, amount: Math.round((contract * (Number(pct[k]) || 0)) / 100) })),
    ];
    const cost = rows.reduce((a, r) => a + r.amount, 0);
    rows.push({ category: "profit", amount: Math.max(contract - cost, 0) });
    check(await sb.from("project_budgets").upsert(rows.map((r) => ({ ...r, project_id: id, updated_at: new Date().toISOString() })), { onConflict: "project_id,category" }));
  });
}

const expenseSchema = z.object({
  id: z.string().uuid().optional().nullable(),
  project_id: zId,
  expense_date: zDate,
  category: z.enum(["material", "labor", "workshop", "transport", "installation", "utilities", "marketing", "admin", "contingency"]),
  description: zText("Keterangan", 2, 200),
  amount: zPositive("Jumlah", 100_000_000_000),
  account_id: z.string({ message: "Pilih akun kas" }).uuid("Pilih akun kas"),
  vendor: zOptText(120),
  receipt_url: zOptText(2000),
});

export async function saveExpense(input: unknown) {
  return run({ owner: true, schema: expenseSchema, input, revalidate: PATHS, message: "Biaya proyek dicatat & masuk buku kas" }, async (sb, { id, ...d }) => {
    if (id) check(await sb.from("project_expenses").update(d).eq("id", id));
    else check(await sb.from("project_expenses").insert(d));
  });
}

export async function deleteExpense(id: string) {
  return run({ owner: true, schema: zId, input: id, revalidate: PATHS, message: "Biaya dihapus (kas dikembalikan)" }, async (sb, eid) => {
    check(await sb.from("project_expenses").delete().eq("id", eid));
  });
}

// ---------------------------------------------------------------------------
// TAHAPAN
// ---------------------------------------------------------------------------
const stageSchema = z.object({
  id: z.string().uuid().optional().nullable(),
  project_id: zId,
  stage_name: zText("Nama tahapan", 1, 120),
  sort_order: z.coerce.number().int().min(0).max(999),
  status: z.enum(["pending", "in_progress", "done", "skipped"]),
  start_date: zOptDate,
  target_date: zOptDate,
  actual_end_date: zOptDate,
  progress: z.coerce.number().int().min(0).max(100),
  notes: zOptText(2000),
  photos: z.array(z.string().max(2000)).max(30).default([]),
});

export async function saveStage(input: unknown) {
  return run({ schema: stageSchema, input, revalidate: PATHS, message: "Tahapan disimpan" }, async (sb, { id, ...d }) => {
    if (id) check(await sb.from("project_timelines").update(d).eq("id", id));
    else check(await sb.from("project_timelines").insert(d));
  });
}

export async function deleteStage(id: string) {
  return run({ schema: zId, input: id, revalidate: PATHS, message: "Tahapan dihapus" }, async (sb, sid) => {
    check(await sb.from("project_timelines").delete().eq("id", sid));
  });
}

// ---------------------------------------------------------------------------
// PEKERJA PROYEK
// ---------------------------------------------------------------------------
const workerSchema = z.object({
  id: z.string().uuid().optional().nullable(),
  project_id: zId,
  employee_id: z.string({ message: "Pilih pegawai" }).uuid("Pilih pegawai"),
  role: zOptText(80),
  start_date: zOptDate,
  end_date: zOptDate,
  estimated_days: zQty("Estimasi hari"),
  agreed_amount: zMoney("Upah borongan"),
  notes: zOptText(300),
});

export async function saveWorker(input: unknown) {
  return run({ schema: workerSchema, input, revalidate: PATHS.concat("/admin/penggajian"), message: "Pekerja proyek disimpan" }, async (sb, { id, ...d }) => {
    if (id) check(await sb.from("project_workers").update(d).eq("id", id));
    else check(await sb.from("project_workers").insert(d));
  });
}

export async function deleteWorker(id: string) {
  return run({ schema: zId, input: id, revalidate: PATHS, message: "Pekerja dilepas dari proyek" }, async (sb, wid) => {
    check(await sb.from("project_workers").delete().eq("id", wid));
  });
}

// ---------------------------------------------------------------------------
// TEMPLATE MATERIAL
// ---------------------------------------------------------------------------
const templateSchema = z.object({
  id: z.string().uuid().optional().nullable(),
  name: zText("Nama template", 2, 120),
  work_type: zOptText(80),
  description: zOptText(500),
  is_active: z.boolean().default(true),
  sort_order: z.coerce.number().int().min(0).max(999).default(0),
  items: z
    .array(
      z.object({
        material_item_id: zOptId,
        name: zText("Nama barang", 1, 160),
        formula: zText("Formula", 1, 300),
        waste_pct: z.coerce.number().min(0).max(100),
        round_up: z.boolean().default(true),
        unit: zText("Satuan", 1, 20),
        notes: zOptText(300),
      }),
    )
    .max(100),
});

export async function saveTemplate(input: unknown) {
  return run({ schema: templateSchema, input, revalidate: ["/admin/template-material", "/admin/proyek"], message: "Template disimpan" }, async (sb, { id, items, ...d }) => {
    // Validasi semua formula dengan nilai contoh sebelum disimpan.
    const sample = Object.fromEntries(FORMULA_VARS.map((f) => [f.key, 2]));
    for (const it of items) {
      try {
        materialQty(it.formula, sample, it.waste_pct, it.round_up);
      } catch (e) {
        throw new Error(`Formula "${it.name}" salah: ${(e as Error).message}`);
      }
    }
    let tid = id;
    if (tid) check(await sb.from("material_templates").update(d).eq("id", tid));
    else tid = (check(await sb.from("material_templates").insert(d).select("id").single()) as { id: string }).id;
    check(await sb.from("material_template_items").delete().eq("template_id", tid));
    if (items.length) check(await sb.from("material_template_items").insert(items.map((it, i) => ({ ...it, template_id: tid, sort_order: i + 1 }))));
    return tid;
  });
}

export async function deleteTemplate(id: string) {
  return run({ schema: zId, input: id, revalidate: ["/admin/template-material"], message: "Template dihapus" }, async (sb, tid) => {
    check(await sb.from("material_templates").delete().eq("id", tid));
  });
}

/** Pratinjau hasil formula (tanpa menyimpan). */
export async function previewTemplate(input: unknown) {
  const schema = z.object({ template_id: zId, specs: specsSchema.default({}) });
  return run({ schema, input }, async (sb, d) => {
    const vars = varsFrom(cleanSpecs(d.specs));
    const { data } = await sb.from("material_template_items").select("name, formula, waste_pct, round_up, unit").eq("template_id", d.template_id).order("sort_order");
    return (data ?? []).map((t) => {
      try {
        return { name: t.name as string, unit: t.unit as string, qty: materialQty(String(t.formula), vars, Number(t.waste_pct), Boolean(t.round_up)), error: null };
      } catch (e) {
        return { name: t.name as string, unit: t.unit as string, qty: 0, error: (e as Error).message };
      }
    });
  });
}
