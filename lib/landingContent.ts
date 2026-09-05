// lib/landingContent.ts
//
// Contenido AUTO-GENERADO de la landing /r/{id} — patrón robado del playbook
// de Owner.com (metropizza.com): title con la frase de búsqueda, FAQ con
// datos reales, bloque de texto SEO. Puro y compartido server/cliente:
// el layout lo usa para <title> y JSON-LD FAQPage, LandingView para pintar
// las mismas secciones (¡el schema SIEMPRE debe decir lo mismo que la página!).

export type FaqEntry = { q: string; a: string };

/**
 * Categorías que NO son una frase de búsqueda. "Otro" es el comodín del
 * selector de giro (Configuración / inferCategory); en un title queda
 * "CURANDERO | Otro — menú…", que no busca nadie. Se filtra en TODO lo que
 * sale a Google: title, párrafo SEO, FAQ, servesCuisine y los chips públicos.
 * El dato en Firestore NO se toca — el dueño eligió "Otro" y es válido.
 */
const PLACEHOLDER_CATEGORIES = new Set([
  "otro", "otros", "other", "others", "general", "varios", "ninguna", "ninguno",
  "sin categoría", "sin categoria", "n/a", "na", "-",
]);

export function isPlaceholderCategory(c: string | null | undefined): boolean {
  if (typeof c !== "string") return true;
  const k = c.trim().toLowerCase();
  return !k || PLACEHOLDER_CATEGORIES.has(k);
}

/** Categorías reales, en su orden, sin comodines. */
export function seoCategories(categories: readonly string[] | null | undefined): string[] {
  return (categories ?? []).filter((c) => !isPlaceholderCategory(c)).map((c) => c.trim());
}

/**
 * La ciudad para SEO: PRIMERO la estructurada que dio Google al geocodificar
 * (`city`, escrita por /api/geocode en la web o derivada del pin por
 * functions/restaurant_city_from_pin.js), y solo si no existe, la heurística
 * del texto. Nunca al revés.
 */
export function cityForRestaurant(
  data: Record<string, unknown> | null | undefined,
): string | null {
  const structured = typeof data?.city === "string" ? data.city.trim() : "";
  if (structured) return structured;
  return cityFromAddress(typeof data?.address === "string" ? data.address : null);
}

/**
 * Ciudad a partir de la dirección — heurística CONSERVADORA: solo cuando la
 * dirección tiene comas estilo "colonia, 70934 Puerto Escondido, Oax." toma
 * el penúltimo segmento y le quita el código postal. Si no hay confianza,
 * null (mejor sin ciudad que con una ciudad equivocada).
 */
export function cityFromAddress(address: string | null | undefined): string | null {
  if (!address) return null;
  const parts = address
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length < 3) return null;
  let seg = parts[parts.length - 2];
  seg = seg.replace(/^\d{4,6}\s*/, "").trim();
  if (!seg || /\d/.test(seg) || seg.length < 3 || seg.length > 40) return null;
  // "Col. Minerales", "Colonia Atenas", "Centro", "Fracc. X": es colonia, no
  // ciudad. Mejor sin ciudad que con la colonia en el title.
  if (/^(col\.?|colonia|fracc\.?|fraccionamiento|barrio|zona)\b/i.test(seg)) return null;
  if (/^(el\s+)?centro$/i.test(seg)) return null;
  return seg;
}

