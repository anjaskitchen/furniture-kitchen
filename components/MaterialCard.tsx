import { formatRupiah } from "@/lib/format";
import type { Material } from "@/types";
import { SmartImage } from "./SmartImage";

export function MaterialCard({ material }: { material: Material }) {
  return (
    <article className="card flex gap-5 p-5">
      <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-cream-200">
        <SmartImage src={material.image_url} alt={material.name} fill sizes="96px" className="object-cover" />
      </div>
      <div>
        <h3 className="font-display text-lg font-semibold">{material.name}</h3>
        <p className="mt-1 text-sm text-charcoal-700 dark:text-cream-200/70">{material.description}</p>
        <p className="mt-2 font-display font-bold text-wood-600 dark:text-bronze-300">
          {formatRupiah(material.price_per_meter)} <span className="text-xs font-normal">/ meter</span>
        </p>
      </div>
    </article>
  );
}
