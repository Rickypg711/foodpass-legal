import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/siteMetadata";

// robots.txt — hasta el 24-ago-2026 esta ruta NO existía: /robots.txt caía en
// el catch-all y respondía un 404 con `noindex`. Un crawler educado que pide
// robots antes de indexar se topaba con basura, y el sitemap (que ya lista
// todos los /r/{slug}) no tenía pointer. Esto lo arregla.
//
// /vendor y /api no se indexan: panel privado y endpoints. Todo lo público
// (/r, /menu, /precios, las landings SEO) queda abierto — incluidos los
// crawlers de IA (GPTBot, PerplexityBot…), que son EXACTAMENTE a quienes el
// SSR de /r y /menu les sirve el menú completo sin JS.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/vendor", "/api/"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
