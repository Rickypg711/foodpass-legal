// lib/loyalty/freeItemsServer.ts
//
// SOLO SERVIDOR (Admin SDK). El "visto" del taco, en un solo lugar, para que
// los dos caminos que lo arrancan hagan exactamente lo mismo
// (docs/REFERIDOS_POR_TELEFONO.md §7):
//   - /api/free-items/seen          → el recibo del pedido (llave = el link)
//   - /api/free-items/seen-by-phone → /puntos (llave = su sesión por SMS)
//
// Qué hace: a los tacos VIVOS de ese teléfono que nunca se habían visto les
// pone `seenAt = ahora` y les recalcula el vencimiento (7 días desde ahora,
// con tope de 30 desde que nacieron). Idempotente: un taco ya visto no se
// vuelve a tocar, así que nadie le estira la vida "re-viéndolo".

import { Timestamp, type Firestore } from "firebase-admin/firestore";
import {
  freeItemsEnabled,
  liveRows,
  markSeenRows,
  toMs,
  type FreeItemRow,
} from "@/lib/loyalty/freeItems";

/** ms → Timestamp para guardar; deja pasar null. */
export function toFirestoreRow(r: FreeItemRow): FreeItemRow {
  const conv = (v: unknown) => {
    const ms = toMs(v);
    return ms == null ? null : Timestamp.fromMillis(ms);
  };
  return {
    ...r,
    bornAt: conv(r.bornAt),
    seenAt: conv(r.seenAt),
    expiresAt: conv(r.expiresAt),
    redeemedAt: conv(r.redeemedAt),
  };
}

export type SeenItem = { id: string; expiresAt: number | null };

/**
 * Marca "visto" los tacos vivos del teléfono en ese local. Devuelve los tacos
 * vivos con su vencimiento YA actualizado (para que la pantalla muestre la
 * fecha buena sin recargar), o `null` si el local no está en esto.
 *
 * `phone` tiene que llegar ya resuelto por el servidor (del pedido o de la
 * sesión verificada). Jamás de lo que mande el navegador.
 */
export async function markPhoneSeen(
  db: Firestore,
  restaurantId: string,
  phone: string,
  nowMs: number = Date.now(),
): Promise<SeenItem[] | null> {
  const restSnap = await db.doc(`restaurants/${restaurantId}`).get();
  // Compuerta: fuera de los locales que ya usan filas, aquí no pasa nada.
  if (!freeItemsEnabled(restSnap.data())) return null;

  const phoneRef = db.doc(`restaurants/${restaurantId}/phoneCustomers/${phone}`);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(phoneRef);
    if (!snap.exists) return [];
    const rows = (snap.data() ?? {}).freeItems;
    const next = markSeenRows(rows, nowMs);
    // Ya estaban vistas: no se escribe de gusto.
    if (next) tx.update(phoneRef, { freeItems: next.map(toFirestoreRow) });
    return liveRows(next ?? rows, nowMs).map((r) => ({
      id: r.id,
      expiresAt: toMs(r.expiresAt),
    }));
  });
}
