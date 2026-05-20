import type { StoredOrderSnapshot } from "@/lib/types/order";

const KEY = "comeleal_order_snapshot_v1";

export function saveOrderSnapshot(snapshot: StoredOrderSnapshot): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(KEY, JSON.stringify(snapshot));
  } catch {
    /* ignore */
  }
}

export function loadOrderSnapshot(): StoredOrderSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredOrderSnapshot;
  } catch {
    return null;
  }
}

export function clearOrderSnapshot(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
