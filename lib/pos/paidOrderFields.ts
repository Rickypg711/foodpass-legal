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
 * 🎚️ Las formas de pago que ESTE restaurante acepta, en orden canónico.
 * Lee `restaurants/{id}.paymentMethods` (string[]). Sin campo, vacío o sin
 * nada válido → las tres (nadie se queda sin botones por un doc viejo).
 *
 * Nació el 5-sep-2026 cuando Central Fast Food (RD) pidió quitar Tarjeta:
 * no tiene terminal. Espejo Dart: acceptedPaymentMethods en
 * lib/orders/paid_order_update.dart.
 */
export function acceptedPaymentMethods(data: unknown): PaymentMethod[] {
  const all = POS_PAYMENT_OPTIONS.map((o) => o.key);
  const raw = (data as { paymentMethods?: unknown } | null | undefined)?.paymentMethods;
  if (!Array.isArray(raw)) return all;
  const wanted = new Set(raw.map((v) => String(v).trim().toLowerCase()));
  const kept = all.filter((k) => wanted.has(k));
  return kept.length > 0 ? kept : all;
}

/** Las opciones (emoji + nombre) que sí se le enseñan al cajero. */
export function acceptedPaymentOptions(data: unknown) {
  const keys = acceptedPaymentMethods(data);
  return POS_PAYMENT_OPTIONS.filter((o) => keys.includes(o.key));
}

/**
 * "Efectivo o transferencia", "Efectivo, tarjeta o transferencia" — para el
 * copy que le dice al cliente cómo puede pagar en el local.
 */
/**
 * Lo que el comensal DIJO que va a hacer al recoger ("pickupPaymentMethod").
 * Copy para su página de pedido y para el app. Sin dato (pedidos viejos, o
 * el dueño solo acepta una forma) → la línea genérica de siempre.
 */
export function pickupPaymentLine(method: unknown): string {
  switch (method) {
    case "cash":
      return "💵 Pagas en efectivo al recoger";
    case "card":
      return "💳 Pagas con tarjeta al recoger";
    case "transfer":
      return "🏦 Pagas por transferencia al recoger";
    default:
      return "💵 Pagas al recoger en el local";
  }
}

/**
 * Ya cobrado: el recibo dice CÓMO se pagó (lo que registró el cajero en
 * paymentMethod). Sin método reconocido → línea genérica.
 */
export function paidWithLine(method: unknown): string {
  switch (method) {
    case "cash":
      return "💵 Pagado en efectivo";
    case "card":
      return "💳 Pagado con tarjeta";
    case "transfer":
      return "🏦 Pagado por transferencia";
    case "mercado_pago":
      return "💳 Pagado en línea con Mercado Pago";
    default:
      return "✅ Pagado";
  }
}

export function paymentMethodsSentence(methods: readonly PaymentMethod[]): string {
  const labels = POS_PAYMENT_OPTIONS.filter((o) => methods.includes(o.key)).map((o) => o.label);
  if (labels.length === 0) return "";
  const lower = labels.map((l, i) => (i === 0 ? l : l.toLowerCase()));
  if (lower.length === 1) return lower[0];
  return `${lower.slice(0, -1).join(", ")} o ${lower[lower.length - 1]}`;
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
