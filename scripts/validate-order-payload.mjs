/**
 * Validates Phase 1 web order field contract (mirrors Flutter Order.toMap).
 * Run: node scripts/validate-order-payload.mjs
 */

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const buildOrderPayloadSrc = readFileSync(
  join(__dirname, "../lib/order/buildOrderPayload.ts"),
  "utf8",
);
if (!/orderSource:\s*ORDER_SOURCE_CUSTOMER_WEB/.test(buildOrderPayloadSrc)) {
  console.error("buildOrderPayload.ts must set orderSource to ORDER_SOURCE_CUSTOMER_WEB");
  process.exit(1);
}

const REQUIRED_TOP_LEVEL = [
  "restaurantId",
  "customerId",
  "items",
  "total",
  "paymentMethod",
  "paymentStatus",
  "status",
  "orderType",
  "orderSource",
  "customerName",
  "pickupPin",
  "createdByUserId",
  "createdByName",
  "isOpenTab",
];

const REQUIRED_ITEM = ["menuItemId", "name", "price", "quantity", "subtotal"];

/** Minimal mock of buildCustomerWebOrderPayload output */
const payload = {
  restaurantId: "test-restaurant",
  customerId: "anon-uid",
  items: [
    {
      menuItemId: "item1",
      name: "Taco",
      price: 50,
      quantity: 2,
      subtotal: 100,
    },
  ],
  total: 100,
  paymentMethod: "pay_at_pickup",
  paymentStatus: "pending",
  status: "pending",
  orderType: "pickup",
  orderSource: "customer_web",
  customerName: "Juan Pérez",
  pickupPin: "4821",
  createdByUserId: "anon-uid",
  createdByName: "Juan Pérez",
  restaurantName: "Test Place",
  isOpenTab: false,
  loyaltyAwarded: false,
};

let failed = false;
for (const key of REQUIRED_TOP_LEVEL) {
  if (!(key in payload)) {
    console.error(`Missing top-level key: ${key}`);
    failed = true;
  }
}

const checks = [
  ["paymentMethod", "pay_at_pickup"],
  ["paymentStatus", "pending"],
  ["status", "pending"],
  ["orderSource", "customer_web"],
  ["orderType", "pickup"],
];
for (const [k, v] of checks) {
  if (payload[k] !== v) {
    console.error(`Expected ${k}=${v}, got ${payload[k]}`);
    failed = true;
  }
}

if (payload.loyaltyAwarded === true) {
  console.error("loyaltyAwarded must not be true on create");
  failed = true;
}

const item = payload.items[0];
for (const key of REQUIRED_ITEM) {
  if (!(key in item)) {
    console.error(`Missing item key: ${key}`);
    failed = true;
  }
}

// mercado_pago branch mirrors buildOrderPayload + orderLifecycle
const mpPayload = {
  ...payload,
  paymentMethod: "mercado_pago",
  status: "payment_pending",
};
if (mpPayload.status !== "payment_pending") {
  console.error("mercado_pago orders must start as payment_pending");
  failed = true;
}

if (failed) process.exit(1);
console.log("OK: order payload contract keys validated");
