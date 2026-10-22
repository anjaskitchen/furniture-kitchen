import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { EmptyState } from "@/components/EmptyState";
import { SectionHeading } from "@/components/SectionHeading";
import { VideoPlayer } from "@/components/VideoPlayer";
import { VideoSlider } from "@/components/VideoSlider";
import { pageMetadata } from "@/lib/seo";
import { getVideos } from "@/services/data";

export const revalidate = 300;

export const metadata: Metadata = pageMetadata({
  title: "Video Project & Proses Produksi",
  description: "Video proses pembuatan dan hasil pemasangan kitchen set serta custom furniture.",
  path: "/video",
});

export default async function VideoPage() {
  const videos = await getVideos();
  const categories = [...new Set(videos.map((v) => v.category))];
  return (
    <section className="container pb-20 pt-8 sm:pt-12">
      <Breadcrumbs items={[{ name: "Video", href: "/video" }]} />
      <SectionHeading as="h1" eyebrow="Video" title="Galeri video" description="Lihat langsung proses produksi di workshop dan hasil pemasangan di rumah customer." />
      {videos.length === 0 ? (
        <EmptyState title="Belum ada video" />
      ) : (
        <>
          <VideoSlider videos={videos} />
          {categories.map((cat) => (
            <div key={cat} className="mt-16">
              <h2 className="mb-6 font-display text-2xl font-semibold">{cat}</h2>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {videos
                  .filter((v) => v.category === cat)
                  .map((v) => (
                    <div key={v.id}>
                      <VideoPlayer url={v.video_url} title={v.title} thumbnail={v.thumbnail_url} />
                      <p className="mt-3 font-medium">{v.title}</p>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </>
      )}
    </section>
  );
}
