import "server-only";
import { getManualReviews, getSettings } from "@/services/data";
import type { DisplayReview, ReviewSummary } from "@/types";

/**
 * Google Reviews via Google Places API (New) — Place Details.
 * Docs: https://developers.google.com/maps/documentation/places/web-service/place-details
 *
 * Butuh:
 *   GOOGLE_PLACES_API_KEY (atau GOOGLE_MAPS_API_KEY) — server only
 *   Place ID — dari Admin → Pengaturan (google_place_id) atau env GOOGLE_PLACE_ID
 *
 * Google hanya mengembalikan maksimal 5 review "paling relevan" per request.
 * Jika API tidak aktif / gagal, TIDAK membuat review palsu: memakai review manual
 * dari Admin dan diberi label "bukan data live".
 */
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

export async function fetchGooglePlace(placeId: string, apiKey: string): Promise<PlacesResponse | null> {
  try {
    const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=id`, {
      headers: {
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "rating,userRatingCount,googleMapsUri,reviews",
      },
      // Cache 1 jam — hemat kuota API dan tetap "live".
      next: { revalidate: 3600, tags: ["google-reviews"] },
    });
    if (!res.ok) {
      console.error("[google-reviews] Places API error", res.status, await res.text());
      return null;
    }
    return (await res.json()) as PlacesResponse;
  } catch (e) {
    console.error("[google-reviews]", e);
    return null;
  }
}

export async function getReviewSummary(): Promise<ReviewSummary> {
  const settings = await getSettings();
  const mapsUrl = settings.google_maps_url || "https://maps.google.com";
  const apiKey = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
  const placeId = settings.google_place_id || process.env.GOOGLE_PLACE_ID;

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
      }));
      return {
        source: "google",
        rating: place.rating ?? 0,
        totalReviews: place.userRatingCount ?? reviews.length,
        reviews,
        mapsUrl: settings.google_maps_url || place.googleMapsUri || mapsUrl,
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
  };
}