/** "pizza" → "Pizza" (para títulos). */
export function capitalizeFirst(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

/**
 * Title estilo Owner: la FRASE DE BÚSQUEDA primero.
 * "Luzz Pizza | Pizza en Puerto Escondido — menú, pedidos y horario"
 * Sin categoría → cae al patrón anterior.
 */
export function buildLandingTitle(
  name: string,
  categories: string[],
  address: string | null,
  /** Ciudad estructurada (cityForRestaurant). Sin ella, heurística del texto. */
  cityHint: string | null = null,
): string {
  const cats = seoCategories(categories);
  const cat = cats[0] ? capitalizeFirst(cats[0].toLowerCase()) : null;
  const city = cityHint ?? cityFromAddress(address);
  if (!cat) return `${name} — Menú, horario y ubicación`;
  return `${name} | ${cat}${city ? ` en ${city}` : ""} — menú, pedidos y horario`;
}

/**
 * Párrafo SEO estilo Metro Pizza ("Las Vegas Pizza Delivery and Takeout"),
 * adaptado al ángulo Comeleal: directo del restaurante + puntos.
 */
export function buildSeoParagraph(
  name: string,
  categories: string[],
  address: string | null,
  /** Premios apagados (5-sep): false = la página no promete puntos. */
  loyaltyLive = true,
  /** Ciudad estructurada (cityForRestaurant). Sin ella, heurística del texto. */
  cityHint: string | null = null,
): string {
  const cats = seoCategories(categories);
  const cat = cats[0] ? cats[0].toLowerCase() : "comida";
  const city = cityHint ?? cityFromAddress(address);
  if (!loyaltyLive) {
    return (
      `Pide ${cat}${city ? ` en ${city}` : ""} directo de ${name}: mira el menú ` +
      `con fotos y precios y haz tu pedido en línea. Sin apps de por medio — ` +
      `tu pedido llega directo al restaurante.`
    );
  }
  return (
    `Pide ${cat}${city ? ` en ${city}` : ""} directo de ${name}: mira el menú ` +
    `con fotos y precios, haz tu pedido en línea y junta puntos con cada compra ` +
    `para canjearlos por platillos gratis. Sin apps de por medio — tu pedido ` +
    `llega directo al restaurante y tú ganas recompensas por regresar.`
  );
}

/**
 * FAQ auto-generada (patrón FAQPage de Owner: 5 preguntas simples que Google
 * y los motores de IA citan). Solo se incluyen preguntas cuyos DATOS existen —
 * nunca inventamos respuestas.
 */
export function buildFaq(args: {
  name: string;
  categories: string[];
  address: string | null;
  /** Ciudad estructurada (cityForRestaurant); hoy la FAQ no la usa en copy,
   *  pero viaja para que el "¿Dónde está?" pueda decirla cuando el texto no. */
  city?: string | null;
  /** "lunes 9:00 am – 8:00 pm · martes Cerrado · …" o null sin horario. */
  hoursText: string | null;
  /** Nombres de platillos destacados (hasta 3). */
  topItems: string[];
  /** Regalo de primera visita (firstPurchaseReward) o null. */
  firstVisitReward: string | null;
  /** Regla de puntos en una línea (earnRuleLine) — opcional. */
  earnRule?: string | null;
  /** Premios concretos de la escalera, ej. "Pizza personal (300 ⭐)". */
  rewardExamples?: string[];
  /** Premios apagados (5-sep): false = la FAQ no promete puntos ni premios. */
  loyaltyLive?: boolean;
}): FaqEntry[] {
  const {
    name,
    categories,
    address,
    city = null,
    hoursText,
    topItems,
    firstVisitReward,
    earnRule = null,
    rewardExamples = [],
    loyaltyLive = true,
  } = args;
  const out: FaqEntry[] = [];

  const realCategories = seoCategories(categories);
  if (realCategories.length > 0 || topItems.length > 0) {
    const cats = realCategories.slice(0, 3).map((c) => c.toLowerCase()).join(", ");
    const tops = topItems.slice(0, 3).join(", ");
    out.push({
      q: `¿Qué sirven en ${name}?`,
      a:
        (cats ? `${name} sirve ${cats}. ` : "") +
        (tops ? `Algunos favoritos del menú: ${tops}. ` : "") +
        "Mira el menú completo con fotos y precios en esta página.",
    });
  }

  out.push({
    q: `¿Puedo ordenar en línea en ${name}?`,
    a: `Sí. Desde el menú de ${name} puedes armar tu pedido en línea con precios actualizados, o escribirle al restaurante por WhatsApp. Ordenar directo apoya al negocio y te da puntos por cada compra.`,
  });

  if (address) {
    // Si el dueño no escribió la ciudad ("el centro", "Villareal"), la pone
    // Google al final. Nunca se repite si el texto ya la trae.
    const where =
      city && !address.toLowerCase().includes(city.toLowerCase()) ? `${address}, ${city}` : address;
    out.push({
      q: `¿Dónde está ${name}?`,
      a: `${name} está en ${where}. En esta página encuentras el botón "Cómo llegar" con la ruta en Google Maps.`,
    });
  }

  if (hoursText) {
    out.push({
      q: `¿Cuál es el horario de ${name}?`,
      a: `Horario de ${name}: ${hoursText}.`,
    });
  }

  // Respuesta con los premios CONCRETOS (robo del teardown de la app Owner:
  // el premio con nombre y costo en ⭐ convierte más que "recompensas" a
  // secas — y a los motores de IA les da la respuesta citable exacta).
  if (!loyaltyLive) return out;
  out.push({
    q: `¿${name} tiene recompensas?`,
    a:
      `Sí — ${name} usa Comeleal: juntas puntos con cada compra` +
      (earnRule ? ` (${earnRule})` : "") +
      ` y los canjeas por platillos gratis.` +
      (rewardExamples.length > 0
        ? ` Premios: ${rewardExamples.slice(0, 3).join(", ")}.`
        : "") +
      (firstVisitReward
        ? ` Además, tu primera compra desbloquea ${firstVisitReward} gratis para tu siguiente visita.`
        : ""),
  });

  return out;
}
