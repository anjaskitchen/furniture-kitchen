import "server-only";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/app/admin/actions";
import { assertAdmin, AuthError } from "@/lib/admin/auth";
import { createClient } from "@/lib/supabase/server";

export type { ActionResult };
export type DataResult<T> = (ActionResult & { data?: T }) | ({ ok: true; message?: string; data?: T });

const NUMERIC_KEY =
  /^(qty|price|amount|total|subtotal|discount|shipping_cost|paid_amount|unit_cost|unit_price|line_total|est_|stock_value|best_price|recommended_price|budget_|material_(?!item)|labor_|other_actual|actual_(?!end)|estimated_(?!days$)|contract_value|balance|rab_total|progress|expected_progress|covered_qty|still_needed|shortage_qty|on_order_qty|stock_available|allocated_remaining|used_qty|min_stock|opening_balance|daily_|monthly_salary|default_|days_worked|base_amount|net_amount|outstanding|repaid_amount|installment_amount|estimated_days|agreed_amount|waste_pct|total_|supplier_count|working_days|actual_days|planned_days|size_bytes)|_(price|amount|cost|total|qty|balance|days)$/;

/** Postgres numeric dikirim sebagai string — ubah ke number untuk kolom angka. */
export function numify<T>(row: Record<string, unknown>): T {
  const out: Record<string, unknown> = { ...row };
  for (const [k, v] of Object.entries(out)) {
    if (typeof v === "string" && NUMERIC_KEY.test(k) && /^-?\d+(\.\d+)?$/.test(v)) out[k] = Number(v);
  }
  return out as T;
}
export const numifyAll = <T>(rows: Record<string, unknown>[] | null | undefined) => (rows ?? []).map((r) => numify<T>(r));

/** Terjemahkan error database ke pesan yang dipahami admin. */
export function friendlyError(msg: string) {
  if (/duplicate key.*payroll_period/i.test(msg)) return "Slip gaji untuk pegawai & periode ini sudah ada";
  if (/duplicate key.*employee_attendance/i.test(msg)) return "Absensi pegawai pada tanggal ini sudah ada";
  if (/duplicate key.*supplier_products/i.test(msg)) return "Barang ini sudah terdaftar di supplier tersebut";
  if (/duplicate key.*project_workers/i.test(msg)) return "Pegawai sudah ditugaskan di proyek ini";
  if (/duplicate key/i.test(msg)) return "Data yang sama sudah ada";
  if (/violates foreign key constraint/i.test(msg) && /delete|update/i.test(msg)) return "Data ini sudah dipakai di transaksi lain sehingga tidak bisa dihapus. Nonaktifkan saja.";
  if (/row-level security|permission denied/i.test(msg)) return "Akses ditolak untuk akun Anda";
  return msg;
}

export function fail(e: unknown): ActionResult {
  if (e instanceof AuthError) return { ok: false, error: e.message };
  const msg = e instanceof Error ? e.message : String(e);
  console.error("[erp]", msg);
  return { ok: false, error: friendlyError(msg) };
}

export function zodFail(error: z.ZodError): ActionResult {
  const fieldErrors: Record<string, string> = {};
  for (const i of error.issues) fieldErrors[i.path.join(".")] ??= i.message;
  return { ok: false, error: error.issues[0]?.message ?? "Periksa kembali isian", fieldErrors };
}

/** Jalankan aksi admin: cek role, validasi, eksekusi, revalidate path. */
export async function run<S extends z.ZodTypeAny, R = void>(
  opts: { owner?: boolean; schema?: S; input?: unknown; revalidate?: string[]; message?: string },
  fn: (sb: Awaited<ReturnType<typeof createClient>>, data: z.infer<S>) => Promise<R>,
): Promise<ActionResult & { data?: R }> {
  try {
    await assertAdmin(opts.owner);
    let data = opts.input as z.infer<S>;
    if (opts.schema) {
      const parsed = opts.schema.safeParse(opts.input);
      if (!parsed.success) return zodFail(parsed.error);
      data = parsed.data;
    }
    const sb = await createClient();
    const result = await fn(sb, data);
    for (const p of opts.revalidate ?? []) revalidatePath(p, "layout");
    return { ok: true, message: opts.message, data: result };
  } catch (e) {
    return fail(e);
  }
}

/** Lempar error Supabase sebagai Error biasa. */
export function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

// ---------------------------------------------------------------------------
// Validator umum
// ---------------------------------------------------------------------------
export const zId = z.string().uuid("ID tidak valid");
export const zOptId = z
  .union([z.literal(""), z.null(), z.undefined(), z.string().uuid("Pilihan tidak valid")])
  .transform((v) => v || null);
export const zText = (label: string, min = 1, max = 200) => z.string({ message: `${label} wajib diisi` }).trim().min(min, `${label} wajib diisi`).max(max, `${label} terlalu panjang`);
export const zOptText = (max = 500) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => v || null);
/** Tanggal YYYY-MM-DD yang masuk akal (tahun 1900–2100); mencegah salah ketik seperti tahun 275760. */
const validDate = (v: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const y = Number(v.slice(0, 4));
  return y >= 1900 && y <= 2100 && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));
};
const DATE_MSG = "Tanggal tidak valid — periksa tahunnya (format hari/bulan/tahun 4 digit)";
export const zDate = z.string({ message: "Tanggal wajib diisi" }).refine(validDate, DATE_MSG);
export const zOptDate = z
  .string()
  .optional()
  .nullable()
  .refine((v) => !v || validDate(v), DATE_MSG)
  .transform((v) => v || null);
export const zMoney = (label: string) =>
  z.coerce
    .number({ message: `${label} harus angka` })
    .min(0, `${label} tidak boleh negatif`)
    .max(100_000_000_000, `${label} terlalu besar`)
    .transform((n) => Math.round(n * 100) / 100);
export const zPositive = (label: string, max = 1_000_000) =>
  z.coerce
    .number({ message: `${label} harus angka` })
    .gt(0, `${label} harus lebih dari 0`)
    .max(max, `${label} terlalu besar`)
    .transform((n) => Math.round(n * 100) / 100);
export const zQty = (label: string) =>
  z.coerce
    .number({ message: `${label} harus angka` })
    .min(0, `${label} tidak boleh negatif`)
    .max(1_000_000, `${label} terlalu besar`)
    .transform((n) => Math.round(n * 100) / 100);
