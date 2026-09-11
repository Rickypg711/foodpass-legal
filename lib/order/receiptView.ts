/**
 * Vista de RECIBO de un pedido de la Caja, para quien abre el link que le llegó
 * por WhatsApp ("Tu recibo y tus puntos").
 *
 * POR QUÉ EXISTE (10-sep-2026, La Familia): la venta de la Caja la crea el
 * restaurante y no trae `customerId`, así que las reglas (dueño del pedido o el
 * local) le niegan la lectura al cliente: el link del recibo NUNCA abrió en su
 * teléfono ("No pudimos cargar tu pedido"). El servidor lee con Admin SDK y
 * regresa SOLO esto. Es allowlist, no denylist: un campo nuevo en el pedido no
 * se publica solo.
 *
 * Fuera a propósito: `pickupPin` (con él otro recogería el pedido),
 * `deliveryAddress`, notas del pedido, quién cobró, `customerId`, descuentos y
 * propina. Del nombre, solo el primero.
 *
 * `customerPhone` SÍ va: la tarjeta de puntos manda el SMS a ese número y enseña
 * el saldo solo después de verificarlo (en pantalla sale "614 ··· 41"); el link
 * salió al WhatsApp de ese mismo número.
 *
 * Solo pedidos de la Caja (`orderSource: "pos"`): los del menú web ya abren con
 * la sesión de quien los hizo.
 *
 * Puro y sin imports con alias: lo prueba scripts/validate-order-receipt.mjs.
 */

export type ReceiptItem = {
  name: string;
  quantity: number;
  subtotal: number;
  isUpsell?: boolean;
  upsellBonusPoints?: number;
  selectedModifiers?: { modifierName: string; selectedOptions: string[] }[];
  /** Nota por platillo ("sin cebolla"): es parte de lo que compró. */
  notes?: string;
};

export type ReceiptView = {
  orderSource: "pos";
  status?: string;
  paymentStatus?: string;
  paymentMethod?: string;
  orderType?: string;
  tableNumber?: string;
  total?: number;
  loyaltyAwarded?: boolean;
  redemptionRequest?: { tierId: string; name: string; points: number };
  redemptionResult?: string;
  customerName?: string;
  customerPhone?: string;
  restaurantName?: string;
  items: ReceiptItem[];
};

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

function num(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

function item(raw: unknown): ReceiptItem | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const name = str(r.name);
  if (!name) return null;
  const out: ReceiptItem = {
    name,
    quantity: num(r.quantity) ?? 1,
    subtotal: num(r.subtotal) ?? 0,
  };
  if (r.isUpsell === true) out.isUpsell = true;
  const bonus = num(r.upsellBonusPoints);
  if (bonus !== undefined) out.upsellBonusPoints = bonus;
  if (Array.isArray(r.selectedModifiers)) {
    const mods = r.selectedModifiers.flatMap((m) => {
      if (!m || typeof m !== "object") return [];
      const mm = m as Record<string, unknown>;
      const modifierName = str(mm.modifierName);
      const opts = Array.isArray(mm.selectedOptions)
        ? mm.selectedOptions.filter((o): o is string => typeof o === "string" && o.trim().length > 0)
        : [];
      return modifierName && opts.length > 0 ? [{ modifierName, selectedOptions: opts }] : [];
    });
    if (mods.length > 0) out.selectedModifiers = mods;
  }
  const notes = str(r.notes);
  if (notes) out.notes = notes;
  return out;
}

/** `null` = no hay recibo público para este pedido (no es de la Caja o no existe). */
export function receiptViewFromOrder(
  order: Record<string, unknown> | undefined | null,
  restaurantName?: unknown,
): ReceiptView | null {
  if (!order || order.orderSource !== "pos") return null;

  const view: ReceiptView = {
    orderSource: "pos",
    items: (Array.isArray(order.items) ? order.items : [])
      .map(item)
      .filter((i): i is ReceiptItem => i !== null),
  };

  const status = str(order.status);
  if (status) view.status = status;
  const paymentStatus = str(order.paymentStatus);
  if (paymentStatus) view.paymentStatus = paymentStatus;
  const paymentMethod = str(order.paymentMethod);
  if (paymentMethod) view.paymentMethod = paymentMethod;
  const orderType = str(order.orderType);
  if (orderType) view.orderType = orderType;
  const tableNumber = str(order.tableNumber);
  if (tableNumber) view.tableNumber = tableNumber;
  const total = num(order.total);
  if (total !== undefined) view.total = total;
  if (typeof order.loyaltyAwarded === "boolean") view.loyaltyAwarded = order.loyaltyAwarded;

  const rr = order.redemptionRequest;
  if (rr && typeof rr === "object") {
    const r = rr as Record<string, unknown>;
    const name = str(r.name);
    const points = num(r.points);
    if (name && points !== undefined) {
      view.redemptionRequest = { tierId: str(r.tierId) ?? "", name, points };
    }
  }
  const redemptionResult = str(order.redemptionResult);
  if (redemptionResult) view.redemptionResult = redemptionResult;

  const firstName = str(order.customerName)?.split(/\s+/)[0];
  if (firstName) view.customerName = firstName;
  const phone = str(order.customerPhone);
  if (phone) view.customerPhone = phone;

  const rName = str(order.restaurantName) ?? str(restaurantName);
  if (rName) view.restaurantName = rName;

  return view;
}
