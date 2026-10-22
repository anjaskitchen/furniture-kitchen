/**
 * Konstanta & helper modul penjualan (data murni — aman untuk client & server).
 * Definisi angka mengikuti supabase/migrations/20261022000500_orders.sql.
 */

export const ORDER_STATUSES = [
  { value: "quotation", label: "Penawaran", tone: "bg-sky-50 text-sky-800 ring-sky-200", dot: "bg-sky-500" },
  { value: "confirmed", label: "Deal", tone: "bg-amber-50 text-amber-800 ring-amber-200", dot: "bg-amber-500" },
  { value: "production", label: "Produksi", tone: "bg-orange-50 text-orange-800 ring-orange-200", dot: "bg-orange-500" },
  { value: "installation", label: "Instalasi", tone: "bg-violet-50 text-violet-800 ring-violet-200", dot: "bg-violet-500" },
  { value: "completed", label: "Selesai", tone: "bg-green-50 text-green-800 ring-green-200", dot: "bg-green-600" },
  { value: "cancelled", label: "Batal", tone: "bg-charcoal-900/5 text-charcoal-700 ring-charcoal-900/10", dot: "bg-charcoal-700/50" },
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number]["value"];
export const BOOKED_STATUSES: OrderStatus[] = ["confirmed", "production", "installation", "completed"];

export const ORDER_SOURCES = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "website", label: "Website" },
  { value: "survey", label: "Request survey" },
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "TikTok" },
  { value: "facebook", label: "Facebook" },
  { value: "referral", label: "Referensi" },
  { value: "walk_in", label: "Datang langsung" },
  { value: "repeat", label: "Customer lama" },
  { value: "other", label: "Lainnya" },
] as const;

export const PAYMENT_METHODS = [
  { value: "transfer", label: "Transfer bank" },
  { value: "cash", label: "Tunai" },
  { value: "qris", label: "QRIS" },
  { value: "debit", label: "Kartu debit" },
  { value: "credit", label: "Kartu kredit" },
  { value: "other", label: "Lainnya" },
] as const;

export const PAYMENT_KINDS = [
  { value: "dp", label: "DP" },
  { value: "termin", label: "Termin" },
  { value: "pelunasan", label: "Pelunasan" },
  { value: "other", label: "Lainnya" },
] as const;

export const PAYMENT_STATUSES = [
  { value: "unpaid", label: "Belum bayar", tone: "bg-red-50 text-red-700 ring-red-200" },
  { value: "partial", label: "Sebagian", tone: "bg-amber-50 text-amber-800 ring-amber-200" },
  { value: "paid", label: "Lunas", tone: "bg-green-50 text-green-800 ring-green-200" },
] as const;

export const ITEM_UNITS = ["unit", "meter", "m²", "set", "pcs", "paket", "titik"] as const;

const find = <T extends { value: string }>(list: readonly T[], v: string | null | undefined) => list.find((x) => x.value === v);
export const statusMeta = (v: string | null | undefined) => find(ORDER_STATUSES, v) ?? ORDER_STATUSES[1];
export const sourceLabel = (v: string | null | undefined) => find(ORDER_SOURCES, v)?.label ?? v ?? "-";
export const methodLabel = (v: string | null | undefined) => find(PAYMENT_METHODS, v)?.label ?? v ?? "-";
export const kindLabel = (v: string | null | undefined) => find(PAYMENT_KINDS, v)?.label ?? v ?? "-";
export const paymentMeta = (v: string | null | undefined) => find(PAYMENT_STATUSES, v) ?? PAYMENT_STATUSES[0];

// ---------------------------------------------------------------------------
// Periode laporan (semua tanggal "YYYY-MM-DD" dalam zona Asia/Jakarta)
// ---------------------------------------------------------------------------
export const PERIOD_PRESETS = [
  { value: "today", label: "Hari ini" },
  { value: "7d", label: "7 hari" },
  { value: "30d", label: "30 hari" },
  { value: "this_month", label: "Bulan ini" },
  { value: "last_month", label: "Bulan lalu" },
  { value: "this_quarter", label: "Kuartal ini" },
  { value: "this_year", label: "Tahun ini" },
  { value: "last_year", label: "Tahun lalu" },
] as const;
export type PeriodPreset = (typeof PERIOD_PRESETS)[number]["value"] | "custom";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Tanggal hari ini di Jakarta (YYYY-MM-DD). */
export function jakartaToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

const toUtc = (d: string) => new Date(`${d}T00:00:00Z`);
const fmt = (d: Date) => d.toISOString().slice(0, 10);
export function addDays(d: string, n: number) {
  const x = toUtc(d);
  x.setUTCDate(x.getUTCDate() + n);
  return fmt(x);
}
const monthStart = (y: number, m: number) => fmt(new Date(Date.UTC(y, m, 1)));
const monthEnd = (y: number, m: number) => fmt(new Date(Date.UTC(y, m + 1, 0)));
export const daysBetween = (from: string, to: string) => Math.round((toUtc(to).getTime() - toUtc(from).getTime()) / 86_400_000) + 1;
export const isValidDate = (d: unknown): d is string => typeof d === "string" && DATE_RE.test(d) && !Number.isNaN(toUtc(d).getTime());

