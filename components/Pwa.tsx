"use client";
import { Download, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "./Logo";

/** Daftarkan service worker (production saja, agar hot reload dev tidak terganggu). */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    const register = () => navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);
  return null;
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "pwa-install-dismissed";
const DISMISS_DAYS = 30;

function recentlyDismissed() {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
    return Date.now() - at < DISMISS_DAYS * 86_400_000;
  } catch {
    return false;
  }
}

/** Kartu ajakan install aplikasi — muncul hanya jika browser mendukung dan belum ditolak 30 hari terakhir. */
export function InstallPrompt({ businessName, logoUrl }: { businessName: string; logoUrl: string | null }) {
  const pathname = usePathname();
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      if (!recentlyDismissed()) setEvent(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setEvent(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!event || pathname.startsWith("/admin")) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {}
    setEvent(null);
  };
  const install = async () => {
    await event.prompt();
    const { outcome } = await event.userChoice;
    if (outcome === "dismissed") dismiss();
    else setEvent(null);
  };

  return (
    <div
      role="dialog"
      aria-label="Install aplikasi"
      className="fixed inset-x-3 bottom-[5.5rem] z-40 animate-fade-up rounded-2xl bg-white p-4 shadow-soft ring-1 ring-charcoal-900/10 dark:bg-charcoal-900 dark:ring-white/10 md:inset-x-auto md:bottom-24 md:right-6 md:w-80"
    >
      <button type="button" onClick={dismiss} className="absolute right-2 top-2 rounded-full p-1.5 text-charcoal-700 hover:bg-cream-200 dark:text-cream-200 dark:hover:bg-charcoal-800" aria-label="Tutup">
        <X className="h-4 w-4" />
      </button>
      <div className="pr-6">
        <Logo name={businessName} logoUrl={logoUrl} />
        <p className="mt-3 text-sm text-charcoal-700 dark:text-cream-200/80">Pasang aplikasi untuk akses katalog & kalkulator lebih cepat, langsung dari layar utama.</p>
      </div>
      <div className="mt-4 flex gap-2">
        <button type="button" onClick={install} className="btn-primary btn-sm flex-1">
          <Download className="h-4 w-4" /> Install
        </button>
        <button type="button" onClick={dismiss} className="btn-outline btn-sm">
          Nanti
        </button>
      </div>
    </div>
  );
}
