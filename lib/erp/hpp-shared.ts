/** Konstanta & helper HPP yang dipakai server dan client. */

export const HPP_CATEGORIES = [
  { value: "material", label: "Bahan baku", color: "#A0714F" },
  { value: "labor", label: "Tenaga kerja", color: "#4B5138" },
  { value: "overhead", label: "Overhead", color: "#C9A227" },
  { value: "other", label: "Lainnya", color: "#8A8F98" },
] as const;

export const hppCategoryLabel = (v: string) => HPP_CATEGORIES.find((c) => c.value === v)?.label ?? v;

export type HppLevel = "good" | "warn" | "bad" | "none";

/** ≤ target = sehat (hijau), ≤ batas = waspada (kuning), di atasnya = bahaya (merah). */
export function hppLevel(pct: number | null | undefined, target: number, max: number): HppLevel {
  if (pct === null || pct === undefined || !Number.isFinite(pct)) return "none";
  if (pct <= target) return "good";
  if (pct <= max) return "warn";
  return "bad";
}

export const HPP_LEVEL_META: Record<HppLevel, { label: string; text: string; bg: string; bar: string }> = {
  good: { label: "Sehat", text: "text-green-700", bg: "bg-green-50 text-green-700 ring-green-600/20", bar: "bg-green-600" },
  warn: { label: "Waspada", text: "text-amber-700", bg: "bg-amber-50 text-amber-800 ring-amber-600/20", bar: "bg-amber-500" },
  bad: { label: "Terlalu tinggi", text: "text-red-600", bg: "bg-red-50 text-red-700 ring-red-600/20", bar: "bg-red-600" },
  none: { label: "Belum dihitung", text: "text-charcoal-700/60", bg: "bg-charcoal-900/5 text-charcoal-700 ring-charcoal-900/10", bar: "bg-charcoal-900/20" },
};

export const pct = (part: number, whole: number) => (whole > 0 ? (part / whole) * 100 : null);
export const fmtPct = (v: number | null | undefined, digits = 1) =>
  v === null || v === undefined || !Number.isFinite(v) ? "—" : `${v.toLocaleString("id-ID", { maximumFractionDigits: digits, minimumFractionDigits: 0 })}%`;

/** Harga jual minimum agar HPP% = target. */
export const priceForTarget = (hpp: number, targetPct: number) => (targetPct > 0 ? Math.ceil(hpp / (targetPct / 100) / 1000) * 1000 : 0);
