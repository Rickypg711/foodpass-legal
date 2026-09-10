// 🛵 Entrega a domicilio — LA verdad de "¿este local entrega?" y del copy
// que ve el comensal cuando elige que se lo lleven. Archivo SIN imports con
// alias para poder ejecutarse en los tests de node
// (scripts/validate-delivery.mjs). Espejo Dart pendiente: viaja en el +53.
//
// POR QUÉ EXISTE (9-sep-2026): Central Fast Food (Las Matas de Farfán, RD)
// es un negocio de pedidos a domicilio: la gente pide por la liga, paga en
// efectivo o transferencia y el dueño entrega. Todo le entraba como "para
// recoger" porque no había otra opción, y una clienta escribió "Daly dígale
// a Harol" en el campo del NOMBRE para dejar el recado de entrega. Zahir
// pidió por WhatsApp "el que entrega los pedidos a las personas".
//
// DISEÑO MÍNIMO A PROPÓSITO: un toggle del dueño, una opción en el checkout
// y UNA caja de texto libre para la dirección. Sin mapa, sin zonas, sin
// validar calle+número: en su pueblo la dirección es "casa azul frente al
// colmado", y su pin sigue en lat 0. El dueño la lee en Pedidos y ya.

import type { PaymentMethod } from "../pos/paidOrderFields";

/** Cómo quiere el comensal su pedido cuando NO está en una mesa. */
export type Fulfillment = "pickup" | "delivery";

/** Tope sano para una dirección escrita a mano: cabe una referencia larga,
 *  no cabe un ensayo. */
export const DELIVERY_ADDRESS_MAX = 240;
/** Menos que esto no es una dirección ("aquí", "ya sabes"). */
export const DELIVERY_ADDRESS_MIN = 5;

/**
 * ¿Este local entrega a domicilio? Lee `restaurants/{id}.deliveryEnabled`.
 * Sin campo = NO (default apagado: es trabajo del dueño y no se lo inventamos
 * a los 23 locales que no lo pidieron).
 */
export function restaurantOffersDelivery(data: unknown): boolean {
  const d = data as { deliveryEnabled?: unknown } | null | undefined;
  return d?.deliveryEnabled === true;
}

/**
 * Costo de envío fijo del local (`deliveryFee`). 0 = no cobra envío (o nunca
 * lo puso). Se SUMA al total del pedido para que "¿Ya te pagó?" cobre lo
 * correcto y los puntos salgan del total real.
 */
export function deliveryFeeOf(data: unknown): number {
  const d = data as { deliveryFee?: unknown } | null | undefined;
  const n = Number(d?.deliveryFee);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0;
}

/** "¿Hasta dónde entregas?" — texto libre del dueño que el comensal ve al
 *  elegir A domicilio ("Solo dentro de la ciudad"). Vacío = no se enseña. */
export function deliveryZoneOf(data: unknown): string {
  const d = data as { deliveryZone?: unknown } | null | undefined;
  return typeof d?.deliveryZone === "string" ? d.deliveryZone.trim() : "";
}

/** La dirección como se guarda: sin espacios dobles ni saltos, con tope. */
export function normalizeDeliveryAddress(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.replace(/\s+/g, " ").trim().slice(0, DELIVERY_ADDRESS_MAX);
}

/** ¿Alcanza para que alguien encuentre la casa? */
export function isUsableDeliveryAddress(raw: unknown): boolean {
  return normalizeDeliveryAddress(raw).length >= DELIVERY_ADDRESS_MIN;
}

/**
 * Copy de cada forma de pago cuando el pedido va A DOMICILIO. Espejo de
 * PICKUP_CHOICE_COPY pero dice la verdad de cómo pasa: nadie va al
 * mostrador, el dinero cambia de manos en la puerta (o antes, por
 * transferencia).
 */
export const DELIVERY_CHOICE_COPY: Record<PaymentMethod, { title: string; sub: string; cta: string }> = {
  cash: {
    title: "Efectivo al recibir",
    sub: "Pagas en tu puerta cuando te lo entreguen",
    cta: "Efectivo al recibir",
  },
  card: {
    title: "Tarjeta al recibir",
    sub: "Pagas con la terminal cuando te lo entreguen",
    cta: "Tarjeta al recibir",
  },
  transfer: {
    title: "Transferencia",
    sub: "Antes o al recibir. El local la confirma al entregarte",
    cta: "Por transferencia",
  },
};

/** Línea bajo el total en la página del pedido a domicilio. */
export function deliveryPaymentLine(method: unknown): string {
  switch (method) {
    case "cash":
      return "💵 Pagas en efectivo al recibir tu pedido";
    case "card":
      return "💳 Pagas con tarjeta al recibir tu pedido";
    case "transfer":
      return "🏦 Pagas por transferencia, antes o al recibir";
    default:
      return "💵 Pagas al recibir tu pedido";
  }
}
