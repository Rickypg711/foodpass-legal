import type { Metadata } from "next";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/siteMetadata";
import { fetchRestaurantMetadata } from "@/lib/server/restaurantMetadata";
import { fetchRestaurantDocFull, fetchRestaurantMenuFull } from "@/lib/server/restaurantLanding";
import { buildRestaurantJsonLd } from "@/lib/server/restaurantJsonLd";
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
  // Sin premios prendidos la vista previa no promete puntos (cazado 8-oct:
  // Omu y El Manantial decían "junta puntos" con los premios apagados).
  const points = restaurant.loyaltyLive ? " y junta puntos con cada compra" : "";
  const description = restaurant.description
    ? `${restaurant.description} Mira el menú de ${restaurant.name}, pide por WhatsApp${points}.`
    : `Mira el menú de ${restaurant.name} con fotos y precios, pide por WhatsApp${points}.`;
  const image = restaurant.bannerUrl ?? restaurant.logoUrl;
  // Su logo en la pestaña (y en checkout y la página del pedido, que cuelgan de este layout).
  const icon = restaurant.faviconUrl;

  return {
    title,
    description,
    alternates: { canonical: `/menu/${restaurantId}` },
    ...(icon ? { icons: { icon: [{ url: icon }], apple: [{ url: icon }] } } : {}),
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
  // Menú completo para el schema (misma URL REST que usa page.tsx → Next
  // dedupe, cero viajes extra a Firestore dentro del request).
  const menuItems = restaurant ? await fetchRestaurantMenuFull(restaurantId) : [];

  // Restaurant JSON-LD: el MISMO que /r (lib/server/restaurantJsonLd.ts) —
  // horario, teléfono, ciudad/región/país del doc y menú con precios. Antes
  // aquí decía "Chihuahua, MX" a fuerza para todos (8-oct-2026).
  const doc = restaurant ? await fetchRestaurantDocFull(restaurantId) : null;
  const jsonLd =
    restaurant && doc?.status === "ok"
      ? buildRestaurantJsonLd({
          data: doc.data,
          name: restaurant.name,
          url: `${SITE_URL}/menu/${restaurantId}`,
          menuUrl: `${SITE_URL}/menu/${restaurantId}`,
          menu: menuItems,
        })
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
