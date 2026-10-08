/**
 * "Vendiste por tu menú" — contrato (web ↔ app ↔ medición).
 *
 * POR QUE EXISTE (12-sep-2026, Ricardo): Owner.com retiene restaurantes
 * enseñándoles el dinero que trajo su sitio. El Panel ahora dice cuánto vendió
 * el dueño por su menú en línea en 30 días, y cuántos pedidos del menú siguen
 * sin Cobrar. La regla es la de scripts/pedidosSinCobrarReadOnly.js (FOODPASS):
 * si el panel y la medición cuentan distinto, le mentimos a alguien.
 * Este candado prueba la función, que el Panel la pinte, y lee el Dart.
 *
 * Run: node scripts/validate-menu-sales.mjs
 */

import { readFileSync, existsSync } from "node:fs";
import {
  MENU_SALES_IN_PROGRESS_MS,
  isMenuOrder,
  summarizeMenuSales,
  menuSalesMoney,
  menuSalesCaption,
  menuUnpaidLine,
  showMenuSales,
} from "../lib/order/menuSales.ts";

let failed = 0;
function check(label, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    console.error(`FAIL ${label}\n  esperado: ${e}\n  recibido: ${a}`);
    failed = 1;
  }
}

const H = 60 * 60 * 1000;
const NOW = 100 * H;

check("en curso = 2 h", MENU_SALES_IN_PROGRESS_MS, 2 * H);

// ── Qué es un pedido del menú ───────────────────────────────────────────────
check("web cuenta", isMenuOrder({ orderSource: "customer_web", createdAtMs: 0 }), true);
check("app de comensal cuenta", isMenuOrder({ orderSource: "customer_app", createdAtMs: 0 }), true);
check("la Caja NO", isMenuOrder({ orderSource: "pos", createdAtMs: 0 }), false);
check("cancelado NO", isMenuOrder({ orderSource: "customer_web", status: "cancelled", createdAtMs: 0 }), false);
check("borrador NO", isMenuOrder({ orderSource: "customer_web", status: "draft", createdAtMs: 0 }), false);

// ── La suma ─────────────────────────────────────────────────────────────────
const orders = [
  { orderSource: "customer_web", status: "completed", paymentStatus: "paid", total: 230, createdAtMs: NOW - 50 * H },
  { orderSource: "customer_web", status: "completed", paymentStatus: "paid", total: 100.5, createdAtMs: NOW - 10 * H },
  // Ronda de mesa pedida por QR y cobrada en la Caja: SÍ es venta del menú.
  { orderSource: "customer_web", status: "completed", paymentStatus: "paid", total: 90, isOpenTab: false, tabId: "t1", createdAtMs: NOW - 5 * H },
  { orderSource: "pos", status: "completed", paymentStatus: "paid", total: 999, createdAtMs: NOW - 1 * H },
  { orderSource: "customer_web", status: "cancelled", paymentStatus: "paid", total: 500, createdAtMs: NOW - 1 * H },
  // Sin cobrar: entregado sin Cobrar, y olvidado en la bandeja > 2 h.
  { orderSource: "customer_web", status: "completed", paymentStatus: "pending", total: 85, createdAtMs: NOW - 1 * H },
  { orderSource: "customer_web", status: "pending", paymentStatus: "pending", total: 360, createdAtMs: NOW - 3 * H },
  // En curso (< 2 h) y cuentas de mesa abiertas: no regañan.
  { orderSource: "customer_web", status: "pending", paymentStatus: "pending", total: 70, createdAtMs: NOW - 1 * H },
  { orderSource: "customer_web", status: "pending", paymentStatus: "pending", total: 40, isOpenTab: true, createdAtMs: NOW - 9 * H },
  { orderSource: "customer_web", status: "ready", paymentStatus: "pending", total: 40, tabId: "t2", createdAtMs: NOW - 9 * H },
];
check("suma", summarizeMenuSales(orders, NOW), { paidCount: 3, paidTotal: 421, unpaidCount: 2, unpaidTotal: 445, unpaidOrderIds: [] });
check("con UN pedido sin cobrar, trae su id (la línea de Hoy lo abre)", summarizeMenuSales([{ id: "o1", orderSource: "customer_web", status: "completed", paymentStatus: "pending", total: 400, createdAtMs: NOW }], NOW).unpaidOrderIds, ["o1"]);
check("total basura = 0", summarizeMenuSales([{ orderSource: "customer_web", paymentStatus: "paid", total: "abc", createdAtMs: 0 }], NOW).paidTotal, 0);
check("sin pedidos no se pinta", showMenuSales(summarizeMenuSales([], NOW)), false);
check("solo sin cobrar sí se pinta", showMenuSales({ paidCount: 0, paidTotal: 0, unpaidCount: 1, unpaidTotal: 85 }), true);

// ── Las palabras (las mismas en la app) ─────────────────────────────────────
check("dinero", menuSalesMoney(4160), "$4,160");
check("dinero chico", menuSalesMoney(85), "$85");
check("dinero grande", menuSalesMoney(1234567.4), "$1,234,567");
check("1 pedido", menuSalesCaption(1), "1 pedido");
check("21 pedidos", menuSalesCaption(21), "21 pedidos");
check("aviso singular", menuUnpaidLine(1, 85), "1 pedido en línea sin cobrar ($85) · cóbralo en Pedidos");
check("aviso plural", menuUnpaidLine(3, 2085), "3 pedidos en línea sin cobrar ($2,085) · cóbralos en Pedidos");

