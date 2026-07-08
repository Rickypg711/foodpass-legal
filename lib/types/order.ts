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

/** Customer-side reward redemption REQUEST riding on the order. Unprivileged:
 * the deduction executes vendor-side at cobro, inside the credit transaction,
 * with a live balance re-check — a faked request simply fails there. */
export type OrderRedemptionRequest = {
  tierId: string;
  name: string;
  points: number;
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
  /** Customer WhatsApp/phone, digits only (e.g. "6141234567"). Required at
   * checkout for BOTH methods — contact for the order + future loyalty capture. */
  customerPhone?: string;
  redemptionRequest?: OrderRedemptionRequest;
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
