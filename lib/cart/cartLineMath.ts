import type { CartLine } from "@/lib/cart/types";

export function lineSubtotal(price: number, quantity: number): number {
  return price * quantity;
}

export function updateCartLineQuantity(
  lines: CartLine[],
  menuItemId: string,
  quantity: number,
): CartLine[] {
  if (quantity <= 0) {
    return lines.filter((l) => l.menuItemId !== menuItemId);
  }
  return lines.map((l) =>
    l.menuItemId === menuItemId
      ? { ...l, quantity, subtotal: lineSubtotal(l.price, quantity) }
      : l,
  );
}

export function incrementCartLine(lines: CartLine[], menuItemId: string): CartLine[] {
  const line = lines.find((l) => l.menuItemId === menuItemId);
  if (!line) return lines;
  return updateCartLineQuantity(lines, menuItemId, line.quantity + 1);
}

export function decrementCartLine(lines: CartLine[], menuItemId: string): CartLine[] {
  const line = lines.find((l) => l.menuItemId === menuItemId);
  if (!line) return lines;
  return updateCartLineQuantity(lines, menuItemId, line.quantity - 1);
}

export function cartItemCount(lines: CartLine[]): number {
  return lines.reduce((s, l) => s + l.quantity, 0);
}

export function cartSubtotal(lines: CartLine[]): number {
  return lines.reduce((s, l) => s + l.subtotal, 0);
}
