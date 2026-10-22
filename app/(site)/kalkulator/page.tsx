import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { PriceCalculator } from "@/components/PriceCalculator";
import { SectionHeading } from "@/components/SectionHeading";
import { pageMetadata } from "@/lib/seo";
import { getPricingConfig, getSettings } from "@/services/data";

// Harga selalu fresh dari database (perubahan admin langsung dipakai, + revalidate on save).
export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  return pageMetadata({
    title: `Kalkulator Harga Kitchen Set ${s.city ?? ""}`.trim(),
    description: `Hitung estimasi harga kitchen set dan custom furniture ${s.city ?? ""} secara online: pilih material HPL atau cat duco, ukuran, finishing, top table, dan hardware.`,
    path: "/kalkulator",
  });
}

export default async function CalculatorPage() {
  const [config, settings] = await Promise.all([getPricingConfig(), getSettings()]);
  return (
    <section className="container pb-20 pt-8 sm:pt-12">
      <Breadcrumbs items={[{ name: "Kalkulator Harga", href: "/kalkulator" }]} />
      <SectionHeading
        as="h1"
        eyebrow="Kalkulator Harga"
        title="Hitung estimasi harga furniture Anda"
        description="Isi detail di bawah. Estimasi dan rincian biaya langsung muncul, lalu kirim ke kami via WhatsApp atau email untuk konsultasi."
      />
      <PriceCalculator config={config} whatsapp={settings.whatsapp_number} />
    </section>
  );
}
