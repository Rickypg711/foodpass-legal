import type { CartLine, CartState } from "./types";

function storageKey(restaurantId: string): string {
  return `comeleal_cart_v1_${restaurantId}`;
}

export function loadCart(restaurantId: string): CartLine[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(storageKey(restaurantId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CartLine[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCart(restaurantId: string, lines: CartLine[]): void {
  if (typeof window === "undefined") return;
  try {
    if (lines.length === 0) {
      sessionStorage.removeItem(storageKey(restaurantId));
    } else {
      sessionStorage.setItem(storageKey(restaurantId), JSON.stringify(lines));
    }
  } catch {
    /* ignore */
  }
}

export function clearCart(restaurantId: string): void {
  saveCart(restaurantId, []);
}
