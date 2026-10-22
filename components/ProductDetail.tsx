import { Calculator, Mail, Ruler } from "lucide-react";
import Link from "next/link";
import { formatRupiah } from "@/lib/format";
import { absoluteUrl } from "@/lib/seo";
import { productInquiryMessage } from "@/lib/whatsapp";
import type { ProductWithRelations } from "@/types";
import { OrderProductButton } from "./OrderProductButton";
import { ProductGallery } from "./ProductGallery";
import { ViewTracker } from "./ViewTracker";

export function ProductDetail({ product, whatsapp }: { product: ProductWithRelations; whatsapp: string | null }) {
  const specs: [string, string | null | undefined][] = [
    ["Kategori", product.category?.name],
    ["Material", product.material?.name],
    ["Finishing", product.finishing],
    ["Warna", product.colors.join(", ") || null],
    ["Dimensi", product.dimensions],
  ];
  const message = productInquiryMessage(product.name, absoluteUrl(`/katalog/${product.slug}`));
  return (
    <div className="grid gap-10 lg:grid-cols-12 lg:gap-14">
      <ViewTracker productId={product.id} productName={product.name} />
      <div className="min-w-0 lg:col-span-7">
        <ProductGallery images={product.images} videoUrl={product.video_url} name={product.name} />
      </div>
      <div className="min-w-0 lg:col-span-5">
        <div className="lg:sticky lg:top-28">
          {product.category && <p className="eyebrow mb-3">{product.category.name}</p>}
          <h1 className="text-3xl font-bold leading-tight sm:text-4xl">{product.name}</h1>
          <div className="mt-6 rounded-2xl bg-cream-100 p-5 dark:bg-charcoal-900">
            <p className="text-xs text-charcoal-700 dark:text-cream-200/60">Estimasi harga mulai</p>
            <p className="font-display text-3xl font-bold text-wood-600 dark:text-bronze-300">{formatRupiah(product.price_estimate)}</p>
            <p className="mt-1 text-xs text-charcoal-700/80 dark:text-cream-200/50">Harga final menyesuaikan ukuran, material, dan detail desain.</p>
          </div>
          {product.description && <p className="mt-6 leading-relaxed text-charcoal-700 dark:text-cream-200/80">{product.description}</p>}
          <dl className="mt-6 divide-y divide-charcoal-900/5 border-y border-charcoal-900/5 dark:divide-white/10 dark:border-white/10">
            {specs.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-6 py-3 text-sm">
                <dt className="text-charcoal-700 dark:text-cream-200/60">{k}</dt>
                <dd className="text-right font-medium">{v || "-"}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-8 grid gap-3">
            <OrderProductButton productId={product.id} productName={product.name} whatsapp={whatsapp} message={message} />
            <div className="grid grid-cols-2 gap-3">
              <Link href="/kalkulator" className="btn-outline">
                <Calculator className="h-4 w-4" /> Hitung Harga
              </Link>
              <Link href={`/kontak?produk=${encodeURIComponent(product.name)}&id=${product.id}#form-email`} className="btn-outline">
                <Mail className="h-4 w-4" /> Email
              </Link>
            </div>
            <Link href={`/kontak?produk=${encodeURIComponent(product.name)}#request-survey`} className="flex items-center justify-center gap-2 py-2 text-sm font-medium text-wood-600 hover:underline dark:text-bronze-300">
              <Ruler className="h-4 w-4" /> Request survey & pengukuran gratis
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
