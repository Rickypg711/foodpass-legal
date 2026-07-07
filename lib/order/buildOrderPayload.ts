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
  /** Digits-only customer phone/WhatsApp (already normalized by the caller). */
  customerPhone?: string;
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
  const items = input.cartLines.map((line) => {
    const item: CustomerOrderPayload["items"][number] = {
      menuItemId: line.menuItemId,
      name: line.name,
      price: line.price,
      quantity: line.quantity,
      subtotal: line.subtotal,
    };
    // Points-powered upsell: carry the server-decided bonus onto the order so
    // it's credited at loyalty award time (order scan). Never a discount.
    if (line.isUpsell) {
      item.isUpsell = true;
      const bonus = Math.floor(line.upsellBonusPoints ?? 0);
      if (bonus > 0) item.upsellBonusPoints = bonus;
      if (line.upsellSurprise) item.upsellSurprise = true;
    }
    return item;
  });

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

  const phone = input.customerPhone?.replace(/\D/g, "") ?? "";
  if (phone) {
    payload.customerPhone = phone;
  }

  return payload;
}
