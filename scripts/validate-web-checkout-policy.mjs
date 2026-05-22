/**
 * Web ordering policy: Mercado Pago only; menu blocks add-to-cart when MP unavailable.
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
if (policySrc.includes("WEB_ORDERING_UNAVAILABLE_TITLE")) {
  fail("remove menu unavailable banner constants from policy");
}
if (policySrc.includes("WEB_ORDERING_ITEM_UNAVAILABLE_HINT")) {
  fail("remove per-item unavailable hint constant");
}

const menuSrc = readFileSync(
  join(root, "app/menu/[restaurantId]/page.tsx"),
  "utf8",
);
const menuCardSrc = readFileSync(join(root, "components/menu/MenuItemCard.tsx"), "utf8");
const cartBarSrc = readFileSync(join(root, "components/cart/CartBar.tsx"), "utf8");
const cartProviderSrc = readFileSync(join(root, "lib/cart/CartProvider.tsx"), "utf8");
const webOrderingSrc = readFileSync(
  join(root, "lib/ordering/WebOrderingContext.tsx"),
  "utf8",
);

if (menuSrc.includes("Pagar al recoger")) {
  fail("menu page must not show Pagar al recoger");
}
if (!menuSrc.includes("WebOrderingContext")) {
  fail("menu must use WebOrderingContext for MP eligibility");
}
if (!menuSrc.includes("useWebOrdering")) {
  fail("menu page must use WebOrderingContext");
}
if (menuSrc.includes("Pedidos en tienda")) {
  fail("menu must not show unavailable ordering banner");
}
if (menuSrc.includes("WEB_ORDERING_UNAVAILABLE")) {
  fail("menu must not import unavailable banner copy");
}
if (!menuSrc.includes("orderingEnabled")) {
  fail("menu must pass orderingEnabled to MenuItemCard");
}
if (!menuCardSrc.includes("orderingEnabled")) {
  fail("MenuItemCard must support orderingEnabled");
}
if (menuCardSrc.includes("Pedidos disponibles directamente en tienda")) {
  fail("MenuItemCard must not repeat per-item unavailable text");
}
if (menuSrc.includes("Consulta disponibilidad y precios en el restaurante")) {
  fail("menu must not show long unavailable footer");
}
if (/disabled[\s\S]{0,120}Agregar/.test(menuCardSrc)) {
  fail("MenuItemCard must not show disabled Agregar when ordering unavailable");
}
if (!/orderingEnabled \?[\s\S]*Agregar[\s\S]*: null/.test(menuCardSrc)) {
  fail("MenuItemCard must omit Agregar when ordering unavailable");
}
if (!cartBarSrc.includes("webOrderingAvailable")) {
  fail("CartBar must hide checkout when MP unavailable");
}
if (!cartProviderSrc.includes("cart_add_blocked_mp_unavailable")) {
  fail("CartProvider must block addItem when MP unavailable");
}
if (!cartProviderSrc.includes("cart_cleared_mp_unavailable")) {
  fail("CartProvider must clear cart when MP unavailable");
}
if (!webOrderingSrc.includes("restaurantSupportsWebCheckout")) {
  fail("WebOrderingContext must use restaurantSupportsWebCheckout");
}

if (failed) process.exit(1);
console.log("OK: web ordering Mercado Pago policy validated (menu + checkout)");
