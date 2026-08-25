/**
 * Pedido desde la MESA (QR numerado) — contrato.
 *
 * Dos capas:
 *  1. Lógica pura de lib/order/tableSession.ts (importable directo: no tiene
 *     imports con alias @/, así que node --experimental-strip-types la carga).
 *  2. Aserciones sobre el CÓDIGO FUENTE de buildOrderPayload.ts, porque ese sí
 *     tiene imports con alias y no se puede ejecutar aquí. Es el mismo truco
 *     que usa validate-web-checkout-policy.mjs.
 *
 * Run: node scripts/validate-table-orders.mjs
 */

import { readFileSync } from "node:fs";
import {
  normalizeTableNumber,
  tableLabel,
  normalizeDiners,
  tableMenuUrl,
  TABLE_MAX_LENGTH,
} from "../lib/order/tableSession.ts";

let failed = 0;
function check(label, actual, expected) {
  if (actual !== expected) {
    console.error(`FAIL ${label}: esperaba ${JSON.stringify(expected)}, obtuvo ${JSON.stringify(actual)}`);
    failed = 1;
  }
}
function checkSource(label, src, needle) {
  if (!src.includes(needle)) {
    console.error(`FAIL ${label}: no encontré ${JSON.stringify(needle)}`);
    failed = 1;
  }
}

// ── 1. normalizeTableNumber ──────────────────────────────────────────────────
check("número simple", normalizeTableNumber("5"), "5");
check("espacios sobrantes", normalizeTableNumber("  12  "), "12");
check("nombres reales de mesa", normalizeTableNumber("Terraza 2"), "Terraza 2");
check("barra", normalizeTableNumber("Barra"), "Barra");
check("acepta # y -", normalizeTableNumber("#3-A"), "#3-A");
check("acentos y ñ", normalizeTableNumber("Jardín"), "Jardín");
check("colapsa espacios", normalizeTableNumber("T   4"), "T 4");
check("corta al máximo", normalizeTableNumber("x".repeat(40)).length, TABLE_MAX_LENGTH);
check("vacío", normalizeTableNumber(""), "");
check("null", normalizeTableNumber(null), "");
check("número (no string) se rechaza", normalizeTableNumber(5), "");
// saneado: nada de inyección ni rutas
check("quita comillas y signos", normalizeTableNumber('5"><script>'), "5script");
check("quita slash", normalizeTableNumber("../../etc"), "etc");

// ── 2. normalizeDiners ───────────────────────────────────────────────────────
check("personas normal", normalizeDiners(4), 4);
check("personas string", normalizeDiners("6"), 6);
check("cero no vale", normalizeDiners(0), null);
check("negativo no vale", normalizeDiners(-2), null);
check("absurdo no vale", normalizeDiners(500), null);
check("basura", normalizeDiners("muchas"), null);
check("decimal se trunca", normalizeDiners(3.7), 3);

// ── 3. tableMenuUrl (lo que se imprime en el QR) ─────────────────────────────
check(
  "url con mesa",
  tableMenuUrl("https://www.comeleal.com", "abc123", "5"),
  "https://www.comeleal.com/menu/abc123?mesa=5",
);
check(
  "url sin mesa cae al menú normal",
  tableMenuUrl("https://www.comeleal.com", "abc123", ""),
  "https://www.comeleal.com/menu/abc123",
);
check(
  "url con nombre de mesa va codificada",
  tableMenuUrl("https://www.comeleal.com/", "abc123", "Terraza 2"),
  "https://www.comeleal.com/menu/abc123?mesa=Terraza%202",
);

// ── 4. El builder respeta el contrato ────────────────────────────────────────
const builder = readFileSync(
  new URL("../lib/order/buildOrderPayload.ts", import.meta.url),
  "utf8",
);
// orderType ya NO puede estar hardcodeado a "pickup"
if (/orderType:\s*"pickup"/.test(builder)) {
  console.error('FAIL: buildOrderPayload sigue con orderType hardcodeado a "pickup"');
  failed = 1;
}
checkSource("usa la constante de dine_in", builder, "ORDER_TYPE_DINE_IN");
checkSource("usa la constante de pickup", builder, "ORDER_TYPE_PICKUP");
checkSource("normaliza la mesa antes de escribirla", builder, "normalizeTableNumber");
checkSource("la mesa decide el modo", builder, "tableNumber ? ORDER_TYPE_DINE_IN : ORDER_TYPE_PICKUP");
checkSource("escribe tableNumber", builder, "payload.tableNumber = tableNumber");
checkSource("escribe diners validado", builder, "normalizeDiners");
// el pickupPin se sigue generando SIEMPRE (es el folio que canta el mesero)
checkSource("pickupPin sigue en el payload", builder, "pickupPin: input.pickupPin");

const types = readFileSync(
  new URL("../lib/types/order.ts", import.meta.url),
  "utf8",
);
checkSource("tipo dine_in declarado", types, 'ORDER_TYPE_DINE_IN = "dine_in"');
checkSource("orderType ya no es literal pickup", types, "orderType: CustomerOrderType");
checkSource("tableNumber opcional en el tipo", types, "tableNumber?: string");
checkSource("diners opcional en el tipo", types, "diners?: number");

