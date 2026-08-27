/**
 * ESPEJO WEB de FOODPASS/lib/subscription/restaurant_private_docs.dart y de
 * functions/restaurant_private_docs.js: desde la migración del 24-ago-2026,
 * la verdad de suscripción vive en restaurants/{rid}/private/billing y el
 * cleanup BORRÓ los campos del doc público (que es `read: if true`).
 *
 * Leer el plan del doc público después de esa fecha = "Free" falso para todo
 * restaurante pagado (caso real: Pecado Escondido, dueño reclamando por
 * WhatsApp el 26-ago con dos meses de $299 cobrados y badge FREE).
 *
 * Regla: TODO lector de entitlement en la web pasa por fetchWithBilling (o
 * merge explícito). El doc público solo aporta el resto del restaurante y el
 * legado pre-backfill (`plan: "pro"` viejo, que entitlementOf ya respeta).
 */
import {
  doc,
  getDoc,
  type DocumentData,
  type Firestore,
  type Transaction,
  type DocumentReference,
} from "firebase/firestore";

/** Misma lista que la app (billingFieldNames) y el server. Si agregas un
 * campo allá, agrégalo aquí — el candado de paridad lo revisa. */
export const BILLING_FIELD_NAMES = [
  "subscriptionPlan",
  "subscriptionAccessStatus",
  "subscriptionAccessExpiresAt",
  "subscriptionTrialEndsAt",
  "subscriptionUpdatedAt",
  "subscriptionTrialSource",
  "subscriptionTrialGrantedAt",
  "subscriptionExpiredBy",
  "subscriptionReconciledAt",
  "subscriptionReconciledBy",
  "subscriptionReconcileSource",
  "subscriptionCompExpiresAt",
] as const;

export function billingRef(
  db: Firestore,
  restaurantId: string,
): DocumentReference<DocumentData> {
  return doc(db, "restaurants", restaurantId, "private", "billing");
}

/** Copia SOLO los campos de la lista, privado manda sobre público — misma
 * semántica que mergePrivateOverPublic de la app. */
export function mergeBillingOverPublic(
  publicData: Record<string, unknown>,
  privateData: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  if (!privateData) return publicData;
  const merged: Record<string, unknown> = { ...publicData };
  for (const k of BILLING_FIELD_NAMES) {
    if (privateData[k] !== undefined) merged[k] = privateData[k];
  }
  return merged;
}

/** try-read: un lector sin permiso (p. ej. cliente anónimo) u offline cae a
 * null y el público queda como fallback legado — igual que _tryRead (app). */
export async function tryFetchBillingData(
  db: Firestore,
  restaurantId: string,
): Promise<Record<string, unknown> | null> {
  try {
    const snap = await getDoc(billingRef(db, restaurantId));
    return snap.exists() ? (snap.data() as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Doc público + private/billing fundidos — la entrada correcta para
 * entitlementOf / isProActive / discountsEnabled. */
export async function fetchWithBilling(
  db: Firestore,
  restaurantId: string,
  publicData: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return mergeBillingOverPublic(
    publicData,
    await tryFetchBillingData(db, restaurantId),
  );
}

/** Variante para transacciones (phonePoints): el tx.get DEBE ir antes de
 * cualquier escritura de la transacción. */
export async function tryTxGetBillingData(
  tx: Transaction,
  db: Firestore,
  restaurantId: string,
): Promise<Record<string, unknown> | null> {
  try {
    const snap = await tx.get(billingRef(db, restaurantId));
    return snap.exists() ? (snap.data() as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
