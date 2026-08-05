import type { Metadata } from "next";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/siteMetadata";
import {
  fetchRestaurantDocFull,
  fetchRestaurantMenuFull,
  type LandingMenuItem,
} from "@/lib/server/restaurantLanding";
import { getRestaurantBannerUrl, getRestaurantImageUrl } from "@/lib/restaurantImage";
import { weeklyHoursRaw } from "@/lib/schedule";

// /r/{id} — la PÁGINA del restaurante (mini-sitio público): hero, horario,
// ubicación, WhatsApp y el menú a un tap. Es el link para la bio de
// Instagram / perfil de Google Maps; el QR de mesa sigue apuntando directo
// a /menu/{id} (ahí el comensal quiere el menú YA, sin landing enfrente).
//
// Metadata + JSON-LD salen del MISMO fetch que usa page.tsx (Next dedupe por
// URL dentro del request — un solo viaje a Firestore por página).

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

async function getRestaurantData(restaurantId: string) {
  const result = await fetchRestaurantDocFull(restaurantId);
  if (result.status !== "ok") return null;
  const data = result.data;
  const name = str(data.name);
  if (!name) return null;
  return { data, name };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ restaurantId: string }>;
}): Promise<Metadata> {
  const { restaurantId } = await params;
  const restaurant = await getRestaurantData(restaurantId);

  if (!restaurant) {
    return {
      title: "Restaurante",
      description: SITE_DESCRIPTION,
      openGraph: { title: `Restaurante | ${SITE_NAME}`, description: SITE_DESCRIPTION },
      twitter: { title: `Restaurante | ${SITE_NAME}`, description: SITE_DESCRIPTION },
    };
  }

  const { data, name } = restaurant;
  const description = str(data.description);

  // SEO local: la búsqueda "{nombre} chihuahua" / "{nombre} horario" debe
  // caer aquí — la página del negocio, no un resultado genérico de Comeleal.
  const title = `${name} — Menú, horario y ubicación`;
  const metaDescription = description
    ? `${description} Mira el menú de ${name}, checa el horario, pide por WhatsApp y junta puntos con cada compra.`
    : `Mira el menú de ${name} con fotos y precios, checa el horario y la ubicación, y pide por WhatsApp.`;
  const image = getRestaurantBannerUrl(data) ?? getRestaurantImageUrl(data);

  return {
    title,
    description: metaDescription,
    alternates: { canonical: `/r/${restaurantId}` },
    openGraph: {
      title: `${title} | ${SITE_NAME}`,
      description: metaDescription,
      ...(image ? { images: [{ url: image }] } : {}),
    },
    twitter: {
      title: `${title} | ${SITE_NAME}`,
      description: metaDescription,
      ...(image ? { images: [image] } : {}),
    },
  };
}

/** JSON-LD Menu completo — el formato que los motores de IA citan directo
 *  ("¿cuánto cuesta la pizza en X?"). Secciones por categoría, precios MXN. */
function buildMenuJsonLd(restaurantId: string, items: LandingMenuItem[]) {
  if (items.length === 0) return `${SITE_URL}/menu/${restaurantId}`;
  const byCategory = new Map<string, LandingMenuItem[]>();
  for (const item of items) {
    const list = byCategory.get(item.category);
    if (list) list.push(item);
    else byCategory.set(item.category, [item]);
  }
  return {
    "@type": "Menu",
    url: `${SITE_URL}/menu/${restaurantId}`,
    hasMenuSection: Array.from(byCategory.entries()).map(([category, sectionItems]) => ({
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
    })),
  };
}

export default async function RestaurantLandingLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ restaurantId: string }>;
}) {
  const { restaurantId } = await params;
  const restaurant = await getRestaurantData(restaurantId);
  const menu = restaurant ? await fetchRestaurantMenuFull(restaurantId) : [];

  // JSON-LD Restaurant completo: horario estructurado, teléfono, menú con
  // precios, rango de precios — Google puede pintar "abierto ahora" y los
  // motores de IA responden con datos DEL negocio citando esta página.
  let jsonLd: Record<string, unknown> | null = null;
  if (restaurant) {
    const { data, name } = restaurant;
    const address = str(data.address);
    const phone = str(data.phone);
    const description = str(data.description);
    const logoUrl = getRestaurantImageUrl(data);
    const bannerUrl = getRestaurantBannerUrl(data);
    const categories = Array.isArray(data.categories)
      ? (data.categories as unknown[])
          .map((c) => (typeof c === "string" ? c.trim() : ""))
          .filter(Boolean)
      : [];
    const hours = weeklyHoursRaw(data);
    const prices = menu.map((i) => i.price).filter((p) => p > 0);
    const images = [bannerUrl, logoUrl].filter(Boolean) as string[];

    jsonLd = {
      "@context": "https://schema.org",
      "@type": "Restaurant",
      name,
      url: `${SITE_URL}/r/${restaurantId}`,
      ...(images.length > 0 ? { image: images } : {}),
      ...(description ? { description } : {}),
      ...(phone ? { telephone: phone } : {}),
      ...(address
        ? {
            address: {
              "@type": "PostalAddress",
              streetAddress: address,
              addressRegion: "Chihuahua",
              addressCountry: "MX",
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
      ...(prices.length > 0
        ? {
            priceRange: `MX$${Math.min(...prices)}–MX$${Math.max(...prices)}`,
          }
        : {}),
      hasMenu: buildMenuJsonLd(restaurantId, menu),
      acceptsReservations: false,
    };
  }

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      {children}
    </>
  );
}
