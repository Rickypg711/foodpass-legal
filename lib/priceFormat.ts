/** Same rules as Flutter `formatPrice` (lib/utils/price_format.dart). */
export function formatPrice(price: number): string {
  return price % 1 === 0 ? `$${Math.trunc(price)}` : `$${price.toFixed(2)}`;
}
