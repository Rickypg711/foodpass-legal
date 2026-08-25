// ⚖️ Etapa 2 de la regla de dinero — contrato del módulo único de cobro.
// Run: node scripts/validate-register-payment.mjs

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { paidOrderFields } from "../lib/pos/paidOrderFields.ts";

// ── 1. LA definición de "pagado" (espejo exacto de paid_order_update.dart —
//       los tests Dart fijan los MISMOS nombres de campo) ───────────────────
{
  const quick = paidOrderFields("cash");
  assert.equal(quick.paymentStatus, "paid");
  assert.equal(quick.paymentMethod, "cash");
  assert.equal(quick.isOpenTab, false, "pagada SALE de Cuentas — anti doble cobro");
  assert.ok("updatedAt" in quick);
  assert.ok(!("status" in quick), "cobro rápido NO completa: la cocina sigue su flujo");

  const close = paidOrderFields("card", { close: true });
  assert.equal(close.status, "completed");
  assert.ok("completedAt" in close);
}

// ── 2. Candados de fuente: NADIE más escribe el pago ────────────────────────
const pedidos = readFileSync(new URL("../app/vendor/pedidos/page.tsx", import.meta.url), "utf8");
const pos = readFileSync(new URL("../app/vendor/pos/page.tsx", import.meta.url), "utf8");
for (const [name, src] of [["pedidos", pedidos], ["pos", pos]]) {
  // El patrón de ESCRITURA (con coma de objeto literal) — la anotación de
  // tipo `"paid" | "pending"` es legítima y no cuenta.
  assert.ok(!/paymentStatus:\s*"paid"\s*,/.test(src),
    `${name}: prohibido escribir el pago a mano — usa registerPayment.ts`);
}
assert.ok(pedidos.includes("registerOrderPayment("), "pedidos delega el cobro rápido");
assert.ok(pos.includes("registerTabGroupPayment("), "la Caja delega el cierre de grupo");

// ── 3. El espejo Dart existe y las capas del app lo usan ────────────────────
const dartBuilder = readFileSync(
  "/Users/ricardoparedes/projects/FOODPASS/lib/orders/paid_order_update.dart", "utf8");
assert.ok(dartBuilder.includes("'paymentStatus': 'paid'"), "builder Dart define pagado");
const posDart = readFileSync(
  "/Users/ricardoparedes/projects/FOODPASS/lib/services/pos_service.dart", "utf8");
assert.ok(posDart.includes("...paidOrderFields("), "app: cierre de grupo usa el builder");
const payDart = readFileSync(
  "/Users/ricardoparedes/projects/FOODPASS/lib/mercado_pago/services/payment_service.dart", "utf8");
assert.ok(payDart.includes("...paidOrderFields("), "app: processPayment usa el builder");

console.log("validate-register-payment: OK");
