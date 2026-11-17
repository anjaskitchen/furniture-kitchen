import "server-only";
import { createClient } from "@/lib/supabase/server";

type SB = Awaited<ReturnType<typeof createClient>>;

/** Kolom numeric dari view/tabel HPP (PostgREST mengirim numeric sebagai string). */
const NUM_KEYS = new Set([
  "qty", "unit_price", "line_total", "length_m", "height_m", "sort_order", "hpp_overhead_pct", "overhead_pct", "cost_lines",
  "material", "labor", "overhead_lines", "other", "auto_overhead", "hpp_total", "hpp_unit", "hpp_pct", "unit_cost", "total",
  "subtotal", "discount", "additional_fee", "cost_estimate", "items_count", "items_with_hpp", "overhead", "hpp_detail",
  "hpp_estimate", "hpp_actual", "actual_material", "actual_labor", "actual_other",
]);
function numify<T>(row: Record<string, unknown>): T {
  const out: Record<string, unknown> = { ...row };
  for (const k of Object.keys(out)) if (NUM_KEYS.has(k) && out[k] !== null && out[k] !== undefined) out[k] = Number(out[k]);
  return out as T;
}
const numifyAll = <T>(rows: Record<string, unknown>[] | null | undefined) => (rows ?? []).map((r) => numify<T>(r));

export interface HppSettings {
  overheadPct: number;
  targetPct: number;
  maxPct: number;
}

export interface CostLine {
  id: string;
  order_item_id: string;
  category: string;
  material_item_id: string | null;
  name: string;
  qty: number;
  unit: string;
  unit_cost: number;
  total: number;
  source: string;
  notes: string | null;
  sort_order: number;
}

export interface ItemHpp {
  item_id: string;
  order_id: string;
  name: string;
  description: string | null;
  qty: number;
  unit: string;
  unit_price: number;
  line_total: number;
  length_m: number | null;
  height_m: number | null;
  sort_order: number;
  hpp_overhead_pct: number | null;
  overhead_pct: number;
  cost_lines: number;
  material: number;
  labor: number;
  overhead_lines: number;
  other: number;
  auto_overhead: number;
  hpp_total: number;
  hpp_unit: number | null;
  hpp_pct: number | null;
}

export interface OrderHpp {
  order_id: string;
  order_number: string;
  order_date: string;
  title: string;
  customer_name: string;
  category: string | null;
  status: string;
  subtotal: number;
  discount: number;
  additional_fee: number;
  total: number;
  cost_estimate: number;
  completed_at: string | null;
  project_id: string | null;
  items_count: number;
  items_with_hpp: number;
  material: number;
  labor: number;
  overhead: number;
  other: number;
  hpp_detail: number;
  has_detail: boolean;
  hpp_estimate: number;
  hpp_actual: number;
  actual_material: number;
  actual_labor: number;
  actual_other: number;
}

export async function getHppSettings(sb?: SB): Promise<HppSettings> {
  sb ??= await createClient();
  const { data } = await sb.from("settings").select("hpp_overhead_pct, hpp_target_pct, hpp_max_pct").eq("id", true).maybeSingle();
  return {
    overheadPct: Number(data?.hpp_overhead_pct ?? 10),
    targetPct: Number(data?.hpp_target_pct ?? 60),
    maxPct: Number(data?.hpp_max_pct ?? 75),
  };
}

/** Data kalkulator HPP satu order. */
export async function getOrderHppDetail(orderId: string) {
  const sb = await createClient();
  const [order, items, lines, settings] = await Promise.all([
    sb.from("order_hpp").select("*").eq("order_id", orderId).maybeSingle(),
    sb.from("order_item_hpp").select("*").eq("order_id", orderId).order("sort_order"),
    sb.from("order_item_costs").select("*").eq("order_id", orderId).order("sort_order").order("created_at"),
    getHppSettings(sb),
  ]);
  if (order.error) console.error("[hpp]", order.error.message);
  if (!order.data) return null;
  return {
    order: numify<OrderHpp>(order.data),
    items: numifyAll<ItemHpp>(items.data),
    lines: numifyAll<CostLine>(lines.data),
    settings,
  };
}

/** Order (bukan penawaran/batal) dalam periode untuk dashboard. */
export async function listOrderHpp(from: string, to: string): Promise<OrderHpp[]> {
  const sb = await createClient();
  const { data, error } = await sb
    .from("order_hpp")
    .select("*")
    .gte("order_date", from)
    .lte("order_date", to)
    .in("status", ["confirmed", "production", "installation", "completed"])
    .order("order_date", { ascending: false });
  if (error) console.error("[hpp:list]", error.message);
  return numifyAll<OrderHpp>(data);
}

export async function listItemHpp(orderIds: string[]): Promise<(ItemHpp & { order_number: string })[]> {
  if (!orderIds.length) return [];
  const sb = await createClient();
  const rows: Record<string, unknown>[] = [];
  // Batasi panjang URL query.
  for (let i = 0; i < orderIds.length; i += 150) {
    const { data, error } = await sb.from("order_item_hpp").select("*").in("order_id", orderIds.slice(i, i + 150)).gt("cost_lines", 0);
    if (error) console.error("[hpp:items]", error.message);
    rows.push(...(data ?? []));
  }
  return numifyAll(rows);
}

/** Bahan baku + harga terbaik supplier / rata-rata stok untuk pilihan baris material. */
export async function hppMaterialOptions(sb?: SB) {
  sb ??= await createClient();
  const { data } = await sb
    .from("material_stock_view")
    .select("id, code, name, unit, best_price, stock_value, qty_on_hand")
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("name");
  return (data ?? []).map((m) => {
    const onHand = Number(m.qty_on_hand ?? 0);
    const avg = onHand > 0 ? Number(m.stock_value ?? 0) / onHand : 0;
    return { id: m.id as string, label: `${m.name}${m.code ? ` · ${m.code}` : ""}`, name: m.name as string, unit: (m.unit as string) || "pcs", price: Number(m.best_price ?? 0) || Math.round(avg) };
  });
}
