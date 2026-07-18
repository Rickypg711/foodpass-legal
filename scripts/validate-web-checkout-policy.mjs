/**
 * Web ordering policy — CURRENT (post menu-first pivot, Jul 2026):
 * customer web checkout accepts exactly TWO methods, each gated per vendor:
 *   - mercado_pago  → only when the restaurant is MP-eligible
 *   - pay_at_pickup → only when the vendor opted in (payAtPickupEnabled)
 * Ordering UI is available when EITHER gate is open; browse-only otherwise.
 * (Replaces the obsolete MP-only policy from before pay-at-pickup shipped.)
 * Run: node scripts/validate-web-checkout-policy.mjs
 */

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

let failed = 0;
function fail(msg) {
  console.error(msg);
  failed = 1;
}

// ── Policy module: the single source of truth for accepted methods ───────────
const policySrc = readFileSync(
  join(root, "lib/order/customerWebCheckoutPolicy.ts"),
  "utf8",
);
if (!policySrc.includes("assertCustomerWebPaymentMethod")) {
  fail("customerWebCheckoutPolicy must export assertCustomerWebPaymentMethod");
}
if (!policySrc.includes("customer_web_checkout_invalid_payment_method")) {
  fail("customerWebCheckoutPolicy must reject unknown methods");
}
if (!policySrc.includes("PAYMENT_METHOD_MERCADO_PAGO")) {
  fail("customerWebCheckoutPolicy must accept mercado_pago");
}
if (!policySrc.includes("PAYMENT_METHOD_PAY_AT_PICKUP")) {
  fail("customerWebCheckoutPolicy must accept pay_at_pickup");
}
if (!policySrc.includes("restaurantAllowsPayAtPickup")) {
  fail("customerWebCheckoutPolicy must export the pay-at-pickup vendor gate");
}
if (!policySrc.includes("payAtPickupEnabled === true")) {
  fail("pay-at-pickup must be vendor OPT-IN (payAtPickupEnabled === true, off by default)");
}
if (!policySrc.includes("restaurantSupportsWebCheckout")) {
  fail("customerWebCheckoutPolicy must export the MP eligibility gate");
}

// ── Order payload: every customer web order goes through the assert ──────────
const buildSrc = readFileSync(join(root, "lib/order/buildOrderPayload.ts"), "utf8");
if (!buildSrc.includes("assertCustomerWebPaymentMethod")) {
  fail("buildOrderPayload must enforce assertCustomerWebPaymentMethod");
}

// ── Checkout page: offers ONLY the methods the restaurant supports ───────────
const checkoutSrc = readFileSync(
  join(root, "app/menu/[restaurantId]/checkout/page.tsx"),
  "utf8",
);
if (!checkoutSrc.includes("restaurantAllowsPayAtPickup")) {
  fail("checkout must gate Pagar al recoger behind restaurantAllowsPayAtPickup");
}
if (!checkoutSrc.includes("payAtPickupAvailable")) {
  fail("checkout must track payAtPickupAvailable state");
}
if (!checkoutSrc.includes("Mercado Pago")) {
  fail("checkout must keep the Mercado Pago path");
}
if (!/mercadoPagoAvailable && !payAtPickupAvailable/.test(checkoutSrc)) {
  fail("checkout must handle the neither-method-available case");
}

// ── Ordering availability: EITHER gate opens the ordering UI ─────────────────
const webOrderingSrc = readFileSync(
  join(root, "lib/ordering/WebOrderingContext.tsx"),
  "utf8",
);
if (!webOrderingSrc.includes("restaurantSupportsWebCheckout")) {
  fail("WebOrderingContext must use restaurantSupportsWebCheckout");
}
if (!webOrderingSrc.includes("restaurantAllowsPayAtPickup")) {
  fail("WebOrderingContext must also open ordering for pay-at-pickup vendors");
}

// ── Menu: browse-only when no method is available ────────────────────────────
const menuSrc = readFileSync(
  join(root, "app/menu/[restaurantId]/page.tsx"),
  "utf8",
);
const menuCardSrc = readFileSync(join(root, "components/menu/MenuItemCard.tsx"), "utf8");
const cartBarSrc = readFileSync(join(root, "components/cart/CartBar.tsx"), "utf8");
const cartProviderSrc = readFileSync(join(root, "lib/cart/CartProvider.tsx"), "utf8");

if (!menuSrc.includes("useWebOrdering")) {
  fail("menu page must use WebOrderingContext");
}
if (!menuSrc.includes("orderingEnabled")) {
  fail("menu must pass orderingEnabled to MenuItemCard");
}
if (!menuCardSrc.includes("orderingEnabled")) {
  fail("MenuItemCard must support orderingEnabled (browse-only mode)");
}
if (!/orderingEnabled \?[\s\S]{0,400}: null/.test(menuCardSrc) && !/!orderingEnabled \? null/.test(menuCardSrc)) {
  fail("MenuItemCard must omit the Agregar control when ordering unavailable");
}
if (!cartBarSrc.includes("webOrderingAvailable")) {
  fail("CartBar must hide checkout when ordering unavailable");
}
if (!cartProviderSrc.includes("webOrderingAvailable")) {
  fail("CartProvider must gate the cart on webOrderingAvailable");
}
if (!cartProviderSrc.includes("cart_add_blocked_mp_unavailable")) {
  fail("CartProvider must log blocked addItem when ordering unavailable");
}

if (failed) process.exit(1);
console.log("OK: web ordering policy validated (MP + vendor-gated pay-at-pickup)");
