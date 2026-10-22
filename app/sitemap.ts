import type { MetadataRoute } from "next";
import { publicEnv } from "@/lib/env";
import { getProducts } from "@/services/data";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = publicEnv.siteUrl;
  const now = new Date();
  const pages = ["", "/katalog", "/kalkulator", "/bahan-warna", "/portfolio", "/video", "/tentang", "/review", "/kontak", "/kirim-project"].map((p) => ({
    url: `${base}${p}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: p === "" ? 1 : p === "/katalog" || p === "/kalkulator" ? 0.9 : 0.7,
  }));
  const products = (await getProducts()).map((p) => ({
    url: `${base}/katalog/${p.slug}`,
    lastModified: new Date(p.created_at),
    changeFrequency: "monthly" as const,
    priority: 0.8,
  }));
  return [...pages, ...products];
}
