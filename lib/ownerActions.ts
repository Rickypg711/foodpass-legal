/**
 * Rastro de lo que el dueño TOCA en el panel (24-sep-2026).
 *
 * Por qué: el cerebro (restaurant_brain) escribe un consejo y la alerta de
 * las 11 AM manda un push, pero NADIE medía si el dueño lo toca. Sin eso no
 * hay forma de decidir si construir la "cola de pendientes" (trabajo listo
 * que solo pide un sí). Dos toques importan hoy:
 *   - nba_tap       → tocó el botón del consejo ("Tu siguiente movimiento")
 *   - winback_send  → tocó "Enviar" para escribirle a un cliente por WhatsApp
 *
 * Dónde vive: restaurants/{rid}/ownerActions/{autoId}. Solo se CREA (las
 * reglas prohíben editar o borrar). Se lee con
 * scripts/accionesDelDuenoReadOnly.js en FOODPASS.
 *
 * Espejo en la app: lib/services/owner_actions_log.dart (misma forma).
 * Nunca guarda el teléfono completo del cliente: solo los últimos 4.
 */
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import { getFirebaseAuth } from "@/lib/auth";

export type OwnerActionType = "nba_tap" | "winback_send";

export interface OwnerActionExtra {
  /** Código del consejo (send_winback, charge_web_orders…). Solo nba_tap. */
  actionCode?: string;
  /** Últimos 4 del teléfono o id corto del cliente. Solo winback_send. */
  target?: string;
}

/** Últimos 4 dígitos: identifica al cliente sin guardar su número. */
export function shortTarget(phoneOrId: string | undefined | null): string | undefined {
  if (!phoneOrId) return undefined;
  const digits = phoneOrId.replace(/\D/g, "");
  if (digits.length >= 4) return `…${digits.slice(-4)}`;
  return phoneOrId.slice(0, 8);
}

/** Forma exacta del documento. Pura, para el candado. */
export function ownerActionDoc(
  uid: string,
  type: OwnerActionType,
  extra: OwnerActionExtra = {},
): Record<string, unknown> {
  const d: Record<string, unknown> = { uid, type, platform: "web", createdAt: serverTimestamp() };
  if (extra.actionCode) d.actionCode = extra.actionCode;
  if (extra.target) d.target = extra.target;
  return d;
}

/**
 * Escribe el toque y sigue. Jamás bloquea ni rompe la acción del dueño:
 * si no hay sesión o la escritura falla, se pierde el dato, no el clic.
 */
export function logOwnerAction(
  restaurantId: string,
  type: OwnerActionType,
  extra: OwnerActionExtra = {},
): void {
  try {
    const uid = getFirebaseAuth().currentUser?.uid;
    if (!uid || !restaurantId) return;
    addDoc(
      collection(getFirebaseDb(), "restaurants", restaurantId, "ownerActions"),
      ownerActionDoc(uid, type, extra),
    ).catch(() => {});
  } catch {
    /* sin Firebase en este entorno: nada */
  }
}
