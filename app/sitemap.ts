import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/siteMetadata";
import { fetchActiveRestaurantHandles } from "@/lib/server/restaurantMetadata";
import { VERTICALES } from "@/lib/marketing/verticals";

// Marketing surfaces + every active restaurant's public menu page (the
// Owner.com play: each vendor page is a local-search result). Restaurant
// listing failures degrade gracefully to the static entries.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: "weekly", priority: 1 },
    {
      // Robo #9: el directorio público — la base instalada como adquisición.
      url: `${SITE_URL}/restaurantes`,
      changeFrequency: "daily",
      priority: 0.9,
    },
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
    // Cluster por VERTICAL (el play de Maspedidos que nos faltaba): el hub más
    // una página por tipo de negocio. Se generan solas desde lib/marketing/verticals.ts,
    // así que agregar una vertical nueva NO requiere tocar este archivo.
    {
      url: `${SITE_URL}/software-para-restaurantes`,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    { url: `${SITE_URL}/hardware`, changeFrequency: "monthly", priority: 0.6 },
  ];

  const verticalEntries: MetadataRoute.Sitemap = VERTICALES.map((v) => ({
    url: `${SITE_URL}/software-para-restaurantes/${v.slug}`,
    changeFrequency: "weekly" as const,
    priority: 0.9,
  }));

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

  return [...staticEntries, ...verticalEntries, ...menuEntries, ...landingEntries];
}
