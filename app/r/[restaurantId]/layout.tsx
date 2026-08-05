import type { Metadata } from "next";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/siteMetadata";
import {
  fetchRestaurantMenuFull,
  resolveRestaurantHandle,
  type LandingMenuItem,
} from "@/lib/server/restaurantLanding";
import { getRestaurantBannerUrl, getRestaurantImageUrl } from "@/lib/restaurantImage";
import { weeklyHoursRaw, weeklySchedule } from "@/lib/schedule";
import { buildFaq, buildLandingTitle } from "@/lib/landingContent";
import { parseRewardTiers } from "@/lib/loyalty/rewardCatalog";
import { earnPolicyFromRestaurant, earnRuleLine } from "@/lib/loyalty/earnPolicy";

// /r/{id} — la PÁGINA del restaurante (mini-sitio público): hero, horario,
// ubicación, WhatsApp y el menú a un tap. Es el link para la bio de
// Instagram / perfil de Google Maps; el QR de mesa sigue apuntando directo
// a /menu/{id} (ahí el comensal quiere el menú YA, sin landing enfrente).
//
// Metadata + JSON-LD salen del MISMO fetch que usa page.tsx (Next dedupe por
// URL dentro del request — un solo viaje a Firestore por página).

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

async function getRestaurantData(handle: string) {
  // El handle puede ser ID o slug — mismo resolver que page.tsx (fetch
  // deduplicado por URL dentro del request).
  const resolved = await resolveRestaurantHandle(handle);
  if (resolved === "error" || resolved === null) return null;
  const name = str(resolved.data.name);
  if (!name) return null;
  return {
    data: resolved.data,
    name,
    id: resolved.id,
    /** Handle canónico para URLs públicas: slug bonito si existe, si no el id. */
    canonicalHandle: resolved.slug ?? resolved.id,
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ restaurantId: string }>;
}): Promise<Metadata> {
  const { restaurantId } = await params;
  const restaurant = await getRestaurantData(restaurantId);

  if (!restaurant) {
    return {
      title: "Restaurante",
      description: SITE_DESCRIPTION,
      openGraph: { title: `Restaurante | ${SITE_NAME}`, description: SITE_DESCRIPTION },
      twitter: { title: `Restaurante | ${SITE_NAME}`, description: SITE_DESCRIPTION },
    };
  }

  const { data, name } = restaurant;
  const description = str(data.description);
  const metaCategories = Array.isArray(data.categories)
    ? (data.categories as unknown[])
        .map((c) => (typeof c === "string" ? c.trim() : ""))
        .filter(Boolean)
    : [];

  // SEO local estilo Owner: la FRASE DE BÚSQUEDA en el title —
  // "{Nombre} | {Categoría} en {Ciudad} — menú, pedidos y horario".
  const title = buildLandingTitle(name, metaCategories, str(data.address));
  const metaDescription = description
    ? `${description} Mira el menú de ${name}, checa el horario, pide por WhatsApp y junta puntos con cada compra.`
    : `Mira el menú de ${name} con fotos y precios, checa el horario y la ubicación, y pide por WhatsApp.`;
  const image = getRestaurantBannerUrl(data) ?? getRestaurantImageUrl(data);

  return {
    title,
    description: metaDescription,
    alternates: { canonical: `/r/${restaurant.canonicalHandle}` },
    openGraph: {
      title: `${title} | ${SITE_NAME}`,
      description: metaDescription,
      ...(image ? { images: [{ url: image }] } : {}),
    },
    twitter: {
      title: `${title} | ${SITE_NAME}`,
      description: metaDescription,
      ...(image ? { images: [image] } : {}),
    },
  };
}

/** JSON-LD Menu completo — el formato que los motores de IA citan directo
 *  ("¿cuánto cuesta la pizza en X?"). Secciones por categoría, precios MXN. */
function buildMenuJsonLd(restaurantId: string, items: LandingMenuItem[]) {
  if (items.length === 0) return `${SITE_URL}/menu/${restaurantId}`;
  const byCategory = new Map<string, LandingMenuItem[]>();
  for (const item of items) {
    const list = byCategory.get(item.category);
    if (list) list.push(item);
    else byCategory.set(item.category, [item]);
  }
  return {
    "@type": "Menu",
    url: `${SITE_URL}/menu/${restaurantId}`,
    hasMenuSection: Array.from(byCategory.entries()).map(([category, sectionItems]) => ({
      "@type": "MenuSection",
      name: category,
      hasMenuItem: sectionItems.map((item) => ({
        "@type": "MenuItem",
        name: item.name,
        ...(item.description ? { description: item.description } : {}),
        ...(item.imageUrl ? { image: item.imageUrl } : {}),
        offers: {
          "@type": "Offer",
          price: item.price,
          priceCurrency: "MXN",
        },
      })),
    })),
  };
}

