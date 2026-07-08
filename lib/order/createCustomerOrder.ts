import { addDoc, collection } from "firebase/firestore";
import { ensureAnonymousUser } from "@/lib/auth";
import { getFirebaseDb } from "@/lib/firebase";
import { buildCustomerWebOrderPayload } from "@/lib/order/buildOrderPayload";
import {
  ORDER_SOURCE_CUSTOMER_WEB,
  type OrderPaymentMethod,
} from "@/lib/types/order";
import { generatePickupPin } from "@/lib/order/pickupPin";
import { saveOrderSnapshot } from "@/lib/order/orderSessionStorage";
import type { CartLine } from "@/lib/cart/types";

export type CreateOrderResult = {
  orderId: string;
  pickupPin: string;
  customerName: string;
  total: number;
};

export async function createCustomerWebOrder(params: {
  restaurantId: string;
  customerName: string;
  customerPhone?: string;
  cartLines: CartLine[];
  restaurantName: string;
  restaurantImageUrl?: string | null;
  paymentMethod?: OrderPaymentMethod;
  redemptionRequest?: import("@/lib/types/order").OrderRedemptionRequest | null;
}): Promise<CreateOrderResult> {
  const user = await ensureAnonymousUser();
  const pickupPin = generatePickupPin();

  const payload = buildCustomerWebOrderPayload({
    restaurantId: params.restaurantId,
    customerId: user.uid,
    customerName: params.customerName,
    customerPhone: params.customerPhone,
    redemptionRequest: params.redemptionRequest,
    pickupPin,
    cartLines: params.cartLines,
    restaurantName: params.restaurantName,
    restaurantImageUrl: params.restaurantImageUrl,
    paymentMethod: params.paymentMethod,
  });

  if (payload.orderSource !== ORDER_SOURCE_CUSTOMER_WEB) {
    throw new Error(
      `orderSource must be ${ORDER_SOURCE_CUSTOMER_WEB}, got ${String(payload.orderSource)}`,
    );
  }

  const db = getFirebaseDb();
  const ref = await addDoc(
    collection(db, "restaurants", params.restaurantId, "orders"),
    payload,
  );

  saveOrderSnapshot({
    orderId: ref.id,
    restaurantId: params.restaurantId,
    pickupPin,
    customerName: params.customerName.trim(),
    restaurantName: params.restaurantName,
    total: payload.total,
  });

  return {
    orderId: ref.id,
    pickupPin,
    customerName: params.customerName.trim(),
    total: payload.total,
  };
}
