// lib/server/restaurantMetadata.ts
//
// Server-side restaurant lookup for per-restaurant Open Graph metadata
// (WhatsApp/social link previews show the RESTAURANT's name + logo instead of
// generic Comeleal). Uses the Firestore REST API — restaurant docs are
// public-read (`allow read: if true`), so the public web API key suffices.
// Cached for an hour per restaurant; failures fall back to generic metadata.

import { getRestaurantBannerUrl, getRestaurantImageUrl } from "@/lib/restaurantImage";

const PROJECT_ID = "foodpass-18b33";
const API_KEY = "AIzaSyB6JpeqOiPEFyELSHl9p64v2XPXk6uN9Xk"; // public web config (same as lib/firebase.ts)

export type RestaurantMetadata = {
  name: string;
  logoUrl: string | null;
  bannerUrl: string | null;
};

/** Flattens Firestore REST `fields` (stringValue only — all we need). */
function flattenStringFields(
  fields: Record<string, { stringValue?: string }> | undefined,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!fields) return out;
  for (const [k, v] of Object.entries(fields)) {
    if (v && typeof v.stringValue === "string") out[k] = v.stringValue;
  }
  return out;
}

export async function fetchRestaurantMetadata(
  restaurantId: string,
): Promise<RestaurantMetadata | null> {
  const id = restaurantId.trim();
  if (!id) return null;
  try {
    const url =
      `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}` +
      `/databases/(default)/documents/restaurants/${encodeURIComponent(id)}?key=${API_KEY}`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      fields?: Record<string, { stringValue?: string }>;
    };
    const data = flattenStringFields(json.fields);
    const name = typeof data.name === "string" ? (data.name as string).trim() : "";
    if (!name) return null;
    return {
      name,
      logoUrl: getRestaurantImageUrl(data),
      bannerUrl: getRestaurantBannerUrl(data),
    };
  } catch {
    return null;
  }
}
