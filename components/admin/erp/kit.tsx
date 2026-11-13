"use client";
import { Loader2, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useCallback, useState, useTransition } from "react";
import { useToast } from "@/components/Toast";
import { labelOf, toneOf } from "@/lib/erp/constants";
import { cn } from "@/lib/utils";

type Result = { ok: true; message?: string; data?: unknown } | { ok: false; error: string; fieldErrors?: Record<string, string> };

/**
 * Jalankan server action dari client: tampilkan toast, refresh data server,
 * simpan field error untuk form.
 */
export function useAction() {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const run = useCallback(
    <R extends Result>(fn: () => Promise<R>, opts: { success?: string; onOk?: (r: R) => void; refresh?: boolean; confirm?: string } = {}) => {
      if (opts.confirm && !window.confirm(opts.confirm)) return;
      start(async () => {
        const res = await fn();
        if (res.ok) {
          setErrors({});
          toast(opts.success ?? res.message ?? "Tersimpan");
          opts.onOk?.(res);
          if (opts.refresh !== false) router.refresh();
        } else {
          setErrors(res.fieldErrors ?? {});
          toast(res.error, "error");
        }
      });
    },
    [router, toast],
  );
  return { run, pending, errors, setErrors };
}

export function Badge({ tone, children, className }: { tone?: string; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset", tone ?? "bg-charcoal-900/5 text-charcoal-700 ring-charcoal-900/10", className)}>
      {children}
    </span>
  );
}

export function StatusPill({ list, value, className }: { list: readonly { value: string; label: string; tone?: string }[]; value: string | null | undefined; className?: string }) {
  return (
    <Badge tone={toneOf(list, value)} className={className}>
      {labelOf(list, value)}
    </Badge>
  );
}

export function Field({ label, children, error, hint, className, required, htmlFor }: { label: string; children: ReactNode; error?: string; hint?: ReactNode; className?: string; required?: boolean; htmlFor?: string }) {
  return (
    <div className={className}>
      <label className="label" htmlFor={htmlFor}>
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-charcoal-700/70">{hint}</p>}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

/** Input rupiah dengan pemisah ribuan; nilai berupa angka. */
export function MoneyInput({ value, onChange, id, className, invalid, ariaLabel, disabled }: { value: number; onChange: (n: number) => void; id?: string; className?: string; invalid?: boolean; ariaLabel?: string; disabled?: boolean }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-charcoal-700/60">Rp</span>
      <input
        id={id}
        aria-label={ariaLabel}
        inputMode="numeric"
        disabled={disabled}
        className={cn("input !pl-9 text-right tabular-nums", invalid && "!border-red-400", className)}
        value={value ? Math.round(value).toLocaleString("id-ID") : ""}
        placeholder="0"
        onChange={(e) => onChange(Number(e.target.value.replace(/\D/g, "").slice(0, 13)) || 0)}
        onFocus={(e) => e.target.select()}
      />
    </div>
  );
}

/** Input angka (boleh desimal dengan koma atau titik). */
export function QtyInput({ value, onChange, id, className, ariaLabel, step = "any", disabled }: { value: string | number; onChange: (v: string) => void; id?: string; className?: string; ariaLabel?: string; step?: string | number; disabled?: boolean }) {
  return (
    <input
      id={id}
      aria-label={ariaLabel}
      inputMode="decimal"
      type="number"
      min={0}
      step={step}
      disabled={disabled}
      className={cn("input tabular-nums", className)}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onFocus={(e) => e.target.select()}
    />
  );
}

export function SubmitButton({ pending, children, className, disabled }: { pending: boolean; children: ReactNode; className?: string; disabled?: boolean }) {
  return (
    <button type="submit" disabled={pending || disabled} className={cn("btn-primary", className)}>
      {pending && <Loader2 className="h-4 w-4 animate-spin" />} {children}
    </button>
  );
}

export function FormActions({ onCancel, pending, label = "Simpan" }: { onCancel: () => void; pending: boolean; label?: string }) {
  return (
    <div className="flex justify-end gap-2 border-t border-charcoal-900/10 pt-4 sm:col-span-2">
      <button type="button" onClick={onCancel} className="btn-outline">
        Batal
      </button>
      <SubmitButton pending={pending}>{label}</SubmitButton>
    </div>
  );
}

export function SearchBox({ value, onChange, placeholder, className }: { value: string; onChange: (v: string) => void; placeholder: string; className?: string }) {
  return (
    <label className={cn("relative block flex-1", className)}>
      <span className="sr-only">Cari</span>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-charcoal-700/50" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="input !py-2.5 !pl-9" />
    </label>
  );
}

/** Tab berbasis URL (?tab=...). */
export function TabLinks({ tabs, active, base }: { tabs: { key: string; label: string; count?: number }[]; active: string; base: string }) {
  return (
    <nav className="-mx-4 mb-6 flex gap-1 overflow-x-auto border-b border-charcoal-900/10 px-4 [scrollbar-width:none] sm:mx-0 sm:px-0" aria-label="Tab">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={`${base}${base.includes("?") ? "&" : "?"}tab=${t.key}`}
          scroll={false}
          className={cn(
            "-mb-px shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium transition",
            active === t.key ? "border-[#17263C] text-[#17263C]" : "border-transparent text-charcoal-700 hover:text-charcoal-900",
          )}
        >
          {t.label}
          {t.count !== undefined && <span className="ml-1.5 rounded-full bg-cream-200 px-1.5 text-xs tabular-nums">{t.count}</span>}
        </Link>
      ))}
    </nav>
  );
}

