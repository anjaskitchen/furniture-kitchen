"use client";
import { usePathname } from "next/navigation";
import { whatsappLink } from "@/lib/whatsapp";
import { TrackedLink } from "./TrackedLink";
import { WhatsAppIcon } from "./icons";

/** Floating WhatsApp (desktop/tablet). Di mobile digantikan MobileCTA. */
export function WhatsAppButton({ number, message }: { number: string | null; message: string }) {
  const pathname = usePathname();
  if (pathname.startsWith("/admin")) return null;
  return (
    <TrackedLink
      event="whatsapp_click"
      eventParams={{ location: "floating" }}
      href={whatsappLink(number, message)}
      className="fixed bottom-6 right-6 z-40 hidden h-14 w-14 items-center justify-center rounded-full bg-[#1FAF38] text-white shadow-soft transition hover:scale-105 hover:bg-[#178a2c] md:flex"
      aria-label="Chat via WhatsApp"
    >
      <WhatsAppIcon size={28} />
      <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-[#1FAF38] opacity-20" />
    </TrackedLink>
  );
}

/** Sticky bottom bar di mobile: [Hitung Harga] [WhatsApp]. Body diberi padding agar konten tidak tertutup. */
export function MobileCTA({ number, message }: { number: string | null; message: string }) {
  const pathname = usePathname();
  if (pathname.startsWith("/admin")) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-2 gap-2 border-t border-charcoal-900/10 bg-cream-50/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md dark:border-white/10 dark:bg-charcoal-950/95 md:hidden">
      <a href="/kalkulator" className="btn-primary !py-3">
        Hitung Harga
      </a>
      <TrackedLink event="whatsapp_click" eventParams={{ location: "mobile_bar" }} href={whatsappLink(number, message)} className="btn-whatsapp !py-3">
        <WhatsAppIcon size={18} /> WhatsApp
      </TrackedLink>
    </div>
  );
}
