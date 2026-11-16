import "server-only";
import { unstable_cache } from "next/cache";
import { getManualReviews, getSettings } from "@/services/data";
import type { DisplayReview, ReviewSummary } from "@/types";

/**
 * Google Reviews via Google Places API (New) — Place Details.
 * Docs: https://developers.google.com/maps/documentation/places/web-service/place-details
 *
 * Butuh:
 *   GOOGLE_PLACES_API_KEY (atau GOOGLE_MAPS_API_KEY) — server only
 *   Place ID — dari Admin → Pengaturan (google_place_id) atau env GOOGLE_PLACE_ID.
 *   Jika kosong, Place ID dicari otomatis dari "Link Google Maps" (Text Search IDs only, gratis)
 *   dan disimpan di cache 30 hari.
 *
 * Google hanya mengembalikan maksimal 5 review "paling relevan" per request.
 * Data diperbarui otomatis tiap 1 jam (cache tag "google-reviews"), atau langsung
 * lewat tombol "Refresh sekarang" di Admin → Pengaturan.
 * Jika API tidak aktif / gagal, TIDAK membuat review palsu: memakai review manual
 * dari Admin dan diberi label "bukan data live".
 */
export const GOOGLE_REVIEWS_TAG = "google-reviews";

interface PlacesReview {
  name?: string;
  rating?: number;
  relativePublishTimeDescription?: string;
  publishTime?: string;
  text?: { text?: string };
  originalText?: { text?: string };
  authorAttribution?: { displayName?: string; photoUri?: string; uri?: string };
}

interface PlacesResponse {
  rating?: number;
  userRatingCount?: number;
  googleMapsUri?: string;
  reviews?: PlacesReview[];
}

type FetchResult = { ok: true; place: PlacesResponse } | { ok: false; error: string };

export const googleApiKey = () => process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY || "";

