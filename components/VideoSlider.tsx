"use client";
import type { Video } from "@/types";
import { Slider } from "./Slider";
import { VideoPlayer } from "./VideoPlayer";

export function VideoSlider({ videos }: { videos: Video[] }) {
  return (
    <Slider ariaLabel="Galeri video" slidesPerView={{ base: 1.05, sm: 1.5, lg: 2 }}>
      {videos.map((v) => (
        <figure key={v.id}>
          <VideoPlayer url={v.video_url} title={v.title} thumbnail={v.thumbnail_url} />
          <figcaption className="mt-4">
            <span className="eyebrow">{v.category}</span>
            <p className="mt-1 font-display text-lg font-semibold">{v.title}</p>
            {v.description && <p className="mt-1 text-sm text-charcoal-700 dark:text-cream-200/70">{v.description}</p>}
          </figcaption>
        </figure>
      ))}
    </Slider>
  );
}
