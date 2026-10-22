"use client";
import { Search, SlidersHorizontal } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { cn } from "@/lib/utils";

interface Option {
  slug: string;
  name: string;
}

export function CatalogFilters({ categories, materials, total }: { categories: Option[]; materials: Option[]; total: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(params.get("q") ?? "");

  const update = (key: string, value: string | null) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    startTransition(() => router.replace(`${pathname}${next.toString() ? `?${next}` : ""}`, { scroll: false }));
  };

  useEffect(() => {
    const t = setTimeout(() => {
      if ((params.get("q") ?? "") !== q) update("q", q.trim() || null);
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const activeCategory = params.get("kategori");

  return (
    <div className="mb-10 space-y-5">
      <div className="flex flex-col gap-3 md:flex-row">
        <label className="relative flex-1">
          <span className="sr-only">Cari produk</span>
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-charcoal-700/50" />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari kitchen set, wardrobe, HPL..." className="input !pl-11" />
        </label>
        <div className="grid grid-cols-2 gap-3 md:flex">
          <label>
            <span className="sr-only">Filter material</span>
            <select className="input md:w-48" value={params.get("material") ?? ""} onChange={(e) => update("material", e.target.value || null)}>
              <option value="">Semua material</option>
              {materials.map((m) => (
                <option key={m.slug} value={m.slug}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="sr-only">Urutkan</span>
            <select className="input md:w-48" value={params.get("sort") ?? ""} onChange={(e) => update("sort", e.target.value || null)}>
              <option value="">Terbaru</option>
              <option value="price_asc">Harga terendah</option>
              <option value="price_desc">Harga tertinggi</option>
              <option value="popular">Terpopuler</option>
            </select>
          </label>
        </div>
      </div>
      <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
        <button type="button" onClick={() => update("kategori", null)} className={cn("chip shrink-0", !activeCategory && "chip-active")}>
          Semua
        </button>
        {categories.map((c) => (
          <button key={c.slug} type="button" onClick={() => update("kategori", c.slug)} className={cn("chip shrink-0", activeCategory === c.slug && "chip-active")}>
            {c.name}
          </button>
        ))}
      </div>
      <p className={cn("flex items-center gap-2 text-sm text-charcoal-700 transition dark:text-cream-200/70", pending && "opacity-50")}>
        <SlidersHorizontal className="h-4 w-4" /> {total} produk ditemukan
      </p>
    </div>
  );
}
