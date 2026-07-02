/** Mirrors lib/models/order.dart (Phase 1 customer pickup). */

export const ORDER_SOURCE_CUSTOMER_WEB = "customer_web" as const;
export const ORDER_SOURCE_CUSTOMER_APP = "customer_app" as const;

export const PAYMENT_METHOD_PAY_AT_PICKUP = "pay_at_pickup" as const;
export const PAYMENT_METHOD_MERCADO_PAGO = "mercado_pago" as const;

export type OrderPaymentMethod =
  | typeof PAYMENT_METHOD_PAY_AT_PICKUP
  | typeof PAYMENT_METHOD_MERCADO_PAGO;

export type OrderItemPayload = {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  subtotal: number;
  selectedModifiers?: unknown[];
  notes?: string | null;
  /** Points-powered upsell metadata (mirrors OrderItem in lib/models/order.dart). */
  isUpsell?: boolean;
  upsellBonusPoints?: number;
  upsellSurprise?: boolean;
};

export type CustomerOrderPayload = {
  restaurantId: string;
  customerId: string;
  items: OrderItemPayload[];
  total: number;
  paymentMethod: OrderPaymentMethod;
  paymentStatus: "pending";
  status: string;
  mercadoPagoPreferenceId?: string;
  orderType: "pickup";
  orderSource: typeof ORDER_SOURCE_CUSTOMER_WEB;
  customerName: string;
  pickupPin: string;
  createdByUserId: string;
  createdByName: string;
  restaurantName?: string;
  restaurantImageUrl?: string;
  isOpenTab: boolean;
  loyaltyAwarded?: boolean;
  createdAt: ReturnType<typeof import("firebase/firestore").serverTimestamp>;
};

export type StoredOrderSnapshot = {
  orderId: string;
  restaurantId: string;
  pickupPin: string;
  customerName: string;
  restaurantName: string;
  total: number;
};
