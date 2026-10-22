import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { CtaBand } from "@/components/CtaBand";
import { FeatureIcon } from "@/components/FeatureIcon";
import { Reveal } from "@/components/Reveal";
import { SmartImage } from "@/components/SmartImage";
import { pageMetadata } from "@/lib/seo";
import { getFeatures, getSettings } from "@/services/data";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  return pageMetadata({
    title: "Tentang Kami",
    description: `${s.business_name} — workshop custom furniture & kitchen set di ${s.city ?? "Bandung"}.`,
    path: "/tentang",
  });
}

export default async function AboutPage() {
  const [s, values] = await Promise.all([getSettings(), getFeatures("about_value")]);
  return (
    <>
      <section className="container pb-12 pt-8 sm:pt-12">
        <Breadcrumbs items={[{ name: "Tentang Kami", href: "/tentang" }]} />
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <Reveal>
            <p className="eyebrow mb-3">Tentang {s.business_name}</p>
            <h1 className="text-4xl font-bold leading-tight sm:text-5xl">{s.about_title}</h1>
            <div className="prose-simple mt-6">
              {(s.about_content ?? "").split(/\n\n+/).map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </Reveal>
          <Reveal delay={120}>
            <div className="grid grid-cols-2 gap-4">
              <div className="relative aspect-[3/4] overflow-hidden rounded-3xl">
                <SmartImage src={s.about_image_url || "/placeholders/wardrobe-2.svg"} alt={`Workshop ${s.business_name}`} fill sizes="25vw" className="object-cover" />
              </div>
              <div className="relative mt-12 aspect-[3/4] overflow-hidden rounded-3xl">
                <SmartImage src={s.about_image_2_url || "/placeholders/kitchen-4.svg"} alt={`Hasil kerja ${s.business_name}`} fill sizes="25vw" className="object-cover" />
              </div>
            </div>
          </Reveal>
        </div>
      </section>
      {values.length > 0 && (
        <section className="section bg-cream-100 dark:bg-charcoal-900/40">
          <div className="container grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {values.map((v) => (
              <div key={v.id} className="card p-6">
                <FeatureIcon name={v.icon} className="h-7 w-7 text-wood-500" />
                <h2 className="mt-4 font-display text-lg font-semibold">{v.title}</h2>
                {v.description && <p className="mt-2 text-sm text-charcoal-700 dark:text-cream-200/70">{v.description}</p>}
              </div>
            ))}
          </div>
        </section>
      )}
      <CtaBand settings={s} />
    </>
  );
}
