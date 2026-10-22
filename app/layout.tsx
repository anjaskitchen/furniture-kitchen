import type { Metadata, Viewport } from "next";
import "@/styles/globals.css";
import { Analytics } from "@/components/Analytics";
import { ServiceWorkerRegister } from "@/components/Pwa";
import { themeInitScript } from "@/components/ThemeToggle";
import { ToastProvider } from "@/components/Toast";
import { publicEnv } from "@/lib/env";
import { getSettings } from "@/services/data";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  const city = s.city || "Bandung";
  const title = `${s.business_name} — Kitchen Set & Custom Furniture ${city}`;
  return {
    metadataBase: new URL(publicEnv.siteUrl),
    title: { default: title, template: `%s | ${s.business_name}` },
    description:
      s.description ||
      `Kitchen set custom dan furniture custom di ${city}. Desain modern, material HPL & cat duco berkualitas, harga transparan dengan kalkulator estimasi online.`,
    applicationName: s.business_name,
    appleWebApp: { capable: true, title: s.business_name, statusBarStyle: "default" },
    icons: { icon: [{ url: "/icon.svg", type: "image/svg+xml" }], apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }] },
    keywords: [
      `Kitchen Set ${city}`,
      `Kitchen Set Custom ${city}`,
      `Furniture Custom ${city}`,
      `Kitchen Set HPL ${city}`,
      `Kitchen Set Cat Duco ${city}`,
      `Custom Furniture ${city}`,
    ],
    openGraph: { type: "website", locale: "id_ID", siteName: s.business_name, title, url: "/" },
    twitter: { card: "summary_large_image", title },
    alternates: { canonical: "/" },
    robots: { index: true, follow: true },
    formatDetection: { telephone: false },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FDFBF7" },
    { media: "(prefers-color-scheme: dark)", color: "#121212" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <ToastProvider>{children}</ToastProvider>
        <Analytics gaId={publicEnv.gaId} />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
