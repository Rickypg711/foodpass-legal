import type { Metadata } from "next";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/siteMetadata";
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

  const title = `${restaurant.name} · Menú`;
  const description = `Mira el menú de ${restaurant.name}, ordena en línea y junta puntos con cada compra.`;
  const image = restaurant.bannerUrl ?? restaurant.logoUrl;

  return {
    title,
    description,
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

export default function MenuRestaurantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MenuRestaurantLayoutClient>{children}</MenuRestaurantLayoutClient>;
}
