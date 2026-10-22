import { Camera } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { CtaBand } from "@/components/CtaBand";
import { PortfolioGrid } from "@/components/PortfolioGrid";
import { SectionHeading } from "@/components/SectionHeading";
import { pageMetadata } from "@/lib/seo";
import { getPortfolio, getSettings } from "@/services/data";
import { PORTFOLIO_CATEGORIES } from "@/types";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  return pageMetadata({
    title: `Portfolio Kitchen Set & Interior ${s.city ?? ""}`.trim(),
    description: `Hasil pekerjaan kitchen set, wardrobe, furniture, kantor, dan interior komersial oleh ${s.business_name}.`,
    path: "/portfolio",
  });
}

export default async function PortfolioPage() {
  const [items, settings] = await Promise.all([getPortfolio(), getSettings()]);
  return (
    <>
      <section className="container pb-12 pt-8 sm:pt-12">
        <Breadcrumbs items={[{ name: "Portfolio", href: "/portfolio" }]} />
        <SectionHeading
          as="h1"
          eyebrow="Portfolio"
          title="Project yang telah kami kerjakan"
          description="Dari rumah tinggal hingga ruang komersial — setiap project dikerjakan custom sesuai kebutuhan klien."
          action={
            <Link href="/kirim-project" className="btn-outline btn-sm">
              <Camera className="h-4 w-4" /> Kirim Foto Project Anda
            </Link>
          }
        />
        <PortfolioGrid items={items} categories={PORTFOLIO_CATEGORIES} />
      </section>
      <CtaBand settings={settings} />
    </>
  );
}
