import Script from "next/script";

/** Google Analytics 4 — aktif hanya jika NEXT_PUBLIC_GA_MEASUREMENT_ID diisi. */
export function Analytics({ gaId }: { gaId: string }) {
  if (!gaId || !/^G-[A-Z0-9]+$/.test(gaId)) return null;
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`} strategy="afterInteractive" />
      <Script id="ga-init" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;gtag('js',new Date());gtag('config','${gaId}');`}
      </Script>
    </>
  );
}
