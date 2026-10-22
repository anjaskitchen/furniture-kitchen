import type { ProductWithRelations } from "@/types";
import { EmptyState } from "./EmptyState";
import { ProductCard } from "./ProductCard";

export function ProductGrid({ products, whatsapp }: { products: ProductWithRelations[]; whatsapp: string | null }) {
  if (!products.length) {
    return <EmptyState title="Produk tidak ditemukan" description="Coba ubah kata kunci atau filter. Atau konsultasikan kebutuhan custom Anda langsung dengan kami." />;
  }
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} whatsapp={whatsapp} />
      ))}
    </div>
  );
}
