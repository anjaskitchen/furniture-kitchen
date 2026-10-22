"use client";
import { Quote } from "lucide-react";
import Image from "next/image";
import { formatDateID } from "@/lib/format";
import type { DisplayReview } from "@/types";
import { Slider } from "./Slider";
import { StarRating } from "./StarRating";

export function ReviewSlider({ reviews }: { reviews: DisplayReview[] }) {
  return (
    <Slider ariaLabel="Review customer" autoplay={6000} slidesPerView={{ base: 1.05, sm: 2, lg: 3 }}>
      {reviews.map((r) => (
        <article key={r.id} className="card flex h-full flex-col p-6">
          <Quote className="h-8 w-8 text-bronze-400/60" />
          <StarRating value={r.rating} />
          <p className="mt-4 line-clamp-6 flex-1 text-sm leading-relaxed text-charcoal-800 dark:text-cream-200/90">{r.text}</p>
          <div className="mt-6 flex items-center gap-3 border-t border-charcoal-900/5 pt-4 dark:border-white/10">
            {r.authorPhoto ? (
              <Image src={r.authorPhoto} alt="" width={40} height={40} className="h-10 w-10 rounded-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <span className="grid h-10 w-10 place-items-center rounded-full bg-cream-200 font-semibold text-wood-600 dark:bg-charcoal-800">
                {r.authorName.charAt(0)}
              </span>
            )}
            <div>
              <p className="text-sm font-semibold">{r.authorName}</p>
              <p className="text-xs text-charcoal-700/70 dark:text-cream-200/50">{r.relativeTime || formatDateID(r.date)}</p>
            </div>
          </div>
        </article>
      ))}
    </Slider>
  );
}
