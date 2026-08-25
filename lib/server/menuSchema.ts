import type { LandingMenuItem } from "@/lib/server/restaurantLanding";

/**
 * JSON-LD `Menu` completo — el formato que los motores de IA citan directo
 * ("¿cuánto cuesta la pizza en X?"). Secciones por categoría, precios MXN.
 *
 * Compartido entre /r/{handle} (layout) y /menu/{id} (layout): las DOS
 * superficies públicas del restaurante llevan el mismo menú estructurado.
 * Sin items → cae a la URL del menú (un string también es `hasMenu` válido).
 */
export function buildMenuJsonLd(
  menuUrl: string,
  items: LandingMenuItem[],
): string | Record<string, unknown> {
  if (items.length === 0) return menuUrl;
  const byCategory = new Map<string, LandingMenuItem[]>();
  for (const item of items) {
    const list = byCategory.get(item.category);
    if (list) list.push(item);
    else byCategory.set(item.category, [item]);
  }
  return {
    "@type": "Menu",
    url: menuUrl,
    hasMenuSection: Array.from(byCategory.entries()).map(
      ([category, sectionItems]) => ({
        "@type": "MenuSection",
        name: category,
        hasMenuItem: sectionItems.map((item) => ({
          "@type": "MenuItem",
          name: item.name,
          ...(item.description ? { description: item.description } : {}),
          ...(item.imageUrl ? { image: item.imageUrl } : {}),
          offers: {
            "@type": "Offer",
            price: item.price,
            priceCurrency: "MXN",
          },
        })),
      }),
    ),
  };
}
