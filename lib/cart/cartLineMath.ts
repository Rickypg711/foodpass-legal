import type { CartLine } from "@/lib/cart/types";

export function lineSubtotal(price: number, quantity: number): number {
  return price * quantity;
}

// Las operaciones van por `lineId`, no por `menuItemId`: el mismo platillo
// puede estar dos veces en el carrito con opciones distintas.
export function updateCartLineQuantity(
  lines: CartLine[],
  lineId: string,
  quantity: number,
): CartLine[] {
  if (quantity <= 0) {
    return lines.filter((l) => l.lineId !== lineId);
  }
  return lines.map((l) =>
    l.lineId === lineId
      ? { ...l, quantity, subtotal: lineSubtotal(l.price, quantity) }
      : l,
  );
}

export function incrementCartLine(lines: CartLine[], lineId: string): CartLine[] {
  const line = lines.find((l) => l.lineId === lineId);
  if (!line) return lines;
  return updateCartLineQuantity(lines, lineId, line.quantity + 1);
}

export function decrementCartLine(lines: CartLine[], lineId: string): CartLine[] {
  const line = lines.find((l) => l.lineId === lineId);
  if (!line) return lines;
  return updateCartLineQuantity(lines, lineId, line.quantity - 1);
}

export function cartItemCount(lines: CartLine[]): number {
  return lines.reduce((s, l) => s + l.quantity, 0);
}

export function cartSubtotal(lines: CartLine[]): number {
  return lines.reduce((s, l) => s + l.subtotal, 0);
}
