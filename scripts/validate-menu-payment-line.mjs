/**
 * La línea bajo el nombre en /menu dice SOLO lo que el local ofrece.
 *
 * POR QUÉ EXISTE: 9-sep-2026, Mi Ángel (solo "pagar al recoger", sin Mercado
 * Pago) mostraba "Pago seguro con Mercado Pago". Regla: jamás prometer lo que
 * no existe.
 *
 * Run: node --experimental-strip-types scripts/validate-menu-payment-line.mjs
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(join(root, "app/menu/[restaurantId]/MenuView.tsx"), "utf8");
assert.ok(src.includes("menuPaymentLine("), "MenuView debe usar menuPaymentLine");
assert.ok(
  !src.includes('? "Ordena en línea · Pago seguro con Mercado Pago"'),
  "la línea de Mercado Pago no puede estar cosida en MenuView",
);
const lib = readFileSync(join(root, "lib/order/menuPaymentLine.ts"), "utf8");
for (const must of ["restaurantSupportsWebCheckout", "restaurantAllowsPayAtPickup", "LINE_PICKUP"]) {
  assert.ok(lib.includes(must), `menuPaymentLine.ts debe usar ${must}`);
}
console.log("✅ menu payment line: contrato OK");
