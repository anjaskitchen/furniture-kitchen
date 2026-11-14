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
