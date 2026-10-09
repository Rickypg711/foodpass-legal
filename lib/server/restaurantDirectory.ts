// Robo #9 a Biomenus (versión honesta): su "Bioniverse" convierte la base
// instalada en un activo de adquisición pública. Esto es el directorio —
// /restaurantes — con los locales ACTIVOS. El MAPA vendrá cuando existan las
// direcciones reales y Places API (pendiente de Ricardo en PENDIENTES.md):
// un mapa con pines en Null Island es peor que no tener mapa.

import { decodeFields } from "@/lib/server/restaurantLanding";
import { cityForRestaurant, seoCategories } from "@/lib/landingContent";
import { getRestaurantBannerUrl, getRestaurantImageUrl } from "@/lib/restaurantImage";
import { isRestaurantVisibleToDiners } from "@/lib/readiness/evaluate";

const PROJECT_ID = "foodpass-18b33";
const API_KEY = "AIzaSyB6JpeqOiPEFyELSHl9p64v2XPXk6uN9Xk"; // public web config

export type DirectoryRestaurant = {
  id: string;
  /** Handle canónico público: slug bonito si existe, si no el id. */
  handle: string;
  name: string;
  description: string | null;
  categories: string[];
  address: string | null;
  /** Ciudad estructurada (Google, con el pin) o heurística; null si no se sabe. */
  city: string | null;
  imageUrl: string | null;
};

/**
 * Locales listos para el aparador público. El query trae los completos; la
 * regla de diners (9-oct, espejo de la app) quita pruebas, borrados y locales
 * sin vida (ni nuevos ni con pedido en 30 días).
 */
export async function fetchDirectoryRestaurants(
  max = 150,
): Promise<DirectoryRestaurant[]> {
  try {
    const res = await fetch(
      `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}` +
        `/databases/(default)/documents:runQuery?key=${API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          structuredQuery: {
            from: [{ collectionId: "restaurants" }],
            where: {
              fieldFilter: {
                field: { fieldPath: "isSetupComplete" },
                op: "EQUAL",
                value: { booleanValue: true },
              },
            },
            limit: max,
          },
        }),
        next: { revalidate: 3600 },
      },
    );
    if (!res.ok) return [];
    const rows = (await res.json()) as {
      document?: { name?: string; fields?: Record<string, Record<string, unknown>> };
    }[];
    const out: DirectoryRestaurant[] = [];
    for (const r of rows) {
      const id = r.document?.name?.split("/").pop();
      if (!id) continue;
      const data = decodeFields(r.document?.fields);
      if (!isRestaurantVisibleToDiners(data)) continue;
      const name = typeof data.name === "string" && data.name.trim() ? data.name.trim() : null;
      if (!name) continue;
      const rawSlug =
        typeof data.slug === "string" ? data.slug.trim().toLowerCase() : "";
      const slug = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(rawSlug) ? rawSlug : null;
      out.push({
        id,
        handle: slug ?? id,
        name,
        description:
          typeof data.description === "string" && data.description.trim()
            ? data.description.trim()
            : null,
        categories: seoCategories(
          Array.isArray(data.categories)
            ? (data.categories as unknown[]).map((c) => (typeof c === "string" ? c.trim() : ""))
            : [],
        ),
        address:
          typeof data.address === "string" && data.address.trim()
            ? data.address.trim()
            : null,
        city: cityForRestaurant(data),
        imageUrl: getRestaurantBannerUrl(data) ?? getRestaurantImageUrl(data),
      });
    }
    out.sort((a, b) => a.name.localeCompare(b.name, "es"));
    return out;
  } catch {
    return [];
  }
}
