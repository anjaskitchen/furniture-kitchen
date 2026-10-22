import { Calculator, Mail, PencilRuler } from "lucide-react";
import Link from "next/link";
import { whatsappLink } from "@/lib/whatsapp";
import type { SiteSettings } from "@/types";
import { TrackedLink } from "./TrackedLink";
import { WhatsAppIcon } from "./icons";

export function CtaBand({
  settings,
  eyebrow,
  title,
  description,
}: {
  settings: SiteSettings;
  eyebrow?: string;
  title?: string;
  description?: string;
}) {
  const heading = title || settings.cta_title || "Siap mewujudkan ruang impian Anda?";
  const label = eyebrow || settings.cta_eyebrow;
  const text = description || settings.cta_text;
  return (
    <section className="container section">
      <div className="relative overflow-hidden rounded-[2rem] bg-charcoal-900 px-6 py-14 text-center text-cream-50 sm:px-12 sm:py-20">
        <div className="absolute -left-20 -top-20 h-64 w-64 rounded-full bg-wood-500/30 blur-3xl" />
        <div className="absolute -bottom-24 -right-10 h-72 w-72 rounded-full bg-bronze-400/20 blur-3xl" />
        {label && <p className="eyebrow relative !text-bronze-300">{label}</p>}
        <h2 className="relative mx-auto mt-4 max-w-2xl text-3xl font-bold sm:text-4xl">{heading}</h2>
        {text && <p className="relative mx-auto mt-4 max-w-xl text-cream-200/80">{text}</p>}
        <div className="relative mt-10 grid gap-3 sm:flex sm:flex-wrap sm:justify-center">
          <Link href="/kalkulator" className="btn bg-cream-50 text-charcoal-900 hover:bg-bronze-300">
            <Calculator className="h-4 w-4" /> Hitung Estimasi Harga
          </Link>
          <TrackedLink event="whatsapp_click" eventParams={{ location: "cta_band" }} href={whatsappLink(settings.whatsapp_number, settings.whatsapp_default_message ?? "")} className="btn-whatsapp">
            <WhatsAppIcon size={18} /> Chat WhatsApp
          </TrackedLink>
          <Link href="/kontak#form-email" className="btn border border-cream-50/30 text-cream-50 hover:bg-cream-50 hover:text-charcoal-900">
            <Mail className="h-4 w-4" /> Hubungi via Email
          </Link>
          <Link href="/kontak#request-design" className="btn border border-cream-50/30 text-cream-50 hover:bg-cream-50 hover:text-charcoal-900">
            <PencilRuler className="h-4 w-4" /> Request Design
          </Link>
        </div>
      </div>
    </section>
  );
}
