/**
 * El precio de un pedido del comensal lo pone el servidor (10-oct-2026).
 *
 * La cuenta vive en `orderPricing.cjs`, que es el MISMO archivo que
 * FOODPASS/functions/order_pricing.js (candado: `npm run test:order-pricing`).
 * Aquí solo están los tipos y la lectura del menú con el Admin SDK, para la
 * ruta que arma la preferencia de Mercado Pago. Flujo completo en
 * FOODPASS/docs/PRECIO_EN_SERVIDOR_10_OCT.md.
 */
import type { Firestore } from "firebase-admin/firestore";
import pricingCore from "./orderPricing.cjs";

export type PricedLine = {
  menuItemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
};

export type OrderPricing = {
  version: number;
  /** false = no se pudo poner precio (platillo que ya no existe, cantidad rara). */
  priceable: boolean;
  /** false = tiene precio pero hoy no se vende así (platillo apagado, opción agotada, no entrega). */
  available: boolean;
  currency: string;
  lines: PricedLine[];
  itemsTotal: number | null;
  deliveryFee: number | null;
  serverTotal: number | null;
  clientTotal: number | null;
  /** El teléfono mandó otro precio (o no se pudo calcular). */
  mismatch: boolean;
  reasons: string[];
};

export type PricingAudit = Omit<OrderPricing, "lines"> & {
  by: "create_preference" | "create_preference_rejected" | "order_created" | "webhook";
  corrected: boolean;
};

type OrderDoc = Record<string, unknown>;

type PricingCore = {
  MAX_LINES: number;
  isCustomerOrder(order: OrderDoc | null | undefined): boolean;
  toCents(v: unknown): number;
  priceCustomerOrder(input: {
    order: OrderDoc;
    menuById: Record<string, OrderDoc>;
    restaurant: OrderDoc | null | undefined;
  }): OrderPricing;
  buildPricingAudit(
    pricing: OrderPricing,
    opts: { by: PricingAudit["by"]; corrected: boolean },
  ): PricingAudit;
  commissionFieldsFor(order: OrderDoc, total: number, rate: number): Record<string, number>;
  correctedOrderFields(order: OrderDoc, pricing: OrderPricing): Record<string, unknown>;
};

const core = pricingCore as unknown as PricingCore;

export const isCustomerOrder = core.isCustomerOrder;
export const buildPricingAudit = core.buildPricingAudit;
export const commissionFieldsFor = core.commissionFieldsFor;
export const correctedOrderFields = core.correctedOrderFields;

/** Lo que ve el comensal cuando el servidor no puede cobrar su pedido tal cual. */
export const ORDER_NEEDS_REVIEW_MESSAGE =
  "Un platillo de tu pedido cambió o ya no está disponible. Vuelve al menú y revisa tu pedido.";

/** Los platillos que el pedido nombra, leídos del menú de ESTE local. */
async function loadMenuById(
  db: Firestore,
  restaurantId: string,
  order: OrderDoc,
): Promise<Record<string, OrderDoc>> {
  const ids = new Set<string>();
  const items = Array.isArray(order.items) ? order.items.slice(0, core.MAX_LINES) : [];
  for (const line of items) {
    const raw = (line as { menuItemId?: unknown } | null)?.menuItemId;
    const id = typeof raw === "string" ? raw.trim() : "";
    if (id && !id.includes("/") && !id.startsWith("__")) ids.add(id);
  }
  const menuById: Record<string, OrderDoc> = {};
  if (ids.size === 0) return menuById;
  const menu = db.collection("restaurants").doc(restaurantId).collection("menu");
  const snaps = await db.getAll(...[...ids].map((id) => menu.doc(id)));
  for (const snap of snaps) {
    if (snap.exists) menuById[snap.id] = snap.data() ?? {};
  }
  return menuById;
}

/** Precio del pedido contra el menú que el local tiene AHORA en Firestore. */
export async function priceOrderFromMenu(
  db: Firestore,
  restaurantId: string,
  order: OrderDoc,
  restaurant: OrderDoc | undefined,
): Promise<OrderPricing> {
  const menuById = await loadMenuById(db, restaurantId, order);
  return core.priceCustomerOrder({ order, menuById, restaurant });
}

/**
 * El precio que el servidor ya había fijado para este pedido, si lo hay.
 *
 * La primera vez que se pide la preferencia, el servidor calcula, deja el
 * pedido con sus precios y guarda `pricing`. Si el comensal reintenta (se le
 * cerró Mercado Pago), se cobra ESE mismo precio: así dos preferencias del
 * mismo pedido nunca valen distinto y el webhook siempre tiene contra qué
 * comparar. El comensal no puede tocar ni `pricing` ni `items` (reglas).
 */
export function lockedPricing(order: OrderDoc): OrderPricing | null {
  const p = order.pricing as Partial<PricingAudit> | undefined;
  if (!p || p.by !== "create_preference" || p.priceable !== true) return null;
  if (typeof p.serverTotal !== "number" || typeof p.deliveryFee !== "number") return null;
  const lines: PricedLine[] = [];
  let cents = core.toCents(p.deliveryFee);
  for (const raw of Array.isArray(order.items) ? order.items : []) {
    const it = raw as Record<string, unknown>;
    if (typeof it?.price !== "number" || typeof it.quantity !== "number") return null;
    cents += core.toCents(it.price) * it.quantity;
    lines.push({
      menuItemId: String(it.menuItemId ?? ""),
      name: typeof it.name === "string" && it.name.trim() ? it.name.trim() : "Platillo",
      quantity: it.quantity,
      unitPrice: it.price,
      subtotal: (core.toCents(it.price) * it.quantity) / 100,
    });
  }
  // Si lo guardado no suma lo guardado, no se confía: se calcula de nuevo.
  if (cents !== core.toCents(p.serverTotal)) return null;
  return {
    version: p.version ?? 1,
    priceable: true,
    available: true,
    currency: typeof p.currency === "string" ? p.currency : "MXN",
    lines,
    itemsTotal: (cents - core.toCents(p.deliveryFee)) / 100,
    deliveryFee: p.deliveryFee,
    serverTotal: p.serverTotal,
    clientTotal: p.clientTotal ?? null,
    mismatch: p.mismatch === true,
    reasons: Array.isArray(p.reasons) ? p.reasons : [],
  };
}

/** Renglones de la preferencia de Mercado Pago: platillos del servidor + envío. */
export function preferenceItemsFrom(
  pricing: OrderPricing,
): { title: string; quantity: number; unit_price: number }[] {
  const items = pricing.lines.map((l) => ({
    title: l.name,
    quantity: l.quantity,
    unit_price: l.unitPrice,
  }));
  if ((pricing.deliveryFee ?? 0) > 0) {
    items.push({ title: "Envío a domicilio", quantity: 1, unit_price: pricing.deliveryFee as number });
  }
  return items;
}
