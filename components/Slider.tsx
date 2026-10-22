"use client";
import type { ReactNode } from "react";
import { A11y, Autoplay, Keyboard, Navigation, Pagination } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";

/**
 * Slider reusable berbasis Swiper: touch/swipe, arrows, pagination dots,
 * autoplay opsional. Gambar di dalam slide memakai lazy loading next/image.
 */
export function Slider({
  children,
  autoplay = false,
  slidesPerView = { base: 1.1, sm: 2, lg: 3 },
  ariaLabel,
  className,
}: {
  children: ReactNode[];
  autoplay?: boolean | number;
  slidesPerView?: { base: number; sm?: number; lg?: number; xl?: number };
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <div aria-label={ariaLabel} role="region" className={className}>
      <Swiper
        modules={[Navigation, Pagination, Autoplay, A11y, Keyboard]}
        spaceBetween={20}
        slidesPerView={slidesPerView.base}
        breakpoints={{
          640: { slidesPerView: slidesPerView.sm ?? slidesPerView.base },
          1024: { slidesPerView: slidesPerView.lg ?? slidesPerView.sm ?? slidesPerView.base },
          1280: { slidesPerView: slidesPerView.xl ?? slidesPerView.lg ?? slidesPerView.sm ?? slidesPerView.base },
        }}
        navigation
        pagination={{ clickable: true, dynamicBullets: children.length > 6 }}
        keyboard={{ enabled: true }}
        autoplay={autoplay ? { delay: typeof autoplay === "number" ? autoplay : 5000, disableOnInteraction: true, pauseOnMouseEnter: true } : false}
        a11y={{ prevSlideMessage: "Sebelumnya", nextSlideMessage: "Berikutnya", paginationBulletMessage: "Ke slide {{index}}" }}
        className="!pb-2"
      >
        {children.map((child, i) => (
          <SwiperSlide key={i} className="!h-auto">
            {child}
          </SwiperSlide>
        ))}
      </Swiper>
    </div>
  );
}
