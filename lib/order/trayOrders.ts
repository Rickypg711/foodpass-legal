/**
 * La bandeja de Pedidos: qué sigue vivo y cómo se unen las dos lecturas.
 *
 * POR QUÉ (18-sep-2026, Luzz Pizza): /vendor/pedidos solo leía 48 h, así que
 * un pedido pendiente de 3+ días desaparecía de la bandeja mientras el Panel
 * lo seguía contando como "sin cobrar" (lib/order/menuSales.ts, 30 días) y
 * "Cobrarlos en Pedidos" caía en vacío. Ahora Pedidos lee además TODO lo que
 * sigue en bandeja por estado, sin fecha, como la app (CustomerOrdersScreen).
 *
 * Puro y sin imports: lo prueba `scripts/validate-tray-orders.mjs` con node.
 */

/** Estados que siguen en bandeja: nunca se esconden por viejos. */
export const IN_TRAY_STATUSES = ["pending", "preparing", "ready", "open_tab"] as const;

export interface TrayOrderLike {
  id: string;
  createdAt?: { toMillis?: () => number } | null;
}

const ms = (o: TrayOrderLike): number =>
  o.createdAt && typeof o.createdAt.toMillis === "function" ? o.createdAt.toMillis() : 0;

/**
 * Une dos lotes por id (el segundo gana si se repite: es el más específico)
 * y ordena del más nuevo al más viejo, como la lectura original por createdAt.
 */
export function mergeOrdersById<T extends TrayOrderLike>(recent: T[], inTray: T[]): T[] {
  const byId = new Map<string, T>();
  for (const o of recent) byId.set(o.id, o);
  for (const o of inTray) byId.set(o.id, o);
  return [...byId.values()].sort((a, b) => ms(b) - ms(a));
}
