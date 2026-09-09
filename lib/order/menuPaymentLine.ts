/**
 * La línea chica bajo el nombre en /menu (9-sep-2026).
 *
 * POR QUÉ EXISTE: decía "Ordena en línea · Pago seguro con Mercado Pago" a
 * TODO local con pedidos en línea — también a Mi Ángel, que solo tiene
 * "pagar al recoger" y jamás conectó Mercado Pago (cazado por Ricardo).
 * Regla de la casa: jamás prometer lo que no existe. La línea dice lo que el
 * local de verdad ofrece, y nada más.
 */

import {
  restaurantAllowsPayAtPickup,
  restaurantSupportsWebCheckout,
} from "@/lib/order/customerWebCheckoutPolicy";

export const LINE_MENU_ONLY = "Menú en línea";
export const LINE_MP = "Ordena en línea · Pago seguro con Mercado Pago";
export const LINE_PICKUP = "Ordena en línea · Pagas al recoger";
export const LINE_MP_AND_PICKUP = "Ordena en línea · Paga en línea o al recoger";

export function menuPaymentLine(args: {
  restaurantId: string;
  rdata: Record<string, unknown> | null | undefined;
  closedNow: boolean;
  webOrderingReady: boolean;
  webOrderingAvailable: boolean;
}): string | null {
  const { restaurantId, rdata, closedNow, webOrderingReady, webOrderingAvailable } = args;
  if (closedNow) return LINE_MENU_ONLY;
  if (!webOrderingReady) return null;
  if (!webOrderingAvailable) return LINE_MENU_ONLY;
  const mp = restaurantSupportsWebCheckout(restaurantId, rdata ?? undefined);
  const pickup = restaurantAllowsPayAtPickup(rdata ?? undefined);
  if (mp && pickup) return LINE_MP_AND_PICKUP;
  if (mp) return LINE_MP;
  if (pickup) return LINE_PICKUP;
  return LINE_MENU_ONLY;
}
