// lib/referral/referralLink.ts
//
// Referidos por teléfono — el link y su código (docs/REFERIDOS_POR_TELEFONO.md §4).
// Módulo PURO: no lee Firestore, no escribe nada, no toca el navegador.
//
// El número NUNCA viaja en la URL. Lo que viaja es un código corto que el
// servidor resuelve: restaurants/{rid}/referralCodes/{codigo} → { phone }, y ese
// doc no lo puede leer ningún cliente (ni el local).
//
// Espejo del alfabeto y la forma en FOODPASS/functions/referral.js: si cambia
// uno, cambian los dos, o el link de un volante deja de resolver.

/** Sin 0/O, 1/I/L, 2/Z, 5/S, 8/B: para que nadie lo dicte mal por teléfono. */
export const CODE_ALPHABET = "ACDEFGHJKMNPQRTUVWXY34679";
export const CODE_LEN = 6;
const CODE_RE = new RegExp(`^[${CODE_ALPHABET}]{${CODE_LEN}}$`);

/** El parámetro del link y la llave donde el navegador del amigo lo guarda. */
export const REF_PARAM = "ref";
export const REF_STORAGE_KEY = "comeleal_ref";
/** Días que el código aguanta en el navegador del amigo antes de olvidarse. */
export const REF_TTL_DAYS = 30;

/** Normaliza lo tecleado o pegado; null si no tiene forma de código. */
export function parseReferralCode(v: unknown): string | null {
  const up = String(v ?? "").trim().toUpperCase();
  return CODE_RE.test(up) ? up : null;
}

/** El link que el que invita manda por WhatsApp. */
export function referralLink(
  restaurantId: string,
  code: string,
  origin = "https://comeleal.com",
): string {
  const c = parseReferralCode(code);
  const base = `${origin.replace(/\/+$/, "")}/menu/${restaurantId}`;
  return c ? `${base}?${REF_PARAM}=${c}` : base;
}

export type StoredRef = { code: string; savedAt: number };

/** Lo guardado en el navegador del amigo, si sigue vigente. */
export function parseStoredRef(
  raw: unknown,
  nowMs: number = Date.now(),
): string | null {
  if (typeof raw !== "string" || !raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Formato viejo o basura: se trata como código pelón.
    return parseReferralCode(raw);
  }
  const o = parsed as Partial<StoredRef> | null;
  const code = parseReferralCode(o?.code);
  if (!code) return null;
  const savedAt = Number(o?.savedAt);
  if (!Number.isFinite(savedAt)) return code;
  if (nowMs - savedAt > REF_TTL_DAYS * 86400000) return null; // se olvidó
  return code;
}

export function storedRefValue(code: string, nowMs: number = Date.now()): string {
  return JSON.stringify({ code, savedAt: nowMs } satisfies StoredRef);
}

/**
 * El texto que el que invita manda por WhatsApp — FALLBACK fijo.
 * En el paso 6 la IA escribe la versión buena en `phoneCustomers.aiLines` y
 * esto queda como red: si no hay frase escrita, se manda esta.
 *
 * Copy: nivel secundaria, "link" jamás "liga", nunca "vi que entraste", y
 * nada de prometer que algo se manda solo.
 */
export function inviteTextFallback(params: {
  itemName: string;
  restaurantName: string;
  link: string;
}): string {
  const item = params.itemName.trim() || "algo gratis";
  const rest = params.restaurantName.trim();
  const donde = rest ? ` en ${rest}` : "";
  // 19-sep: el amigo NO recibe el premio en su primera compra; con ella se lo
  // GANA para su siguiente visita. El texto no puede prometer otra cosa.
  return `Aquí se come bien. Con tu primer pedido${donde} te ganas un ${item} gratis para tu siguiente visita. Entra con este link: ${params.link}`;
}

/**
 * El texto de "Avísale" (§9): el que invita ya ganó su taco y el local se lo
 * dice a mano por WhatsApp. FALLBACK fijo, igual que arriba.
 *
 * Nunca decir "automático": esto lo manda una persona.
 */
export function notifyTextFallback(params: {
  itemName: string;
  restaurantName: string;
  friendName?: string;
  expiryLabel?: string;
}): string {
  const item = params.itemName.trim() || "un premio";
  const rest = params.restaurantName.trim();
  const quien = params.friendName?.trim();
  const gracias = quien ? `Tu amigo ${quien} ya vino` : "Tu amigo ya vino";
  const cuando = params.expiryLabel?.trim() ? ` (${params.expiryLabel.trim()})` : "";
  return `${gracias}. Te ganaste un ${item}${rest ? ` en ${rest}` : ""}: pídelo en tu próxima visita${cuando}.`;
}