export default async function RestaurantLandingLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ restaurantId: string }>;
}) {
  const { restaurantId: handle } = await params;
  const restaurant = await getRestaurantData(handle);
  // /menu SIEMPRE con el ID real (los links internos del menú usan id).
  const menu = restaurant ? await fetchRestaurantMenuFull(restaurant.id) : [];

  // JSON-LD Restaurant completo: horario estructurado, teléfono, menú con
  // precios, rango de precios — Google puede pintar "abierto ahora" y los
  // motores de IA responden con datos DEL negocio citando esta página.
  let jsonLd: Record<string, unknown> | null = null;
  // FAQPage (patrón Owner/metropizza): las mismas preguntas que pinta la
  // página, en schema — comida favorita de Google y los motores de IA.
  let faqJsonLd: Record<string, unknown> | null = null;
  if (restaurant) {
    const { data, name } = restaurant;
    const address = str(data.address);
    const phone = str(data.phone);
    const description = str(data.description);
    const logoUrl = getRestaurantImageUrl(data);
    const bannerUrl = getRestaurantBannerUrl(data);
    const categories = Array.isArray(data.categories)
      ? (data.categories as unknown[])
          .map((c) => (typeof c === "string" ? c.trim() : ""))
          .filter(Boolean)
      : [];
    const hours = weeklyHoursRaw(data);
    const prices = menu.map((i) => i.price).filter((p) => p > 0);
    const images = [bannerUrl, logoUrl].filter(Boolean) as string[];

    jsonLd = {
      "@context": "https://schema.org",
      "@type": "Restaurant",
      name,
      url: `${SITE_URL}/r/${restaurant.canonicalHandle}`,
      ...(images.length > 0 ? { image: images } : {}),
      ...(description ? { description } : {}),
      ...(phone ? { telephone: phone } : {}),
      ...(address
        ? {
            address: {
              "@type": "PostalAddress",
              streetAddress: address,
              addressRegion: "Chihuahua",
              addressCountry: "MX",
            },
          }
        : {}),
      ...(categories.length > 0 ? { servesCuisine: categories } : {}),
      ...(hours && hours.length > 0
        ? {
            openingHoursSpecification: hours.map((h) => ({
              "@type": "OpeningHoursSpecification",
              dayOfWeek: h.day,
              opens: h.opens,
              closes: h.closes,
            })),
          }
        : {}),
      ...(prices.length > 0
        ? {
            priceRange: `MX$${Math.min(...prices)}–MX$${Math.max(...prices)}`,
          }
        : {}),
      hasMenu: buildMenuJsonLd(restaurant.id, menu),
      acceptsReservations: false,
    };

    // FAQ con los MISMOS datos que renderiza LandingView (schema y página
    // nunca deben contradecirse).
    const weeklyRows = weeklySchedule(data);
    const hoursText = weeklyRows
      ? weeklyRows.map((r) => `${r.day} ${r.hours}`).join(" · ")
      : null;
    const fpr = data.firstPurchaseReward;
    let firstVisitReward: string | null = null;
    if (fpr && typeof fpr === "object") {
      const m = fpr as Record<string, unknown>;
      if (m.enabled === true) {
        firstVisitReward = str(m.menuItemName) ?? str(m.description);
      }
    }
    // Mismos "favoritos" que pinta LandingView: con foto, y por ventas
    // (orderCount) cuando existen datos.
    const withPhoto = menu.filter((i) => i.imageUrl);
    const topSource = withPhoto.some((i) => i.orderCount > 0)
      ? [...withPhoto].sort((a, b) => b.orderCount - a.orderCount)
      : withPhoto;
    const faq = buildFaq({
      name,
      categories,
      address,
      hoursText,
      topItems: topSource.slice(0, 3).map((i) => i.name),
      firstVisitReward,
      // MISMOS args que LandingView (la página y el schema jamás se
      // contradicen): regla de puntos + premios concretos de la escalera.
      earnRule: earnRuleLine(earnPolicyFromRestaurant(data)),
      rewardExamples: parseRewardTiers(data.rewardTiers)
        .slice(0, 3)
        .map((t) => `${t.name} (${t.points} ⭐)`),
    });
    if (faq.length > 0) {
      faqJsonLd = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faq.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      };
    }
  }

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      {faqJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
      )}
      {children}
    </>
  );
}
