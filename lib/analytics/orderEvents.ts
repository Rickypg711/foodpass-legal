import { logEventSafe } from "./orderEventsCore";

export function trackCartItemAdded(p: {
  restaurantId: string;
  menuItemId: string;
  quantity: number;
}): void {
  void logEventSafe("cart_item_added", {
    restaurant_id: p.restaurantId,
    menu_item_id: p.menuItemId,
    quantity: p.quantity,
    placement_channel: "web",
    auth_state: "guest_anon",
  });
}

export function trackCheckoutStarted(p: {
  restaurantId: string;
  cartItemCount: number;
  cartTotal: number;
}): void {
  void logEventSafe("checkout_started", {
    restaurant_id: p.restaurantId,
    placement_channel: "web",
    auth_state: "guest_anon",
    cart_item_count: p.cartItemCount,
    cart_total: p.cartTotal,
  });
}

export function trackOrderPlaced(p: {
  restaurantId: string;
  orderId: string;
  orderSource: string;
  total: number;
}): void {
  void logEventSafe("order_placed", {
    restaurant_id: p.restaurantId,
    order_id: p.orderId,
    order_source: p.orderSource,
    placement_channel: "web",
    auth_state: "guest_anon",
    order_type: "pickup",
    total: p.total,
  });
}

export function trackWhatsappOrderMessageSent(p: {
  restaurantId: string;
  orderId: string;
}): void {
  void logEventSafe("whatsapp_order_message_sent", {
    restaurant_id: p.restaurantId,
    order_id: p.orderId,
    placement_channel: "web",
    auth_state: "guest_anon",
  });
}

// ── Cierre del pedido (10-oct-2026, FOODPASS docs/design/checkout-final/ESTUDIO.md) ──
// Mismos nombres y campos que la app (CustomerOrderingAnalytics.checkout*). Ningún evento lleva nombre,
// teléfono ni platillos: solo el local y cómo fue.

/** Se abrió el cierre. standing = first | returning | unknown (en la web casi siempre unknown al abrir). */
export function trackCheckoutReviewShown(p: {
  restaurantId: string;
  hasRedemption: boolean;
  atTable: boolean;
  /** Nombre y teléfono llegaron puestos de un pedido anterior en este navegador. */
  hasName: boolean;
  hasPhone: boolean;
}): void {
  void logEventSafe("checkout_review_shown", {
    restaurant_id: p.restaurantId,
    has_redemption: p.hasRedemption ? 1 : 0,
    at_table: p.atTable ? 1 : 0,
    standing: "unknown",
    placement_channel: "web",
  });
  void logEventSafe("checkout_identity_prefilled", {
    restaurant_id: p.restaurantId,
    has_name: p.hasName ? 1 : 0,
    has_phone: p.hasPhone ? 1 : 0,
    placement_channel: "web",
  });
}

/** Eligió (selected) o quitó un premio en el pedido. */
export function trackCheckoutRedeem(p: { restaurantId: string; selected: boolean; points: number }): void {
  void logEventSafe(p.selected ? "checkout_redeem_selected" : "checkout_redeem_unselected", {
    restaurant_id: p.restaurantId,
    points: p.points,
    is_welcome: 0,
    placement_channel: "web",
  });
}

/** Tocó el botón principal. payKind = online | cash | card | transfer | table. */
export function trackCheckoutSubmit(p: {
  restaurantId: string;
  payKind: string;
  hasRedemption: boolean;
  total: number;
}): void {
  void logEventSafe("checkout_submit", {
    restaurant_id: p.restaurantId,
    pay_kind: p.payKind,
    has_redemption: p.hasRedemption ? 1 : 0,
    total: p.total,
    placement_channel: "web",
  });
}

/** No salió. code viene de checkoutErrorCode (lib/order/checkoutReview.ts). */
export function trackCheckoutError(p: { restaurantId: string; code: string }): void {
  void logEventSafe("checkout_error", {
    restaurant_id: p.restaurantId,
    code: p.code,
    placement_channel: "web",
  });
}
