export type CartLine = {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  subtotal: number;
  imageUrl?: string | null;
  /**
   * Points-powered upsell metadata (mirrors lib/models/cart_item.dart).
   * Set when the line was added by accepting an AI upsell suggestion:
   * the server-decided bonus points are credited at loyalty award time
   * (order scan), never as a discount.
   */
  isUpsell?: boolean;
  upsellBonusPoints?: number;
  upsellSurprise?: boolean;
};

export type CartState = {
  restaurantId: string;
  lines: CartLine[];
};
