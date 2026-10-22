import { ArrowRight, Calculator, Star } from "lucide-react";
import Link from "next/link";
import { parseVideoUrl } from "@/lib/utils";
import type { Feature, SiteSettings } from "@/types";
import { SmartImage } from "./SmartImage";

export function Hero({
  settings,
  stats = [],
  rating,
  accentImage,
}: {
  settings: SiteSettings;
  stats?: Feature[];
  rating?: { value: number; count: number };
  /** Foto kedua (mis. project portfolio terbaru) untuk kolase di desktop. */
  accentImage?: { src: string; alt: string; href: string } | null;
}) {
  const [line1, line2] = (settings.hero_title || "Custom Furniture & Kitchen Set\nSesuai Ruang, Sesuai Gaya Anda.").split("\n");
  const video = parseVideoUrl(settings.hero_video_url);
  const hasRating = Boolean(rating && rating.value > 0 && rating.count > 0);

  return (
    <section className="relative isolate overflow-hidden">
      {/* Latar: gradasi hangat + grid halus */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_85%_10%,rgba(200,164,106,0.18),transparent_70%),radial-gradient(40%_40%_at_0%_100%,rgba(154,107,67,0.10),transparent_70%)] dark:bg-[radial-gradient(60%_50%_at_85%_10%,rgba(200,164,106,0.10),transparent_70%)]"
      />
      <div
        aria-hidden
        className="absolute inset-0 -z-10 opacity-[0.35] [background-image:linear-gradient(rgba(28,28,28,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(28,28,28,0.05)_1px,transparent_1px)] [background-size:56px_56px] [mask-image:radial-gradient(70%_60%_at_50%_30%,black,transparent)] dark:opacity-10"
      />

      <div className="container grid items-center gap-12 pb-16 pt-6 sm:pt-10 lg:grid-cols-12 lg:gap-10 lg:pb-24">
        <div className="animate-fade-up lg:col-span-6">
          <p className="eyebrow mb-5 flex items-center gap-3">
            <span className="h-px w-8 bg-current" aria-hidden />
            {settings.tagline || `Custom Furniture ${settings.city ?? ""}`}
          </p>
          <h1 className="text-balance text-[clamp(2.25rem,5.2vw,4.25rem)] font-bold leading-[1.05] tracking-tight">
            {line1}
            {line2 && <span className="mt-2 block font-medium text-wood-500 dark:text-bronze-300">{line2}</span>}
          </h1>
          {settings.hero_subtitle && (
            <p className="mt-6 max-w-xl text-pretty text-base leading-relaxed text-charcoal-700 dark:text-cream-200/80 sm:text-lg">{settings.hero_subtitle}</p>
          )}
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/kalkulator" className="btn-primary group !px-7 !py-4">
              <Calculator className="h-4 w-4" /> {settings.cta_primary_label || "Hitung Harga"}
            </Link>
            <Link href="/katalog" className="btn-outline group !px-7 !py-4">
              {settings.cta_secondary_label || "Lihat Katalog"} <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </Link>
          </div>

          {hasRating && (
            <Link href="/review" className="mt-6 inline-flex items-center gap-2 text-sm text-charcoal-700 transition hover:text-charcoal-900 dark:text-cream-200/70 dark:hover:text-cream-50">
              <span className="flex text-bronze-400" aria-hidden>
                {Array.from({ length: 5 }, (_, i) => (
                  <Star key={i} className="h-4 w-4" fill={i < Math.round(rating!.value) ? "currentColor" : "none"} />
                ))}
              </span>
              <span>
                <strong className="font-semibold text-charcoal-900 dark:text-cream-50">{rating!.value.toFixed(1)}</strong> dari {rating!.count} ulasan customer
              </span>
            </Link>
          )}

          {stats.length > 0 && (
            <dl className="mt-10 grid max-w-md grid-cols-3 gap-4 border-t border-charcoal-900/10 pt-6 dark:border-white/10 sm:gap-6">
              {stats.slice(0, 3).map((stat) => {
                // Statistik berikon bintang tanpa nilai = rating review otomatis.
                const value = stat.value || (stat.icon === "star" && hasRating ? rating!.value.toFixed(1) : "—");
                return (
                  <div key={stat.id}>
                    <dt className="text-xs text-charcoal-700 dark:text-cream-200/60">{stat.title}</dt>
                    <dd className="font-display text-xl font-bold sm:text-2xl">{value}</dd>
                  </div>
                );
              })}
            </dl>
          )}
        </div>

        <div className="relative animate-fade-in lg:col-span-6">
          <div className="relative aspect-[4/3.4] overflow-hidden rounded-[2rem] shadow-soft ring-1 ring-charcoal-900/5 lg:ml-6 lg:aspect-[4/4.4]">
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

          {accentImage && (
            <Link
              href={accentImage.href}
              className="group absolute -bottom-8 -left-2 hidden w-44 overflow-hidden rounded-2xl border-4 border-cream-50 shadow-soft transition hover:-translate-y-1 dark:border-charcoal-950 lg:block xl:w-52"
              aria-label={`Lihat project ${accentImage.alt}`}
            >
              <div className="relative aspect-[4/5]">
                <SmartImage src={accentImage.src} alt={accentImage.alt} fill sizes="208px" className="object-cover transition duration-700 group-hover:scale-105" />
              </div>
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-charcoal-950/80 to-transparent p-3 pt-8 text-xs font-medium text-white">{accentImage.alt}</span>
            </Link>
          )}

          {settings.hero_card_title && (
            <div className="absolute -top-5 right-4 hidden rounded-2xl bg-white/95 p-4 shadow-soft ring-1 ring-charcoal-900/5 backdrop-blur dark:bg-charcoal-900/95 sm:block lg:-right-4">
              {settings.hero_card_text && <p className="text-xs text-charcoal-700 dark:text-cream-200/70">{settings.hero_card_text}</p>}
              <p className="font-display text-lg font-bold">{settings.hero_card_title}</p>
              <Link href="/kalkulator" className="text-sm font-semibold text-wood-600 hover:underline dark:text-bronze-300">
                Hitung sekarang →
              </Link>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
