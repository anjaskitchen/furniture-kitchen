import { AnnouncementBar } from "@/components/AnnouncementBar";
import { Footer } from "@/components/Footer";
import { JsonLd } from "@/components/JsonLd";
import { Navbar } from "@/components/Navbar";
import { InstallPrompt } from "@/components/Pwa";
import { MobileCTA, WhatsAppButton } from "@/components/WhatsAppButton";
import { localBusinessJsonLd } from "@/lib/seo";
import { getSettings } from "@/services/data";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings();
  const waMessage = settings.whatsapp_default_message || "Halo, saya ingin konsultasi custom furniture.";
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2">
        Lewati ke konten
      </a>
      <AnnouncementBar text={settings.announcement_text} url={settings.announcement_url} />
      <Navbar businessName={settings.business_name} logoUrl={settings.logo_url} whatsapp={settings.whatsapp_number} whatsappMessage={waMessage} />
      <main id="main" className="min-h-[60vh]">
        {children}
      </main>
      <Footer settings={settings} />
      <WhatsAppButton number={settings.whatsapp_number} message={waMessage} />
      <MobileCTA number={settings.whatsapp_number} message={waMessage} />
      <InstallPrompt businessName={settings.business_name} logoUrl={settings.logo_url} />
      <JsonLd data={localBusinessJsonLd(settings)} />
    </>
  );
}
