import { ArrowDownRight, ArrowUpRight, Info, type LucideIcon, Minus } from "lucide-react";
import type { ReactNode } from "react";
import { formatRupiah } from "@/lib/format";
import { bucketLabel, deltaPct, formatCompactRupiah, paymentMeta, statusMeta, type OrderReport } from "@/lib/orders";
import { cn } from "@/lib/utils";

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const m = statusMeta(status);
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset", m.tone, className)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", m.dot)} aria-hidden />
      {m.label}
    </span>
  );
}

export function PaymentBadge({ status }: { status: string }) {
  const m = paymentMeta(status);
  return <span className={cn("inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset", m.tone)}>{m.label}</span>;
}

/** Perubahan vs periode sebelumnya. `invert`: turun = baik (mis. batal). */
export function Delta({ current, previous, invert = false }: { current: number; previous: number; invert?: boolean }) {
  const d = deltaPct(current, previous);
  if (d === null) return <span className="text-xs opacity-60">baru</span>;
  if (Math.abs(d) < 0.05)
    return (
      <span className="inline-flex items-center gap-0.5 text-xs opacity-60">
        <Minus className="h-3 w-3" /> 0%
      </span>
    );
  const good = invert ? d < 0 : d > 0;
  const Icon = d > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-xs font-semibold tabular-nums", good ? "text-green-600" : "text-red-500")}>
      <Icon className="h-3.5 w-3.5" />
      {Math.abs(d).toLocaleString("id-ID", { maximumFractionDigits: 1 })}%
    </span>
  );
}

export function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  delta,
  sub,
  emphasis = false,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: LucideIcon;
  delta?: ReactNode;
  sub?: ReactNode;
  emphasis?: boolean;
}) {
  return (
    <div className={cn("rounded-2xl p-4 ring-1 sm:p-5", emphasis ? "bg-charcoal-900 text-cream-50 ring-charcoal-900" : "bg-white ring-charcoal-900/5")}>
      <div className="flex items-start justify-between gap-2">
        <p className={cn("flex items-center gap-1 text-xs font-medium sm:text-sm", emphasis ? "text-cream-200/80" : "text-charcoal-700")}>
          {label}
          {hint && (
            <span title={hint} className="cursor-help" aria-label={hint}>
              <Info className="h-3.5 w-3.5 opacity-50" />
            </span>
          )}
        </p>
        {Icon && (
          <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg", emphasis ? "bg-white/10 text-bronze-300" : "bg-cream-100 text-wood-600")}>
            <Icon className="h-4 w-4" />
          </span>
        )}
      </div>
      <p className="mt-2 font-display text-xl font-bold tabular-nums sm:text-2xl">{value}</p>
      {(delta || sub) && (
        <div className={cn("mt-1 flex flex-wrap items-center gap-x-2 text-xs", emphasis ? "text-cream-200/70" : "text-charcoal-700/70")}>
          {delta}
          {sub}
        </div>
      )}
    </div>
  );
}

/** Grafik tren: batang = omset, garis = kas masuk. SVG murni (ringan, tanpa library). */
export function TrendChart({ report }: { report: OrderReport }) {
  const data = report.series;
  const W = 720;
  const H = 240;
  const pad = { l: 56, r: 12, t: 12, b: 28 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const max = Math.max(1, ...data.map((d) => Math.max(Number(d.revenue), Number(d.cash_in))));
  // Skala "bagus": 1/2/2.5/5 × 10^n
  const raw = max / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const top = step * 4;
  const y = (v: number) => pad.t + ih - (v / top) * ih;
  const bw = iw / Math.max(1, data.length);
  const barW = Math.max(2, Math.min(32, bw * 0.62));
  const labelEvery = Math.ceil(data.length / 10);
  const line = data.map((d, i) => `${i ? "L" : "M"}${(pad.l + bw * i + bw / 2).toFixed(1)},${y(Number(d.cash_in)).toFixed(1)}`).join(" ");
  const empty = data.every((d) => !Number(d.revenue) && !Number(d.cash_in));

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Grafik omset dan kas masuk">
        {[0, 1, 2, 3, 4].map((i) => (
          <g key={i}>
            <line x1={pad.l} x2={W - pad.r} y1={y(step * i)} y2={y(step * i)} stroke="rgba(28,28,28,0.08)" strokeDasharray={i ? "3 4" : undefined} />
            <text x={pad.l - 8} y={y(step * i) + 4} textAnchor="end" fill="rgba(58,58,58,0.6)" fontSize={10}>
              {formatCompactRupiah(step * i).replace("Rp ", "")}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = pad.l + bw * i + (bw - barW) / 2;
          const v = Number(d.revenue);
          return (
            <g key={d.bucket}>
              <rect x={x} y={y(v)} width={barW} height={Math.max(0, pad.t + ih - y(v))} rx={Math.min(4, barW / 3)} fill="#9A6B43" fillOpacity={0.88}>
                <title>{`${bucketLabel(d.bucket, report.range.grain)}: omset ${formatRupiah(v)} · ${d.orders} order · kas masuk ${formatRupiah(Number(d.cash_in))}`}</title>
              </rect>
              {i % labelEvery === 0 && (
                <text x={pad.l + bw * i + bw / 2} y={H - 8} textAnchor="middle" fill="rgba(58,58,58,0.7)" fontSize={10}>
                  {bucketLabel(d.bucket, report.range.grain)}
                </text>
              )}
            </g>
          );
        })}
        <path d={line} fill="none" stroke="#C8A46A" strokeWidth={2.25} strokeLinejoin="round" strokeLinecap="round" />
        {data.length <= 40 &&
          data.map((d, i) => <circle key={d.bucket} cx={pad.l + bw * i + bw / 2} cy={y(Number(d.cash_in))} r={2.5} fill="#fff" stroke="#B08D57" strokeWidth={1.5} />)}
      </svg>
      {empty && <p className="absolute inset-0 grid place-items-center text-sm text-charcoal-700/70">Belum ada transaksi pada periode ini</p>}
    </div>
  );
}

/** Rincian berbentuk bar horizontal + persentase kontribusi. */
export function BreakdownList({ rows, format = "money", empty = "Belum ada data" }: { rows: { label: string; value: number; sub?: string }[]; format?: "money" | "count"; empty?: string }) {
  const total = rows.reduce((a, r) => a + r.value, 0);
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (!rows.length) return <p className="py-6 text-center text-sm text-charcoal-700/70">{empty}</p>;
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate font-medium">{r.label}</span>
            <span className="shrink-0 tabular-nums">
              {format === "money" ? formatCompactRupiah(r.value) : r.value.toLocaleString("id-ID")}
              <span className="ml-1.5 text-xs text-charcoal-700/60">{total ? Math.round((r.value / total) * 100) : 0}%</span>
            </span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-cream-100">
            <div className="h-full rounded-full bg-wood-500" style={{ width: `${(r.value / max) * 100}%` }} />
          </div>
          {r.sub && <p className="mt-1 text-xs text-charcoal-700/60">{r.sub}</p>}
        </li>
      ))}
    </ul>
  );
}

export function Panel({ title, action, children, className }: { title: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-2xl bg-white p-5 ring-1 ring-charcoal-900/5 sm:p-6", className)}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-display text-base font-semibold sm:text-lg">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