// ── El Panel lo pinta de verdad ─────────────────────────────────────────────
const panel = readFileSync(new URL("../app/vendor/page.tsx", import.meta.url), "utf8");
check("el Panel suma con la función", panel.includes("summarizeMenuSales("), true);
check("el Panel dice 'Vendiste por tu menú'", panel.includes("Vendiste por tu menú"), true);
check("sin $0: se esconde si no hay nada", panel.includes("showMenuSales(menuSales)"), true);
check("sin nada cobrado no pinta $0", panel.includes("{menuSales.paidCount > 0 && ("), true);
check("el aviso lleva a Pedidos", panel.includes('href="/vendor/pedidos"'), true);
check("Hoy: con un solo pedido el link va a ese pedido", panel.includes("`/vendor/pedidos?pedido=${menuSales.unpaidOrderIds[0]}`"), true);

// ── Espejo en la app (lee el Dart) ──────────────────────────────────────────
const APP = "/Users/ricardoparedes/projects/FOODPASS";
const DART = `${APP}/lib/orders/menu_sales.dart`;
if (existsSync(`${APP}/pubspec.yaml`)) {
  check("la app tiene el espejo lib/orders/menu_sales.dart", existsSync(DART), true);
  if (existsSync(DART)) {
    const d = readFileSync(DART, "utf8");
    check("app: en curso = las mismas horas", Number(d.match(/const int kMenuSalesInProgressHours = (\d+);/)?.[1]) * H, MENU_SALES_IN_PROGRESS_MS);
    check("app: la Caja no cuenta", d.includes("o['orderSource'] == 'pos'"), true);
    check("app: mismas palabras (pedidos en línea sin cobrar)", d.includes("pedidos en línea sin cobrar"), true);
    check("app: mismas palabras (cóbralo/cóbralos en Pedidos)", d.includes("cóbralos") && d.includes("cóbralo") && d.includes(" en Pedidos"), true);
    const arb = readFileSync(`${APP}/lib/l10n/app_es.arb`, "utf8");
    check("app: la pantalla dice 'Vendiste por tu menú'", arb.includes('"menuSalesTitle": "Vendiste por tu menú"'), true);
  }
}

if (failed) process.exit(1);
console.log("validate-menu-sales: OK");

// ── "🔥 El más pedido" (8-oct-2026) ─────────────────────────────────────────
// Lo pone el dato (orderCount del trigger). Candado: nunca con pocas ventas y
// nunca más de 3, para que el menú no mienta.
{
  const { topSellerIds, TOP_SELLER_MIN_ORDERS } = await import("../lib/menu/topSellers.ts");
  const ids = (s) => [...s].sort().join(",");
  const chk = (got, want, m) => { if (got !== want) throw new Error(`${m}: esperaba "${want}", salió "${got}"`); };
  chk(String(TOP_SELLER_MIN_ORDERS), "10", "el mínimo es 10 ventas");
  chk(ids(topSellerIds([{ id: "a", orderCount: 2 }, { id: "b", orderCount: 9 }])), "", "con pocas ventas no hay más pedido");
  chk(ids(topSellerIds([{ id: "a", orderCount: 50 }, { id: "b", orderCount: 10 }, { id: "c" }])), "a,b", "desde 10 sí");
  chk(ids(topSellerIds([{ id: "a", orderCount: 50 }, { id: "b", orderCount: 40 }, { id: "c", orderCount: 30 }, { id: "d", orderCount: 20 }])), "a,b,c", "máximo 3, los de más ventas");
  chk(ids(topSellerIds([{ id: "a", orderCount: NaN }, { id: "b", orderCount: null }])), "", "datos raros no truenan");
  const card = readFileSync(new URL("../components/menu/MenuItemCard.tsx", import.meta.url), "utf8");
  if (!card.includes("🔥 Más pedido") || card.includes("El más pedido")) throw new Error("la tarjeta pinta el sello");
  console.log("✅ El más pedido: solo con 10+ ventas reales y máximo 3 platillos");
}

// ── "🔥 El más pedido" también en las pieles (8-oct-2026) ───────────────────
{
  const view = readFileSync(new URL("../app/menu/[restaurantId]/MenuView.tsx", import.meta.url), "utf8");
  const once = view.match(/const topSellers = topSellerIds\(/g) || [];
  if (once.length !== 1) throw new Error("pieles: topSellers se calcula una sola vez para todo el menú");
  for (const skin of ["pecado", "suadero", "kame", "omu", "fresheria", "blooms", "igo", "mixteco", "laspic", "tortasperras", "negroblanco", "tercera", "manantial"]) {
    const src = readFileSync(new URL(`../components/menu/skins/${skin}.tsx`, import.meta.url), "utf8");
    if (!src.includes("topSeller = false") || !src.includes("🔥 Más pedido") || src.includes("El más pedido")) throw new Error(`piel ${skin}: pinta el sello a su modo`);
  }
  for (const row of ["PecadoItemRow", "SuaderoItemRow", "KameItemRow", "OmuItemRow", "FresheriaItemRow", "BloomsItemRow", "IGOItemRow", "MixtecoItemRow", "LaspicItemRow", "TortasItemRow", "NegroBlancoItemRow", "TerceraItemRow", "ManantialItemRow"]) {
    const i = view.indexOf(`<${row}`);
    if (i < 0 || !view.slice(i, i + 200).includes("topSeller={topSellers.has(")) throw new Error(`${row}: recibe el sello`);
  }
  console.log("✅ El más pedido en las 13 pieles, cada una con su ropa");
}
