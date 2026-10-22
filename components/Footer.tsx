import { Clock, Mail, MapPin, Phone } from "lucide-react";
import Link from "next/link";
import { NAV_ITEMS } from "@/lib/navigation";
import { safeUrl } from "@/lib/utils";
import { whatsappLink } from "@/lib/whatsapp";
import type { SiteSettings } from "@/types";
import { FacebookIcon, InstagramIcon, TikTokIcon, YouTubeIcon } from "./icons";
import { Logo } from "./Logo";

export function SocialLinks({ settings, className = "" }: { settings: SiteSettings; className?: string }) {
  const links = [
    { href: safeUrl(settings.instagram_url), label: "Instagram", Icon: InstagramIcon },
    { href: safeUrl(settings.facebook_url), label: "Facebook", Icon: FacebookIcon },
    { href: safeUrl(settings.tiktok_url), label: "TikTok", Icon: TikTokIcon },
    { href: safeUrl(settings.youtube_url), label: "YouTube", Icon: YouTubeIcon },
  ].filter((l) => l.href);
  return (
    <div className={`flex gap-2 ${className}`}>
      {links.map(({ href, label, Icon }) => (
        <a
          key={label}
          href={href!}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={label}
          className="grid h-10 w-10 place-items-center rounded-full border border-current/20 transition hover:border-bronze-400 hover:text-bronze-300"
        >
          <Icon size={18} />
        </a>
      ))}
    </div>
  );
}

export function Footer({ settings }: { settings: SiteSettings }) {
  const year = new Date().getFullYear();
  return (
    <footer className="bg-charcoal-950 pb-28 pt-16 text-cream-200 md:pb-10">
      <div className="container grid gap-12 md:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-5">
          <div className="text-cream-50">
            <Logo name={settings.business_name} logoUrl={settings.logo_url} light />
          </div>
          <p className="text-sm leading-relaxed text-cream-200/70">{settings.footer_text || settings.description}</p>
          <SocialLinks settings={settings} />
        </div>
        <div>
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-widest text-bronze-300">Menu</h3>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm lg:grid-cols-1">
            {NAV_ITEMS.map((i) => (
              <li key={i.href}>
                <Link href={i.href} className="text-cream-200/80 transition hover:text-white">
                  {i.label}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/kirim-project" className="text-cream-200/80 transition hover:text-white">
                Kirim Foto Project
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-widest text-bronze-300">Kontak</h3>
          <ul className="space-y-3 text-sm text-cream-200/80">
            {settings.address && (
              <li className="flex gap-3">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-bronze-300" />
                {settings.address}
              </li>
            )}
            {settings.whatsapp_number && (
              <li className="flex gap-3">
                <Phone className="mt-0.5 h-4 w-4 shrink-0 text-bronze-300" />
                <a href={whatsappLink(settings.whatsapp_number, settings.whatsapp_default_message ?? "")} target="_blank" rel="noopener noreferrer" className="hover:text-white">
                  +{settings.whatsapp_number}
                </a>
              </li>
            )}
            {settings.email && (
              <li className="flex gap-3">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-bronze-300" />
                <a href={`mailto:${settings.email}`} className="hover:text-white">
                  {settings.email}
                </a>
              </li>
            )}
            {settings.opening_hours && (
              <li className="flex gap-3">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-bronze-300" />
                {settings.opening_hours}
              </li>
            )}
          </ul>
        </div>
        <div>
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-widest text-bronze-300">Lokasi</h3>
          <div className="overflow-hidden rounded-xl ring-1 ring-white/10">
            <iframe
              title={`Peta lokasi ${settings.business_name}`}
              src={`https://www.google.com/maps?q=${encodeURIComponent(settings.google_maps_embed_query || settings.address || settings.city || "Bandung")}&output=embed`}
              className="h-40 w-full grayscale"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
          {safeUrl(settings.google_maps_url) && (
            <a href={safeUrl(settings.google_maps_url)!} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-sm text-bronze-300 hover:text-white">
              Buka di Google Maps →
            </a>
          )}
        </div>
      </div>
      <div className="container mt-12 flex flex-col gap-2 border-t border-white/10 pt-6 text-xs text-cream-200/50 sm:flex-row sm:justify-between">
        <p>
          © {year} {settings.business_name}. Seluruh hak cipta dilindungi.
        </p>
        <p>Custom Furniture & Kitchen Set {settings.city}</p>
      </div>
    </footer>
  );
}
