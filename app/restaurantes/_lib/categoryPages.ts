// Datos de /restaurantes/{ciudad}/{categoria} (8-oct-2026, robo #10 a Owner).
//
// Sale del MISMO origen que el directorio (fetchDirectoryRestaurants: locales
// con isSetupComplete) y además exige lo que el sitemap exige: status
// "active", que no sea un local de prueba (isSitemapExcluded) y que tenga un
// menú real (al menos un platillo disponible con precio). Una página solo
// existe si quedan 2 o más locales: sin páginas flacas.
//
// Cache: las mismas URLs de Firestore REST que /r y /menu (Next dedupe y
// revalida); la página revalida cada hora, igual que el directorio.

import {
  fetchDirectoryRestaurants,
  type DirectoryRestaurant,
} from "@/lib/server/restaurantDirectory";
import {
  fetchRestaurantDocFull,
  fetchRestaurantMenuFull,
} from "@/lib/server/restaurantLanding";
import { isSitemapExcluded } from "@/lib/server/sitemapExclusions";
import {
  MIN_RESTAURANTS_PER_CATEGORY_PAGE,
  groupByCityAndCategory,
  type CategoryCityGroup,
} from "@/lib/landingContent";

export type CategoryPageRestaurant = DirectoryRestaurant & {
  /** Cuántos platillos con precio tiene su menú (dato real, para la tarjeta). */
  menuItemCount: number;
};

async function verify(r: DirectoryRestaurant): Promise<CategoryPageRestaurant | null> {
  const [doc, menu] = await Promise.all([
    fetchRestaurantDocFull(r.id),
    fetchRestaurantMenuFull(r.id),
  ]);
  if (doc.status !== "ok" || doc.data.status !== "active") return null;
  const priced = menu.filter((i) => i.price > 0).length;
  if (priced === 0) return null;
  return { ...r, menuItemCount: priced };
}

/** Todas las combinaciones ciudad + categoría con 2 o más locales reales. */
export async function fetchCategoryCityPages(): Promise<CategoryCityGroup<CategoryPageRestaurant>[]> {
  const all = await fetchDirectoryRestaurants();
  const visible = all.filter(
    (r) => !isSitemapExcluded(r.id, r.handle === r.id ? null : r.handle, r.name),
  );
  // Solo verificamos (2 lecturas por local) a los que podrían caer en una
  // página: los que comparten ciudad + categoría con al menos otro.
  const candidates = new Map<string, DirectoryRestaurant>();
  for (const g of groupByCityAndCategory(visible)) {
    if (g.restaurants.length < MIN_RESTAURANTS_PER_CATEGORY_PAGE) continue;
    for (const r of g.restaurants) candidates.set(r.id, r);
  }
  const verified = (await Promise.all(Array.from(candidates.values()).map(verify))).filter(
    (r): r is CategoryPageRestaurant => r !== null,
  );
  return groupByCityAndCategory(verified)
    .filter((g) => g.restaurants.length >= MIN_RESTAURANTS_PER_CATEGORY_PAGE)
    .sort((a, b) =>
      a.city === b.city ? a.category.localeCompare(b.category, "es") : a.city.localeCompare(b.city, "es"),
    );
}

export async function fetchCategoryCityPage(
  citySlug: string,
  categorySlug: string,
): Promise<CategoryCityGroup<CategoryPageRestaurant> | null> {
  const pages = await fetchCategoryCityPages();
  return pages.find((p) => p.citySlug === citySlug && p.categorySlug === categorySlug) ?? null;
}
