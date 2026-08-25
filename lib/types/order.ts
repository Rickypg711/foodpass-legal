/** Mirrors lib/models/order.dart (Phase 1 customer pickup). */

export const ORDER_SOURCE_CUSTOMER_WEB = "customer_web" as const;
export const ORDER_SOURCE_CUSTOMER_APP = "customer_app" as const;

/** Modo de servicio. `dine_in` = el comensal pidió desde el QR de su mesa.
 *  El POS del vendor ya usaba "in_store" para su propia venta de mostrador;
 *  eso NO se toca — esto es el pedido que hace el comensal desde la mesa. */
export const ORDER_TYPE_PICKUP = "pickup" as const;
export const ORDER_TYPE_DINE_IN = "dine_in" as const;

export type CustomerOrderType =
  | typeof ORDER_TYPE_PICKUP
  | typeof ORDER_TYPE_DINE_IN;

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
  orderType: CustomerOrderType;
  /** Mesa del comensal cuando `orderType === "dine_in"` (viene del QR ?mesa=).
   *  String y no número a propósito: en la vida real hay "Barra" y "Terraza 2". */
  tableNumber?: string;
  /** Cuántas personas hay en la mesa. Opcional — el comensal puede no decirlo. */
  diners?: number;
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

  /** Nombre de la cuenta en la Caja ("Mesa 5"). Solo en dine_in. */
  tabName?: string;
  /** Cuenta de la mesa (Etapa 1): agrupa las rondas de la MISMA mesa en una
   * fila de la Caja sin fusionar tickets. Solo cuando la orden abre cuenta. */
  tabId?: string;
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
