import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/siteMetadata";
import { fetchActiveRestaurantHandles } from "@/lib/server/restaurantMetadata";

// Marketing surfaces + every active restaurant's public menu page (the
// Owner.com play: each vendor page is a local-search result). Restaurant
// listing failures degrade gracefully to the static entries.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: "weekly", priority: 1 },
    {
      url: `${SITE_URL}/lealtad-restaurantes-chihuahua`,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/menu-qr-gratis-restaurantes`,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/pedidos-whatsapp-restaurantes`,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/clientes-que-regresan`,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/punto-de-venta-gratis-restaurantes`,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/pedidos-en-linea-restaurantes`,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/como-vender-mas-en-mi-restaurante`,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/inteligencia-artificial-para-restaurantes`,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/tarjeta-de-lealtad-digital`,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/programa-de-lealtad-para-restaurantes`,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    { url: `${SITE_URL}/precios`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/descargar`, changeFrequency: "monthly", priority: 0.5 },
  ];

  const restaurants = await fetchActiveRestaurantHandles();
  const menuEntries: MetadataRoute.Sitemap = restaurants.map((r) => ({
    url: `${SITE_URL}/menu/${r.id}`,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));
  // La página del restaurante — la "home" del negocio para búsquedas locales.
  // Canónico: el slug bonito cuando existe (/r/luzz-pizza), si no el id.
  const landingEntries: MetadataRoute.Sitemap = restaurants.map((r) => ({
    url: `${SITE_URL}/r/${r.slug ?? r.id}`,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  return [...staticEntries, ...menuEntries, ...landingEntries];
}
