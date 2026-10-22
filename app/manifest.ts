import type { MetadataRoute } from "next";
import { getSettings } from "@/services/data";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const s = await getSettings();
  return {
    id: "/",
    name: s.business_name,
    short_name: s.business_name.length > 12 ? s.business_name.split(" ")[0] : s.business_name,
    description: s.description ?? undefined,
    lang: "id",
    dir: "ltr",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#FDFBF7",
    theme_color: "#1C1C1C",
    categories: ["shopping", "lifestyle", "business"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
    shortcuts: [
      { name: "Hitung Harga", short_name: "Kalkulator", url: "/kalkulator", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Katalog", url: "/katalog", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Kontak & Survey", short_name: "Kontak", url: "/kontak", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
