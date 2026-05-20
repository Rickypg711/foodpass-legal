export type CartLine = {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  subtotal: number;
  imageUrl?: string | null;
};

export type CartState = {
  restaurantId: string;
  lines: CartLine[];
};
