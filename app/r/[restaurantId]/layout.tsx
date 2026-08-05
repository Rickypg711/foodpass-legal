import type { Metadata } from "next";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/siteMetadata";
import { fetchRestaurantMetadata } from "@/lib/server/restaurantMetadata";

// /r/{id} — la PÁGINA del restaurante (mini-sitio público): hero, horario,
// ubicación, WhatsApp y el menú a un tap. Es el link para la bio de
// Instagram / perfil de Google Maps; el QR de mesa sigue apuntando directo
// a /menu/{id} (ahí el comensal quiere el menú YA, sin landing enfrente).
export async function generateMetadata({
  params,
}: {
  params: Promise<{ restaurantId: string }>;
}): Promise<Metadata> {
  const { restaurantId } = await params;
  const restaurant = await fetchRestaurantMetadata(restaurantId);

  if (!restaurant) {
    return {
      title: "Restaurante",
      description: SITE_DESCRIPTION,
      openGraph: { title: `Restaurante | ${SITE_NAME}`, description: SITE_DESCRIPTION },
      twitter: { title: `Restaurante | ${SITE_NAME}`, description: SITE_DESCRIPTION },
    };
  }

  // SEO local: la búsqueda "{nombre} chihuahua" / "{nombre} horario" debe
  // caer aquí — la página del negocio, no un resultado genérico de Comeleal.
  const title = `${restaurant.name} — Menú, horario y ubicación`;
  const description = restaurant.description
    ? `${restaurant.description} Mira el menú de ${restaurant.name}, checa el horario, pide por WhatsApp y junta puntos con cada compra.`
    : `Mira el menú de ${restaurant.name} con fotos y precios, checa el horario y la ubicación, y pide por WhatsApp.`;
  const image = restaurant.bannerUrl ?? restaurant.logoUrl;

  return {
    title,
    description,
    alternates: { canonical: `/r/${restaurantId}` },
    openGraph: {
      title: `${title} | ${SITE_NAME}`,
      description,
      ...(image ? { images: [{ url: image }] } : {}),
    },
    twitter: {
      title: `${title} | ${SITE_NAME}`,
      description,
      ...(image ? { images: [image] } : {}),
    },
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
  const restaurant = await fetchRestaurantMetadata(restaurantId);

  // JSON-LD Restaurant — mismo shape que /menu/{id} pero con url canónica /r/
  // y teléfono; Google entiende que ESTA es la home del negocio.
  const jsonLd = restaurant
    ? {
        "@context": "https://schema.org",
        "@type": "Restaurant",
        name: restaurant.name,
        url: `${SITE_URL}/r/${restaurantId}`,
        ...(restaurant.logoUrl ? { image: restaurant.logoUrl } : {}),
        ...(restaurant.description ? { description: restaurant.description } : {}),
        ...(restaurant.phone ? { telephone: restaurant.phone } : {}),
        ...(restaurant.address
          ? {
              address: {
                "@type": "PostalAddress",
                streetAddress: restaurant.address,
                addressRegion: "Chihuahua",
                addressCountry: "MX",
              },
            }
          : {}),
        ...(restaurant.categories.length > 0
          ? { servesCuisine: restaurant.categories }
          : {}),
        hasMenu: `${SITE_URL}/menu/${restaurantId}`,
        acceptsReservations: false,
      }
    : null;

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
