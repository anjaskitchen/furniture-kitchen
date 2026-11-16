import { AlertTriangle, CheckCircle2, Star } from "lucide-react";
import type { GoogleReviewStatus as Status } from "@/services/google-reviews";
import { RefreshGoogleReviewsButton } from "./RefreshGoogleReviewsButton";

/** Kartu status koneksi Google Review di Admin → Pengaturan. */
export function GoogleReviewStatus({ status }: { status: Status }) {
  const tone = status.ok
    ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/30"
    : "border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30";
  return (
    <section className={`mb-6 rounded-2xl border p-5 ${tone}`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          {status.ok ? (
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
          ) : (
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          )}
          <div className="text-sm">
            <h2 className="font-semibold">Google Review live: {status.ok ? "Aktif" : "Belum aktif"}</h2>
            {status.ok ? (
              <p className="mt-1 text-charcoal-700 dark:text-cream-200/80">
                <Star className="mr-1 inline h-4 w-4 fill-amber-400 text-amber-400" />
                {status.rating?.toFixed(1) ?? "—"} dari {status.totalReviews ?? 0} ulasan · {status.reviewCount} ulasan terbaru tampil di website.
                Diperbarui otomatis tiap 1 jam.
              </p>
            ) : !status.hasKey ? (
              <p className="mt-1 text-charcoal-700 dark:text-cream-200/80">
                API key belum diisi. Tambahkan <code className="rounded bg-white/70 px-1 dark:bg-black/30">GOOGLE_MAPS_API_KEY</code> di Vercel → Settings →
                Environment Variables, lalu Redeploy. Sementara ini website menampilkan review manual dari menu Review.
              </p>
            ) : (
              <p className="mt-1 text-charcoal-700 dark:text-cream-200/80">
                Google menolak permintaan: <span className="font-medium">{status.error}</span>. Pastikan &quot;Places API (New)&quot; aktif dan billing project
                Google Cloud sudah diaktifkan.
              </p>
            )}
            {status.placeId && (
              <p className="mt-1 text-xs text-charcoal-700/70 dark:text-cream-200/50">
                Place ID: <code>{status.placeId}</code> {status.autoPlaceId && "(otomatis dari Link Google Maps)"}
              </p>
            )}
          </div>
        </div>
        {status.hasKey && <RefreshGoogleReviewsButton />}
      </div>
    </section>
  );
}
