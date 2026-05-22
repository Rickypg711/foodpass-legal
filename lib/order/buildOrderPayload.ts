import { serverTimestamp } from "firebase/firestore";
import type { CartLine } from "@/lib/cart/types";
import { resolveInitialOrderStatus } from "@/lib/order/orderLifecycle";
import {
  ORDER_SOURCE_CUSTOMER_WEB,
  PAYMENT_METHOD_MERCADO_PAGO,
  type CustomerOrderPayload,
  type OrderPaymentMethod,
} from "@/lib/types/order";
import { assertCustomerWebPaymentMethod } from "@/lib/order/customerWebCheckoutPolicy";

export type BuildOrderInput = {
  restaurantId: string;
  customerId: string;
  customerName: string;
  pickupPin: string;
  cartLines: CartLine[];
  restaurantName: string;
  restaurantImageUrl?: string | null;
  paymentMethod?: OrderPaymentMethod;
};

/**
 * Builds Firestore order map aligned with Flutter Order.toMap() (Phase 1).
 */
export function buildCustomerWebOrderPayload(
  input: BuildOrderInput,
): CustomerOrderPayload {
  const items = input.cartLines.map((line) => ({
    menuItemId: line.menuItemId,
    name: line.name,
    price: line.price,
    quantity: line.quantity,
    subtotal: line.subtotal,
  }));

  const total = items.reduce((sum, i) => sum + i.subtotal, 0);
  const paymentMethod = assertCustomerWebPaymentMethod(
    input.paymentMethod ?? PAYMENT_METHOD_MERCADO_PAGO,
  );
  const status = resolveInitialOrderStatus({
    orderSource: ORDER_SOURCE_CUSTOMER_WEB,
    paymentMethod,
  });

  const payload: CustomerOrderPayload = {
    restaurantId: input.restaurantId,
    customerId: input.customerId,
    items,
    total,
    paymentMethod,
    paymentStatus: "pending",
    status,
    orderType: "pickup",
    orderSource: ORDER_SOURCE_CUSTOMER_WEB,
    customerName: input.customerName.trim(),
    pickupPin: input.pickupPin,
    createdByUserId: input.customerId,
    createdByName: input.customerName.trim(),
    isOpenTab: false,
    loyaltyAwarded: false,
    createdAt: serverTimestamp(),
  };

  const name = input.restaurantName.trim();
  if (name) {
    payload.restaurantName = name;
  }
  const img = input.restaurantImageUrl?.trim();
  if (img) {
    payload.restaurantImageUrl = img;
  }

  return payload;
}
