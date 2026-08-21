import { serverTimestamp } from "firebase/firestore";
import type { CartLine } from "@/lib/cart/types";
import { resolveInitialOrderStatus } from "@/lib/order/orderLifecycle";
import {
  ORDER_SOURCE_CUSTOMER_WEB,
  ORDER_TYPE_DINE_IN,
  ORDER_TYPE_PICKUP,
  PAYMENT_METHOD_MERCADO_PAGO,
  type CustomerOrderPayload,
  type OrderPaymentMethod,
  type OrderRedemptionRequest,
} from "@/lib/types/order";
import { assertCustomerWebPaymentMethod } from "@/lib/order/customerWebCheckoutPolicy";
import { normalizeDiners, normalizeTableNumber } from "@/lib/order/tableSession";

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
  redemptionRequest?: OrderRedemptionRequest | null;
  /** Mesa del QR (?mesa=). Si viene, la orden es dine_in en vez de pickup. */
  tableNumber?: string | null;
  /** Cuántas personas en la mesa. Solo aplica en dine_in. */
  diners?: number | null;
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

  // La mesa manda el modo de servicio: con mesa es dine_in, sin mesa es pickup.
  // El pickupPin se sigue generando SIEMPRE — en dine_in sirve de folio corto
  // para que el mesero cante el pedido sin leer un id de Firestore.
  const tableNumber = normalizeTableNumber(input.tableNumber ?? "");
  const orderType = tableNumber ? ORDER_TYPE_DINE_IN : ORDER_TYPE_PICKUP;

  const payload: CustomerOrderPayload = {
    restaurantId: input.restaurantId,
    customerId: input.customerId,
    items,
    total,
    paymentMethod,
    paymentStatus: "pending",
    status,
    orderType,
    orderSource: ORDER_SOURCE_CUSTOMER_WEB,
    customerName: input.customerName.trim(),
    pickupPin: input.pickupPin,
    createdByUserId: input.customerId,
    createdByName: input.customerName.trim(),
    isOpenTab: false,
    loyaltyAwarded: false,
    createdAt: serverTimestamp(),
  };

  if (tableNumber) {
    payload.tableNumber = tableNumber;
    const diners = normalizeDiners(input.diners ?? null);
    if (diners != null) payload.diners = diners;
  }

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

  const r = input.redemptionRequest;
  if (r && r.tierId && r.name && Number.isFinite(r.points) && r.points > 0) {
    payload.redemptionRequest = {
      tierId: r.tierId,
      name: r.name,
      points: Math.floor(r.points),
    };
  }

  return payload;
}
