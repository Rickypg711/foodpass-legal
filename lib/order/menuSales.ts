/**
 * "Vendiste por tu menú": cuánto dinero le trajo el menú en línea al dueño.
 *
 * POR QUÉ EXISTE (12-sep-2026, Ricardo): Owner.com retiene a sus restaurantes
 * enseñándoles el dinero — "$X llegó por tu sitio este mes". Nuestros dueños
 * reciben pedidos por /menu y nunca ven cuánto suman. Se pinta dentro del
 * bloque 4 del Panel (Clientes · últimos 30 días), sin bloque nuevo: el panel
 * se queda en 7 bloques (panel-app-7-bloques).
 *
 * Misma regla que `scripts/pedidosSinCobrarReadOnly.js` (FOODPASS), para que
 * lo que ve el dueño y lo que medimos digan lo mismo:
 *   - del menú      = orderSource distinto de "pos", sin cancelados ni borradores
 *   - vendido       = paymentStatus "paid"
 *   - sin cobrar    = no pagado, sin cuenta de mesa (esa se cobra en la Caja),
 *                     y ya entregado o con más de 2 h en la bandeja
 * Lo que entró hace menos de 2 h está en curso: no regaña.
 *
 * ESPEJO EXACTO de `lib/orders/menu_sales.dart` en la app;
 * `scripts/validate-menu-sales.mjs` lee el Dart y truena si se separan.
 *
 * Puro y sin imports con alias: lo prueba el validador con node directo.
 */

export const MENU_SALES_IN_PROGRESS_MS = 2 * 60 * 60 * 1000;

export interface MenuSalesOrder {
  orderSource?: unknown;
  status?: unknown;
  paymentStatus?: unknown;
  total?: unknown;
  isOpenTab?: unknown;
  tabId?: unknown;
  createdAtMs: number;
}

export interface MenuSalesSummary {
  paidCount: number;
  paidTotal: number;
  unpaidCount: number;
  unpaidTotal: number;
}

export function isMenuOrder(o: MenuSalesOrder): boolean {
  if (o.orderSource === "pos") return false;
  return o.status !== "cancelled" && o.status !== "draft";
}

export function summarizeMenuSales(orders: MenuSalesOrder[], nowMs: number): MenuSalesSummary {
  const s: MenuSalesSummary = { paidCount: 0, paidTotal: 0, unpaidCount: 0, unpaidTotal: 0 };
  for (const o of orders) {
    if (!isMenuOrder(o)) continue;
    const total = typeof o.total === "number" && Number.isFinite(o.total) ? o.total : 0;
    if (o.paymentStatus === "paid") {
      s.paidCount++;
      s.paidTotal += total;
      continue;
    }
    if (o.isOpenTab === true || (typeof o.tabId === "string" && o.tabId !== "")) continue;
    if (o.status === "completed" || nowMs - o.createdAtMs > MENU_SALES_IN_PROGRESS_MS) {
      s.unpaidCount++;
      s.unpaidTotal += total;
    }
  }
  s.paidTotal = Math.round(s.paidTotal);
  s.unpaidTotal = Math.round(s.unpaidTotal);
  return s;
}

/** "$4,160" — sin centavos: es un marcador, no un ticket. */
export function menuSalesMoney(amount: number): string {
  return `$${Math.round(amount).toLocaleString("en-US")}`;
}

/** "21 pedidos" / "1 pedido". */
export function menuSalesCaption(paidCount: number): string {
  return paidCount === 1 ? "1 pedido" : `${paidCount} pedidos`;
}

/** La línea de aviso cuando hay pedidos del menú sin Cobrar. */
export function menuUnpaidLine(unpaidCount: number, unpaidTotal: number): string {
  const n = unpaidCount === 1 ? "1 pedido del menú sin cobrar" : `${unpaidCount} pedidos del menú sin cobrar`;
  return `${n} (${menuSalesMoney(unpaidTotal)}) · cóbralos en Pedidos`;
}

/** Se pinta solo si hay algo que contar: un $0 no le vende nada al dueño. */
export function showMenuSales(s: MenuSalesSummary): boolean {
  return s.paidCount > 0 || s.unpaidCount > 0;
}