export function presetRange(preset: Exclude<PeriodPreset, "custom">, today = jakartaToday()) {
  const t = toUtc(today);
  const y = t.getUTCFullYear();
  const m = t.getUTCMonth();
  switch (preset) {
    case "today":
      return { from: today, to: today };
    case "7d":
      return { from: addDays(today, -6), to: today };
    case "30d":
      return { from: addDays(today, -29), to: today };
    case "last_month":
      return { from: monthStart(y, m - 1), to: monthEnd(y, m - 1) };
    case "this_quarter": {
      const q = Math.floor(m / 3) * 3;
      return { from: monthStart(y, q), to: monthEnd(y, q + 2) };
    }
    case "this_year":
      return { from: `${y}-01-01`, to: `${y}-12-31` };
    case "last_year":
      return { from: `${y - 1}-01-01`, to: `${y - 1}-12-31` };
    case "this_month":
    default:
      return { from: monthStart(y, m), to: monthEnd(y, m) };
  }
}

/** Baca periode dari query string (?preset=... atau ?from=&to=). Default: bulan ini. */
export function resolvePeriod(sp: Record<string, string | string[] | undefined>, fallback: Exclude<PeriodPreset, "custom"> = "this_month") {
  const from = typeof sp.from === "string" ? sp.from : undefined;
  const to = typeof sp.to === "string" ? sp.to : undefined;
  if (isValidDate(from) && isValidDate(to) && from <= to && daysBetween(from, to) <= 3660) {
    return { preset: "custom" as PeriodPreset, from, to, label: periodLabel(from, to) };
  }
  const p = PERIOD_PRESETS.find((x) => x.value === sp.preset)?.value ?? fallback;
  const r = presetRange(p);
  return { preset: p as PeriodPreset, ...r, label: PERIOD_PRESETS.find((x) => x.value === p)!.label };
}

export function formatDateShort(d: string) {
  return toUtc(d).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export function periodLabel(from: string, to: string) {
  return from === to ? formatDateShort(from) : `${formatDateShort(from)} – ${formatDateShort(to)}`;
}

/** Label sumbu grafik sesuai granularitas laporan. */
export function bucketLabel(bucket: string, grain: "day" | "week" | "month") {
  const d = toUtc(bucket);
  if (grain === "month") return d.toLocaleDateString("id-ID", { month: "short", year: "2-digit", timeZone: "UTC" });
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", timeZone: "UTC" });
}

/**
 * Target omset untuk sebuah periode = target bulanan × porsi hari tiap bulan yang tercakup.
 * Contoh: 1–15 Okt (31 hari) dengan target 100 jt → 48,4 jt.
 */
export function targetForPeriod(monthlyTarget: number, from: string, to: string) {
  if (!monthlyTarget) return 0;
  let total = 0;
  let cursor = from;
  while (cursor <= to) {
    const c = toUtc(cursor);
    const end = monthEnd(c.getUTCFullYear(), c.getUTCMonth());
    const segEnd = end < to ? end : to;
    const daysInMonth = toUtc(end).getUTCDate();
    total += monthlyTarget * (daysBetween(cursor, segEnd) / daysInMonth);
    cursor = addDays(segEnd, 1);
  }
  return Math.round(total);
}

/** Persentase perubahan vs periode sebelumnya; null jika tidak bisa dibandingkan. */
export function deltaPct(current: number, previous: number) {
  if (!previous) return current ? null : 0;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export function formatCompactRupiah(n: number) {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1e9) return `${sign}Rp ${(abs / 1e9).toLocaleString("id-ID", { maximumFractionDigits: 2 })} M`;
  if (abs >= 1e6) return `${sign}Rp ${(abs / 1e6).toLocaleString("id-ID", { maximumFractionDigits: 1 })} jt`;
  if (abs >= 1e3) return `${sign}Rp ${(abs / 1e3).toLocaleString("id-ID", { maximumFractionDigits: 0 })} rb`;
  return `${sign}Rp ${abs.toLocaleString("id-ID")}`;
}

export interface OrderReport {
  range: { from: string; to: string; prev_from: string; prev_to: string; days: number; grain: "day" | "week" | "month" };
  current: PeriodKpi;
  previous: PeriodKpi;
  receivables: { amount: number; orders: number; overdue_amount: number; overdue_orders: number };
  pipeline: { status: OrderStatus; orders: number; value: number }[];
  series: { bucket: string; revenue: number; orders: number; cash_in: number }[];
  by_category: { label: string; revenue: number; orders: number }[];
  by_source: { label: string; revenue: number; orders: number }[];
  by_status: { label: OrderStatus; value: number; orders: number }[];
  top_customers: { name: string; phone: string | null; revenue: number; orders: number }[];
}

export interface PeriodKpi {
  revenue: number;
  orders: number;
  gross_profit: number;
  cost: number;
  cash_in: number;
  payments: number;
  completed: number;
  cancelled: number;
  quotations: number;
  leads: number;
}
