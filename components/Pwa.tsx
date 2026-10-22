"use client";
import { Download, RefreshCw, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "./Logo";

/**
 * Daftarkan service worker (production saja) dan cek versi baru secara berkala.
 * Saat deploy baru aktif, tampilkan bar "Versi terbaru tersedia" dengan tombol muat ulang.
 */
export function ServiceWorkerRegister() {
  const [updated, setUpdated] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    let registration: ServiceWorkerRegistration | undefined;
    // Kunjungan pertama (belum ada controller) tidak perlu notifikasi.
    const hadController = Boolean(navigator.serviceWorker.controller);

    const check = () => registration?.update().catch(() => {});
    const onVisible = () => document.visibilityState === "visible" && check();
    const onControllerChange = () => hadController && setUpdated(true);

    const register = () =>
      navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .then((reg) => {
          registration = reg;
        })
        .catch(() => {});

    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    document.addEventListener("visibilitychange", onVisible);
    const interval = setInterval(check, 15 * 60_000);
    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(interval);
    };
  }, []);

  if (!updated) return null;
  return (
    <div role="status" className="fixed inset-x-3 top-3 z-[90] mx-auto flex max-w-md animate-fade-up items-center gap-3 rounded-2xl bg-charcoal-900 p-3 pl-4 text-sm text-cream-50 shadow-soft">
      <RefreshCw className="h-4 w-4 shrink-0 text-bronze-300" aria-hidden />
      <span className="flex-1">Versi terbaru website tersedia.</span>
      <button type="button" onClick={() => window.location.reload()} className="rounded-full bg-cream-50 px-4 py-1.5 text-xs font-semibold text-charcoal-900 hover:bg-bronze-300">
        Muat ulang
      </button>
      <button type="button" onClick={() => setUpdated(false)} className="rounded-full p-1.5 text-cream-200/70 hover:bg-white/10" aria-label="Tutup">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
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
