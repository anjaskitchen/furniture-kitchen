"use client";
import { Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { ORDER_STATUSES, PAYMENT_STATUSES } from "@/lib/orders";

const SORTS = [
  { value: "newest", label: "Terbaru" },
  { value: "oldest", label: "Terlama" },
  { value: "total_desc", label: "Nilai terbesar" },
  { value: "balance_desc", label: "Sisa tagihan terbesar" },
  { value: "due", label: "Jatuh tempo terdekat" },
];

/** Pencarian & filter daftar order (disimpan di URL). */
export function OrderFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [, start] = useTransition();

  const update = (k: string, v: string) => {
    const sp = new URLSearchParams(params.toString());
    if (v) sp.set(k, v);
    else sp.delete(k);
    sp.delete("page");
    start(() => router.replace(`${pathname}?${sp.toString()}`, { scroll: false }));
  };

  // Pencarian dengan jeda agar tidak memuat ulang setiap ketikan.
  useEffect(() => {
    if (q === (params.get("q") ?? "")) return;
    const t = setTimeout(() => update("q", q.trim()), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const active = ["q", "status", "payment"].some((k) => params.get(k));

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      <label className="relative flex-1 sm:min-w-[240px]">
        <span className="sr-only">Cari order</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-charcoal-700/50" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari no. order, customer, HP, project..." className="input !py-2.5 !pl-9" />
      </label>
      <div className="grid grid-cols-3 gap-2 sm:flex">
        <select aria-label="Filter status" className="input !py-2.5 sm:w-40" value={params.get("status") ?? ""} onChange={(e) => update("status", e.target.value)}>
          <option value="">Semua status</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <select aria-label="Filter pembayaran" className="input !py-2.5 sm:w-40" value={params.get("payment") ?? ""} onChange={(e) => update("payment", e.target.value)}>
          <option value="">Semua bayar</option>
          {PAYMENT_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <select aria-label="Urutkan" className="input !py-2.5 sm:w-48" value={params.get("sort") ?? "newest"} onChange={(e) => update("sort", e.target.value === "newest" ? "" : e.target.value)}>
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      {active && (
        <button
          type="button"
          onClick={() => {
            setQ("");
            const sp = new URLSearchParams(params.toString());
            for (const k of ["q", "status", "payment", "page"]) sp.delete(k);
            start(() => router.replace(`${pathname}?${sp.toString()}`, { scroll: false }));
          }}
          className="inline-flex items-center gap-1 self-start rounded-full px-3 py-2 text-sm text-charcoal-700 hover:bg-white sm:self-auto"
        >
          <X className="h-4 w-4" /> Reset
        </button>
      )}
    </div>
  );
}
