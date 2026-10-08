// Señales del menú (8-oct-2026): lo que los pedidos pagados de 30 días dicen
// del menú. El backend escribe en el doc público restaurants/{id}:
//   menuSignals: { topItemIds: string[] (<=6), pairs: { [itemId]: string[] (<=2) },
//                  orders: number, windowDays: 30 }
// Solo existe con 10+ pedidos pagados. Si falta o viene raro, todo se apaga
// en silencio: nada se inventa.
//
// Aquí también vive la línea del panel "lo que te habría costado una app de
// reparto" (vendorInsights/current.metrics.webOrdersPaid30d), para que la
// web y su candado lean la misma función.

export type MenuSignals = {
  topItemIds: string[];
  pairs: Record<string, string[]>;
};

const TOP_MAX = 6;
const PAIRS_MAX = 2;

function cleanIds(v: unknown, max: number): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const x of v) {
    if (typeof x !== "string") continue;
    const id = x.trim();
    if (!id || out.includes(id)) continue;
    out.push(id);
    if (out.length >= max) break;
  }
  return out;
}

/** Lee `menuSignals` del doc del restaurante. null = no hay señales. */
export function parseMenuSignals(raw: Record<string, unknown> | null | undefined): MenuSignals | null {
  const ms = raw?.menuSignals;
  if (!ms || typeof ms !== "object") return null;
  const m = ms as Record<string, unknown>;
  const topItemIds = cleanIds(m.topItemIds, TOP_MAX);
  const pairs: Record<string, string[]> = {};
  if (m.pairs && typeof m.pairs === "object" && !Array.isArray(m.pairs)) {
    for (const [k, v] of Object.entries(m.pairs as Record<string, unknown>)) {
      const ids = cleanIds(v, PAIRS_MAX).filter((id) => id !== k);
      if (ids.length) pairs[k] = ids;
    }
  }
  if (!topItemIds.length && !Object.keys(pairs).length) return null;
  return { topItemIds, pairs };
}

/** "Lo más pedido": solo los platillos que siguen en el menú (y disponibles),
 *  en el orden de las señales. */
export function topItemsFromSignals<T extends { id: string }>(
  signals: MenuSignals | null,
  items: readonly T[],
): T[] {
  if (!signals) return [];
  const byId = new Map(items.map((i) => [i.id, i] as const));
  const out: T[] = [];
  for (const id of signals.topItemIds) {
    const it = byId.get(id);
    if (it) out.push(it);
  }
  return out;
}

/** "Va bien con": hasta 2 platillos que siguen en el menú, nunca el mismo. */
export function pairItemsFor<T extends { id: string }>(
  signals: MenuSignals | null,
  itemId: string | null | undefined,
  items: readonly T[],
): T[] {
  if (!signals || !itemId) return [];
  const ids = signals.pairs[itemId];
  if (!ids) return [];
  const byId = new Map(items.map((i) => [i.id, i] as const));
  const out: T[] = [];
  for (const id of ids) {
    if (id === itemId) continue;
    const it = byId.get(id);
    if (it) out.push(it);
    if (out.length >= PAIRS_MAX) break;
  }
  return out;
}

/** Parámetro del link directo a un platillo: /menu/{id}?platillo={itemId}. */
export const DISH_PARAM = "platillo";

/** Link de una foto de /r al menú con ese platillo abierto. Sin id ni nombre,
 *  el link de siempre. */
export function dishMenuHref(restaurantId: string, dish: { id?: string | null; name?: string | null }): string {
  const base = `/menu/${encodeURIComponent(restaurantId)}`;
  const key = (dish.id && dish.id.trim()) || (dish.name && dish.name.trim()) || "";
  return key ? `${base}?${DISH_PARAM}=${encodeURIComponent(key)}` : base;
}

/** Busca el platillo del link: primero por id; si no, por nombre exacto
 *  (sin importar mayúsculas), para las fotos que no traen id. */
export function findLinkedDish<T extends { id: string; name: string }>(
  items: readonly T[],
  param: string | null | undefined,
): T | null {
  const want = (param ?? "").trim();
  if (!want) return null;
  const byId = items.find((i) => i.id === want);
  if (byId) return byId;
  const lower = want.toLowerCase();
  return items.find((i) => i.name.trim().toLowerCase() === lower) ?? null;
}

/** Comisión que cobran las apps de reparto, como tope ("hasta 30 %"). */
export const DELIVERY_APP_MAX_FEE = 0.3;

/** Mismo formato que menuSalesMoney (lib/order/menuSales.ts): "$4,160". Copia
 *  local para que el candado lo importe con node sin alias; el candado compara. */
function money(amount: number): string {
  return `$${Math.round(amount).toLocaleString("en-US")}`;
}

/** La línea del panel. null con 0 pedidos, sin monto o con datos raros. */
export function deliveryAppSavingsLine(orders: unknown, amount: unknown): string | null {
  if (typeof orders !== "number" || !Number.isFinite(orders) || orders < 1) return null;
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) return null;
  const n = Math.round(orders);
  const fee = money(amount * DELIVERY_APP_MAX_FEE);
  return n === 1
    ? `Tu pedido en línea de 30 días suma ${money(amount)}. En una app de reparto que cobra hasta 30 %, te habría costado hasta ${fee} de comisión.`
    : `Tus ${n} pedidos en línea de 30 días suman ${money(amount)}. En una app de reparto que cobra hasta 30 %, te habrían costado hasta ${fee} de comisión.`;
}
