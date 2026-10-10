// lib/referral/accountInvite.ts
//
// Referidos por teléfono desde la APP (paridad 9-oct-2026,
// FOODPASS docs/REFERIDOS_PARIDAD_9_OCT.md).
//
// La web acuña el código del que invita a partir de un PEDIDO pagado (el link
// del recibo es la llave: POST /api/referral-code). En la app el comensal no
// llega desde un recibo: toca "Regálale {premio} a un amigo" en el perfil del
// local. Ahí la llave es SU SESIÓN: el teléfono sale del token (SMS) o de
// users/{uid}.linkedPhone (que las reglas solo dejan escribir con un token que
// trae ese mismo número), NUNCA del cuerpo de la petición.
//
// Mismo código, mismo link, misma compuerta, mismo requisito que la web:
//   - el local tiene `freeItemsV2Enabled === true` (si no, nadie promete nada);
//   - el local tiene premio de bienvenida con nombre (si no, no hay qué regalar);
//   - ese teléfono tiene ≥1 pedido PAGADO en el local (§2).
//
// Módulo PURO: no lee Firestore, no toca el navegador. Lo importan la ruta
// y el candado scripts/validate-referral-parity.mjs.

/** La ruta que llama la app. Espejo de kAccountInvitePath en FOODPASS. */
export const REFERRAL_ACCOUNT_ENDPOINT = "/api/referral-code/by-account";

/** Últimos 10 dígitos, o null. Misma normalización que functions/referral.js. */
export function normalizePhone10(v: unknown): string | null {
  const digits = String(v ?? "").replace(/\D/g, "");
  if (digits.length < 10) return null;
  return digits.slice(-10);
}

/** Formas en las que un mismo número pudo guardarse en los pedidos (espejo de functions). */
export function phoneVariants(p10: string): string[] {
  return [p10, `52${p10}`, `+52${p10}`, `521${p10}`, `+521${p10}`];
}

/** El teléfono de la sesión: el del token manda; si no trae, el ligado a la cuenta. */
export function phoneFromAccount(params: {
  tokenPhone?: unknown;
  linkedPhone?: unknown;
}): string | null {
  return normalizePhone10(params.tokenPhone) ?? normalizePhone10(params.linkedPhone);
}

export type AccountInviteDecision =
  | { ok: true }
  | { ok: false; reason: "gate_off" | "no_welcome_item" | "no_phone" | "no_purchase" };

/**
 * ¿Este comensal puede invitar desde la app? Mismas condiciones que el recibo
 * de la web, más la del premio con nombre (sin él el grant tampoco otorga).
 */
export function decideAccountInvite(params: {
  gateOn: boolean;
  itemName: string | null;
  phone: string | null;
  paidOrders: number;
}): AccountInviteDecision {
  if (!params.gateOn) return { ok: false, reason: "gate_off" };
  if (!params.itemName || !params.itemName.trim()) return { ok: false, reason: "no_welcome_item" };
  if (!params.phone) return { ok: false, reason: "no_phone" };
  if (!(Number(params.paidOrders) >= 1)) return { ok: false, reason: "no_purchase" };
  return { ok: true };
}
