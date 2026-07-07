import { evaluateRestaurantMpEligibility } from "@/lib/mercadoPago/restaurantEligibility";
import {
  PAYMENT_METHOD_MERCADO_PAGO,
  PAYMENT_METHOD_PAY_AT_PICKUP,
  type OrderPaymentMethod,
} from "@/lib/types/order";

export const CUSTOMER_WEB_PAYMENT_METHOD = PAYMENT_METHOD_MERCADO_PAGO;

export const MP_UNAVAILABLE_MESSAGE =
  "Este restaurante todavía no tiene pagos en línea activos. Intenta más tarde.";

export const ORDERING_UNAVAILABLE_MESSAGE =
  "Este restaurante todavía no acepta pedidos en línea. Intenta más tarde.";

export function restaurantSupportsWebCheckout(
  restaurantId: string,
  data: Record<string, unknown> | undefined,
): boolean {
  return evaluateRestaurantMpEligibility(restaurantId, data).eligible;
}

/**
 * Per-vendor opt-in for "Pagar al recoger" (cash/card at the counter).
 * STRATEGY_MENU_FIRST_AND_PHONE_LOYALTY.md §3 Step 1: vendor toggle, off by
 * default — the vendor chooses their no-show risk. Points are NOT awarded at
 * order time for this method; loyalty credits only when the vendor marks the
 * order cobrada (paymentStatus: "paid" via vendor pedidos/POS).
 */
export function restaurantAllowsPayAtPickup(
  data: Record<string, unknown> | undefined,
): boolean {
  return data?.payAtPickupEnabled === true;
}

export function mercadoPagoCheckoutTitle(sandboxMode: boolean): string {
  return sandboxMode
    ? "Pagar en línea con Mercado Pago (sandbox)"
    : "Pagar en línea con Mercado Pago";
}

export function mercadoPagoCheckoutSubtitle(sandboxMode: boolean): string {
  return sandboxMode
    ? "Sandbox — tarjeta de prueba en Mercado Pago"
    : "Pago seguro antes de preparar tu pedido";
}

/**
 * Customer web checkout accepts exactly two methods:
 *  - mercado_pago  → order starts as payment_pending until MP confirms
 *  - pay_at_pickup → order starts as pending; vendor charges at the counter
 * Anything else is rejected. The per-restaurant gating (MP eligibility /
 * payAtPickupEnabled) is enforced by the checkout UI, which only offers the
 * methods the restaurant supports.
 */
export function assertCustomerWebPaymentMethod(
  method: string,
): OrderPaymentMethod {
  if (method === PAYMENT_METHOD_MERCADO_PAGO) return PAYMENT_METHOD_MERCADO_PAGO;
  if (method === PAYMENT_METHOD_PAY_AT_PICKUP) return PAYMENT_METHOD_PAY_AT_PICKUP;
  throw new Error("customer_web_checkout_invalid_payment_method");
}
