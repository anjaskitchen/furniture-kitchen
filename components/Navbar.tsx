"use client";
import { Calculator, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { NAV_ITEMS } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { whatsappLink } from "@/lib/whatsapp";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
import { TrackedLink } from "./TrackedLink";
import { WhatsAppIcon } from "./icons";

export function Navbar({
  businessName,
  logoUrl,
  whatsapp,
  whatsappMessage,
}: {
  businessName: string;
  logoUrl: string | null;
  whatsapp: string | null;
  whatsappMessage: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
  }, [open]);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <header
      className={cn(
        "sticky top-0 z-50 transition-all duration-300",
        scrolled || open
          ? "bg-cream-50/90 shadow-[0_1px_0_rgba(0,0,0,0.06)] backdrop-blur-md dark:bg-charcoal-950/90"
          : "bg-transparent",
      )}
    >
      <nav className="container flex h-16 items-center justify-between gap-4 lg:h-20" aria-label="Navigasi utama">
        <Logo name={businessName} logoUrl={logoUrl} />

        <ul className="hidden items-center gap-1 lg:flex">
          {NAV_ITEMS.map((item) => (
            <li key={item.href} className={cn("wide" in item && item.wide && "hidden xl:block")}>
              <Link
                href={item.href}
                className={cn(
                  "relative rounded-full px-3 py-2 text-sm font-medium transition hover:text-wood-600 dark:hover:text-bronze-300",
                  isActive(item.href) ? "text-wood-600 dark:text-bronze-300" : "text-charcoal-800 dark:text-cream-200",
                )}
                aria-current={isActive(item.href) ? "page" : undefined}
              >
                {item.label.replace(" Harga", "").replace(" Kami", "")}
                {isActive(item.href) && <span className="absolute inset-x-3 -bottom-0.5 h-0.5 rounded-full bg-current" aria-hidden />}
              </Link>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-1 sm:gap-2">
          <ThemeToggle />
          <Link href="/kalkulator" className="btn-primary btn-sm hidden sm:inline-flex">
            <Calculator className="h-4 w-4" /> <span className="lg:hidden xl:inline">Hitung Estimasi Harga</span>
            <span className="hidden lg:inline xl:hidden">Hitung Harga</span>
          </Link>
          <button
            type="button"
            className="rounded-full p-2 transition hover:bg-charcoal-900/5 dark:hover:bg-white/10 lg:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? "Tutup menu" : "Buka menu"}
          >
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </nav>

      {open && (
        <div id="mobile-menu" className="absolute inset-x-0 top-full z-40 h-[100dvh] animate-fade-in overflow-y-auto bg-cream-50 pb-24 dark:bg-charcoal-950 lg:hidden">
          <ul className="container flex flex-col py-6">
            {NAV_ITEMS.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center justify-between border-b border-charcoal-900/5 py-4 font-display text-xl font-semibold dark:border-white/10",
                    isActive(item.href) && "text-wood-600 dark:text-bronze-300",
                  )}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="container grid gap-3 pb-10">
            <Link href="/kalkulator" className="btn-primary">
              <Calculator className="h-4 w-4" /> Hitung Estimasi Harga
            </Link>
            <TrackedLink event="whatsapp_click" eventParams={{ location: "mobile_menu" }} href={whatsappLink(whatsapp, whatsappMessage)} className="btn-whatsapp">
              <WhatsAppIcon size={18} /> Chat WhatsApp
            </TrackedLink>
            <Link href="/kontak#request-design" className="btn-outline">
              Request Design
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
