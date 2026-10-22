import { MessageCircle } from "lucide-react";
import Link from "next/link";
import { formatRupiah } from "@/lib/format";
import { productInquiryMessage, whatsappLink } from "@/lib/whatsapp";
import type { ProductWithRelations } from "@/types";
import { SmartImage } from "./SmartImage";
import { TrackedLink } from "./TrackedLink";

export function ProductCard({ product, whatsapp }: { product: ProductWithRelations; whatsapp: string | null }) {
  return (
    <article className="card group flex flex-col overflow-hidden transition duration-300 hover:-translate-y-1 hover:shadow-soft">
      <Link href={`/katalog/${product.slug}`} className="relative block aspect-[4/3] overflow-hidden" aria-label={`Lihat detail ${product.name}`}>
        <SmartImage
          src={product.images[0]}
          alt={product.name}
          fill
          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
          className="object-cover transition duration-700 group-hover:scale-105"
        />
        {product.category && (
          <span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-charcoal-900 backdrop-blur">{product.category.name}</span>
        )}
      </Link>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-display text-lg font-semibold leading-snug">
          <Link href={`/katalog/${product.slug}`} className="hover:text-wood-600 dark:hover:text-bronze-300">
            {product.name}
          </Link>
        </h3>
        <p className="mt-2 line-clamp-2 text-sm text-charcoal-700 dark:text-cream-200/70">{product.description}</p>
        <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
          <div>
            <dt className="text-charcoal-700/70 dark:text-cream-200/50">Material</dt>
            <dd className="font-medium">{product.material?.name ?? "-"}</dd>
          </div>
          <div>
            <dt className="text-charcoal-700/70 dark:text-cream-200/50">Finishing</dt>
            <dd className="font-medium">{product.finishing ?? "-"}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-charcoal-700/70 dark:text-cream-200/50">Dimensi</dt>
            <dd className="font-medium">{product.dimensions ?? "-"}</dd>
          </div>
        </dl>
        <div className="mt-auto pt-5">
          <p className="text-xs text-charcoal-700/70 dark:text-cream-200/50">Estimasi mulai</p>
          <p className="font-display text-xl font-bold text-wood-600 dark:text-bronze-300">{formatRupiah(product.price_estimate)}</p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Link href={`/katalog/${product.slug}`} className="btn-outline btn-sm">
              Lihat Detail
            </Link>
            <TrackedLink
              event="product_inquiry"
              eventParams={{ product: product.name, location: "card" }}
              href={whatsappLink(whatsapp, productInquiryMessage(product.name))}
              className="btn-whatsapp btn-sm"
            >
              <MessageCircle className="h-3.5 w-3.5" /> Konsultasi
            </TrackedLink>
          </div>
        </div>
      </div>
    </article>
  );
}
