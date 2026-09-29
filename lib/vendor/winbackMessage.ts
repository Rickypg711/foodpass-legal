// lib/vendor/winbackMessage.ts
//
// Win-back por WhatsApp para clientes de TELÉFONO (29-sep-2026).
//
// El cerebro (generateWinBackMessage, camino phone10) escribe el mensaje con
// lo que sabe del cliente (platillos, cuándo viene, puntos, premio sin usar,
// qué ha funcionado en el local) y elige el gancho; el DUEÑO lo manda él
// mismo desde su WhatsApp. Manual y gratis, siempre. Si la función falla,
// sale la plantilla de siempre y el rastro (lastWinbackAt) se deja desde
// aquí para que la Caja pueda marcar el regreso igual.
//
// Espejo de FOODPASS lib/services/winback_message_service.dart.

import { httpsCallable } from "firebase/functions";
import { Timestamp, arrayUnion, doc, increment, serverTimestamp, setDoc } from "firebase/firestore";
import { getFirebaseDb, getFirebaseFunctions } from "@/lib/firebase";

export type WinbackMessage = { message: string; hook: string; fromAi: boolean };

/** Plantilla de respaldo: la misma de siempre, solo cuando la IA no contesta. */
export function fallbackWinback(params: {
  firstName: string;
  restaurantName: string;
  points: number;
}): WinbackMessage {
  const venue = params.restaurantName || "el restaurante";
  const name = params.firstName || "Hola";
  if (params.points > 0) {
    return {
      message: `¡Hola ${name}! 👋 Te extrañamos en ${venue}. Tienes ${params.points} puntos esperándote 🎁`,
      hook: "points",
      fromAi: false,
    };
  }
  return {
    message: `¡Hola ${name}! 👋 Te extrañamos en ${venue}. Esta semana tenemos algo especial para ti 🎁`,
    hook: "special",
    fromAi: false,
  };
}

/** "Le escribiste hace 3 d" / "Regresó 4 d después de tu mensaje" / null. */
export function winbackStatusLabel(c: {
  lastWinbackAt?: Timestamp | Date | null;
  winbackReturnedAt?: Timestamp | Date | null;
}, nowMs = Date.now()): { label: string; returned: boolean } | null {
  const sentMs = toMs(c.lastWinbackAt);
  if (sentMs == null) return null;
  const backMs = toMs(c.winbackReturnedAt);
  if (backMs != null && backMs >= sentMs) {
    const d = Math.floor((backMs - sentMs) / 86400000);
    return {
      label: d === 0 ? "Regresó el mismo día de tu mensaje" : `Regresó ${d} d después de tu mensaje`,
      returned: true,
    };
  }
  const ago = Math.floor((nowMs - sentMs) / 86400000);
  return { label: ago === 0 ? "Le escribiste hoy" : `Le escribiste hace ${ago} d`, returned: false };
}

function toMs(v: unknown): number | null {
  if (v == null) return null;
  if (v instanceof Date) return v.getTime();
  const t = v as { toMillis?: () => number };
  return typeof t.toMillis === "function" ? t.toMillis() : null;
}

/** Pide el mensaje al cerebro. Nunca lanza: si falla, plantilla + rastro. */
export async function writePhoneWinback(params: {
  restaurantId: string;
  restaurantName: string;
  phone10: string;
  firstName: string;
  points?: number;
}): Promise<WinbackMessage> {
  const { restaurantId, restaurantName, phone10, firstName, points = 0 } = params;
  try {
    const fn = httpsCallable<Record<string, unknown>, { message: string; hook?: string }>(
      getFirebaseFunctions(),
      "generateWinBackMessage",
    );
    const res = await fn({ restaurantId, restaurantName: restaurantName || "el restaurante", phone10 });
    const message = (res.data?.message ?? "").trim();
    if (!message) throw new Error("empty message");
    return { message, hook: (res.data?.hook ?? "unknown").trim(), fromAi: true };
  } catch {
    return fallbackWinback({ firstName, restaurantName, points });
  }
}

/**
 * El rastro se deja AL MANDAR (29-sep): el dueño lee el mensaje y puede no
 * aprobarlo. Sin esto "regresó después de tu mensaje" no existe. La Caja
 * compara lastVisitAt contra lastWinbackAt al cobrar.
 */
export function stampWinbackSent(restaurantId: string, phone10: string, hook: string): Promise<void> {
  return setDoc(
    doc(getFirebaseDb(), "restaurants", restaurantId, "phoneCustomers", phone10),
    {
      lastWinbackAt: serverTimestamp(),
      lastWinbackHook: hook,
      winbackCount: increment(1),
      winbackHistory: arrayUnion({ sentAt: Timestamp.now(), hook }),
    },
    { merge: true },
  ).catch(() => {});
}
