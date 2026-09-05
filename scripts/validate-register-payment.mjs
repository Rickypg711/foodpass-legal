// ⚖️ Etapa 2 de la regla de dinero — contrato del módulo único de cobro.
// Run: node scripts/validate-register-payment.mjs

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  paidOrderFields,
  POS_PAYMENT_OPTIONS,
  tipStaysWithStaff,
  acceptedPaymentMethods,
  paymentMethodsSentence,
  pickupPaymentLine,
} from "../lib/pos/paidOrderFields.ts";

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

  // 🏦 Transferencia (5-sep-2026, primer dueño dominicano): es un método de
  // cobro de primera clase — pagado, sale de Cuentas, igual que efectivo.
  const transfer = paidOrderFields("transfer");
  assert.equal(transfer.paymentStatus, "paid");
  assert.equal(transfer.paymentMethod, "transfer");
  assert.equal(transfer.isOpenTab, false);
}

// ── 1b. Las TRES formas de recibir dinero, en todas las pantallas ───────────
// Antes había dos botones (efectivo/tarjeta) y el dueño que cobra por
// transferencia tenía que mentirle a la Caja: tarjeta rompía propinas y
// reportes; efectivo rompía el corte. Un solo arreglo de opciones y las
// pantallas lo mapean — ninguna puede quedarse con dos.
assert.deepEqual(
  POS_PAYMENT_OPTIONS.map((o) => o.key),
  ["cash", "card", "transfer"],
  "las opciones de cobro son efectivo, tarjeta y transferencia, en ese orden",
);
assert.ok(tipStaysWithStaff("cash"), "propina en efectivo: el mesero ya la tiene");
assert.ok(!tipStaysWithStaff("card"), "propina en tarjeta: la cobró el negocio");
assert.ok(!tipStaysWithStaff("transfer"), "propina por transferencia: la cobró el negocio");

// ── 1c. 🎚️ El dueño apaga lo que no acepta (Central Fast Food: sin terminal) ─
assert.deepEqual(acceptedPaymentMethods(undefined), ["cash", "card", "transfer"], "sin doc: las tres");
assert.deepEqual(acceptedPaymentMethods({}), ["cash", "card", "transfer"], "sin campo: las tres");
assert.deepEqual(acceptedPaymentMethods({ paymentMethods: [] }), ["cash", "card", "transfer"], "vacío: las tres");
assert.deepEqual(acceptedPaymentMethods({ paymentMethods: ["bitcoin"] }), ["cash", "card", "transfer"], "nada válido: las tres");
assert.deepEqual(acceptedPaymentMethods({ paymentMethods: ["transfer", "cash"] }), ["cash", "transfer"],
  "se respeta el orden canónico, no el del doc");
assert.deepEqual(acceptedPaymentMethods({ paymentMethods: [" Card "] }), ["card"], "tolera espacios/mayúsculas");
assert.equal(paymentMethodsSentence(["cash", "transfer"]), "Efectivo o transferencia");
assert.equal(paymentMethodsSentence(["cash", "card", "transfer"]), "Efectivo, tarjeta o transferencia");
assert.equal(paymentMethodsSentence(["card"]), "Tarjeta");

// ── 1d. 🏦 Lo que el comensal dijo al ordenar, en su página y en Pedidos ─────
assert.equal(pickupPaymentLine("transfer"), "🏦 Pagas por transferencia al recoger");
assert.equal(pickupPaymentLine("cash"), "💵 Pagas en efectivo al recoger");
assert.equal(pickupPaymentLine("card"), "💳 Pagas con tarjeta al recoger");
assert.equal(pickupPaymentLine(undefined), "💵 Pagas al recoger en el local", "pedidos viejos: la línea de siempre");

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
for (const [name, src] of [["pedidos", pedidos], ["pos", pos]]) {
  assert.ok(src.includes("paymentOptions.map("),
    `${name}: los botones de cobro se mapean de la lista canónica filtrada, no de una lista a mano`);
  assert.ok(!/\{ key: "cash", emoji/.test(src),
    `${name}: prohibida una lista de métodos a mano — se queda sin transferencia`);
}
// 🎚️ Las pantallas que cobran FILTRAN por lo que el dueño aceptó — la lista
// completa solo vive en Configuración (donde se prende/apaga) y en el default.
for (const [name, src] of [["pedidos", pedidos], ["pos", pos]]) {
  assert.ok(src.includes("acceptedPaymentOptions("),
    `${name}: los botones salen de acceptedPaymentOptions (Configuración manda)`);
  assert.ok(!/POS_PAYMENT_OPTIONS\.map\(/.test(src),
    `${name}: prohibido mapear la lista completa — se ignoraría lo que apagó el dueño`);
}
const configuracion = readFileSync(new URL("../app/vendor/configuracion/page.tsx", import.meta.url), "utf8");
assert.ok(/paymentMethods:\s*acceptedMethods/.test(configuracion), "configuración guarda paymentMethods");
assert.ok(configuracion.includes("Tiene que quedar al menos una."), "configuración: no se pueden apagar las tres");
const checkout = readFileSync(new URL("../app/menu/[restaurantId]/checkout/page.tsx", import.meta.url), "utf8");
assert.ok(checkout.includes("paymentMethodsSentence("), "el cliente ve las formas de pago reales, no un texto fijo");
assert.ok(!checkout.includes("Efectivo o tarjeta en el local"), "checkout: copy fijo 'Efectivo o tarjeta' eliminado");
// 🏦 §1d (fuente): lo que dijo el comensal viaja del checkout al mesero y a su página.
{
  const orderPage = readFileSync(new URL("../app/menu/[restaurantId]/order/[orderId]/page.tsx", import.meta.url), "utf8");
  assert.ok(orderPage.includes("pickupPaymentLine(order?.pickupPaymentMethod)"), "la página del pedido repite lo que dijo el comensal");
  assert.ok(checkout.includes("pickupPaymentMethod: enMesaSePagaAlFinal ? null : effectivePickupPayMethod"),
    "checkout manda lo que dijo el comensal, nunca en mesa");
  assert.ok(pedidos.includes("El cliente dijo:"), "Pedidos le enseña al mesero lo que dijo el cliente");
}
const reportes = readFileSync(new URL("../app/vendor/reportes/page.tsx", import.meta.url), "utf8");
assert.ok(reportes.includes("tipStaysWithStaff("),
  "reportes: la cubeta de propinas usa tipStaysWithStaff (transferencia cae con tarjeta)");

// ── 2b. Candado last-10: el teléfono del cierre se normaliza, no se tira ─────
// Antes `customerPhone.length === 10` sobre 12 dígitos ("52"+número) PERDÍA la
// captura en silencio (caso Pecado Escondido, 26-ago-2026).
const registerSrc = readFileSync(new URL("../lib/pos/registerPayment.ts", import.meta.url), "utf8");
assert.ok(/phone10 = phone10\.slice\(-10\)/.test(registerSrc),
  "registerPayment: normaliza customerPhone a last-10 antes del gate de 10 dígitos");
assert.ok(!/customerPhone\.length === 10 \? \{ customerPhone \}/.test(registerSrc),
  "registerPayment: prohibido gatear sobre el crudo — un 52+número se tiraba");

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
