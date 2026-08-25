import { serverTimestamp } from "firebase/firestore";
import type { CartLine } from "@/lib/cart/types";
import { resolveInitialOrderStatus } from "@/lib/order/orderLifecycle";
import {
  ORDER_SOURCE_CUSTOMER_WEB,
  ORDER_TYPE_DINE_IN,
  ORDER_TYPE_PICKUP,
  PAYMENT_METHOD_MERCADO_PAGO,
  PAYMENT_METHOD_PAY_AT_PICKUP,
  type CustomerOrderPayload,
  type OrderPaymentMethod,
  type OrderRedemptionRequest,
} from "@/lib/types/order";
import { assertCustomerWebPaymentMethod } from "@/lib/order/customerWebCheckoutPolicy";
import {
  normalizeDiners,
  normalizeTableNumber,
  tableLabel,
} from "@/lib/order/tableSession";

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
  /**
   * Cuenta de la mesa (Etapa 1, docs/PEDIDO_EN_MESA.md): llave que agrupa las
   * rondas de la MISMA mesa en una sola cuenta en la Caja. La resuelve
   * `resolveTableTabId` (server) o la funda `freshTabId`. Solo se escribe
   * cuando la orden ABRE cuenta — una mesa prepagada con MP no es una cuenta.
   */
  tabId?: string | null;
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
    // Lo que el cliente eligió. La forma es exactamente la que la pantalla
    // de Pedidos ya renderiza: { modifierName, selectedOptions[] }.
    if (line.selectedOptions?.length) {
      item.selectedModifiers = line.selectedOptions.map((g) => ({
        modifierName: g.groupName,
        selectedOptions: g.options.map((o) => o.name),
      }));
    }
    // Nota libre por platillo (sin cebolla, término). El vendor ya la pinta.
    const note = line.notes?.trim();
    if (note) item.notes = note;
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

  // Una cuenta abierta es algo que queda POR COBRAR. Un pedido de mesa que ya
  // se pagó con Mercado Pago no lo es: si lo abriéramos igual, se quedaría
  // colgado para siempre en "Cuentas abiertas" de la Caja, pagado, esperando
  // un cobro que nunca va a llegar. Por eso mesa Y sin pagar en línea.
  const abreCuenta =
    Boolean(tableNumber) && paymentMethod === PAYMENT_METHOD_PAY_AT_PICKUP;

  // En la mesa el nombre es opcional. Vacío NO se queda vacío: la pantalla de
  // Pedidos pinta `customerName`, y un pedido sin nombre le llega a la cocina
  // como una tarjeta anónima. "Mesa 5" es exactamente lo que el mesero
  // necesita leer ahí.
  const nombreCapturado = input.customerName.trim();
  const nombreDelPedido =
    nombreCapturado || (tableNumber ? tableLabel(tableNumber) : "");

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
    customerName: nombreDelPedido,
    pickupPin: input.pickupPin,
    createdByUserId: input.customerId,
    createdByName: nombreDelPedido,
    // Comiendo AQUÍ = cuenta abierta. Para llevar = pedido que se cierra solo.
    //
    // POR QUE: en una mesa nadie pide una vez y ya. Pides, comes, pides otra
    // ronda, y pagas AL FINAL. Un pedido de mesa que nace cerrado obliga al
    // mesero a sumar tickets sueltos de cabeza, y deja fuera toda la máquina
    // que ya existe para cobrar una mesa: propina al cierre, teléfono para los
    // puntos, y el canje del premio.
    //
    // `status: "pending"` + `isOpenTab: true` es la forma canónica de una
    // cuenta (ver pos_service.dart §62), y la cocina la SIGUE VIENDO: la
    // pantalla de Pedidos mete `pending` y `open_tab` en la misma columna.
    isOpenTab: abreCuenta,
    loyaltyAwarded: false,
    createdAt: serverTimestamp(),
  };

  if (tableNumber) {
    payload.tableNumber = tableNumber;
    // El nombre con el que el mesero la busca en la Caja. Sin esto la cuenta
    // sale sin nombre y hay que abrirla para saber de qué mesa es.
    // `tableLabel`, NO `Mesa ${n}`: una mesa llamada "Barra" o "Terraza 1"
    // saldría como "Mesa Barra". La misma regla que usa la hoja de QR.
    if (abreCuenta) payload.tabName = tableLabel(tableNumber);
    // tabId agrupa SIN fusionar: la cocina sigue viendo cada ronda como su
    // propio ticket; la Caja suma por tabId ("Mesa 5 · 3 personas · $840").
    const tabId = typeof input.tabId === "string" ? input.tabId.trim() : "";
    if (abreCuenta && tabId) payload.tabId = tabId;
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
