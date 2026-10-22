import type { Metadata } from "next";
import { publicEnv } from "./env";
import type { Faq, ReviewSummary, SiteSettings } from "@/types";

export function absoluteUrl(path = "/") {
  if (/^https?:\/\//.test(path)) return path;
  return `${publicEnv.siteUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

export function pageMetadata({
  title,
  description,
  path,
  image,
  type = "website",
}: {
  title: string;
  description: string;
  path: string;
  image?: string | null;
  type?: "website" | "article";
}): Metadata {
  const images = image ? [{ url: absoluteUrl(image), width: 1200, height: 900, alt: title }] : undefined;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title, description, url: path, type, locale: "id_ID", ...(images ? { images } : {}) },
    twitter: { card: "summary_large_image", title, description, ...(images ? { images: images.map((i) => i.url) } : {}) },
  };
}

export function localBusinessJsonLd(settings: SiteSettings, reviews?: ReviewSummary) {
  const sameAs = [settings.instagram_url, settings.facebook_url, settings.tiktok_url, settings.youtube_url, settings.google_maps_url].filter(
    (u): u is string => Boolean(u && /^https?:\/\//.test(u) && !/^https?:\/\/(www\.)?(instagram|facebook|tiktok|youtube)\.com\/?$/.test(u)),
  );
  return {
    "@context": "https://schema.org",
    "@type": "FurnitureStore",
    "@id": `${publicEnv.siteUrl}/#business`,
    name: settings.business_name,
    description: settings.description,
    url: publicEnv.siteUrl,
    image: absoluteUrl(settings.hero_image_url || "/opengraph-image"),
    ...(settings.logo_url ? { logo: absoluteUrl(settings.logo_url) } : {}),
    ...(settings.whatsapp_number ? { telephone: `+${settings.whatsapp_number}` } : {}),
    ...(settings.email ? { email: settings.email } : {}),
    address: {
      "@type": "PostalAddress",
      streetAddress: settings.address,
      addressLocality: settings.city || "Bandung",
      addressRegion: "Jawa Barat",
      addressCountry: "ID",
    },
    areaServed: settings.city || "Bandung",
    priceRange: "Rp",
    ...(settings.opening_hours ? { openingHours: "Mo-Sa 08:00-17:00" } : {}),
    ...(sameAs.length ? { sameAs } : {}),
    // AggregateRating hanya disertakan jika berasal dari data live Google.
    ...(reviews && reviews.source === "google" && reviews.totalReviews > 0
      ? { aggregateRating: { "@type": "AggregateRating", ratingValue: reviews.rating, reviewCount: reviews.totalReviews } }
      : {}),
  };
}

export function faqJsonLd(items: Pick<Faq, "question" | "answer">[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };
}
