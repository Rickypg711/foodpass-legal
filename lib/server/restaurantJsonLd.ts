import type { LandingMenuItem } from "./restaurantLanding.ts";
import { buildMenuJsonLd } from "./menuSchema.ts";
import { getRestaurantBannerUrl, getRestaurantImageUrl } from "../restaurantImage.ts";
import { weeklyHoursRaw } from "../schedule.ts";
import { cityForRestaurant, seoCategories } from "../landingContent.ts";

// JSON-LD Restaurant de UNA sola fuente para /r y /menu (8-oct-2026).
// Antes /menu armaba el suyo a mano con addressRegion "Chihuahua" y país "MX"
// fijos: Mexican Fresh Water (Carolina del Sur) le decía a Google que estaba
// en Chihuahua, y /menu no mandaba horario ni teléfono. Ahora las dos páginas
// leen lo mismo del doc del local y jamás se contradicen.

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/** "MX$45–MX$180" para MXN, "$5–$15" para USD, "COP 9000–COP 30000" para el resto. */
export function priceRangeFor(prices: readonly number[], currencyCode: unknown): string | null {
  const ps = prices.filter((p) => Number.isFinite(p) && p > 0);
  if (ps.length === 0) return null;
  const cc = typeof currencyCode === "string" && currencyCode.trim() ? currencyCode.trim().toUpperCase() : "MXN";
  const sym = cc === "MXN" ? "MX$" : cc === "USD" ? "$" : `${cc} `;
  return `${sym}${Math.min(...ps)}–${sym}${Math.max(...ps)}`;
}

export function buildRestaurantJsonLd(args: {
  data: Record<string, unknown>;
  name: string;
  url: string;
  menuUrl: string;
  menu: LandingMenuItem[];
}): Record<string, unknown> {
  const { data, name, url, menuUrl, menu } = args;
  const address = str(data.address);
  const phone = str(data.phone);
  const description = str(data.description);
  const images = [getRestaurantBannerUrl(data), getRestaurantImageUrl(data)].filter(Boolean) as string[];
  const categories = seoCategories(
    Array.isArray(data.categories)
      ? (data.categories as unknown[]).map((c) => (typeof c === "string" ? c.trim() : ""))
      : [],
  );
  const city = cityForRestaurant(data);
  const region = str(data.state);
  const country = str(data.countryCode);
  const hours = weeklyHoursRaw(data);
  const priceRange = priceRangeFor(menu.map((i) => i.price), data.currencyCode);

  return {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    name,
    url,
    ...(images.length > 0 ? { image: images } : {}),
    ...(description ? { description } : {}),
    ...(phone ? { telephone: phone } : {}),
    ...(address
      ? {
          address: {
            "@type": "PostalAddress",
            streetAddress: address,
            // Región y país salen del doc (hay locales en Oaxaca, Colombia, RD
            // y Carolina del Sur): jamás "Chihuahua" a fuerza. Sin dato, se omite.
            ...(city ? { addressLocality: city } : {}),
            ...(region ? { addressRegion: region } : {}),
            ...(country ? { addressCountry: country } : {}),
          },
        }
      : {}),
    ...(categories.length > 0 ? { servesCuisine: categories } : {}),
    ...(hours && hours.length > 0
      ? {
          openingHoursSpecification: hours.map((h) => ({
            "@type": "OpeningHoursSpecification",
            dayOfWeek: h.day,
            opens: h.opens,
            closes: h.closes,
          })),
        }
      : {}),
    ...(priceRange ? { priceRange } : {}),
    hasMenu: buildMenuJsonLd(menuUrl, menu),
    acceptsReservations: false,
  };
}
