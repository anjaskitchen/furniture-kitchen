"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/app/admin/actions";
import { assertAdmin, AuthError } from "@/lib/admin/auth";
import { ORDER_SOURCES, ORDER_STATUSES, PAYMENT_KINDS, PAYMENT_METHODS } from "@/lib/orders";
import { createClient } from "@/lib/supabase/server";

const values = <T extends { value: string }>(list: readonly T[]) => list.map((x) => x.value) as [string, ...string[]];
const money = (label: string) =>
  z.coerce
    .number({ message: `${label} harus angka` })
    .min(0, `${label} tidak boleh negatif`)
    .max(100_000_000_000, `${label} terlalu besar`)
    .transform((n) => Math.round(n * 100) / 100);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => v || null);
const optionalDate = z
  .string()
  .optional()
  .nullable()
  .refine((v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v), "Tanggal tidak valid")
  .transform((v) => v || null);

const itemSchema = z.object({
  name: z.string().trim().min(1, "Nama item wajib diisi").max(200),
  description: optionalText(500),
  qty: z.coerce.number({ message: "Qty harus angka" }).gt(0, "Qty harus lebih dari 0").max(100_000),
  unit: z.string().trim().max(20).default("unit"),
  unit_price: money("Harga satuan"),
});

const paymentSchema = z.object({
  paid_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal bayar tidak valid"),
  amount: money("Jumlah bayar").refine((n) => n > 0, "Jumlah bayar harus lebih dari 0"),
  method: z.enum(values(PAYMENT_METHODS)),
  kind: z.enum(values(PAYMENT_KINDS)),
  reference: optionalText(100),
  note: optionalText(300),
});

const orderSchema = z
  .object({
    id: z.string().uuid().optional().nullable(),
    order_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal order tidak valid"),
    customer_name: z.string().trim().min(2, "Nama customer minimal 2 karakter").max(120),
    customer_phone: optionalText(30),
    customer_email: z
      .string()
      .trim()
      .max(120)
      .optional()
      .nullable()
      .refine((v) => !v || z.string().email().safeParse(v).success, "Email tidak valid")
      .transform((v) => v || null),
    customer_address: optionalText(500),
    title: z.string().trim().min(2, "Judul project minimal 2 karakter").max(200),
    category: optionalText(80),
    source: z.enum(values(ORDER_SOURCES)),
    status: z.enum(values(ORDER_STATUSES)),
    discount: money("Diskon"),
    additional_fee: money("Biaya tambahan"),
    cost_estimate: money("HPP"),
    due_date: optionalDate,
    completed_at: optionalDate,
    survey_request_id: z.string().uuid().optional().nullable(),
    contact_message_id: z.string().uuid().optional().nullable(),
    notes: optionalText(2000),
    items: z.array(itemSchema).min(1, "Tambahkan minimal 1 item").max(100),
    payments: z.array(paymentSchema).max(50),
  })
  .superRefine((o, ctx) => {
    const subtotal = o.items.reduce((a, i) => a + Math.round(i.qty * i.unit_price * 100) / 100, 0);
    const total = subtotal - o.discount + o.additional_fee;
    if (total < 0) ctx.addIssue({ code: "custom", path: ["discount"], message: "Diskon melebihi subtotal + biaya tambahan" });
    const paid = o.payments.reduce((a, p) => a + p.amount, 0);
    if (o.status !== "cancelled" && paid - Math.max(total, 0) > 0.009) {
      ctx.addIssue({ code: "custom", path: ["payments"], message: "Total pembayaran melebihi total order" });
    }
    if (o.due_date && o.due_date < o.order_date) ctx.addIssue({ code: "custom", path: ["due_date"], message: "Jatuh tempo tidak boleh sebelum tanggal order" });
    if (o.completed_at && o.completed_at < o.order_date) {
      ctx.addIssue({ code: "custom", path: ["completed_at"], message: "Tanggal selesai tidak boleh sebelum tanggal order" });
    }
  });

function fail(e: unknown): ActionResult {
  if (e instanceof AuthError) return { ok: false, error: e.message };
  const msg = e instanceof Error ? e.message : String(e);
  console.error("[orders]", msg);
  return { ok: false, error: "Terjadi kesalahan: " + msg };
}

function revalidateOrders(id?: string) {
  revalidatePath("/admin/orders");
  revalidatePath("/admin/reports");
  revalidatePath("/admin");
  if (id) revalidatePath(`/admin/orders/${id}`);
}

export async function saveOrder(input: unknown): Promise<ActionResult & { id?: string }> {
  try {
    await assertAdmin();
    const parsed = orderSchema.safeParse(input);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const i of parsed.error.issues) fieldErrors[i.path.join(".")] ??= i.message;
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Periksa kembali isian", fieldErrors };
    }
    const data = { ...parsed.data, completed_at: parsed.data.status === "completed" ? parsed.data.completed_at : null };
    const sb = await createClient();
    const { data: id, error } = await sb.rpc("save_order", { p: data });
    if (error) throw new Error(error.message);
    revalidateOrders(id as string);
    return { ok: true, message: parsed.data.id ? "Order diperbarui" : "Order dibuat", id: id as string };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteOrder(id: string): Promise<ActionResult> {
  try {
    await assertAdmin();
    if (!z.string().uuid().safeParse(id).success) return { ok: false, error: "ID tidak valid" };
    const sb = await createClient();
    const { error } = await sb.from("orders").delete().eq("id", id);
    if (error) throw new Error(error.message);
    revalidateOrders();
    return { ok: true, message: "Order dihapus" };
  } catch (e) {
    return fail(e);
  }
}

export async function updateOrderStatus(id: string, status: string): Promise<ActionResult> {
  try {
    await assertAdmin();
    if (!z.string().uuid().safeParse(id).success || !values(ORDER_STATUSES).includes(status)) return { ok: false, error: "Data tidak valid" };
    const sb = await createClient();
    const { error } = await sb.from("orders").update({ status }).eq("id", id);
    if (error) throw new Error(error.message);
    revalidateOrders(id);
    return { ok: true, message: `Status: ${ORDER_STATUSES.find((s) => s.value === status)!.label}` };
  } catch (e) {
    return fail(e);
  }
}

export async function saveRevenueTarget(amount: unknown): Promise<ActionResult> {
  try {
    await assertAdmin(true);
    const parsed = money("Target").safeParse(amount);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
    const sb = await createClient();
    const { error } = await sb.from("settings").update({ monthly_revenue_target: parsed.data }).eq("id", true);
    if (error) throw new Error(error.message);
    revalidatePath("/admin/reports");
    revalidatePath("/admin");
    return { ok: true, message: "Target omset bulanan disimpan" };
  } catch (e) {
    return fail(e);
  }
}
