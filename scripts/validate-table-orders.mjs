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

if (failed) {
  console.error("validate-table-orders: FAILED");
  process.exit(1);
}
console.log("validate-table-orders: OK");