export async function fetchGooglePlaceResult(placeId: string, apiKey: string): Promise<FetchResult> {
  try {
    const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=id`, {
      headers: {
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "rating,userRatingCount,googleMapsUri,reviews",
      },
      // Cache 1 jam — hemat kuota API dan tetap "live".
      next: { revalidate: 3600, tags: [GOOGLE_REVIEWS_TAG] },
    });
    if (!res.ok) {
      const body = await res.text();
      console.error("[google-reviews] Places API error", res.status, body);
      let msg = `HTTP ${res.status}`;
      try {
        msg = (JSON.parse(body) as { error?: { message?: string } }).error?.message || msg;
      } catch {}
      return { ok: false, error: msg };
    }
    return { ok: true, place: (await res.json()) as PlacesResponse };
  } catch (e) {
    console.error("[google-reviews]", e);
    return { ok: false, error: e instanceof Error ? e.message : "Gagal menghubungi Google" };
  }
}

export async function fetchGooglePlace(placeId: string, apiKey: string): Promise<PlacesResponse | null> {
  const r = await fetchGooglePlaceResult(placeId, apiKey);
  return r.ok ? r.place : null;
}

/** Ambil nama tempat + koordinat dari link Google Maps (termasuk short link maps.app.goo.gl). */
async function parseMapsLink(url: string): Promise<{ name: string; lat?: number; lng?: number } | null> {
  let full = url;
  for (let i = 0; i < 4 && !/\/maps\/place\//.test(full); i++) {
    const res = await fetch(full, { redirect: "manual", cache: "no-store" });
    const loc = res.headers.get("location");
    if (!loc) break;
    full = new URL(loc, full).toString();
  }
  const name = full.match(/\/maps\/place\/([^/@?]+)/)?.[1];
  if (!name) return null;
  const lat = full.match(/!3d(-?\d+(?:\.\d+)?)/)?.[1] ?? full.match(/@(-?\d+\.\d+),/)?.[1];
  const lng = full.match(/!4d(-?\d+(?:\.\d+)?)/)?.[1] ?? full.match(/@-?\d+\.\d+,(-?\d+\.\d+)/)?.[1];
  return { name: decodeURIComponent(name.replace(/\+/g, " ")), lat: lat ? Number(lat) : undefined, lng: lng ? Number(lng) : undefined };
}

/** Cari Place ID dari link Maps (Text Search "IDs only" — tidak dikenai biaya). */
async function lookupPlaceId(mapsUrl: string, apiKey: string): Promise<string | null> {
  try {
    const info = await parseMapsLink(mapsUrl);
    if (!info) return null;
    const body: Record<string, unknown> = { textQuery: info.name, pageSize: 1 };
    if (info.lat !== undefined && info.lng !== undefined)
      body.locationBias = { circle: { center: { latitude: info.lat, longitude: info.lng }, radius: 500 } };
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": "places.id" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    if (!res.ok) {
      console.error("[google-reviews] searchText error", res.status, await res.text());
      return null;
    }
    const json = (await res.json()) as { places?: { id?: string }[] };
    return json.places?.[0]?.id ?? null;
  } catch (e) {
    console.error("[google-reviews] lookupPlaceId", e);
    return null;
  }
}

const cachedPlaceId = unstable_cache(lookupPlaceId, ["google-place-id"], { revalidate: 60 * 60 * 24 * 30, tags: [GOOGLE_REVIEWS_TAG] });

/** Place ID yang dipakai: Admin → env → otomatis dari link Google Maps. */
export async function resolvePlaceId(apiKey: string) {
  const settings = await getSettings();
  const manual = settings.google_place_id || process.env.GOOGLE_PLACE_ID;
  if (manual) return { placeId: manual, auto: false };
  const mapsUrl = settings.google_maps_url || settings.invoice_review_url;
  if (!mapsUrl || !apiKey) return { placeId: null, auto: true };
  return { placeId: await cachedPlaceId(mapsUrl, apiKey), auto: true };
}

const writeReviewUrl = (placeId: string | null, fallback?: string | null) =>
  placeId ? `https://search.google.com/local/writereview?placeid=${encodeURIComponent(placeId)}` : fallback || null;

export async function getReviewSummary(): Promise<ReviewSummary> {
  const settings = await getSettings();
  const mapsUrl = settings.google_maps_url || "https://maps.google.com";
  const apiKey = googleApiKey();
  const { placeId } = apiKey ? await resolvePlaceId(apiKey) : { placeId: settings.google_place_id || process.env.GOOGLE_PLACE_ID || null };

  if (apiKey && placeId) {
    const place = await fetchGooglePlace(placeId, apiKey);
    if (place && (place.reviews?.length || place.rating)) {
      const reviews: DisplayReview[] = (place.reviews ?? []).map((r, i) => ({
        id: r.name ?? `g-${i}`,
        authorName: r.authorAttribution?.displayName ?? "Pengguna Google",
        authorPhoto: r.authorAttribution?.photoUri ?? null,
        rating: r.rating ?? 5,
        text: r.text?.text ?? r.originalText?.text ?? "",
        date: r.publishTime ?? "",
        relativeTime: r.relativePublishTimeDescription,
        url: r.authorAttribution?.uri,
      }));
      return {
        source: "google",
        rating: place.rating ?? 0,
        totalReviews: place.userRatingCount ?? reviews.length,
        reviews,
        mapsUrl: settings.google_maps_url || place.googleMapsUri || mapsUrl,
        writeReviewUrl: writeReviewUrl(placeId, settings.invoice_review_url),
      };
    }
  }

  const manual = await getManualReviews();
  return {
    source: "manual",
    rating: Number(settings.manual_rating ?? 0),
    totalReviews: Number(settings.manual_review_count ?? manual.length),
    reviews: manual.map((r) => ({
      id: r.id,
      authorName: r.author_name,
      authorPhoto: r.author_photo_url,
      rating: r.rating,
      text: r.content,
      date: r.review_date,
    })),
    mapsUrl,
    writeReviewUrl: writeReviewUrl(placeId, settings.invoice_review_url),
  };
}

export interface GoogleReviewStatus {
  hasKey: boolean;
  placeId: string | null;
  autoPlaceId: boolean;
  ok: boolean;
  rating?: number;
  totalReviews?: number;
  reviewCount?: number;
  error?: string;
}

/** Status koneksi untuk Admin → Pengaturan. */
export async function getGoogleReviewStatus(): Promise<GoogleReviewStatus> {
  const apiKey = googleApiKey();
  if (!apiKey) return { hasKey: false, placeId: null, autoPlaceId: false, ok: false };
  const { placeId, auto } = await resolvePlaceId(apiKey);
  if (!placeId)
    return { hasKey: true, placeId: null, autoPlaceId: auto, ok: false, error: "Place ID tidak ditemukan dari Link Google Maps. Isi Place ID secara manual." };
  const r = await fetchGooglePlaceResult(placeId, apiKey);
  if (!r.ok) return { hasKey: true, placeId, autoPlaceId: auto, ok: false, error: r.error };
  return {
    hasKey: true,
    placeId,
    autoPlaceId: auto,
    ok: true,
    rating: r.place.rating,
    totalReviews: r.place.userRatingCount,
    reviewCount: r.place.reviews?.length ?? 0,
  };
}
