import { ArrowRight, ArrowUpRight, Calculator, PencilRuler } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { CtaBand } from "@/components/CtaBand";
import { FaqList } from "@/components/FaqList";
import { FeatureIcon } from "@/components/FeatureIcon";
import { Hero } from "@/components/Hero";
import { JsonLd } from "@/components/JsonLd";
import { ProductCard } from "@/components/ProductCard";
import { Reveal } from "@/components/Reveal";
import { ReviewSection } from "@/components/ReviewSection";
import { SectionHeading } from "@/components/SectionHeading";
import { Slider } from "@/components/Slider";
import { SmartImage } from "@/components/SmartImage";
import { TrackedLink } from "@/components/TrackedLink";
import { VideoPlayer } from "@/components/VideoPlayer";
import { WhatsAppIcon } from "@/components/icons";
import { formatRupiah } from "@/lib/format";
import { faqJsonLd } from "@/lib/seo";
import { cn, safeUrl } from "@/lib/utils";
import { whatsappLink } from "@/lib/whatsapp";
import {
  getCategories,
  getFaqs,
  getFeatures,
  getHomeSections,
  getMaterials,
  getPortfolio,
  getProducts,
  getSettings,
  getVideos,
} from "@/services/data";
import { getReviewSummary } from "@/services/google-reviews";
import type { HomeSection, HomeSectionKey } from "@/types";

export const revalidate = 300;

/** Teks bawaan jika admin mengosongkan judul/eyebrow section. */
const DEFAULTS: Record<HomeSectionKey, { eyebrow: string; title: string }> = {
  categories: { eyebrow: "Layanan Kami", title: "Furniture custom untuk setiap ruang" },
  featured_products: { eyebrow: "Katalog", title: "Produk pilihan" },
  calculator: { eyebrow: "Harga Transparan", title: "Hitung estimasi biaya dalam 1 menit" },
  portfolio: { eyebrow: "Portfolio", title: "Hasil pekerjaan kami" },
  videos: { eyebrow: "Video", title: "Lihat proses & hasil kerja" },
  reviews: { eyebrow: "Review Customer", title: "Dipercaya pemilik rumah & bisnis" },
  advantages: { eyebrow: "Kenapa Kami", title: "Dikerjakan serius, dari survei sampai instalasi" },
  faq: { eyebrow: "FAQ", title: "Pertanyaan yang sering diajukan" },
  cta: { eyebrow: "", title: "" },
};

function heading(s: HomeSection) {
  return {
    eyebrow: s.eyebrow || DEFAULTS[s.key].eyebrow,
    title: s.title || DEFAULTS[s.key].title,
    description: s.description ?? undefined,
  };
}

/**
 * Ukuran kartu grid bento portfolio agar baris selalu penuh berapa pun jumlah item:
 * item pertama 2x2, sisanya mengisi kolom (sm: 2 kolom, lg: 4 kolom).
 */
function bentoSpan(i: number, n: number) {
  if (n === 1) return "sm:col-span-2 lg:col-span-4";
  if (i === 0) return "sm:col-span-2 sm:row-span-2";
  const classes: string[] = [];
  // sm (2 kolom): jika sisa item ganjil, item terakhir selebar baris.
  if ((n - 1) % 2 === 1 && i === n - 1) classes.push("sm:col-span-2");
  // lg (4 kolom): item 1-4 mengisi 2x2 di samping item besar, lalu baris berisi 4.
  let lg = "lg:col-span-1";
  if (n === 2) lg = "lg:col-span-2 lg:row-span-2";
  else if (n === 3) lg = "lg:col-span-2";
  else if (n === 4 && i === 3) lg = "lg:col-span-2";
  else if (i >= 5) {
    const extra = n - 5;
    const pos = (i - 5) % 4;
    const inRow = Math.min(4, extra - (i - 5 - pos));
    if (inRow === 1) lg = "lg:col-span-4";
    else if (inRow === 2) lg = "lg:col-span-2";
    else if (inRow === 3 && pos === 2) lg = "lg:col-span-2";
  }
  classes.push(lg);
  return classes.join(" ");
}

function SectionLink({ s, fallback }: { s: HomeSection; fallback?: string }) {
  const href = safeUrl(s.cta_url) ?? fallback;
  if (!s.cta_label || !href) return null;
  return (
    <Link href={href} className="btn-outline btn-sm">
      {s.cta_label} <ArrowRight className="h-4 w-4" />
    </Link>
  );
}

