/* Service worker PWA — strategi cache sederhana dan aman.
 * - Halaman: network-first, fallback ke cache lalu /offline (konten admin selalu terbaru saat online).
 * - /_next/static: cache-first (file ber-hash, immutable).
 * - Gambar & font: stale-while-revalidate dengan batas jumlah.
 * - /admin, /api, request RSC, dan domain lain (Supabase, YouTube) tidak pernah di-cache.
 * Naikkan VERSION untuk membuang cache lama.
 */
const VERSION = "v1";
const STATIC_CACHE = `static-${VERSION}`;
const PAGE_CACHE = `pages-${VERSION}`;
const ASSET_CACHE = `assets-${VERSION}`;
const OFFLINE_URL = "/offline";
const PRECACHE = [OFFLINE_URL, "/icons/icon-192.png", "/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  const keep = [STATIC_CACHE, PAGE_CACHE, ASSET_CACHE];
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !keep.includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

async function networkFirstPage(request) {
  try {
    const response = await fetch(request);
    if (response.ok && response.type === "basic") {
      const cache = await caches.open(PAGE_CACHE);
      cache.put(request, response.clone()).then(() => trim(PAGE_CACHE, 30));
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || (await caches.match(OFFLINE_URL)) || Response.error();
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) (await caches.open(STATIC_CACHE)).put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(ASSET_CACHE);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone()).then(() => trim(ASSET_CACHE, 120));
      return response;
    })
    .catch(() => cached);
  return cached || network;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/admin") || url.pathname.startsWith("/api") || url.pathname === "/sw.js") return;
  // Request data React Server Components saat navigasi client — biarkan Next.js menanganinya.
  if (request.headers.get("RSC") || url.searchParams.has("_rsc")) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirstPage(request));
    return;
  }
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request));
    return;
  }
  if (
    url.pathname.startsWith("/_next/image") ||
    url.pathname.startsWith("/placeholders/") ||
    url.pathname.startsWith("/icons/") ||
    /\.(?:png|jpe?g|webp|avif|gif|svg|woff2?)$/.test(url.pathname)
  ) {
    event.respondWith(staleWhileRevalidate(request));
  }
});
