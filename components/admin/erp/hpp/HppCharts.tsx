import Link from "next/link";
import { fmtPct, HPP_LEVEL_META, hppLevel } from "@/lib/erp/hpp-shared";
import { formatRupiah } from "@/lib/format";
import { formatCompactRupiah } from "@/lib/orders";
import { cn } from "@/lib/utils";

export interface PctRow {
  key: string;
  label: string;
  pct: number | null;
  revenue: number;
  hpp: number;
  sub?: string;
  href?: string;
}

/**
 * Batang horizontal HPP% dengan garis target & batas.
 * Skala 0–100% (atau lebih bila ada HPP > 100%).
 */
export function HppPctBars({ rows, target, max, empty = "Belum ada data" }: { rows: PctRow[]; target: number; max: number; empty?: string }) {
  if (!rows.length) return <p className="py-6 text-center text-sm text-charcoal-700/70">{empty}</p>;
  const scale = Math.max(100, ...rows.map((r) => r.pct ?? 0));
  const pos = (v: number) => `${Math.min(100, (v / scale) * 100)}%`;
  return (
    <div>
      <ul className="space-y-3">
        {rows.map((r) => {
          const level = hppLevel(r.pct, target, max);
          const label = (
            <span className="truncate font-medium" title={r.label}>
              {r.label}
            </span>
          );
          return (
            <li key={r.key}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                {r.href ? (
                  <Link href={r.href} className="min-w-0 truncate hover:underline">
                    {label}
                  </Link>
                ) : (
                  label
                )}
                <span className="shrink-0 tabular-nums">
                  <span className={cn("font-semibold", HPP_LEVEL_META[level].text)}>{fmtPct(r.pct)}</span>
                  <span className="ml-1.5 text-xs text-charcoal-700/60">
                    {formatCompactRupiah(r.hpp)} / {formatCompactRupiah(r.revenue)}
                  </span>
                </span>
              </div>
              <div className="relative mt-1.5 h-2.5 rounded-full bg-charcoal-900/5">
                <div className={cn("h-full rounded-full", HPP_LEVEL_META[level].bar)} style={{ width: pos(r.pct ?? 0) }} />
                <span className="absolute inset-y-[-3px] w-0.5 bg-green-700/70" style={{ left: pos(target) }} aria-hidden />
                <span className="absolute inset-y-[-3px] w-0.5 bg-red-600/70" style={{ left: pos(max) }} aria-hidden />
              </div>
              {r.sub && <p className="mt-0.5 text-xs text-charcoal-700/60">{r.sub}</p>}
            </li>
          );
        })}
      </ul>
      <Legend target={target} max={max} />
    </div>
  );
}

export function Legend({ target, max }: { target: number; max: number }) {
  return (
    <p className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-charcoal-700/70">
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-green-600" /> Sehat ≤ {target}%
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-amber-500" /> Waspada {target}–{max}%
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-red-600" /> Terlalu tinggi &gt; {max}%
      </span>
    </p>
  );
}

/** Grafik kolom HPP% per bulan dengan garis target. SVG murni. */
export function MonthlyHppChart({ data, target, max }: { data: { month: string; pct: number | null; revenue: number; hpp: number }[]; target: number; max: number }) {
  if (!data.some((d) => d.pct !== null)) return <p className="py-10 text-center text-sm text-charcoal-700/70">Belum ada order dengan HPP di periode ini</p>;
  const W = 760;
  const H = 240;
  const pad = { l: 40, r: 12, t: 14, b: 28 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const top = Math.max(100, Math.ceil(Math.max(...data.map((d) => d.pct ?? 0)) / 20) * 20);
  const y = (v: number) => pad.t + ih - (v / top) * ih;
  const bw = iw / Math.max(1, data.length);
  const barW = Math.max(6, Math.min(36, bw * 0.6));
  const ticks = Array.from({ length: top / 20 + 1 }, (_, i) => i * 20);
  const color = { good: "#16a34a", warn: "#f59e0b", bad: "#dc2626", none: "#d4d4d4" };
  const monthLabel = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString("id-ID", { month: "short", year: "2-digit", timeZone: "UTC" });
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="HPP persen per bulan">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="rgba(23,23,23,0.07)" strokeDasharray={t ? "3 4" : undefined} />
            <text x={pad.l - 6} y={y(t) + 4} textAnchor="end" fill="rgba(56,58,61,0.65)" fontSize={10}>
              {t}%
            </text>
          </g>
        ))}
        {[
          { v: target, c: "#15803d" },
          { v: max, c: "#dc2626" },
        ].map((l) => (
          <line key={l.v} x1={pad.l} x2={W - pad.r} y1={y(l.v)} y2={y(l.v)} stroke={l.c} strokeOpacity={0.6} strokeDasharray="6 4" />
        ))}
        {data.map((d, i) => {
          const x = pad.l + bw * i + (bw - barW) / 2;
          const v = d.pct ?? 0;
          return (
            <g key={d.month}>
              {d.pct !== null && (
                <>
                  <rect x={x} y={y(v)} width={barW} height={Math.max(1, y(0) - y(v))} rx={3} fill={color[hppLevel(d.pct, target, max)]}>
                    <title>{`${monthLabel(d.month)} · HPP ${fmtPct(d.pct)} (${formatRupiah(d.hpp)} dari ${formatRupiah(d.revenue)})`}</title>
                  </rect>
                  {data.length <= 14 && (
                    <text x={x + barW / 2} y={y(v) - 4} textAnchor="middle" fontSize={10} fill="rgba(23,23,23,0.75)">
                      {Math.round(v)}%
                    </text>
                  )}
                </>
              )}
              <text x={pad.l + bw * i + bw / 2} y={H - 8} textAnchor="middle" fontSize={10} fill="rgba(56,58,61,0.75)">
                {monthLabel(d.month)}
              </text>
            </g>
          );
        })}
      </svg>
      <Legend target={target} max={max} />
    </div>
  );
}

/** Komposisi HPP (bahan, tenaga kerja, overhead, lainnya) — satu batang bertumpuk + daftar. */
export function CompositionBar({ parts, note }: { parts: { label: string; value: number; color: string }[]; note?: string }) {
  const total = parts.reduce((a, p) => a + p.value, 0);
  if (!total) return <p className="py-6 text-center text-sm text-charcoal-700/70">Belum ada rincian biaya</p>;
  return (
    <div>
      <div className="flex h-4 overflow-hidden rounded-full bg-charcoal-900/5">
        {parts.map((p) =>
          p.value > 0 ? <div key={p.label} style={{ width: `${(p.value / total) * 100}%`, background: p.color }} title={`${p.label}: ${formatRupiah(p.value)}`} /> : null,
        )}
      </div>
      <ul className="mt-4 space-y-2 text-sm">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} /> {p.label}
            </span>
            <span className="tabular-nums">
              {formatCompactRupiah(p.value)} <span className="ml-1 text-xs text-charcoal-700/60">{fmtPct((p.value / total) * 100, 0)}</span>
            </span>
          </li>
        ))}
      </ul>
      {note && <p className="mt-3 text-xs text-charcoal-700/60">{note}</p>}
    </div>
  );
}