// ── tableLabel — una sola regla para la hoja de QR y para Pedidos ────────────
// Espejo de FOODPASS test/order/table_session_test.dart. Pedidos hardcodeaba
// "Mesa {n}", asi que una mesa llamada "Barra" salia como "Mesa Barra".
check("numero lleva prefijo", tableLabel("5"), "Mesa 5");
check("numero de dos digitos", tableLabel("12"), "Mesa 12");
check("Barra a secas", tableLabel("Barra"), "Barra");
check("Terraza 1 a secas", tableLabel("Terraza 1"), "Terraza 1");
check("T3 a secas", tableLabel("T3"), "T3");
check("A-1 a secas", tableLabel("A-1"), "A-1");

// ── Mesa = cuenta abierta ───────────────────────────────────────────
//
// POR QUE ESTAS LINEAS SON UN TEST Y NO UN COMENTARIO:
//
// 1. Sin `abreCuenta`, cuatro amigos en la mesa 5 generan cuatro pedidos
//    cerrados sueltos y el mesero suma tickets de cabeza.
// 2. Si `abreCuenta` deja de exigir pay_at_pickup, un pedido de mesa YA PAGADO
//    con Mercado Pago se queda colgado para siempre en "Cuentas abiertas",
//    esperando un cobro que nunca va a llegar.
// 3. Si el nombre vuelve a ser `Mesa ${n}`, una mesa llamada "Barra" sale como
//    "Mesa Barra" — el mismo bug que ya arreglo `tableLabel` en la hoja de QR.
checkSource(
  "mesa sin pagar abre cuenta",
  builder,
  "Boolean(tableNumber) && paymentMethod === PAYMENT_METHOD_PAY_AT_PICKUP",
);
checkSource("isOpenTab lo decide abreCuenta", builder, "isOpenTab: abreCuenta");
checkSource("el nombre pasa por tableLabel", builder, "tabName = tableLabel(");

// La app tiene que escribir EXACTAMENTE la misma forma, o una mesa que ordena
// desde la app nace distinta a una que ordena desde la web.
const posDart = readFileSync(
  "/Users/ricardoparedes/projects/FOODPASS/lib/services/pos_service.dart",
  "utf8",
);
checkSource("app: mesa sin pagar abre cuenta", posDart, "orderMap['isOpenTab'] = true");
checkSource(
  "app: el nombre pasa por tableLabel",
  posDart,
  "orderMap['tabName'] = tableLabel(table)",
);

// ── Etapa 1: tabId — agrupar SIN fusionar (docs/PEDIDO_EN_MESA.md) ──────────
// Las rondas de la MISMA mesa comparten tabId; la cocina sigue viendo cada
// ronda como su ticket. Los DOS escritores lo escriben, o una mesa que pide
// desde la app y otra desde la web nunca se juntan en la Caja.
checkSource("web: tabId solo cuando abre cuenta", builder, "if (abreCuenta && tabId) payload.tabId = tabId");
checkSource("web: el tabId se resuelve en el server o se funda", readFileSync(new URL("../lib/order/createCustomerOrder.ts", import.meta.url), "utf8"), "resolveTableTabId(params.restaurantId, mesaNormalizada)) ??");
checkSource("app: tabId en la cuenta de mesa", posDart, "orderMap['tabId'] = await TableTabService.resolveOrFound(");

// ── Etapa 1, mitad visible: la Caja agrupa y el cierre es de GRUPO ──────────
// Si la web agrupa y la app no (o al revés), la misma mesa se ve distinta
// según el lado — y el cierre por ronda vuelve a cobrar de cabeza.
const posPage = readFileSync(new URL("../app/vendor/pos/page.tsx", import.meta.url), "utf8");
checkSource("web Caja: agrupa por tabId", posPage, "groupOpenTabs(activeOpenTabs");
checkSource("web Caja: el cierre es transacción de GRUPO", posPage, "async function closeTabGroup(");
checkSource("web Caja: reparto proporcional del neto", posPage, "distributeGroupNet(grossPerOrder");
const posSheetDart = readFileSync(
  "/Users/ricardoparedes/projects/FOODPASS/lib/pages/pos/dialogs/pos_tab_sheet.dart",
  "utf8",
);
checkSource("app Caja: agrupa por tabId", posSheetDart, "groupOpenTabs(_tabs)");
checkSource("app Caja: el cierre es de GRUPO", posDart, "Future<void> completePaidTabGroup(");
checkSource("app Caja: reparto proporcional del neto", posDart, "distributeGroupNet(grossPerOrder");

// ── Una sola verdad para el cobro de MESA: solo la Caja cierra cuentas ──────
// (regla de Ricardo, 25-ago: dos pantallas que cobran distinto es peligroso).
// El 'Cobrar' pelón de Pedidos sobre una cuenta abierta cobraba una ronda sin
// propina, sin teléfono→puntos y fuera de la cuenta agrupada.
const pedidosPage = readFileSync(new URL("../app/vendor/pedidos/page.tsx", import.meta.url), "utf8");
checkSource("Pedidos: cuenta abierta redirige a la Caja", pedidosPage, 'href="/vendor/pos?cuentas=1"');
checkSource("Pedidos: el cobro pelón queda solo para NO-cuentas", pedidosPage, "!isPaid && order.isOpenTab ?");

if (failed) {
  console.error("validate-table-orders: FAILED");
  process.exit(1);
}
console.log("validate-table-orders: OK");
