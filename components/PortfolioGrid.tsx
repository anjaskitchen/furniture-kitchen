"use client";
import { MapPin } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import type { PortfolioItem } from "@/types";
import { EmptyState } from "./EmptyState";
import { Modal } from "./Modal";
import { Slider } from "./Slider";
import { SmartImage } from "./SmartImage";
import { VideoPlayer } from "./VideoPlayer";

/** Grid masonry portfolio + filter kategori + lightbox slider. */
export function PortfolioGrid({ items, categories }: { items: PortfolioItem[]; categories: readonly string[] }) {
  const [active, setActive] = useState<string | null>(null);
  const [open, setOpen] = useState<PortfolioItem | null>(null);
  const filtered = useMemo(() => (active ? items.filter((i) => i.category === active) : items), [items, active]);

  useEffect(() => {
    const slug = decodeURIComponent(window.location.hash.slice(1));
    if (slug) {
      const found = items.find((i) => i.slug === slug);
      if (found) setOpen(found);
    }
  }, [items]);

  return (
    <div>
      <div className="-mx-5 mb-8 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
        <button type="button" onClick={() => setActive(null)} className={cn("chip shrink-0", !active && "chip-active")}>
          Semua
        </button>
        {categories.map((c) => (
          <button type="button" key={c} onClick={() => setActive(c)} className={cn("chip shrink-0", active === c && "chip-active")}>
            {c}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="Belum ada project di kategori ini" />
      ) : (
        <div className="columns-1 gap-5 sm:columns-2 lg:columns-3">
          {filtered.map((p, i) => (
            <button
              key={p.id}
              id={p.slug}
              type="button"
              onClick={() => setOpen(p)}
              className="group relative mb-5 block w-full scroll-mt-24 break-inside-avoid overflow-hidden rounded-2xl text-left"
            >
              <div className={cn("relative w-full", i % 3 === 0 ? "aspect-[4/5]" : i % 3 === 1 ? "aspect-[4/3]" : "aspect-square")}>
                <SmartImage src={p.images[0]} alt={p.title} fill sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" className="object-cover transition duration-700 group-hover:scale-105" />
              </div>
              <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-charcoal-950/80 via-transparent to-transparent p-5 text-white">
                <p className="text-xs text-bronze-300">
                  {p.category} · {p.year}
                  {p.source === "customer" && " · Customer Project"}
                </p>
                <h3 className="font-display text-lg font-semibold">{p.title}</h3>
                {p.location && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-white/70">
                    <MapPin className="h-3 w-3" /> {p.location}
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      <Modal open={Boolean(open)} onClose={() => setOpen(null)} title={open?.title ?? ""} size="xl">
        {open && (
          <div className="grid gap-6 lg:grid-cols-5">
            <div className="min-w-0 lg:col-span-3">
              <Slider slidesPerView={{ base: 1 }} ariaLabel={`Foto ${open.title}`}>
                {open.images.map((src, i) => (
                  <div key={i} className="relative aspect-[4/3] overflow-hidden rounded-2xl">
                    <SmartImage src={src} alt={`${open.title} foto ${i + 1}`} fill sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" />
                  </div>
                ))}
              </Slider>
              {open.video_url && (
                <div className="mt-4">
                  <VideoPlayer url={open.video_url} title={open.title} />
                </div>
              )}
            </div>
            <dl className="space-y-4 text-sm lg:col-span-2">
              {[
                ["Kategori", open.category],
                ["Lokasi", open.location],
                ["Tahun", open.year],
                ["Material", open.material],
              ].map(([k, v]) => (
                <div key={k as string} className="flex justify-between border-b border-charcoal-900/5 pb-3 dark:border-white/10">
                  <dt className="text-charcoal-700 dark:text-cream-200/60">{k}</dt>
                  <dd className="font-medium">{v ?? "-"}</dd>
                </div>
              ))}
              {open.description && <p className="leading-relaxed text-charcoal-700 dark:text-cream-200/80">{open.description}</p>}
            </dl>
          </div>
        )}
      </Modal>
    </div>
  );
}
