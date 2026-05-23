import type { Metadata } from "next";

/** Customer-facing product name (tabs, OG, social). */
export const SITE_NAME = "Comeleal";

export const SITE_DESCRIPTION =
  "Descubre restaurantes locales, gana recompensas y vuelve fácil a tus lugares favoritos con Comeleal.";

/** Homepage title (full string for tab / OG on `/`). */
export const HOME_PAGE_TITLE = "Comeleal | Restaurantes locales y recompensas";

/** Canonical public origin for absolute Open Graph URLs (www.comeleal.com). */
export const SITE_URL = "https://www.comeleal.com";

export const siteIcons: Metadata["icons"] = {
  icon: [{ url: "/favicon.ico", sizes: "any" }],
  apple: "/comeleal-app-icon.png",
};

export const rootMetadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  openGraph: {
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    siteName: SITE_NAME,
    locale: "es_MX",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
  },
  icons: siteIcons,
};
