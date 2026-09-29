/**
 * El reloj de Pedidos: cuánto lleva esperando cada pedido y cuándo recordarlo.
 *
 * POR QUÉ EXISTE (10-sep-2026, La Familia): las ventas de la Caja se quedaban en
 * "Pendientes" horas porque nadie tocaba Comenzar → Listo → Entregado. Ricardo
 * eligió: reloj en cada pedido (naranja a los 10 min, rojo y parpadeando a los
 * 20) y un aviso que suena cada 5 min mientras alguno pase de 20, hasta que se
 * entregue o lo callen. Ruby NO quiso "Entregado directo": el camino de siempre
 * se queda (Comenzar → Terminar → Entregar).
 *
 * ESPEJO EXACTO de `lib/orders/order_aging.dart` en la app. Los números y las
 * palabras son los mismos; `scripts/validate-order-aging.mjs` lee el Dart y
 * truena si se separan.
 *
 * Puro y sin imports con alias: lo prueba el validador con node directo.
 */

export const ORDER_WAIT_WARN_MINUTES = 10;
export const ORDER_WAIT_LATE_MINUTES = 20;
export const ORDER_REMINDER_EVERY_MINUTES = 5;
/** A las 24 h un pedido ya no es "tarde": es VIEJO (apartado, no suena, no cuenta). */
export const ORDER_STALE_MINUTES = 24 * 60;

/** >= 24 h → viejo (apartado). */
export function isStaleOrder(minutes: number): boolean {
  return minutes >= ORDER_STALE_MINUTES;
}

export type OrderWaitLevel = "ok" | "warn" | "late";

/** Minutos completos desde que se creó el pedido; nunca negativo. */
export function orderWaitingMinutes(createdAtMs: number, nowMs: number): number {
  if (!Number.isFinite(createdAtMs) || !Number.isFinite(nowMs)) return 0;
  return Math.max(0, Math.floor((nowMs - createdAtMs) / 60000));
}

/** >= 20 → late; >= 10 → warn; si no, ok. */
export function orderWaitLevel(minutes: number): OrderWaitLevel {
  if (minutes >= ORDER_WAIT_LATE_MINUTES) return "late";
  if (minutes >= ORDER_WAIT_WARN_MINUTES) return "warn";
  return "ok";
}

/**
 * Solo cuenta lo que sigue en la bandeja: pendiente, en cocina o listo. Las
 * cuentas abiertas NUNCA: una mesa se queda abierta a propósito.
 */
export function isWaitingOrder(p: { status?: string | null; isOpenTab?: boolean | null }): boolean {
  if (p.isOpenTab === true || p.status === "open_tab") return false;
  return p.status === "pending" || p.status === "preparing" || p.status === "ready";
}

/**
 * Lo que dice la tarjeta: un reloj, no un regaño (29-sep-2026). "Ahora",
 * "12 min", "1 h 5 min", "3 d". La pregunta "¿ya lo entregaste?" vive UNA
 * vez, en el letrero de arriba (lateOrdersBanner).
 */
export function orderWaitLabel(minutes: number): string {
  if (minutes < 1) return "Ahora";
  if (minutes < 60) return `${minutes} min`;
  if (minutes < ORDER_STALE_MINUTES) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m === 0 ? `${h} h` : `${h} h ${m} min`;
  }
  return `${Math.floor(minutes / ORDER_STALE_MINUTES)} d`;
}

/** ¿Suena otra vez? Sí si hay alguno en rojo y ya pasaron 5 min del último aviso. */
export function shouldRemindLateOrders(p: {
  lateCount: number;
  lastRemindAtMs: number | null;
  nowMs: number;
}): boolean {
  if (p.lateCount <= 0) return false;
  if (p.lastRemindAtMs === null) return true;
  return p.nowMs - p.lastRemindAtMs >= ORDER_REMINDER_EVERY_MINUTES * 60000;
}

/** El letrero de arriba cuando hay pedidos en rojo. */
export function lateOrdersBanner(lateCount: number): string {
  return lateCount === 1
    ? "1 pedido lleva más de 20 min. ¿Ya lo entregaste?"
    : `${lateCount} pedidos llevan más de 20 min. ¿Ya los entregaste?`;
}
