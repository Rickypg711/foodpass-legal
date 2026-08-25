// Robo #5 a Biomenus: el hub de una tecla — "llamar al mesero" y "pedir la
// cuenta" desde el QR de la mesa, con cooldown de 30 s. El cooldown es el
// detalle que hace que esto sobreviva un viernes en la noche: sin él, un niño
// aburrido con el teléfono de papá es una metralleta de timbres en la Caja.
//
// El comensal solo CREA (reglas estrictas en firestore.rules); ver y atender
// es del equipo del local (campana en la Caja).

import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { ensureAnonymousUser } from "@/lib/auth";
import { getFirebaseDb } from "@/lib/firebase";

import { cooldownRemainingMs } from "@/lib/order/serviceRequestCooldown";

export type ServiceRequestType = "call_waiter" | "ask_bill";

export function serviceCooldownKey(
  restaurantId: string,
  tableNumber: string,
  type: ServiceRequestType,
): string {
  return `comeleal_srv_${restaurantId}_${tableNumber}_${type}`;
}

function readLastSent(key: string): number | null {
  try {
    const raw = window.sessionStorage.getItem(key);
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

export function serviceRequestCooldownMs(
  restaurantId: string,
  tableNumber: string,
  type: ServiceRequestType,
): number {
  if (typeof window === "undefined") return 0;
  return cooldownRemainingMs(
    readLastSent(serviceCooldownKey(restaurantId, tableNumber, type)),
    Date.now(),
  );
}

export type ServiceRequestResult = "sent" | "cooldown" | "error";

/** Manda la petición. En cooldown no manda; en error no truena — el mesero
 * de carne y hueso sigue existiendo, esto solo es el atajo. */
export async function sendServiceRequest(params: {
  restaurantId: string;
  tableNumber: string;
  type: ServiceRequestType;
}): Promise<ServiceRequestResult> {
  const { restaurantId, tableNumber, type } = params;
  if (serviceRequestCooldownMs(restaurantId, tableNumber, type) > 0) {
    return "cooldown";
  }
  try {
    const user = await ensureAnonymousUser();
    const db = getFirebaseDb();
    await addDoc(collection(db, "restaurants", restaurantId, "serviceRequests"), {
      type,
      tableNumber,
      status: "pending",
      customerId: user.uid,
      createdAt: serverTimestamp(),
    });
    try {
      window.sessionStorage.setItem(
        serviceCooldownKey(restaurantId, tableNumber, type),
        String(Date.now()),
      );
    } catch {
      /* best-effort */
    }
    return "sent";
  } catch {
    return "error";
  }
}
