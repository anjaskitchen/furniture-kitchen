import { formatRupiah } from "@/lib/format";
import { formatCompactRupiah } from "@/lib/orders";

export interface Series {
  key: string;
  label: string;
  color: string;
  type: "bar" | "line";
}

const monthLabel = (m: string) => new Date(`${m}T00:00:00Z`).toLocaleDateString("id-ID", { month: "short", year: "2-digit", timeZone: "UTC" });

/** Grafik bulanan: beberapa batang (dikelompokkan) + garis. SVG murni, ringan, tanpa library. */
export function MonthlyChart({ data, series, height = 260 }: { data: Record<string, number | string>[]; series: Series[]; height?: number }) {
  const W = 760;
  const H = height;
  const pad = { l: 60, r: 12, t: 12, b: 28 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const vals = data.flatMap((d) => series.map((s) => Number(d[s.key]) || 0));
  const max = Math.max(1, ...vals);
  const min = Math.min(0, ...vals);
  const raw = (max - min) / 4;
  const mag = 10 ** Math.floor(Math.log10(Math.max(raw, 1)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const lo = Math.floor(min / step) * step;
  const hi = lo + step * Math.max(4, Math.ceil((max - lo) / step));
  const y = (v: number) => pad.t + ih - ((v - lo) / (hi - lo)) * ih;
  const bw = iw / Math.max(1, data.length);
  const bars = series.filter((s) => s.type === "bar");
  const lines = series.filter((s) => s.type === "line");
  const barW = Math.max(3, Math.min(18, (bw * 0.75) / Math.max(1, bars.length)));
  const ticks = Array.from({ length: Math.round((hi - lo) / step) + 1 }, (_, i) => lo + step * i);
  const empty = vals.every((v) => !v);

  return (
    <div>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={series.map((s) => s.label).join(", ")}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke={t === 0 ? "rgba(23,23,23,0.25)" : "rgba(23,23,23,0.07)"} strokeDasharray={t === 0 ? undefined : "3 4"} />
              <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" fill="rgba(56,58,61,0.65)" fontSize={10}>
                {formatCompactRupiah(t).replace("Rp ", "")}
              </text>
            </g>
          ))}
          {data.map((d, i) => {
            const x0 = pad.l + bw * i + (bw - barW * bars.length) / 2;
            return (
              <g key={String(d.month)}>
                {bars.map((s, j) => {
                  const v = Number(d[s.key]) || 0;
                  const top = y(Math.max(v, 0));
                  const h = Math.abs(y(v) - y(0));
                  return (
                    <rect key={s.key} x={x0 + j * barW} y={top} width={barW - 1} height={Math.max(h, v ? 1 : 0)} rx={2} fill={s.color}>
                      <title>{`${monthLabel(String(d.month))} · ${s.label}: ${formatRupiah(v)}`}</title>
                    </rect>
                  );
                })}
                <text x={pad.l + bw * i + bw / 2} y={H - 8} textAnchor="middle" fill="rgba(56,58,61,0.75)" fontSize={10}>
                  {monthLabel(String(d.month))}
                </text>
              </g>
            );
          })}
          {lines.map((s) => {
            const path = data.map((d, i) => `${i ? "L" : "M"}${(pad.l + bw * i + bw / 2).toFixed(1)},${y(Number(d[s.key]) || 0).toFixed(1)}`).join(" ");
            return (
              <g key={s.key}>
                <path d={path} fill="none" stroke={s.color} strokeWidth={2.25} strokeLinejoin="round" strokeLinecap="round" />
                {data.map((d, i) => (
                  <circle key={i} cx={pad.l + bw * i + bw / 2} cy={y(Number(d[s.key]) || 0)} r={3} fill="#fff" stroke={s.color} strokeWidth={1.75}>
                    <title>{`${monthLabel(String(d.month))} · ${s.label}: ${formatRupiah(Number(d[s.key]) || 0)}`}</title>
                  </circle>
                ))}
              </g>
            );
          })}
        </svg>
        {empty && <p className="absolute inset-0 grid place-items-center text-sm text-charcoal-700/70">Belum ada transaksi</p>}
      </div>
      <div className="mt-2 flex flex-wrap gap-4 text-xs text-charcoal-700">
        {series.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <span className={s.type === "line" ? "h-0.5 w-4" : "h-3 w-3 rounded-sm"} style={{ background: s.color }} /> {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Perbandingan anggaran vs realisasi per proyek (bar horizontal ganda). */
export function BudgetBars({ rows }: { rows: { id: string; label: string; budget: number; actual: number; href?: string }[] }) {
  if (!rows.length) return <p className="py-6 text-center text-sm text-charcoal-700/70">Belum ada proyek aktif dengan anggaran</p>;
  const max = Math.max(1, ...rows.flatMap((r) => [r.budget, r.actual]));
  return (
    <ul className="space-y-3">
      {rows.map((r) => {
        const over = r.budget > 0 && r.actual > r.budget;
        return (
          <li key={r.id}>
            <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
              {r.href ? (
                <a href={r.href} className="truncate font-medium hover:underline">
                  {r.label}
                </a>
              ) : (
                <span className="truncate font-medium">{r.label}</span>
              )}
              <span className={`shrink-0 text-xs tabular-nums ${over ? "font-semibold text-red-600" : "text-charcoal-700"}`}>
                {formatCompactRupiah(r.actual)} / {formatCompactRupiah(r.budget)}
              </span>
            </div>
            <div className="space-y-1">
              <div className="h-1.5 overflow-hidden rounded-full bg-cream-200">
                <div className="h-full rounded-full bg-[#17263C]/70" style={{ width: `${(r.budget / max) * 100}%` }} />
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-cream-200">
                <div className={`h-full rounded-full ${over ? "bg-red-500" : "bg-[#4B5138]"}`} style={{ width: `${(r.actual / max) * 100}%` }} />
              </div>
            </div>
          </li>
        );
      })}
      <li className="flex gap-4 pt-1 text-xs text-charcoal-700">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-4 rounded bg-[#17263C]/70" /> Anggaran
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-4 rounded bg-[#4B5138]" /> Realisasi
        </span>
      </li>
    </ul>
  );
}
