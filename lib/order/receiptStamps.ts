// lib/order/receiptStamps.ts
//
// Stamps del recibo — paso 1 de docs/REFERIDOS_POR_TELEFONO.md (FOODPASS, 18-sep-2026).
//
// Antes de construir el referido hay que ver el canal: el comensal solo llega a
// la página del pedido si el local le manda el recibo por WhatsApp (Caja) o si
// ordenó en línea. Hoy ni el tap del recibo ni la vista de la página dejan
// rastro. Estos dos stamps son el embudo mínimo: ventas con teléfono →
// recibos tocados → páginas abiertas. Lectura: scripts/recibosReadOnly.js (FOODPASS).
//
// Dos stamps, mismo molde (primera vez fija, última vez y conteo se mueven):
//   receiptTapped — el dueño/equipo tocó "Enviar recibo por WhatsApp" (Pedidos,
//                   Caja web, Caja app). Un tap NO prueba envío; es lo más
//                   cercano que podemos ver.
//   viewed        — el bloque del recibo se DIBUJÓ en la pantalla del comensal
//                   (IntersectionObserver en la página → POST /api/order-receipt/viewed).
//                   El preview de WhatsApp no ejecuta scripts, así que no cuenta;
//                   el dueño con sesión abierta tampoco cuenta (viewerIsStaff).
//
// Paridad app: lib/services/receipt_tap_stamp.dart escribe los MISMOS campos
// con receiptTapSource 'app'. Espejo de este molde; no cambiar uno sin el otro.

import {
  doc,
  increment,
  runTransaction,
  serverTimestamp,
  type Firestore,
} from "firebase/firestore";

export type ReceiptStampKind = "receiptTapped" | "viewed";

export type ReceiptStampSource = "web" | "app";

/**
 * Campos a escribir en el pedido para un stamp. Puro: los sentinelas
 * (serverTimestamp / increment) llegan como parámetro para que el candado
 * los pruebe sin Firebase.
 *
 * - `<kind>At` solo la PRIMERA vez (si ya existe, no se toca).
 * - `<kind>LastAt` siempre.
 * - `<kind>Count` +1 siempre.
 * - `receiptTapSource` solo en receiptTapped (web | app), última fuente.
 */
export function receiptStampFields(
  kind: ReceiptStampKind,
  prev: Record<string, unknown> | undefined,
  now: unknown,
  inc: unknown,
  source?: ReceiptStampSource,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const firstKey = `${kind}At`;
  if (!prev || prev[firstKey] == null) out[firstKey] = now;
  out[`${kind}LastAt`] = now;
  out[`${kind}Count`] = inc;
  if (kind === "receiptTapped" && source) out.receiptTapSource = source;
  return out;
}

/**
 * Stamp del tap del recibo desde el navegador del local (Pedidos / Caja web).
 * Fire-and-forget: jamás bloquea el window.open del wa.me ni tira error al
 * cajero. Las reglas ya dejan al asociado del restaurante actualizar sus
 * pedidos (firestore.rules → /orders/{orderId} update).
 */
export async function markReceiptTapped(
  db: Firestore,
  restaurantId: string,
  orderId: string,
): Promise<void> {
  if (!restaurantId || !orderId) return;
  try {
    const ref = doc(db, "restaurants", restaurantId, "orders", orderId);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) return;
      tx.update(
        ref,
        receiptStampFields("receiptTapped", snap.data(), serverTimestamp(), increment(1), "web"),
      );
    });
  } catch (e) {
    console.warn("[receiptStamps] tap stamp failed", e);
  }
}

/** Ruta del POST que la página del pedido usa para marcar "visto". */
export const RECEIPT_VIEWED_ENDPOINT = "/api/order-receipt/viewed";
