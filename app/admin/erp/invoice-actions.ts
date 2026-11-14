"use server";

import { z } from "zod";
import { check, run, zId, zOptText, zText } from "@/lib/erp/server";

const PATHS = ["/admin/invoice-settings", "/admin/invoice", "/admin/orders"];

const settingsSchema = z.object({
  invoice_logo_url: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .nullable()
    .refine((v) => !v || /^https?:\/\//.test(v) || v.startsWith("/"), "URL logo tidak valid")
    .transform((v) => v || null),
  invoice_title: zText("Judul invoice", 1, 40),
  invoice_footer: zOptText(1000),
  invoice_terms: zOptText(3000),
  invoice_show_bank: z.boolean(),
  work_days_per_week: z.coerce.number().int().min(5).max(7),
  invoice_review_url: z
    .string()
    .trim()
    .max(500)
    .optional()
    .nullable()
    .refine((v) => !v || /^https:\/\//.test(v), "Link ulasan harus diawali https://")
    .transform((v) => v || null),
  invoice_completed_note: zOptText(2000),
});

export async function saveInvoiceSettings(input: unknown) {
  return run({ schema: settingsSchema, input, revalidate: PATHS, message: "Pengaturan invoice disimpan" }, async (sb, d) => {
    check(await sb.from("settings").update(d).eq("id", true));
  });
}

const bankSchema = z.object({
  id: z.string().uuid().optional().nullable(),
  bank_name: zText("Nama bank", 1, 80),
  account_number: z
    .string({ message: "Nomor rekening wajib diisi" })
    .trim()
    .min(3, "Nomor rekening wajib diisi")
    .max(40)
    .refine((v) => /^[\d\s.-]+$/.test(v), "Nomor rekening hanya boleh angka"),
  account_holder: zText("Nama pemilik rekening", 1, 120),
  notes: zOptText(200),
  is_active: z.boolean().default(true),
  sort_order: z.coerce.number().int().min(0).max(999).default(0),
});

export async function saveBankAccount(input: unknown) {
  return run({ schema: bankSchema, input, revalidate: PATHS, message: "Rekening disimpan" }, async (sb, { id, ...d }) => {
    if (id) check(await sb.from("invoice_bank_accounts").update(d).eq("id", id));
    else check(await sb.from("invoice_bank_accounts").insert(d));
  });
}

export async function deleteBankAccount(id: string) {
  return run({ schema: zId, input: id, revalidate: PATHS, message: "Rekening dihapus" }, async (sb, bid) => {
    check(await sb.from("invoice_bank_accounts").delete().eq("id", bid));
  });
}

// ---------------------------------------------------------------------------
// JENIS PEMBAYARAN (DP, Termin, Pelunasan, …)
// ---------------------------------------------------------------------------
const kindSchema = z.object({
  code: z.string().optional().nullable(),
  label: zText("Nama jenis pembayaran", 1, 60),
  sort_order: z.coerce.number().int().min(0).max(999).default(0),
  is_active: z.boolean().default(true),
});

export async function savePaymentKind(input: unknown) {
  return run({ schema: kindSchema, input, revalidate: PATHS, message: "Jenis pembayaran disimpan" }, async (sb, d) => {
    if (d.code) {
      check(await sb.from("payment_kinds").update({ label: d.label, sort_order: d.sort_order, is_active: d.is_active }).eq("code", d.code));
      return;
    }
    const base =
      d.label
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .replace(/^(\d)/, "k_$1")
        .slice(0, 32) || "jenis";
    const { data: taken } = await sb.from("payment_kinds").select("code").like("code", `${base}%`);
    const used = new Set((taken ?? []).map((r) => r.code as string));
    let code = base;
    for (let i = 2; used.has(code); i++) code = `${base}_${i}`;
    check(await sb.from("payment_kinds").insert({ code, label: d.label, sort_order: d.sort_order, is_active: d.is_active }));
  });
}

export async function deletePaymentKind(code: string) {
  return run({ schema: z.string().min(1).max(40), input: code, revalidate: PATHS, message: "Jenis pembayaran dihapus" }, async (sb, c) => {
    const { data: k } = await sb.from("payment_kinds").select("is_system").eq("code", c).maybeSingle();
    if (k?.is_system) throw new Error("Jenis bawaan tidak bisa dihapus — ubah namanya atau nonaktifkan saja.");
    const { count } = await sb.from("order_payments").select("id", { count: "exact", head: true }).eq("kind", c);
    if (count) throw new Error(`Sudah dipakai di ${count} pembayaran. Nonaktifkan saja agar riwayat tetap aman.`);
    check(await sb.from("payment_kinds").delete().eq("code", c));
  });
}
