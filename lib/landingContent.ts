// lib/landingContent.ts
//
// Contenido AUTO-GENERADO de la landing /r/{id} — patrón robado del playbook
// de Owner.com (metropizza.com): title con la frase de búsqueda, FAQ con
// datos reales, bloque de texto SEO. Puro y compartido server/cliente:
// el layout lo usa para <title> y JSON-LD FAQPage, LandingView para pintar
// las mismas secciones (¡el schema SIEMPRE debe decir lo mismo que la página!).

export type FaqEntry = { q: string; a: string };

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
): string {
  const cat = categories[0] ? capitalizeFirst(categories[0].toLowerCase()) : null;
  const city = cityFromAddress(address);
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
): string {
  const cat = categories[0] ? categories[0].toLowerCase() : "comida";
  const city = cityFromAddress(address);
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
  /** "lunes 9:00 am – 8:00 pm · martes Cerrado · …" o null sin horario. */
  hoursText: string | null;
  /** Nombres de platillos destacados (hasta 3). */
  topItems: string[];
  /** Regalo de primera visita (firstPurchaseReward) o null. */
  firstVisitReward: string | null;
}): FaqEntry[] {
  const { name, categories, address, hoursText, topItems, firstVisitReward } = args;
  const out: FaqEntry[] = [];

  if (categories.length > 0 || topItems.length > 0) {
    const cats = categories.slice(0, 3).map((c) => c.toLowerCase()).join(", ");
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
    out.push({
      q: `¿Dónde está ${name}?`,
      a: `${name} está en ${address}. En esta página encuentras el botón "Cómo llegar" con la ruta en Google Maps.`,
    });
  }

  if (hoursText) {
    out.push({
      q: `¿Cuál es el horario de ${name}?`,
      a: `Horario de ${name}: ${hoursText}.`,
    });
  }

  out.push({
    q: `¿${name} tiene recompensas?`,
    a:
      `Sí — ${name} usa Comeleal: juntas puntos con cada compra y los canjeas por platillos gratis.` +
      (firstVisitReward
        ? ` Además, tu primera compra desbloquea ${firstVisitReward} gratis para tu siguiente visita.`
        : ""),
  });

  return out;
}
