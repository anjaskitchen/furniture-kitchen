import { ExternalLink } from "lucide-react";
import type { ReviewSummary } from "@/types";
import { EmptyState } from "./EmptyState";
import { ReviewSlider } from "./ReviewSlider";
import { StarRating } from "./StarRating";

export function ReviewSection({
  summary,
  heading = true,
  eyebrow = "Review Customer",
  title = "Dipercaya pemilik rumah & bisnis",
  limit,
}: {
  summary: ReviewSummary;
  heading?: boolean;
  eyebrow?: string;
  title?: string;
  limit?: number;
}) {
  const reviews = limit ? summary.reviews.slice(0, limit) : summary.reviews;
  return (
    <div>
      <div className="mb-10 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          {heading && (
            <>
              <p className="eyebrow mb-3">{eyebrow}</p>
              <h2 className="section-title">{title}</h2>
            </>
          )}
          <div className="mt-5 flex items-center gap-4">
            <span className="font-display text-5xl font-bold">{summary.rating > 0 ? summary.rating.toFixed(1) : "—"}</span>
            <div>
              <StarRating value={summary.rating} size={18} />
              <p className="mt-1 text-sm text-charcoal-700 dark:text-cream-200/70">
                {summary.source === "google" ? `${summary.totalReviews} ulasan di Google` : `Berdasarkan ${summary.totalReviews} ulasan customer`}
              </p>
            </div>
          </div>
          <p className="mt-2 text-xs text-charcoal-700/70 dark:text-cream-200/50">
            {summary.source === "google"
              ? "Data live dari Google Maps (diperbarui berkala)."
              : "Review pilihan dari customer — lihat ulasan lengkap langsung di Google Maps."}
          </p>
        </div>
        <a href={summary.mapsUrl} target="_blank" rel="noopener noreferrer" className="btn-outline shrink-0">
          Lihat Semua Review di Google <ExternalLink className="h-4 w-4" />
        </a>
      </div>
      {reviews.length ? <ReviewSlider reviews={reviews} /> : <EmptyState title="Belum ada review" />}
      {summary.source === "google" && <p className="mt-4 text-right text-xs text-charcoal-700/60 dark:text-cream-200/40">Ulasan dari Google</p>}
    </div>
  );
}
