import { SmartImage } from "./SmartImage";

/** Kartu sampel warna/material ala katalog sample. */
export function ColorCard({ name, code, hex, image, meta, badge }: { name: string; code: string; hex?: string | null; image?: string | null; meta?: string | null; badge?: string }) {
  return (
    <figure className="group card overflow-hidden p-2 transition duration-300 hover:-translate-y-1 hover:shadow-soft">
      <div className="relative aspect-square overflow-hidden rounded-xl ring-1 ring-inset ring-black/5" style={{ backgroundColor: hex || "#E9E4DA" }}>
        {image && <SmartImage src={image} alt={`Sampel ${name}`} fill sizes="200px" className="object-cover mix-blend-multiply" style={{ opacity: 0.85 }} />}
        {badge && <span className="absolute right-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-charcoal-900">{badge}</span>}
      </div>
      <figcaption className="px-2 pb-2 pt-3">
        <p className="text-sm font-semibold leading-tight">{name}</p>
        <p className="mt-0.5 font-mono text-xs text-charcoal-700/80 dark:text-cream-200/60">{code}</p>
        {meta && <p className="mt-1 text-xs text-wood-600 dark:text-bronze-300">{meta}</p>}
      </figcaption>
    </figure>
  );
}
