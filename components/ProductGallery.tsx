"use client";
import { useState } from "react";
import type { Swiper as SwiperType } from "swiper";
import { A11y, Keyboard, Navigation, Pagination, Thumbs } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";
import "swiper/css/thumbs";
import { SmartImage } from "./SmartImage";
import { VideoPlayer } from "./VideoPlayer";

export function ProductGallery({ images, videoUrl, name }: { images: string[]; videoUrl?: string | null; name: string }) {
  const [thumbs, setThumbs] = useState<SwiperType | null>(null);
  const list = images.length ? images : ["/placeholders/kitchen-1.svg"];
  const slides = [...list.map((src) => ({ type: "image" as const, src })), ...(videoUrl ? [{ type: "video" as const, src: videoUrl }] : [])];

  return (
    <div className="min-w-0">
      <Swiper
        modules={[Navigation, Pagination, Thumbs, A11y, Keyboard]}
        navigation
        pagination={{ clickable: true }}
        keyboard={{ enabled: true }}
        thumbs={{ swiper: thumbs && !thumbs.destroyed ? thumbs : null }}
        className="overflow-hidden rounded-3xl"
      >
        {slides.map((s, i) => (
          <SwiperSlide key={i}>
            {s.type === "image" ? (
              <div className="relative aspect-[4/3] bg-cream-200">
                <SmartImage src={s.src} alt={`${name} — foto ${i + 1}`} fill priority={i === 0} sizes="(min-width: 1024px) 55vw, 100vw" className="object-cover" />
              </div>
            ) : (
              <div className="flex aspect-[4/3] items-center bg-charcoal-900">
                <div className="w-full">
                  <VideoPlayer url={s.src} title={`Video ${name}`} />
                </div>
              </div>
            )}
          </SwiperSlide>
        ))}
      </Swiper>
      {slides.length > 1 && (
        <Swiper modules={[Thumbs]} onSwiper={setThumbs} slidesPerView={4.5} spaceBetween={10} watchSlidesProgress className="mt-3">
          {slides.map((s, i) => (
            <SwiperSlide key={i} className="cursor-pointer overflow-hidden rounded-xl opacity-60 transition [&.swiper-slide-thumb-active]:opacity-100 [&.swiper-slide-thumb-active]:ring-2 [&.swiper-slide-thumb-active]:ring-wood-500">
              <div className="relative aspect-square bg-charcoal-900">
                {s.type === "image" ? (
                  <SmartImage src={s.src} alt="" fill sizes="120px" className="object-cover" />
                ) : (
                  <span className="grid h-full place-items-center text-xs font-semibold text-white">▶ Video</span>
                )}
              </div>
            </SwiperSlide>
          ))}
        </Swiper>
      )}
    </div>
  );
}
