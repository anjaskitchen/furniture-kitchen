import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { OrderReport, OrderStatus } from "@/lib/orders";

export interface OrderRow {
  id: string;
  order_number: string;
  order_date: string;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  customer_address: string | null;
  title: string;
  category: string | null;
  source: string;
  status: OrderStatus;
  subtotal: number;
  discount: number;
  additional_fee: number;
  total: number;
  cost_estimate: number;
  paid_amount: number;
  balance: number;
  payment_status: "unpaid" | "partial" | "paid";
  gross_profit: number;
  is_booked: boolean;
  items_count: number;
  due_date: string | null;
  completed_at: string | null;
  survey_request_id: string | null;
  contact_message_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderItemRow {
  id: string;
  name: string;
  description: string | null;
  qty: number;
  unit: string;
  unit_price: number;
  line_total: number;
  sort_order: number;
}

export interface OrderPaymentRow {
  id: string;
  paid_at: string;
  amount: number;
  method: string;
  kind: string;
  reference: string | null;
  note: string | null;
}

const NUMERIC = ["subtotal", "discount", "additional_fee", "total", "cost_estimate", "paid_amount", "balance", "gross_profit", "items_count", "qty", "unit_price", "line_total", "amount"];

/** Postgres numeric dikirim sebagai string — ubah ke number. */
function numify<T>(row: Record<string, unknown>): T {
  const out: Record<string, unknown> = { ...row };
  for (const k of NUMERIC) if (out[k] !== undefined && out[k] !== null) out[k] = Number(out[k]);
  return out as T;
}

export interface OrderFilters {
  from: string;
  to: string;
  q?: string;
  status?: string;
  payment?: string;
  sort?: string;
  page?: number;
}

export const PAGE_SIZE = 25;

const SORTS: Record<string, { column: string; ascending: boolean }> = {
  newest: { column: "order_date", ascending: false },
  oldest: { column: "order_date", ascending: true },
  total_desc: { column: "total", ascending: false },
  balance_desc: { column: "balance", ascending: false },
  due: { column: "due_date", ascending: true },
};

export async function listOrders(f: OrderFilters, opts: { all?: boolean } = {}) {
  const sb = await createClient();
  let q = sb.from("orders_view").select("*", { count: "exact" }).gte("order_date", f.from).lte("order_date", f.to);
  if (f.status) q = q.eq("status", f.status);
  if (f.payment) q = q.eq("payment_status", f.payment);
  if (f.q) {
    // Karakter khusus PostgREST dibuang agar filter or() aman.
    const term = f.q.replace(/[,()*%\\]/g, " ").trim().slice(0, 60);
    if (term) q = q.or(`order_number.ilike.%${term}%,customer_name.ilike.%${term}%,customer_phone.ilike.%${term}%,title.ilike.%${term}%`);
  }
  const sort = SORTS[f.sort ?? "newest"] ?? SORTS.newest;
  q = q.order(sort.column, { ascending: sort.ascending, nullsFirst: false }).order("created_at", { ascending: false });
  if (!opts.all) {
    const page = Math.max(1, f.page ?? 1);
    q = q.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  } else {
    q = q.limit(5000);
  }
  const { data, count, error } = await q;
  if (error) console.error("[orders]", error.message);
  return { rows: (data ?? []).map((r) => numify<OrderRow>(r)), count: count ?? 0 };
}

export async function getOrder(id: string) {
  const sb = await createClient();
  const [order, items, payments] = await Promise.all([
    sb.from("orders_view").select("*").eq("id", id).maybeSingle(),
    sb.from("order_items").select("*").eq("order_id", id).order("sort_order"),
    sb.from("order_payments").select("*").eq("order_id", id).order("paid_at").order("created_at"),
  ]);
  if (!order.data) return null;
  return {
    order: numify<OrderRow>(order.data),
    items: (items.data ?? []).map((r) => numify<OrderItemRow>(r)),
    payments: (payments.data ?? []).map((r) => numify<OrderPaymentRow>(r)),
  };
}

export async function getOrderReport(from: string, to: string): Promise<OrderReport | null> {
  const sb = await createClient();
  const { data, error } = await sb.rpc("order_report", { p_from: from, p_to: to });
  if (error) {
    console.error("[order_report]", error.message);
    return null;
  }
  return data as OrderReport;
}

export async function getMonthlyTarget() {
  const sb = await createClient();
  const { data } = await sb.from("settings").select("monthly_revenue_target").eq("id", true).maybeSingle();
  return Number(data?.monthly_revenue_target ?? 0);
}

/** Kategori yang pernah dipakai + kategori katalog, untuk saran input. */
export async function getCategorySuggestions() {
  const sb = await createClient();
  const [cats, used] = await Promise.all([
    sb.from("categories").select("name").order("sort_order"),
    sb.from("orders").select("category").not("category", "is", null).limit(500),
  ]);
  const set = new Set<string>();
  for (const c of cats.data ?? []) set.add(c.name as string);
  for (const o of used.data ?? []) if (o.category) set.add(o.category as string);
  return [...set];
}
