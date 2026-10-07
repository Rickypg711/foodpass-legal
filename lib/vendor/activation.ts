/**
 * Activación en tres toques (6-oct-2026) — la parte pura.
 *
 * Problema medido: 10 de 11 altas de MENU_C sin un pedido; "no supe cómo".
 * El tour, el consejo y los correos ya existían y no movían nada: el dueño
 * no vuelve al panel. El único minuto seguro es justo después de reclamar
 * su menú. Ahí se le piden TRES toques y cada uno hace el trabajo por él
 * (abre WhatsApp con el mensaje escrito, copia el link, abre su menú), no
 * se lo explica. Espec: FOODPASS/docs/ACTIVACION_TRES_TOQUES.md.
 *
 * Canon que sigue: Fogg (disparador en el momento caliente), Shopify/Hormozi
 * (hacerlo por ellos), Nunes & Drèze (progreso ya empezado: "tu menú listo"
 * cuenta como paso hecho), Zeigarnik (lo inconcluso jala: la tarjeta vuelve
 * en el paso que falta), Hulick/Krug (una acción por pantalla), Kahneman
 * (termina en el pico: el pedido que suena).
 *
 * Esta librería no toca Firestore ni el DOM: recibe señales y devuelve
 * pasos. La tarjeta (components/vendor/ActivationCard.tsx) la usa y el
 * candado scripts/validate-activation-card.mjs la prueba.
 */

export type ActivationStepKey = "menu" | "share" | "place" | "test";

export type ActivationSignals = {
  /** El dueño tocó "Mandar por WhatsApp" (restaurants.activation.shareTappedAt). */
  shareTappedAt?: number | null;
  /** El dueño copió su link (restaurants.activation.linkCopiedAt). */
  linkCopiedAt?: number | null;
  /** Existe al menos un pedido por el menú (no POS, no cancelado). */
  hasMenuOrder?: boolean;
};

export type ActivationStep = {
  key: ActivationStepKey;
  title: string;
  done: boolean;
};

/** Orden fijo de los pasos. "menu" siempre está hecho: es el progreso dotado. */
export const ACTIVATION_STEP_TITLES: Record<ActivationStepKey, string> = {
  menu: "Tu menú ya está listo",
  share: "Mándaselo a 5 clientes",
  place: "Ponlo donde te buscan, para que te pidan",
  test: "Haz un pedido de prueba",
};

export function activationSteps(s: ActivationSignals | null | undefined): ActivationStep[] {
  const sig = s ?? {};
  return [
    { key: "menu", title: ACTIVATION_STEP_TITLES.menu, done: true },
    { key: "share", title: ACTIVATION_STEP_TITLES.share, done: isMs(sig.shareTappedAt) },
    { key: "place", title: ACTIVATION_STEP_TITLES.place, done: isMs(sig.linkCopiedAt) },
    { key: "test", title: ACTIVATION_STEP_TITLES.test, done: sig.hasMenuOrder === true },
  ];
}

/** El primer paso sin hacer, o null cuando los cuatro están hechos. */
export function activationCurrent(steps: ActivationStep[]): ActivationStepKey | null {
  const next = steps.find((st) => !st.done);
  return next ? next.key : null;
}

export function activationDoneCount(steps: ActivationStep[]): number {
  return steps.filter((st) => st.done).length;
}

export function activationAllDone(s: ActivationSignals | null | undefined): boolean {
  return activationCurrent(activationSteps(s)) === null;
}

/** "1 de 4 listo" — en voz de progreso, nunca de regaño. */
export function activationProgressLabel(steps: ActivationStep[]): string {
  return `${activationDoneCount(steps)} de ${steps.length} listo`;
}

/**
 * De dónde vino la visita por link del dueño. "perfil" es el link que copia
 * y pega en Facebook, Instagram, WhatsApp o Google: es UN link para los
 * cuatro, así que no se finge saber en cuál lo pegó (6-oct-2026).
 */
export type ActivationUtmSource = "whatsapp" | "instagram" | "google" | "perfil";

/**
 * Link público del local con el rastro de quién lo compartió. Usa el slug
 * cuando existe (el redirect de /r por ID conserva los parámetros desde el
 * 6-oct, pero el slug es la URL canónica y la que Google consolida).
 */
export function activationPublicLink(
  restaurantId: string,
  slug: string | null | undefined,
  utmSource: ActivationUtmSource,
): string {
  const handle = slug && slug.trim() ? slug.trim() : restaurantId;
  return `https://comeleal.com/r/${encodeURIComponent(handle)}?utm_source=${utmSource}&utm_medium=owner_share`;
}

/**
 * El mensaje que el dueño les manda a sus clientes. En su voz, corto, sin
 * promesas que no existan. Sin emojis: api.whatsapp.com los respeta, pero
 * el dueño los agrega si quiere.
 */
export function activationShareMessage(restaurantName: string, link: string): string {
  const name = restaurantName.trim() || "nosotros";
  return `Hola, ya puedes ver el menú de ${name} y pedir desde tu cel. Aquí está: ${link}`;
}

/** Lee las señales del doc del restaurante (Timestamp de Firestore o ms). */
export function activationSignalsFromRestaurant(
  data: Record<string, unknown> | null | undefined,
  hasMenuOrder: boolean,
): ActivationSignals {
  const act = (data?.activation ?? null) as Record<string, unknown> | null;
  return {
    shareTappedAt: toMs(act?.shareTappedAt),
    linkCopiedAt: toMs(act?.linkCopiedAt),
    hasMenuOrder,
  };
}

/** "Lo hago después": se esconde 24 h en este navegador (solo comodidad). */
export const ACTIVATION_LATER_MS = 24 * 60 * 60 * 1000;
export function activationLaterKey(restaurantId: string): string {
  return `comeleal.activation.later.${restaurantId}`;
}
export function activationLaterActive(storedMs: number | null | undefined, nowMs: number): boolean {
  return typeof storedMs === "number" && storedMs > 0 && nowMs - storedMs < ACTIVATION_LATER_MS;
}

/** Un pedido cuenta como "pedido por el menú" con la misma regla que Hoy
 *  (lib/order/menuSales.ts): no POS, no cancelado, no borrador. */
export function isActivationMenuOrder(o: { orderSource?: unknown; status?: unknown } | null | undefined): boolean {
  if (!o) return false;
  if (o.orderSource === "pos") return false;
  return o.status !== "cancelled" && o.status !== "draft";
}

function isMs(v: unknown): boolean {
  return typeof v === "number" && Number.isFinite(v) && v > 0;
}

function toMs(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v) && v > 0) return v;
  if (v && typeof v === "object") {
    const t = v as { toMillis?: () => number; seconds?: number };
    if (typeof t.toMillis === "function") {
      try { return t.toMillis(); } catch { return null; }
    }
    if (typeof t.seconds === "number") return t.seconds * 1000;
  }
  return null;
}
