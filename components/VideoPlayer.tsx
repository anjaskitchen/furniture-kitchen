"use client";
import { Play } from "lucide-react";
import { useState } from "react";
import { trackEvent } from "@/lib/analytics";
import { parseVideoUrl } from "@/lib/utils";
import { SmartImage } from "./SmartImage";

/**
 * Lazy video: hanya menampilkan thumbnail. Iframe YouTube/Vimeo atau <video>
 * baru dimuat setelah diklik — menjaga website tetap cepat.
 */
export function VideoPlayer({ url, title, thumbnail }: { url: string; title: string; thumbnail?: string | null }) {
  const [playing, setPlaying] = useState(false);
  const video = parseVideoUrl(url);
  if (!video) return null;
  const thumb = thumbnail || (video.kind !== "file" ? video.thumbnail : null);

  if (playing) {
    return (
      <div className="relative aspect-video overflow-hidden rounded-2xl bg-black">
        {video.kind === "file" ? (
          <video src={video.url} controls autoPlay playsInline className="h-full w-full" />
        ) : (
          <iframe
            src={video.embedUrl}
            title={title}
            className="absolute inset-0 h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
          />
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setPlaying(true);
        trackEvent("product_view", { video: title });
      }}
      className="group relative block aspect-video w-full overflow-hidden rounded-2xl bg-charcoal-900"
      aria-label={`Putar video: ${title}`}
    >
      {thumb ? (
        <SmartImage src={thumb} alt={title} fill sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover opacity-90 transition duration-500 group-hover:scale-105" />
      ) : (
        <SmartImage src="/placeholders/kitchen-3.svg" alt={title} fill sizes="100vw" className="object-cover opacity-70" />
      )}
      <span className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
      <span className="absolute left-1/2 top-1/2 grid h-16 w-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/95 text-charcoal-900 shadow-soft transition group-hover:scale-110">
        <Play className="ml-1 h-6 w-6 fill-current" />
      </span>
    </button>
  );
}
