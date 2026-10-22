import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { ProductCard } from "@/components/ProductCard";
import { ProductDetail } from "@/components/ProductDetail";
import { SectionHeading } from "@/components/SectionHeading";
import { absoluteUrl, pageMetadata } from "@/lib/seo";
import { getProductBySlug, getProducts, getRelatedProducts, getSettings } from "@/services/data";

export const revalidate = 300;

export async function generateStaticParams() {
  return (await getProducts()).map((p) => ({ slug: p.slug }));
}

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const [product, settings] = await Promise.all([getProductBySlug(slug), getSettings()]);
  if (!product) return { title: "Produk tidak ditemukan" };
  return pageMetadata({
    title: `${product.name} ${settings.city ?? ""}`.trim(),
    description: (product.description ?? `${product.name} custom dari ${settings.business_name}.`).slice(0, 160),
    path: `/katalog/${product.slug}`,
    image: product.images[0],
  });
}

export default async function ProductPage({ params }: { params: Params }) {
  const { slug } = await params;
  const [product, settings] = await Promise.all([getProductBySlug(slug), getSettings()]);
  if (!product) notFound();
  const related = await getRelatedProducts(product);

  return (
    <section className="container pb-20 pt-8 sm:pt-12">
      <Breadcrumbs
        items={[
          { name: "Katalog", href: "/katalog" },
          ...(product.category ? [{ name: product.category.name, href: `/katalog?kategori=${product.category.slug}` }] : []),
          { name: product.name, href: `/katalog/${product.slug}` },
        ]}
      />
      <ProductDetail product={product} whatsapp={settings.whatsapp_number} />

      {related.length > 0 && (
        <div className="mt-24">
          <SectionHeading eyebrow="Produk Serupa" title="Mungkin Anda juga suka" />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} whatsapp={settings.whatsapp_number} />
            ))}
          </div>
        </div>
      )}

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Product",
          name: product.name,
          description: product.description,
          image: product.images.map((i) => absoluteUrl(i)),
          category: product.category?.name,
          material: product.material?.name,
          brand: { "@type": "Brand", name: settings.business_name },
          url: absoluteUrl(`/katalog/${product.slug}`),
          ...(product.price_estimate
            ? {
                offers: {
                  "@type": "Offer",
                  priceCurrency: "IDR",
                  price: product.price_estimate,
                  availability: "https://schema.org/MadeToOrder",
                  seller: { "@type": "Organization", name: settings.business_name },
                },
              }
            : {}),
        }}
      />
    </section>
  );
}
