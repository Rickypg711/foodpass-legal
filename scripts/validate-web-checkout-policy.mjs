/**
 * Web checkout: Mercado Pago only (no pay_at_pickup).
 * Run: node scripts/validate-web-checkout-policy.mjs
 */

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const checkoutSrc = readFileSync(
  join(root, "app/menu/[restaurantId]/checkout/page.tsx"),
  "utf8",
);
const buildSrc = readFileSync(join(root, "lib/order/buildOrderPayload.ts"), "utf8");

let failed = 0;
function fail(msg) {
  console.error(msg);
  failed = 1;
}

if (checkoutSrc.includes("Pagar al recoger")) {
  fail("checkout page must not show Pagar al recoger");
}
if (checkoutSrc.includes("Efectivo o terminal en el local")) {
  fail("checkout page must not show cash-at-pickup copy");
}
if (checkoutSrc.includes("PAYMENT_METHOD_PAY_AT_PICKUP")) {
  fail("checkout page must not import pay_at_pickup");
}
if (!checkoutSrc.includes("Pagar con Mercado Pago")) {
  fail("checkout submit must use Mercado Pago CTA");
}
if (!checkoutSrc.includes("MP_UNAVAILABLE_MESSAGE")) {
  fail("checkout must use MP_UNAVAILABLE_MESSAGE");
}

if (buildSrc.includes("PAYMENT_METHOD_PAY_AT_PICKUP")) {
  fail("buildOrderPayload must not default to pay_at_pickup");
}
if (!buildSrc.includes("assertCustomerWebPaymentMethod")) {
  fail("buildOrderPayload must enforce mercado_pago");
}

const policySrc = readFileSync(
  join(root, "lib/order/customerWebCheckoutPolicy.ts"),
  "utf8",
);
if (!policySrc.includes("customer_web_checkout_requires_mercado_pago")) {
  fail("customerWebCheckoutPolicy must reject non-MP methods");
}

if (failed) process.exit(1);
console.log("OK: web checkout Mercado Pago-only policy validated");
