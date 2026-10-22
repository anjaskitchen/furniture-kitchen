import { Camera } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { ReviewSection } from "@/components/ReviewSection";
import { pageMetadata } from "@/lib/seo";
import { getSettings } from "@/services/data";
import { getReviewSummary } from "@/services/google-reviews";
import { publicEnv } from "@/lib/env";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  return pageMetadata({
    title: "Review Customer",
    description: `Ulasan dan testimoni customer ${s.business_name} untuk kitchen set dan custom furniture.`,
    path: "/review",
  });
}

export default async function ReviewPage() {
  const [summary, settings] = await Promise.all([getReviewSummary(), getSettings()]);
  return (
    <section className="container pb-20 pt-8 sm:pt-12">
      <Breadcrumbs items={[{ name: "Review", href: "/review" }]} />
      <h1 className="mb-2 text-4xl font-bold sm:text-5xl">Review Customer</h1>
      <p className="mb-10 max-w-2xl text-charcoal-700 dark:text-cream-200/80">Apa kata customer tentang hasil kerja {settings.business_name}.</p>
      <ReviewSection summary={summary} heading={false} />
      <div className="card mt-16 flex flex-col items-start gap-4 p-8 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-xl font-semibold">Sudah memakai jasa kami?</h2>
          <p className="mt-1 text-sm text-charcoal-700 dark:text-cream-200/70">Bagikan foto hasil project dan testimoni Anda. Setelah diverifikasi admin, akan tampil di website.</p>
        </div>
        <Link href="/kirim-project" className="btn-primary shrink-0">
          <Camera className="h-4 w-4" /> Kirim Foto & Testimoni
        </Link>
      </div>
      {summary.reviews.length > 0 && (
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "FurnitureStore",
            "@id": `${publicEnv.siteUrl}/#business`,
            name: settings.business_name,
            review: summary.reviews.slice(0, 10).map((r) => ({
              "@type": "Review",
              author: { "@type": "Person", name: r.authorName },
              reviewRating: { "@type": "Rating", ratingValue: r.rating, bestRating: 5 },
              reviewBody: r.text,
              ...(r.date ? { datePublished: r.date.slice(0, 10) } : {}),
            })),
          }}
        />
      )}
    </section>
  );
}
