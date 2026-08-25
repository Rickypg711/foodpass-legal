// Robo #4 a Biomenus: `dismissedSuggestionIds` — la sugerencia que el
// comensal ya rechazó NO se le vuelve a empujar. Nada mata más rápido la
// confianza en el upsell que la máquina necia.
//
// v1 = localStorage con TTL (paridad Biomenus). El núcleo es PURO a
// propósito: cuando esto se mude al wallet (identidad verificada, server-side
// y entre restaurantes — lo que Biomenus estructuralmente no puede), solo
// cambia el storage, no las reglas.

export type DismissalMap = Record<string, number>; // key → expiresAtMs

/** Un "no, gracias" dura 14 días: suficiente para no ser necio, corto para
 * que un platillo nuevo de temporada vuelva a tener su oportunidad. */
export const DISMISSAL_TTL_MS = 14 * 24 * 60 * 60 * 1000;

const STORE_KEY = "comeleal_upsell_dismissals_v1";

export function dismissalKey(restaurantId: string, menuItemId: string): string {
  return `${restaurantId}::${menuItemId}`;
}

/** Núcleo puro: limpia expirados. */
export function pruneDismissals(map: DismissalMap, nowMs: number): DismissalMap {
  const out: DismissalMap = {};
  for (const [k, exp] of Object.entries(map)) {
    if (typeof exp === "number" && exp > nowMs) out[k] = exp;
  }
  return out;
}

/** Núcleo puro: ¿este platillo ya fue rechazado y sigue vigente? */
export function isDismissedIn(
  map: DismissalMap,
  restaurantId: string,
  menuItemId: string,
  nowMs: number,
): boolean {
  const exp = map[dismissalKey(restaurantId, menuItemId)];
  return typeof exp === "number" && exp > nowMs;
}

/** Núcleo puro: registra el rechazo. */
export function withDismissal(
  map: DismissalMap,
  restaurantId: string,
  menuItemId: string,
  nowMs: number,
  ttlMs: number = DISMISSAL_TTL_MS,
): DismissalMap {
  return {
    ...pruneDismissals(map, nowMs),
    [dismissalKey(restaurantId, menuItemId)]: nowMs + ttlMs,
  };
}

// ── Storage (browser) — best-effort: sin localStorage, simplemente no hay
//    memoria y el upsell se comporta como antes. Jamás rompe el checkout. ──

function readStore(): DismissalMap {
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as DismissalMap) : {};
  } catch {
    return {};
  }
}

export function isUpsellDismissed(restaurantId: string, menuItemId: string): boolean {
  if (typeof window === "undefined") return false;
  return isDismissedIn(readStore(), restaurantId, menuItemId, Date.now());
}

export function rememberUpsellDismissal(restaurantId: string, menuItemId: string): void {
  if (typeof window === "undefined") return;
  try {
    const next = withDismissal(readStore(), restaurantId, menuItemId, Date.now());
    window.localStorage.setItem(STORE_KEY, JSON.stringify(next));
  } catch {
    /* best-effort */
  }
}
