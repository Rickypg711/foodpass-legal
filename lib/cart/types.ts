export type SelectedOptionGroup = {
  groupId: string;
  groupName: string;
  options: { id: string; name: string; priceDelta: number }[];
};

export type CartLine = {
  /**
   * Llave canónica de la línea. Antes el carrito se indexaba por menuItemId,
   * así que dos veces el mismo platillo con opciones distintas se pisaban.
   * Sin opciones, lineId === menuItemId (carritos viejos siguen sirviendo).
   */
  lineId: string;
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  subtotal: number;
  imageUrl?: string | null;
  /** Lo que el cliente eligió: salsa, aderezo, extras. `price` ya trae el sobreprecio. */
  selectedOptions?: SelectedOptionGroup[];
  /**
   * Nota libre del cliente para ESTE platillo ("Búfalo y ranch", "sin cebolla").
   * Los menús reales traen opciones que hoy viven como texto en la descripción
   * (ej. "Elige tu salsa: Mango Habanero, Búfalo, BBQ...") y el pedido llegaba
   * a la cocina sin ellas. `notes` ya existía en OrderItemPayload y la pantalla
   * de Pedidos ya lo pinta — solo faltaba que el cliente pudiera escribirlo.
   * NO altera el precio: los extras con costo son trabajo de modifiers.
   */
  notes?: string;
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
