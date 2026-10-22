import { WifiOff } from "lucide-react";
import type { Metadata } from "next";
import { RetryButton } from "./RetryButton";

export const metadata: Metadata = { title: "Offline", robots: { index: false, follow: false } };
export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-cream-50 px-6 py-16 text-center dark:bg-charcoal-950">
      <div className="max-w-sm">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-cream-200 text-wood-600 dark:bg-charcoal-800 dark:text-bronze-300">
          <WifiOff className="h-6 w-6" aria-hidden />
        </span>
        <h1 className="mt-6 font-display text-2xl font-bold">Anda sedang offline</h1>
        <p className="mt-3 text-sm leading-relaxed text-charcoal-700 dark:text-cream-200/70">
          Halaman ini belum tersimpan di perangkat. Periksa koneksi internet Anda, lalu coba lagi. Halaman yang pernah dibuka tetap bisa dilihat saat offline.
        </p>
        <RetryButton />
      </div>
    </main>
  );
}
