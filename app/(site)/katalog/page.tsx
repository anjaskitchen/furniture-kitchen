import type { Metadata } from "next";
import { Suspense } from "react";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { CatalogFilters } from "@/components/CatalogFilters";
import { CtaBand } from "@/components/CtaBand";
import { SkeletonGrid } from "@/components/LoadingState";
import { ProductGrid } from "@/components/ProductGrid";
import { SectionHeading } from "@/components/SectionHeading";
import { pageMetadata } from "@/lib/seo";
import { filterProducts, getCategories, getMaterials, getSettings, type ProductFilter } from "@/services/data";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  return pageMetadata({
    title: `Katalog Kitchen Set & Custom Furniture ${s.city ?? ""}`.trim(),
    description: `Katalog kitchen set, kitchen island, wardrobe, TV cabinet, dan furniture custom ${s.city ?? ""} lengkap dengan material, dimensi, dan estimasi harga.`,
    path: "/katalog",
    image: "/placeholders/kitchen-1.svg",
  });
}

type SP = Promise<Record<string, string | string[] | undefined>>;
const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

export default async function CatalogPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const filter: ProductFilter = {
    q: str(sp.q),
    category: str(sp.kategori),
    material: str(sp.material),
    sort: str(sp.sort) as ProductFilter["sort"],
  };
  const [settings, products, categories, materials] = await Promise.all([getSettings(), filterProducts(filter), getCategories(), getMaterials()]);

  return (
    <>
      <section className="container pb-16 pt-8 sm:pt-12">
        <Breadcrumbs items={[{ name: "Katalog", href: "/katalog" }]} />
        <SectionHeading
          as="h1"
          eyebrow="Katalog"
          title="Kitchen set & custom furniture"
          description="Semua desain bisa disesuaikan dengan ukuran ruang, warna, dan budget Anda."
        />
        <Suspense fallback={null}>
          <CatalogFilters
            categories={categories.filter((c) => c.slug !== "interior").map((c) => ({ slug: c.slug, name: c.name }))}
            materials={materials.map((m) => ({ slug: m.slug, name: m.name }))}
            total={products.length}
          />
        </Suspense>
        <Suspense fallback={<SkeletonGrid />}>
          <ProductGrid products={products} whatsapp={settings.whatsapp_number} />
        </Suspense>
      </section>
      <CtaBand settings={settings} title="Tidak menemukan desain yang pas? Kami buatkan custom." />
    </>
  );
}
