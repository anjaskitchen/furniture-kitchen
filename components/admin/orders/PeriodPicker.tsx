"use client";
import { CalendarRange, Check } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { PERIOD_PRESETS } from "@/lib/orders";
import { cn } from "@/lib/utils";

/** Pilihan periode (preset atau rentang tanggal) yang disimpan di URL. */
export function PeriodPicker({ preset, from, to, rangeLabel }: { preset: string; from: string; to: string; rangeLabel: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const [custom, setCustom] = useState(false);
  const [range, setRange] = useState({ from, to });
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => setRange({ from, to }), [from, to]);
  useEffect(() => {
    if (!custom) return;
    const onClick = (e: MouseEvent) => !panel.current?.contains(e.target as Node) && setCustom(false);
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [custom]);

  const go = (next: Record<string, string | null>) => {
    const sp = new URLSearchParams(params.toString());
    for (const k of ["preset", "from", "to", "page"]) sp.delete(k);
    for (const [k, v] of Object.entries(next)) if (v) sp.set(k, v);
    start(() => router.push(`${pathname}?${sp.toString()}`, { scroll: false }));
  };

  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-center", pending && "opacity-70")}>
      <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0 sm:pb-0">
        {PERIOD_PRESETS.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => go({ preset: p.value })}
            className={cn(
              "shrink-0 rounded-full px-3.5 py-1.5 text-sm transition",
              preset === p.value ? "bg-charcoal-900 font-semibold text-cream-50" : "bg-white text-charcoal-700 ring-1 ring-charcoal-900/10 hover:bg-cream-50",
            )}
          >
            {p.label}
          </button>
        ))}
        <div className="relative shrink-0" ref={panel}>
          <button
            type="button"
            onClick={() => setCustom((c) => !c)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm transition",
              preset === "custom" ? "bg-charcoal-900 font-semibold text-cream-50" : "bg-white text-charcoal-700 ring-1 ring-charcoal-900/10 hover:bg-cream-50",
            )}
            aria-expanded={custom}
          >
            <CalendarRange className="h-4 w-4" /> {preset === "custom" ? rangeLabel : "Pilih tanggal"}
          </button>
          {custom && (
            <div className="fixed inset-x-4 top-1/3 z-50 rounded-2xl bg-white p-4 shadow-soft ring-1 ring-charcoal-900/10 sm:absolute sm:inset-x-auto sm:left-0 sm:top-full sm:mt-2 sm:w-80">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label !text-xs" htmlFor="pp-from">Dari</label>
                  <input id="pp-from" type="date" className="input !py-2" value={range.from} max={range.to} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} />
                </div>
                <div>
                  <label className="label !text-xs" htmlFor="pp-to">Sampai</label>
                  <input id="pp-to" type="date" className="input !py-2" value={range.to} min={range.from} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} />
                </div>
              </div>
              <button
                type="button"
                disabled={!range.from || !range.to || range.from > range.to}
                onClick={() => {
                  setCustom(false);
                  go({ from: range.from, to: range.to });
                }}
                className="btn-primary btn-sm mt-3 w-full !py-2.5"
              >
                <Check className="h-4 w-4" /> Terapkan
              </button>
            </div>
          )}
        </div>
      </div>
      <p className="text-xs font-medium text-charcoal-700 sm:ml-auto">{rangeLabel}</p>
    </div>
  );
}
