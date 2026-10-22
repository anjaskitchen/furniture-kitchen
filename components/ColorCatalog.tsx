"use client";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { ColorCard } from "./ColorCard";
import { EmptyState } from "./EmptyState";

export interface ColorItem {
  id: string;
  name: string;
  code: string;
  hex: string | null;
  image: string | null;
  category: string;
  meta?: string | null;
  badge?: string;
}

/** Katalog warna dengan filter kategori (HPL / Cat Duco). */
export function ColorCatalog({ items, categories, label }: { items: ColorItem[]; categories: readonly string[]; label: string }) {
  const [active, setActive] = useState<string | null>(null);
  const available = categories.filter((c) => items.some((i) => i.category === c));
  const filtered = useMemo(() => (active ? items.filter((i) => i.category === active) : items), [items, active]);
  return (
    <div>
      <div className="-mx-5 mb-8 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0" role="tablist" aria-label={`Filter ${label}`}>
        <button type="button" role="tab" aria-selected={!active} onClick={() => setActive(null)} className={cn("chip shrink-0", !active && "chip-active")}>
          Semua
        </button>
        {available.map((c) => (
          <button type="button" role="tab" aria-selected={active === c} key={c} onClick={() => setActive(c)} className={cn("chip shrink-0", active === c && "chip-active")}>
            {c}
          </button>
        ))}
      </div>
      {filtered.length ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {filtered.map((i) => (
            <ColorCard key={i.id} name={i.name} code={i.code} hex={i.hex} image={i.image} meta={i.meta} badge={i.badge} />
          ))}
        </div>
      ) : (
        <EmptyState title={`Belum ada warna ${label}`} />
      )}
    </div>
  );
}
