// ⚖️ LA definición de "pagado" — el corazón de la Etapa 2, en archivo propio
// SIN imports con alias para poder ejecutarse en los tests de node
// (validate-register-payment.mjs). La capa con transacciones y puntos vive
// en registerPayment.ts. Espejo Dart: lib/orders/paid_order_update.dart.

import { serverTimestamp } from "firebase/firestore";

export type PaymentMethod = "cash" | "card";

/**
 * Campos canónicos de "pagado". `close: true` además completa el pedido
 * (cierre de cuenta); el cobro rápido NO completa — la cocina sigue su flujo.
 */
export function paidOrderFields(
  method: PaymentMethod | string,
  opts: { close?: boolean } = {},
): Record<string, unknown> {
  return {
    paymentStatus: "paid",
    paymentMethod: method,
    // Una cuenta abierta es algo POR COBRAR: pagada, sale de Cuentas — esto
    // es lo que evita el doble cobro (la Caja ya no la suma al grupo).
    isOpenTab: false,
    updatedAt: serverTimestamp(),
    ...(opts.close
      ? { status: "completed", completedAt: serverTimestamp() }
      : {}),
  };
}
