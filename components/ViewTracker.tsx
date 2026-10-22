"use client";
import { useEffect } from "react";
import { trackEvent } from "@/lib/analytics";

/** Catat product view (GA4 + counter di database untuk "Produk Terpopuler"). */
export function ViewTracker({ productId, productName }: { productId: string; productName: string }) {
  useEffect(() => {
    trackEvent("product_view", { product: productName });
    const key = `viewed:${productId}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {}
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, type: "view" }),
      keepalive: true,
    }).catch(() => {});
  }, [productId, productName]);
  return null;
}

export function trackInquiry(productId: string, productName: string) {
  trackEvent("product_inquiry", { product: productName });
  fetch("/api/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ productId, type: "inquiry" }),
    keepalive: true,
  }).catch(() => {});
}