export default async function HomePage() {
  const [settings, sections, categories, products, materials, portfolio, videos, reviews, heroStats, steps, advantages, faqs] = await Promise.all([
    getSettings(),
    getHomeSections(),
    getCategories(),
    getProducts(),
    getMaterials(),
    getPortfolio(),
    getVideos(),
    getReviewSummary(),
    getFeatures("hero_stat"),
    getFeatures("process"),
    getFeatures("advantage"),
    getFaqs(),
  ]);

  const render: Record<HomeSectionKey, (s: HomeSection) => ReactNode> = {
    categories: (s) => {
      const items = categories.filter((c) => c.show_on_home).slice(0, s.item_limit);
      if (!items.length) return null;
      return (
        <>
          <Reveal>
            <SectionHeading {...heading(s)} action={<SectionLink s={s} fallback="/katalog" />} />
          </Reveal>
          <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
            {items.map((c, i) => (
              <Reveal key={c.id} delay={i * 60}>
                <Link href={`/katalog?kategori=${c.slug}`} className="group relative block overflow-hidden rounded-2xl">
                  <div className="relative aspect-[4/5] w-full">
                    <SmartImage src={c.image_url} alt={c.name} fill sizes="(min-width: 1024px) 25vw, 50vw" className="object-cover transition duration-700 group-hover:scale-105" />
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-charcoal-950/75 via-charcoal-950/10 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-4 text-white sm:p-6">
                    <h3 className="font-display text-base font-semibold sm:text-xl">{c.name}</h3>
                    <ArrowRight className="h-5 w-5 -translate-x-2 opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100" />
                  </div>
                </Link>
              </Reveal>
            ))}
            <Reveal delay={items.length * 60}>
              <Link href="/kontak#request-design" className="group flex aspect-[4/5] flex-col justify-between rounded-2xl bg-charcoal-900 p-5 text-cream-50 transition hover:bg-wood-600 sm:p-6">
                <PencilRuler className="h-7 w-7 text-bronze-300" />
                <div>
                  <h3 className="font-display text-lg font-semibold sm:text-2xl">Punya desain sendiri?</h3>
                  <p className="mt-2 hidden text-sm text-cream-200/80 sm:block">Kirim referensi, kami wujudkan sesuai ukuran ruang Anda.</p>
                  <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold">
                    Request Design <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                  </span>
                </div>
              </Link>
            </Reveal>
          </div>
        </>
      );
    },

    featured_products: (s) => {
      const featured = products.filter((p) => p.is_featured);
      const items = (featured.length ? featured : products).slice(0, s.item_limit);
      if (!items.length) return null;
      return (
        <>
          <Reveal>
            <SectionHeading {...heading(s)} action={<SectionLink s={s} fallback="/katalog" />} />
          </Reveal>
          <Slider ariaLabel={heading(s).title} slidesPerView={{ base: 1.08, sm: 2, lg: 3 }}>
            {items.map((p) => (
              <ProductCard key={p.id} product={p} whatsapp={settings.whatsapp_number} />
            ))}
          </Slider>
        </>
      );
    },

    calculator: (s) => {
      const h = heading(s);
      return (
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <Reveal>
            <p className="eyebrow mb-3">{h.eyebrow}</p>
            <h2 className="section-title">{h.title}</h2>
            {h.description && <p className="mt-4 leading-relaxed text-charcoal-700 dark:text-cream-200/80">{h.description}</p>}
            {materials.length > 0 && (
              <ul className="mt-8 space-y-3">
                {materials.slice(0, s.item_limit).map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-4 rounded-xl border border-charcoal-900/10 px-5 py-4 dark:border-white/10">
                    <span className="font-medium">{m.name}</span>
                    <span className="text-right font-display font-bold text-wood-600 dark:text-bronze-300">
                      {formatRupiah(m.price_per_meter)} <span className="text-xs font-normal text-charcoal-700 dark:text-cream-200/60">/ meter</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <Link href={safeUrl(s.cta_url) ?? "/kalkulator"} className="btn-primary mt-8">
              <Calculator className="h-4 w-4" /> {s.cta_label || "Hitung Estimasi Harga"}
            </Link>
          </Reveal>
          {steps.length > 0 && (
            <Reveal delay={120}>
              <ol className="grid grid-cols-2 gap-4">
                {steps.map((step, i) => (
                  <li key={step.id} className={cn("card p-5 sm:p-6", i % 2 === 1 && "translate-y-6")}>
                    <span className="grid h-11 w-11 place-items-center rounded-xl bg-cream-200 text-wood-600 dark:bg-charcoal-800 dark:text-bronze-300">
                      <FeatureIcon name={step.icon} className="h-5 w-5" />
                    </span>
                    <p className="mt-4 text-xs font-semibold text-wood-500">{String(i + 1).padStart(2, "0")}</p>
                    <h3 className="mt-1 font-display font-semibold">{step.title}</h3>
                    {step.description && <p className="mt-2 text-sm text-charcoal-700 dark:text-cream-200/70">{step.description}</p>}
                  </li>
                ))}
              </ol>
            </Reveal>
          )}
        </div>
      );
    },

    portfolio: (s) => {
      const items = portfolio.slice(0, s.item_limit);
      if (!items.length) return null;
      return (
        <>
          <Reveal>
            <SectionHeading {...heading(s)} action={<SectionLink s={s} fallback="/portfolio" />} />
          </Reveal>
          {/* Bento: project pertama tampil besar di desktop */}
          <div className="grid auto-rows-[220px] grid-cols-1 gap-4 sm:auto-rows-[240px] sm:grid-cols-2 lg:grid-cols-4">
            {items.map((p, i) => (
              <Reveal key={p.id} delay={i * 60} className={bentoSpan(i, items.length)}>
                <Link href={`/portfolio#${p.slug}`} className="group relative block h-full overflow-hidden rounded-2xl">
                  <SmartImage
                    src={p.images[0]}
                    alt={p.title}
                    fill
                    sizes={i === 0 ? "(min-width: 1024px) 50vw, 100vw" : "(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"}
                    className="object-cover transition duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-charcoal-950/80 via-charcoal-950/10 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-5 text-white">
                    <div className="min-w-0">
                      <p className="text-xs text-bronze-300">
                        {p.category}
                        {p.year ? ` · ${p.year}` : ""}
                      </p>
                      <h3 className={cn("font-display font-semibold leading-snug", i === 0 ? "text-xl sm:text-2xl" : "text-base")}>{p.title}</h3>
                      {p.location && <p className="mt-0.5 truncate text-xs text-white/70">{p.location}</p>}
                    </div>
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/15 backdrop-blur transition group-hover:bg-white group-hover:text-charcoal-900">
                      <ArrowUpRight className="h-4 w-4" />
                    </span>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        </>
      );
    },

    videos: (s) => {
      const items = videos.slice(0, s.item_limit);
      if (!items.length) return null;
      return (
        <>
          <Reveal>
            <SectionHeading {...heading(s)} action={<SectionLink s={s} fallback="/video" />} />
          </Reveal>
          <div className={cn("grid gap-6", items.length > 1 && "md:grid-cols-2", items.length > 2 && "lg:grid-cols-3")}>
            {items.map((v) => (
              <div key={v.id}>
                <VideoPlayer url={v.video_url} title={v.title} thumbnail={v.thumbnail_url} />
                <p className="mt-3 font-display font-semibold">{v.title}</p>
              </div>
            ))}
          </div>
        </>
      );
    },

    reviews: (s) => <ReviewSection summary={reviews} eyebrow={heading(s).eyebrow} title={heading(s).title} limit={s.item_limit} />,

    advantages: (s) => {
      if (!advantages.length) return null;
      return (
        <>
          <Reveal>
            <SectionHeading {...heading(s)} action={<SectionLink s={s} />} />
          </Reveal>
          <div className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {advantages.slice(0, s.item_limit).map((a, i) => (
              <Reveal key={a.id} delay={i * 60}>
                <div className="flex gap-4">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-cream-200 text-wood-600 dark:bg-charcoal-800 dark:text-bronze-300">
                    <FeatureIcon name={a.icon} className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="font-display font-semibold">{a.title}</h3>
                    {a.description && <p className="mt-1 text-sm leading-relaxed text-charcoal-700 dark:text-cream-200/70">{a.description}</p>}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </>
      );
    },

    faq: (s) => {
      const items = faqs.slice(0, s.item_limit);
      if (!items.length) return null;
      const h = heading(s);
      return (
        <div className="grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <p className="eyebrow mb-3">{h.eyebrow}</p>
            <h2 className="section-title">{h.title}</h2>
            {h.description && <p className="mt-4 leading-relaxed text-charcoal-700 dark:text-cream-200/80">{h.description}</p>}
            {s.cta_label && (
              <TrackedLink
                event="whatsapp_click"
                eventParams={{ location: "faq" }}
                href={safeUrl(s.cta_url) ?? whatsappLink(settings.whatsapp_number, settings.whatsapp_default_message ?? "")}
                className="btn-whatsapp mt-8"
              >
                <WhatsAppIcon size={18} /> {s.cta_label}
              </TrackedLink>
            )}
          </div>
          <div className="lg:col-span-8">
            <FaqList items={items} />
          </div>
          <JsonLd data={faqJsonLd(items)} />
        </div>
      );
    },

    cta: () => null,
  };

  // Section yang tampil, dirender sesuai urutan dari admin. Latar belakang selang-seling
  // dihitung dari posisi tampil agar tetap rapi setelah urutan diubah.
  const visible = sections
    .filter((s) => s.key !== "cta")
    .map((s) => ({ s, node: render[s.key]?.(s) }))
    .filter((x) => x.node);
  const ctaSection = sections.find((s) => s.key === "cta");

  return (
    <>
      <Hero
        settings={settings}
        stats={heroStats}
        rating={{ value: reviews.rating, count: reviews.totalReviews }}
        accentImage={portfolio[0]?.images[0] ? { src: portfolio[0].images[0], alt: portfolio[0].title, href: `/portfolio#${portfolio[0].slug}` } : null}
      />
      {visible.map(({ s, node }, i) =>
        i % 2 === 0 ? (
          <section key={s.id} id={s.key} className={cn("container section", i === 0 && "!pt-8")} aria-label={heading(s).title}>
            {node}
          </section>
        ) : (
          <section key={s.id} id={s.key} className="section bg-cream-100 dark:bg-charcoal-900/40" aria-label={heading(s).title}>
            <div className="container">{node}</div>
          </section>
        ),
      )}
      {ctaSection && (
        <CtaBand
          settings={settings}
          eyebrow={ctaSection.eyebrow ?? undefined}
          title={ctaSection.title ?? undefined}
          description={ctaSection.description ?? undefined}
        />
      )}
    </>
  );
}
