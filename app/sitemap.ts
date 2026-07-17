import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/siteMetadata";

// Static sitemap: public marketing surfaces only (menus are per-restaurant and
// discovered via links; vendor/app routes are private).
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/`, changeFrequency: "weekly", priority: 1 },
    {
      url: `${SITE_URL}/lealtad-restaurantes-chihuahua`,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    { url: `${SITE_URL}/descargar`, changeFrequency: "monthly", priority: 0.5 },
  ];
}
