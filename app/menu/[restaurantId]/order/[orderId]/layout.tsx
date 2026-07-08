import type { Metadata } from "next";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/siteMetadata";
import { fetchRestaurantMetadata } from "@/lib/server/restaurantMetadata";

// Per-restaurant link preview: when the customer's WhatsApp receipt message
// is shared, the preview shows the RESTAURANT's name + logo, not generic
// Comeleal. Falls back to generic when the lookup fails.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ restaurantId: string }>;
}): Promise<Metadata> {
  const { restaurantId } = await params;
  const restaurant = await fetchRestaurantMetadata(restaurantId);

  if (!restaurant) {
    return {
      title: "Pedido",
      description: SITE_DESCRIPTION,
      openGraph: { title: `Pedido | ${SITE_NAME}`, description: SITE_DESCRIPTION },
      twitter: { title: `Pedido | ${SITE_NAME}`, description: SITE_DESCRIPTION },
    };
  }

  const title = `Pedido en ${restaurant.name}`;
  const description = `Tu recibo, PIN de recogida y puntos en ${restaurant.name}.`;
  const image = restaurant.logoUrl ?? restaurant.bannerUrl;

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

export default function OrderLayout({ children }: { children: React.ReactNode }) {
  return children;
}
