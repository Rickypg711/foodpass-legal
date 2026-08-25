import { addDoc, collection } from "firebase/firestore";
import { ensureAnonymousUser } from "@/lib/auth";
import { getFirebaseDb } from "@/lib/firebase";
import { buildCustomerWebOrderPayload } from "@/lib/order/buildOrderPayload";
import { freshTabId, resolveTableTabId } from "@/lib/order/tableTab";
import { normalizeTableNumber } from "@/lib/order/tableSession";
import {
  ORDER_SOURCE_CUSTOMER_WEB,
  PAYMENT_METHOD_PAY_AT_PICKUP,
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
  /** Mesa del QR (?mesa=). Si viene, la orden se marca dine_in. */
  tableNumber?: string | null;
  /** Personas en la mesa. Solo dine_in. */
  diners?: number | null;
}): Promise<CreateOrderResult> {
  const user = await ensureAnonymousUser();
  const pickupPin = generatePickupPin();

  // Cuenta de mesa (Etapa 1, docs/PEDIDO_EN_MESA.md): solo cuando esta ronda
  // ABRE cuenta — mesa Y pagar-al-recoger, el espejo exacto de `abreCuenta`
  // en buildOrderPayload (prepagada con MP no es cuenta). El servidor dice a
  // qué cuenta colgarse; si no hay (o no contesta), esta ronda la FUNDA con
  // una llave fresca. Nunca bloquea el pedido.
  const mesaNormalizada = normalizeTableNumber(params.tableNumber ?? "");
  const abreCuenta =
    Boolean(mesaNormalizada) &&
    params.paymentMethod === PAYMENT_METHOD_PAY_AT_PICKUP;
  const tabId = abreCuenta
    ? (await resolveTableTabId(params.restaurantId, mesaNormalizada)) ??
      freshTabId()
    : null;

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
    tableNumber: params.tableNumber,
    diners: params.diners,
    tabId,
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
