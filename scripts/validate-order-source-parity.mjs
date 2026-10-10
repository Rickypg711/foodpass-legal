/**
 * Candado (9-oct-2026): de dónde vino cada pedido.
 *
 * 1. La lista ORDER_SOURCES es la misma, en el mismo orden, que la app
 *    (FOODPASS lib/orders/order_attribution.dart) y el servidor
 *    (FOODPASS functions/order_attribution.js). Si FOODPASS no está en esta
 *    máquina (FOODPASS_DIR o ~/projects/FOODPASS), se valida contra la lista
 *    fija de abajo, que es la misma.
 * 2. `?src=` del link → order.source; mesa, referido y bolsa sin `src`.
 * 3. El payload y el checkout lo usan; la Caja escribe source "pos".
 *
 * Run: node --experimental-strip-types scripts/validate-order-source-parity.mjs
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const {
  ORDER_SOURCES,
  parseOrderSource,
  parseSourceRef,
  orderSourceFromSearch,
  storedOrderSourceValue,
  parseStoredOrderSource,
  resolveWebOrderSource,
} = await import("../lib/order/orderAttribution.ts");

const EXPECTED = [
  "pos", "qr_menu", "web_link", "hoy_pick", "hoy_top_dish", "hoy_recent_post", "hoy_nearby",
  "hoy_jugada", "map", "reward", "search", "referral", "winback", "push", "friends", "reorder", "unknown",
];
assert.deepEqual([...ORDER_SOURCES], EXPECTED, "la lista de la web cambió: cámbiala también en la app y el servidor");

function quotedListAfter(src, marker) {
  const start = src.indexOf(marker);
  assert.ok(start >= 0, `falta ${marker}`);
  const open = src.indexOf("[", start);
  const close = src.indexOf("]", open);
  return [...src.slice(open, close).matchAll(/["']([a-z_]+)["']/g)].map((m) => m[1]);
}

const foodpass = process.env.FOODPASS_DIR || join(homedir(), "projects", "FOODPASS");
const jsPath = join(foodpass, "functions", "order_attribution.js");
const dartPath = join(foodpass, "lib", "orders", "order_attribution.dart");
if (existsSync(jsPath)) {
  assert.deepEqual(quotedListAfter(readFileSync(jsPath, "utf8"), "const ORDER_SOURCES"), EXPECTED, "servidor ≠ web");
  console.log("✅ paridad con el servidor (functions/order_attribution.js)");
} else {
  console.log("ℹ️  FOODPASS no está en esta máquina: paridad solo contra la lista fija");
}
if (existsSync(dartPath)) {
  const dart = readFileSync(dartPath, "utf8");
  const block = dart.slice(dart.indexOf("static const List<String> all"), dart.indexOf("];", dart.indexOf("static const List<String> all")));
  const values = [...block.matchAll(/\b([a-zA-Z]+),/g)].map((m) => {
    const v = dart.match(new RegExp(`static const String ${m[1]} = '([a-z_]+)'`));
    return v && v[1];
  });
  assert.deepEqual(values, EXPECTED, "app ≠ web");
  console.log("✅ paridad con la app (lib/orders/order_attribution.dart)");
}

// parse
assert.equal(parseOrderSource(" WINBACK "), "winback");
assert.equal(parseOrderSource("facebook"), null);
assert.equal(parseSourceRef("abc_1-X"), "abc_1-X");
assert.equal(parseSourceRef("a/b"), null);

// ?src= → origen guardado; un link nunca dice "pos"
assert.deepEqual(orderSourceFromSearch("?src=winback&sref=msg_1"), { source: "winback", ref: "msg_1" });
assert.deepEqual(orderSourceFromSearch("?src=push"), { source: "push", ref: null });
assert.equal(orderSourceFromSearch("?src=pos"), null);
assert.equal(orderSourceFromSearch("?src=unknown"), null);
assert.equal(orderSourceFromSearch("?src=inventado"), null);
assert.equal(orderSourceFromSearch("?utm_source=bolsa"), null);
const now = Date.UTC(2026, 9, 9);
const raw = storedOrderSourceValue({ source: "winback", ref: "m1" }, now);
assert.deepEqual(parseStoredOrderSource(raw, now + 1000), { source: "winback", ref: "m1" });
assert.equal(parseStoredOrderSource(raw, now + 8 * 86400000), null, "vence a los 7 días");
assert.equal(parseStoredOrderSource("{basura", now), null);

// src → order.source (con la precedencia de la app)
const stored = parseStoredOrderSource(raw, now);
assert.deepEqual(resolveWebOrderSource({ stored }), { source: "winback", sourceRef: "m1" });
assert.deepEqual(resolveWebOrderSource({ stored, tableNumber: "4" }), { source: "qr_menu", sourceRef: null }, "mesa gana");
assert.deepEqual(resolveWebOrderSource({ referralCode: "ACDEFG" }), { source: "referral", sourceRef: null });
assert.deepEqual(resolveWebOrderSource({ entrySource: "bolsa" }), { source: "qr_menu", sourceRef: null });
assert.deepEqual(resolveWebOrderSource({}), { source: "web_link", sourceRef: null });
assert.deepEqual(resolveWebOrderSource({ stored: { source: "pos", ref: null } }), { source: "web_link", sourceRef: null });
console.log("✅ ?src= → order.source; mesa, referido y bolsa sin src");

// Cableado (por fuente: buildOrderPayload importa con "@/", node no lo resuelve)
const payloadSrc = readFileSync(new URL("../lib/order/buildOrderPayload.ts", import.meta.url), "utf8");
assert.ok(/resolveWebOrderSource\(\{[\s\S]*stored: input\.storedOrderSource/.test(payloadSrc), "buildOrderPayload decide source con resolveWebOrderSource");
assert.ok(/payload\.source = attribution\.source;/.test(payloadSrc), "buildOrderPayload siempre escribe source");
const createSrc = readFileSync(new URL("../lib/order/createCustomerOrder.ts", import.meta.url), "utf8");
assert.ok(/storedOrderSource: readStoredOrderSource\(params\.restaurantId\)/.test(createSrc), "el checkout lee el src guardado");
const layoutSrc = readFileSync(new URL("../app/menu/[restaurantId]/MenuRestaurantLayoutClient.tsx", import.meta.url), "utf8");
assert.ok(/captureOrderSource\(restaurantId\)/.test(layoutSrc), "el menú guarda el src al abrir");
const posSrc = readFileSync(new URL("../app/vendor/pos/page.tsx", import.meta.url), "utf8");
assert.ok(/orderSource: "pos",\s*\/\/[^\n]*\n\s*source: "pos",/.test(posSrc), "la Caja escribe source pos");
console.log("validate-order-source-parity: OK");
