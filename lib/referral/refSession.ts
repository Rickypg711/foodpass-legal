// lib/referral/refSession.ts
//
// Captura del código de referido en el navegador del AMIGO (§4).
//
// El amigo abre /menu/{rid}?ref=ACDEFG. De ahí navega, el parámetro se pierde
// de la URL y el pedido saldría sin referido — igual que pasaba con ?mesa=.
// Por eso se persiste, y el checkout lo recoge de aquí.
//
// localStorage y NO sessionStorage (que es por pestaña): el amigo puede abrir
// el link hoy desde WhatsApp y venir a comer el viernes. Dura 30 días.
// La llave lleva el id del local: un código de un local jamás se cuela al
// pedido de otro.

import {
  REF_PARAM,
  REF_STORAGE_KEY,
  parseReferralCode,
  parseStoredRef,
  storedRefValue,
} from "@/lib/referral/referralLink";

function keyFor(restaurantId: string): string {
  return `${REF_STORAGE_KEY}_${restaurantId}`;
}

/**
 * Lee `?ref=` de la URL; si viene, lo guarda. Devuelve el código vigente
 * (el de la URL o el guardado), o "" si no hay.
 *
 * Nunca truena: en un navegador con el almacenamiento bloqueado (modo privado,
 * ajustes), el referido simplemente no se recuerda y el pedido sale normal.
 */
export function resolveRefFromLocation(restaurantId: string): string {
  if (!restaurantId || typeof window === "undefined") return "";
  let fromUrl: string | null = null;
  try {
    fromUrl = parseReferralCode(
      new URL(window.location.href).searchParams.get(REF_PARAM),
    );
  } catch {
    fromUrl = null;
  }
  if (fromUrl) {
    try {
      window.localStorage.setItem(keyFor(restaurantId), storedRefValue(fromUrl));
    } catch {
      // sin almacenamiento: vale el de esta pantalla y ya
    }
    return fromUrl;
  }
  return readStoredRef(restaurantId);
}

/** El código guardado, si no se pasó de los 30 días. */
export function readStoredRef(restaurantId: string): string {
  if (!restaurantId || typeof window === "undefined") return "";
  try {
    return parseStoredRef(window.localStorage.getItem(keyFor(restaurantId))) ?? "";
  } catch {
    return "";
  }
}

/** Se olvida el código (ya se usó, o el amigo resultó no ser nuevo). */
export function clearStoredRef(restaurantId: string): void {
  if (!restaurantId || typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(keyFor(restaurantId));
  } catch {
    // nada que hacer
  }
}
