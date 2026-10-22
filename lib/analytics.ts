"use client";

export type AnalyticsEvent =
  | "product_view"
  | "calculator_started"
  | "calculator_completed"
  | "whatsapp_click"
  | "email_click"
  | "survey_request"
  | "product_inquiry";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

/** Kirim event ke Google Analytics 4 (jika NEXT_PUBLIC_GA_MEASUREMENT_ID diisi). */
export function trackEvent(event: AnalyticsEvent, params: Record<string, string | number | undefined> = {}) {
  if (typeof window === "undefined") return;
  window.gtag?.("event", event, params);
}
