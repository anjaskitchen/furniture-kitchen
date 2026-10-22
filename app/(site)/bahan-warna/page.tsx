import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { ColorCatalog } from "@/components/ColorCatalog";
import { CtaBand } from "@/components/CtaBand";
import { MaterialCard } from "@/components/MaterialCard";
import { SectionHeading } from "@/components/SectionHeading";
import { pageMetadata } from "@/lib/seo";
import { getDucoColors, getHplColors, getMaterials, getSettings } from "@/services/data";
import { DUCO_CATEGORIES, HPL_CATEGORIES } from "@/types";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  return pageMetadata({
    title: "Bahan & Warna — Katalog HPL dan Cat Duco",
    description: `Pilihan warna HPL (wood, solid, marble, stone) dan cat duco (glossy, matte, satin) untuk kitchen set dan furniture custom ${s.city ?? ""}.`,
    path: "/bahan-warna",
  });
}

export default async function MaterialsPage() {
  const [materials, hpl, duco, settings] = await Promise.all([getMaterials(), getHplColors(), getDucoColors(), getSettings()]);
  return (
    <>
      <section className="container pb-12 pt-8 sm:pt-12">
        <Breadcrumbs items={[{ name: "Bahan & Warna", href: "/bahan-warna" }]} />
        <SectionHeading as="h1" eyebrow="Bahan & Warna" title="Material dan sampel warna" description="Pilih material dan warna favorit Anda. Sampel fisik bisa dilihat saat survey atau di workshop kami." />
        <div className="grid gap-4 md:grid-cols-3">
          {materials.map((m) => (
            <MaterialCard key={m.id} material={m} />
          ))}
        </div>
        <nav className="mt-8 flex gap-3" aria-label="Lompat ke katalog">
          <Link href="#hpl" className="btn-outline btn-sm">Katalog HPL</Link>
          <Link href="#duco" className="btn-outline btn-sm">Katalog Cat Duco</Link>
        </nav>
      </section>

      <section id="hpl" className="section scroll-mt-24 bg-cream-100 dark:bg-charcoal-900/40">
        <div className="container">
          <SectionHeading eyebrow="HPL" title="Katalog warna HPL" description="High Pressure Laminate dari brand terpercaya — tahan gores, tahan panas, dan mudah dibersihkan." />
          <ColorCatalog
            label="HPL"
            categories={HPL_CATEGORIES}
            items={hpl.map((c) => ({ id: c.id, name: c.name, code: c.code, hex: c.hex, image: c.image_url, category: c.category, meta: c.brand, badge: c.category }))}
          />
        </div>
      </section>

      <section id="duco" className="container section scroll-mt-24">
        <SectionHeading eyebrow="Cat Duco" title="Katalog warna Cat Duco" description="Finishing cat berlapis dengan hasil mulus tanpa sambungan. Tersedia finish glossy, matte, dan satin — warna custom bisa disesuaikan." />
        <ColorCatalog
          label="Cat Duco"
          categories={DUCO_CATEGORIES}
          items={duco.map((c) => ({ id: c.id, name: c.name, code: c.code, hex: c.hex, image: c.image_url, category: c.category, meta: `Finish ${c.finish}`, badge: c.finish }))}
        />
      </section>
      <CtaBand settings={settings} title="Bingung memilih warna? Konsultasikan dengan desainer kami." />
    </>
  );
}
