import { ArrowRight, Calculator } from "lucide-react";
import Link from "next/link";
import { parseVideoUrl } from "@/lib/utils";
import type { Feature, SiteSettings } from "@/types";
import { SmartImage } from "./SmartImage";

export function Hero({
  settings,
  stats = [],
  rating,
}: {
  settings: SiteSettings;
  stats?: Feature[];
  rating?: { value: number; count: number };
}) {
  const [line1, line2] = (settings.hero_title || "Custom Furniture & Kitchen Set\nSesuai Ruang, Sesuai Gaya Anda.").split("\n");
  const video = parseVideoUrl(settings.hero_video_url);
  return (
    <section className="relative overflow-hidden">
      <div className="container grid items-center gap-10 pb-16 pt-6 lg:grid-cols-12 lg:gap-12 lg:pb-24 lg:pt-10">
        <div className="animate-fade-up lg:col-span-6">
          <p className="eyebrow mb-5">{settings.tagline || `Custom Furniture ${settings.city ?? ""}`}</p>
          <h1 className="text-4xl font-bold leading-[1.08] sm:text-5xl lg:text-6xl">
            {line1}
            {line2 && <span className="mt-2 block font-medium text-wood-500 dark:text-bronze-300">{line2}</span>}
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-charcoal-700 dark:text-cream-200/80 sm:text-lg">{settings.hero_subtitle}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/kalkulator" className="btn-primary !px-7 !py-4">
              <Calculator className="h-4 w-4" /> {settings.cta_primary_label || "Hitung Harga"}
            </Link>
            <Link href="/katalog" className="btn-outline !px-7 !py-4">
              {settings.cta_secondary_label || "Lihat Katalog"} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          {stats.length > 0 && (
            <dl className="mt-10 grid max-w-md grid-cols-3 gap-6 border-t border-charcoal-900/10 pt-6 dark:border-white/10">
              {stats.slice(0, 3).map((stat) => {
                // Statistik berikon bintang tanpa nilai = rating review otomatis.
                const value = stat.value || (stat.icon === "star" && rating && rating.value > 0 ? rating.value.toFixed(1) : "—");
                return (
                  <div key={stat.id}>
                    <dt className="text-xs text-charcoal-700 dark:text-cream-200/60">{stat.title}</dt>
                    <dd className="font-display text-2xl font-bold">{value}</dd>
                  </div>
                );
              })}
            </dl>
          )}
        </div>
        <div className="relative animate-fade-in lg:col-span-6">
          <div className="relative aspect-[4/3.4] overflow-hidden rounded-[2rem] shadow-soft lg:aspect-[4/4.2]">
            {video?.kind === "file" ? (
              <video src={video.url} autoPlay muted loop playsInline poster={settings.hero_image_url ?? undefined} className="h-full w-full object-cover" />
            ) : (
              <SmartImage
                src={settings.hero_image_url}
                alt={`Kitchen set custom ${settings.business_name}`}
                fill
                priority
                sizes="(min-width: 1024px) 50vw, 100vw"
                className="object-cover"
              />
            )}
          </div>
          {settings.hero_card_title && (
            <div className="absolute -bottom-6 left-4 hidden rounded-2xl bg-white/95 p-4 shadow-soft backdrop-blur dark:bg-charcoal-900/95 sm:block lg:-left-8">
              {settings.hero_card_text && <p className="text-xs text-charcoal-700 dark:text-cream-200/70">{settings.hero_card_text}</p>}
              <p className="font-display text-lg font-bold">{settings.hero_card_title}</p>
              <Link href="/kalkulator" className="text-sm font-semibold text-wood-600 hover:underline dark:text-bronze-300">
                Hitung sekarang →
              </Link>
            </div>
          )}
          <div className="absolute -right-24 -top-24 -z-10 h-72 w-72 rounded-full bg-bronze-300/30 blur-3xl" />
        </div>
      </div>
    </section>
  );
}
