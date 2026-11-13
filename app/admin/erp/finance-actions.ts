"use server";

import { z } from "zod";
import { LEDGER_CATEGORIES, MANUAL_LEDGER_CATEGORIES, PERCENT_BUDGET_KEYS } from "@/lib/erp/constants";
import { check, run, zDate, zId, zOptId, zOptText, zPositive, zText } from "@/lib/erp/server";

const PATHS = ["/admin/keuangan", "/admin"];
const manualCats = MANUAL_LEDGER_CATEGORIES.map((c) => c.value) as [string, ...string[]];

const txnSchema = z.object({
  id: z.string().uuid().optional().nullable(),
  txn_date: zDate,
  account_id: z.string({ message: "Pilih akun" }).uuid("Pilih akun"),
  category: z.enum(manualCats, { message: "Pilih kategori" }),
  amount: zPositive("Jumlah", 100_000_000_000),
  project_id: zOptId,
  description: zText("Keterangan", 2, 300),
  reference: zOptText(100),
});

/** Transaksi kas manual: biaya operasional (listrik, sewa, iklan), setoran modal, prive, pendapatan lain. */
export async function saveTransaction(input: unknown) {
  return run({ owner: true, schema: txnSchema, input, revalidate: PATHS.concat("/admin/proyek"), message: "Transaksi kas disimpan" }, async (sb, { id, ...d }) => {
    const direction = LEDGER_CATEGORIES.find((c) => c.value === d.category)!.dir;
    const row = { ...d, direction, source_type: "manual" };
    if (id) check(await sb.from("financial_transactions").update(row).eq("id", id).eq("source_type", "manual"));
    else check(await sb.from("financial_transactions").insert(row));
  });
}

export async function deleteTransaction(id: string) {
  return run({ owner: true, schema: zId, input: id, revalidate: PATHS }, async (sb, tid) => {
    const { data } = await sb.from("financial_transactions").select("source_type, source_id").eq("id", tid).maybeSingle();
    if (!data) throw new Error("Transaksi tidak ditemukan");
    if (data.source_type === "transfer") check(await sb.from("financial_transactions").delete().eq("source_type", "transfer").eq("source_id", data.source_id as string));
    else if (data.source_type === "manual") check(await sb.from("financial_transactions").delete().eq("id", tid));
    else throw new Error("Transaksi otomatis dihapus dari sumbernya (order, pembelian, biaya proyek, kasbon, atau gaji).");
  });
}

const transferSchema = z
  .object({ txn_date: zDate, from_account: zId, to_account: zId, amount: zPositive("Jumlah", 100_000_000_000), description: zOptText(200) })
  .refine((t) => t.from_account !== t.to_account, { path: ["to_account"], message: "Akun tujuan harus berbeda" });

export async function transferFunds(input: unknown) {
  return run({ owner: true, schema: transferSchema, input, revalidate: PATHS, message: "Transfer antar akun dicatat" }, async (sb, d) => {
    const sid = crypto.randomUUID();
    const desc = d.description || "Transfer antar akun";
    check(
      await sb.from("financial_transactions").insert([
        { txn_date: d.txn_date, account_id: d.from_account, direction: "out", amount: d.amount, category: "transfer_out", source_type: "transfer", source_id: sid, description: desc },
        { txn_date: d.txn_date, account_id: d.to_account, direction: "in", amount: d.amount, category: "transfer_in", source_type: "transfer", source_id: sid, description: desc },
      ]),
    );
  });
}

const accountSchema = z.object({
  id: z.string().uuid().optional().nullable(),
  name: zText("Nama akun", 1, 80),
  kind: z.enum(["cash", "bank", "ewallet"]),
  account_number: zOptText(60),
  opening_balance: z.coerce.number({ message: "Saldo awal harus angka" }).min(-100_000_000_000).max(100_000_000_000),
  opening_date: zDate,
  is_default: z.boolean().default(false),
  is_active: z.boolean().default(true),
  notes: zOptText(300),
});

export async function saveCashAccount(input: unknown) {
  return run({ owner: true, schema: accountSchema, input, revalidate: PATHS, message: "Akun kas disimpan" }, async (sb, { id, ...d }) => {
    // Satu akun default per jenis.
    if (d.is_default) {
      let q = sb.from("cash_accounts").update({ is_default: false }).eq("kind", d.kind);
      if (id) q = q.neq("id", id);
      check(await q);
    }
    if (id) check(await sb.from("cash_accounts").update(d).eq("id", id));
    else check(await sb.from("cash_accounts").insert(d));
  });
}

export async function deleteCashAccount(id: string) {
  return run({ owner: true, schema: zId, input: id, revalidate: PATHS }, async (sb, aid) => {
    const { count } = await sb.from("financial_transactions").select("id", { count: "exact", head: true }).eq("account_id", aid);
    if (count) {
      check(await sb.from("cash_accounts").update({ is_active: false, is_default: false }).eq("id", aid));
      return "archived";
    }
    check(await sb.from("cash_accounts").delete().eq("id", aid));
    return "deleted";
  });
}

const settingsSchema = z.object({
  budget_defaults: z.object(Object.fromEntries(PERCENT_BUDGET_KEYS.map((k) => [k, z.coerce.number().min(0).max(100)])) as Record<(typeof PERCENT_BUDGET_KEYS)[number], z.ZodNumber>),
  project_stages: z.array(z.string().trim().min(1).max(120)).min(1, "Minimal 1 tahapan").max(30),
  company_signatory: zOptText(120),
});

export async function saveErpSettings(input: unknown) {
  return run({ owner: true, schema: settingsSchema, input, revalidate: ["/admin/keuangan", "/admin/proyek"], message: "Pengaturan disimpan" }, async (sb, d) => {
    const sum = Object.values(d.budget_defaults).reduce((a, b) => a + b, 0);
    if (sum >= 100) throw new Error("Total persentase biaya harus di bawah 100%");
    check(await sb.from("settings").update(d).eq("id", true));
  });
}

