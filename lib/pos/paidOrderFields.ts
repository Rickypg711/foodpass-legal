// ⚖️ LA definición de "pagado" — el corazón de la Etapa 2, en archivo propio
// SIN imports con alias para poder ejecutarse en los tests de node
// (validate-register-payment.mjs). La capa con transacciones y puntos vive
// en registerPayment.ts. Espejo Dart: lib/orders/paid_order_update.dart.

import { serverTimestamp } from "firebase/firestore";

// 🏦 "transfer" desde el 5-sep-2026: el primer dueño dominicano (Central
// Fast Food) cobra por transferencia bancaria y la Caja lo obligaba a mentir
// (tarjeta rompía propinas/reportes; efectivo rompía el corte). En MX es la
// misma realidad con SPEI. Espejo Dart: lib/orders/paid_order_update.dart.
export type PaymentMethod = "cash" | "card" | "transfer";

/**
 * LAS opciones que la Caja, Pedidos y el cierre de cuenta le enseñan al
 * cajero — en orden. Un solo lugar para que ninguna pantalla se quede con
 * dos botones cuando hay tres formas reales de recibir dinero.
 */
export const POS_PAYMENT_OPTIONS: readonly {
  key: PaymentMethod;
  emoji: string;
  label: string;
}[] = [
  { key: "cash", emoji: "💵", label: "Efectivo" },
  { key: "card", emoji: "💳", label: "Tarjeta" },
  { key: "transfer", emoji: "🏦", label: "Transferencia" },
];

/**
 * Propina: ¿ya la tiene el mesero en la mano? Solo en efectivo. Tarjeta y
 * transferencia caen en la cuenta del negocio y el dueño se la debe al
 * equipo — por eso Reportes las suma juntas.
 */
export function tipStaysWithStaff(method: unknown): boolean {
  return method === "cash";
}

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
