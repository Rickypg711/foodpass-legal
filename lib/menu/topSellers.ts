// "🔥 El más pedido" en la tarjeta (8-oct-2026, copiado del cinturón
// "Champion" del sitio de Rebellion Pizza). Lo pone el dato, no el dueño:
// `orderCount` lo escribe el trigger functions/menu_order_count.js con cada
// pedido pagado.
//
// Para que NUNCA mienta: un platillo con 2 ventas no es "el más pedido".
// Solo cuenta con un mínimo de ventas, y solo los 3 primeros del menú.

export const TOP_SELLER_MIN_ORDERS = 10;
export const TOP_SELLER_MAX = 3;

export function topSellerIds(
  items: readonly { id: string; orderCount?: number | null }[],
): Set<string> {
  const ranked = items
    .filter((i) => typeof i.orderCount === "number" && Number.isFinite(i.orderCount) && i.orderCount >= TOP_SELLER_MIN_ORDERS)
    .sort((a, b) => (b.orderCount as number) - (a.orderCount as number) || (a.id < b.id ? -1 : 1));
  return new Set(ranked.slice(0, TOP_SELLER_MAX).map((i) => i.id));
}
