/**
 * Cart editing: increment/decrement/remove on checkout.
 * Run: node scripts/validate-cart-editing.mjs
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

const providerSrc = readFileSync(join(root, "lib/cart/CartProvider.tsx"), "utf8");
const checkoutSrc = readFileSync(
  join(root, "app/menu/[restaurantId]/checkout/page.tsx"),
  "utf8",
);
const linesSrc = readFileSync(join(root, "components/cart/CheckoutCartLines.tsx"), "utf8");
const mathSrc = readFileSync(join(root, "lib/cart/cartLineMath.ts"), "utf8");
const confirmSrc = readFileSync(join(root, "lib/cart/confirmRemoveLine.ts"), "utf8");

if (!providerSrc.includes("incrementLine")) fail("CartProvider must expose incrementLine");
if (!providerSrc.includes("decrementLine")) fail("CartProvider must expose decrementLine");
if (!providerSrc.includes("decrementCartLine")) fail("CartProvider must use decrementCartLine");
if (!checkoutSrc.includes("CheckoutCartLines")) fail("checkout must use CheckoutCartLines");
if (!linesSrc.includes("decrementLine")) fail("CheckoutCartLines must call decrementLine");
if (!linesSrc.includes("incrementLine")) fail("CheckoutCartLines must call incrementLine");
if (!linesSrc.includes("removeLine")) fail("CheckoutCartLines must call removeLine");
if (!linesSrc.includes("Eliminar")) fail("CheckoutCartLines must show remove action");
if (!mathSrc.includes("updateCartLineQuantity")) fail("cartLineMath must update quantity");
if (!confirmSrc.includes("¿Seguro que quieres quitar este producto del carrito?")) {
  fail("confirmRemoveLine must use Spanish confirmation message");
}
if (!linesSrc.includes("confirmRemoveCartLine")) {
  fail("CheckoutCartLines must confirm before removeLine");
}
if (linesSrc.match(/decrementLine[\s\S]{0,200}confirmRemoveCartLine/)) {
  fail("minus/decrement must not use remove confirmation");
}

if (failed) process.exit(1);
console.log("OK: web cart editing validated");
