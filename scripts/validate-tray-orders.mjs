/**
 * Bandeja de Pedidos — candado (18-sep-2026).
 *
 * POR QUÉ: /vendor/pedidos leía solo 48 h y un pedido pendiente de 3+ días
 * desaparecía mientras el Panel lo contaba como "sin cobrar" (Luzz Pizza, 5
 * pedidos, $370). Este candado prueba: (1) los estados que siguen en bandeja,
 * (2) la unión de las dos lecturas, y (3) que la página use las dos.
 *
 * Run: node scripts/validate-tray-orders.mjs
 */
import { readFileSync } from "node:fs";
import { IN_TRAY_STATUSES, mergeOrdersById } from "../lib/order/trayOrders.ts";

let failed = 0;
function check(label, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    console.error(`FAIL ${label}\n  esperado: ${e}\n  recibido: ${a}`);
    failed = 1;
  }
}

check("estados en bandeja", [...IN_TRAY_STATUSES], ["pending", "preparing", "ready", "open_tab"]);

const at = (ms) => ({ toMillis: () => ms });
const recent = [
  { id: "hoy", createdAt: at(300), status: "completed" },
  { id: "ayer", createdAt: at(200), status: "pending" },
];
const inTray = [
  { id: "ayer", createdAt: at(200), status: "pending" },
  { id: "hace9dias", createdAt: at(10), status: "pending" },
  { id: "hace30dias", createdAt: at(1), status: "ready" },
];
const merged = mergeOrdersById(recent, inTray);
check("sin duplicados y del más nuevo al más viejo", merged.map((o) => o.id), ["hoy", "ayer", "hace9dias", "hace30dias"]);
check("el viejo en bandeja sí sale", merged.some((o) => o.id === "hace30dias"), true);
check("sin createdAt va al final, no truena", mergeOrdersById([{ id: "sinFecha" }], [{ id: "x", createdAt: at(5) }]).map((o) => o.id), ["x", "sinFecha"]);

const page = readFileSync(new URL("../app/vendor/pedidos/page.tsx", import.meta.url), "utf8");
check("Pedidos lee la bandeja por estado", page.includes('where("status", "in", IN_TRAY_STATUSES)'), true);
check("Pedidos une las dos lecturas", page.includes("mergeOrdersById("), true);
check("Pedidos sigue leyendo 48 h para Entregados hoy", page.includes('where("createdAt", ">=", Timestamp.fromDate(twoDaysAgo))'), true);

if (failed) process.exit(1);
console.log("OK validate-tray-orders");
