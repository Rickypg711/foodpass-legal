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
