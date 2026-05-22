import { evaluateRestaurantMpEligibility } from "@/lib/mercadoPago/restaurantEligibility";
import { PAYMENT_METHOD_MERCADO_PAGO } from "@/lib/types/order";

export const CUSTOMER_WEB_PAYMENT_METHOD = PAYMENT_METHOD_MERCADO_PAGO;

export const MP_UNAVAILABLE_MESSAGE =
  "Este restaurante todavía no tiene pagos en línea activos. Intenta más tarde.";

export function restaurantSupportsWebCheckout(
  restaurantId: string,
  data: Record<string, unknown> | undefined,
): boolean {
  return evaluateRestaurantMpEligibility(restaurantId, data).eligible;
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

/** Web checkout must never submit pay-at-pickup. */
export function assertCustomerWebPaymentMethod(method: string): typeof PAYMENT_METHOD_MERCADO_PAGO {
  if (method !== PAYMENT_METHOD_MERCADO_PAGO) {
    throw new Error("customer_web_checkout_requires_mercado_pago");
  }
  return PAYMENT_METHOD_MERCADO_PAGO;
}
