import type { Metadata } from "next";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/siteMetadata";
import { fetchRestaurantMetadata } from "@/lib/server/restaurantMetadata";
import MenuRestaurantLayoutClient from "./MenuRestaurantLayoutClient";

// Per-restaurant link preview for the MENU link itself — the URL behind every
// table QR and every share. Shows the restaurant's name + logo instead of
// generic Comeleal; falls back to generic when the lookup fails.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ restaurantId: string }>;
}): Promise<Metadata> {
  const { restaurantId } = await params;
  const restaurant = await fetchRestaurantMetadata(restaurantId);

  if (!restaurant) {
    return {
      title: "Menú",
      description: SITE_DESCRIPTION,
      openGraph: { title: `Menú | ${SITE_NAME}`, description: SITE_DESCRIPTION },
      twitter: { title: `Menú | ${SITE_NAME}`, description: SITE_DESCRIPTION },
    };
  }

  // SEO: the restaurant's own local search result ("{nombre} menú"), not a
  // generic Comeleal page — every vendor page is a Google/AI-citable surface.
  const title = `${restaurant.name} — Menú, precios y pedidos por WhatsApp`;
  const description = restaurant.description
    ? `${restaurant.description} Mira el menú de ${restaurant.name}, pide por WhatsApp y junta puntos con cada compra.`
    : `Mira el menú de ${restaurant.name} con fotos y precios, pide por WhatsApp y junta puntos con cada compra.`;
  const image = restaurant.bannerUrl ?? restaurant.logoUrl;

  return {
    title,
    description,
    alternates: { canonical: `/menu/${restaurantId}` },
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

export default async function MenuRestaurantLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ restaurantId: string }>;
}) {
  const { restaurantId } = await params;
  const restaurant = await fetchRestaurantMetadata(restaurantId);

  // Restaurant JSON-LD so Google and AI engines understand WHO this page is:
  // a real local restaurant with a menu and WhatsApp ordering.
  const jsonLd = restaurant
    ? {
        "@context": "https://schema.org",
        "@type": "Restaurant",
        name: restaurant.name,
        url: `${SITE_URL}/menu/${restaurantId}`,
        ...(restaurant.logoUrl ? { image: restaurant.logoUrl } : {}),
        ...(restaurant.description ? { description: restaurant.description } : {}),
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
      <MenuRestaurantLayoutClient>{children}</MenuRestaurantLayoutClient>
    </>
  );
}
