import {
  ORDER_SOURCE_CUSTOMER_WEB,
  PAYMENT_METHOD_MERCADO_PAGO,
  PAYMENT_METHOD_PAY_AT_PICKUP,
  type OrderPaymentMethod,
} from "@/lib/types/order";

export const ORDER_STATUS_PAYMENT_PENDING = "payment_pending" as const;
export const ORDER_STATUS_PENDING = "pending" as const;

export function isOnlineMercadoPagoPaymentMethod(
  paymentMethod: string,
): boolean {
  return (
    paymentMethod === PAYMENT_METHOD_MERCADO_PAGO ||
    paymentMethod === "mercadoPago" ||
    paymentMethod === "app"
  );
}

/** Mirrors lib/orders/order_lifecycle.dart resolveInitialOrderStatus for customer_web. */
export function resolveInitialOrderStatus(params: {
  orderSource: string;
  paymentMethod: OrderPaymentMethod;
}): string {
  if (params.orderSource === ORDER_SOURCE_CUSTOMER_WEB) {
    if (params.paymentMethod === PAYMENT_METHOD_PAY_AT_PICKUP) {
      return ORDER_STATUS_PENDING;
    }
    if (isOnlineMercadoPagoPaymentMethod(params.paymentMethod)) {
      return ORDER_STATUS_PAYMENT_PENDING;
    }
  }
  return ORDER_STATUS_PENDING;
}
