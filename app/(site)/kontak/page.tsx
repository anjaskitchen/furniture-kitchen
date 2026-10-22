import { Clock, Mail, MapPin } from "lucide-react";
import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { ContactTabs } from "@/components/ContactTabs";
import { SocialLinks } from "@/components/Footer";
import { SectionHeading } from "@/components/SectionHeading";
import { TrackedLink } from "@/components/TrackedLink";
import { WhatsAppIcon } from "@/components/icons";
import { pageMetadata } from "@/lib/seo";
import { whatsappLink } from "@/lib/whatsapp";
import { getPricingConfig, getSettings } from "@/services/data";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  return pageMetadata({
    title: "Kontak & Konsultasi",
    description: `Hubungi ${s.business_name} via WhatsApp, email, atau request survey gratis. ${s.address ?? ""}`,
    path: "/kontak",
  });
}

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function ContactPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const [s, pricing] = await Promise.all([getSettings(), getPricingConfig()]);
  const product = typeof sp.produk === "string" ? sp.produk.slice(0, 120) : undefined;
  const productId = typeof sp.id === "string" && /^[0-9a-f-]{36}$/i.test(sp.id) ? sp.id : undefined;
  const furnitureTypes = [...pricing.productTypes.map((p) => p.name), "Kitchen Island", "Bathroom Cabinet", "Interior"];

  return (
    <section className="container pb-20 pt-8 sm:pt-12">
      <Breadcrumbs items={[{ name: "Kontak", href: "/kontak" }]} />
      <SectionHeading as="h1" eyebrow="Kontak" title="Mari diskusikan project Anda" description="Pilih cara yang paling nyaman: chat WhatsApp, kirim email, atau jadwalkan survey lokasi gratis." />
      <div className="grid gap-8 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-5">
          <TrackedLink event="whatsapp_click" eventParams={{ location: "contact_page" }} href={whatsappLink(s.whatsapp_number, s.whatsapp_default_message ?? "")} className="card flex items-center gap-4 p-5 transition hover:shadow-soft">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-[#1FAF38] text-white">
              <WhatsAppIcon size={24} />
            </span>
            <span>
              <span className="block text-sm text-charcoal-700 dark:text-cream-200/70">WhatsApp</span>
              <span className="font-display text-lg font-semibold">+{s.whatsapp_number}</span>
            </span>
          </TrackedLink>
          <div className="card space-y-4 p-6 text-sm">
            {s.address && (
              <p className="flex gap-3">
                <MapPin className="h-5 w-5 shrink-0 text-wood-500" /> {s.address}
              </p>
            )}
            {s.email && (
              <TrackedLink event="email_click" eventParams={{ location: "contact_page" }} href={`mailto:${s.email}`} className="flex gap-3 hover:text-wood-600">
                <Mail className="h-5 w-5 shrink-0 text-wood-500" /> {s.email}
              </TrackedLink>
            )}
            {s.opening_hours && (
              <p className="flex gap-3">
                <Clock className="h-5 w-5 shrink-0 text-wood-500" /> {s.opening_hours}
              </p>
            )}
            <SocialLinks settings={s} className="pt-2 text-charcoal-800 dark:text-cream-200" />
          </div>
          <div className="overflow-hidden rounded-2xl ring-1 ring-charcoal-900/5">
            <iframe
              title={`Peta ${s.business_name}`}
              src={`https://www.google.com/maps?q=${encodeURIComponent(s.google_maps_embed_query || s.address || "Bandung")}&output=embed`}
              className="h-72 w-full"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </div>
        <div className="lg:col-span-7">
          <ContactTabs whatsapp={s.whatsapp_number} furnitureTypes={furnitureTypes} product={product} productId={productId} />
        </div>
      </div>
    </section>
  );
}