export interface Col<R> {
  key: string;
  label: string;
  render?: (row: R) => ReactNode;
  className?: string;
  align?: "right" | "center";
  /** Sembunyikan di tampilan kartu (mobile). */
  hideMobile?: boolean;
}

/** Tabel responsif: kartu di mobile, tabel di tablet/desktop. */
export function DataTable<R extends { id: string }>({
  columns,
  rows,
  onRowClick,
  actions,
  empty = "Belum ada data",
  footer,
  dense,
}: {
  columns: Col<R>[];
  rows: R[];
  onRowClick?: (row: R) => void;
  actions?: (row: R) => ReactNode;
  empty?: ReactNode;
  footer?: ReactNode;
  dense?: boolean;
}) {
  const cell = (c: Col<R>, r: R) => (c.render ? c.render(r) : String((r as Record<string, unknown>)[c.key] ?? "-") || "-");
  if (!rows.length) return <div className="rounded-2xl bg-white px-4 py-10 text-center text-sm text-charcoal-700/70 ring-1 ring-charcoal-900/5">{empty}</div>;
  const [first, ...rest] = columns;
  return (
    <>
      <ul className="space-y-3 md:hidden">
        {rows.map((r) => (
          <li key={r.id} className="rounded-2xl bg-white p-4 ring-1 ring-charcoal-900/5">
            <div onClick={() => onRowClick?.(r)} role={onRowClick ? "button" : undefined} className={cn(onRowClick && "cursor-pointer")}>
              <div className="font-semibold leading-snug">{cell(first, r)}</div>
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                {rest
                  .filter((c) => !c.hideMobile)
                  .map((c) => (
                    <div key={c.key} className="min-w-0">
                      <dt className="text-charcoal-700/60">{c.label}</dt>
                      <dd className="break-words text-charcoal-900">{cell(c, r)}</dd>
                    </div>
                  ))}
              </dl>
            </div>
            {actions && <div className="mt-3 flex flex-wrap items-center justify-end gap-1 border-t border-charcoal-900/5 pt-2">{actions(r)}</div>}
          </li>
        ))}
        {footer && <li className="rounded-2xl bg-cream-100 p-4 text-sm">{footer}</li>}
      </ul>
      <div className="hidden overflow-x-auto rounded-2xl bg-white ring-1 ring-charcoal-900/5 md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-charcoal-900/5 bg-cream-50 text-xs uppercase tracking-wider text-charcoal-700">
            <tr>
              {columns.map((c) => (
                <th key={c.key} scope="col" className={cn("px-4 py-3 font-semibold", c.align === "right" && "text-right", c.align === "center" && "text-center")}>
                  {c.label}
                </th>
              ))}
              {actions && <th className="px-4 py-3 text-right font-semibold">Aksi</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-charcoal-900/5">
            {rows.map((r) => (
              <tr key={r.id} onClick={() => onRowClick?.(r)} className={cn("transition hover:bg-cream-50/60", onRowClick && "cursor-pointer")}>
                {columns.map((c) => (
                  <td key={c.key} className={cn("px-4 align-middle", dense ? "py-2" : "py-3", c.align === "right" && "text-right tabular-nums", c.align === "center" && "text-center", c.className)}>
                    {cell(c, r)}
                  </td>
                ))}
                {actions && (
                  <td className={cn("px-4", dense ? "py-2" : "py-3")} onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">{actions(r)}</div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          {footer && (
            <tfoot className="border-t border-charcoal-900/10 bg-cream-50 font-semibold">
              <tr>
                <td colSpan={columns.length + (actions ? 1 : 0)} className="px-4 py-3">
                  {footer}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </>
  );
}

export function IconButton({ onClick, label, children, danger, disabled }: { onClick: () => void; label: string; children: ReactNode; danger?: boolean; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={cn("rounded-lg p-2 transition disabled:opacity-40", danger ? "text-red-600 hover:bg-red-50" : "text-charcoal-700 hover:bg-cream-200")}
    >
      {children}
    </button>
  );
}

/** Bar progres sederhana. */
export function ProgressBar({ value, tone = "bg-[#4B5138]", className }: { value: number; tone?: string; className?: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className={cn("h-2 overflow-hidden rounded-full bg-cream-200", className)} role="progressbar" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn("h-full rounded-full transition-all", tone)} style={{ width: `${v}%` }} />
    </div>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "good" | "bad" | "warn" }) {
  return (
    <div className="rounded-xl bg-cream-50 p-3 ring-1 ring-charcoal-900/5">
      <p className="text-xs text-charcoal-700/70">{label}</p>
      <p className={cn("mt-0.5 font-display text-base font-bold tabular-nums sm:text-lg", tone === "good" && "text-green-700", tone === "bad" && "text-red-600", tone === "warn" && "text-amber-700")}>{value}</p>
      {sub && <p className="text-xs text-charcoal-700/70">{sub}</p>}
    </div>
  );
}
