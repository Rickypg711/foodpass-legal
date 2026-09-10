// 🛵 Entrega a domicilio (9-sep-2026) — candado del contrato.
//
// POR QUÉ EXISTE: Central Fast Food (Las Matas de Farfán, RD) entrega él
// mismo; todo le caía como "para recoger" y una clienta puso "Daly dígale a
// Harol" en el NOMBRE para dejar el recado de entrega. Reglas que no pueden
// regresar:
//   1. delivery SOLO sin mesa, SOLO si lo eligió, SOLO con dirección real.
//   2. El envío se SUMA al total (es lo que "¿Ya te pagó?" cobra).
//   3. Mismos nombres de campo que ya lee la app: orderType "delivery",
//      deliveryAddress, deliveryFee (OrderDetailScreen.dart).
//   4. Default apagado: sin deliveryEnabled === true no existe la opción.
//   5. La dirección viaja en el WhatsApp y se pinta en Pedidos.
//   6. Mercado Pago cobra el envío como renglón (si no, cobra de menos).
//
// Run: node --experimental-strip-types scripts/validate-delivery.mjs

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DELIVERY_ADDRESS_MAX,
  DELIVERY_CHOICE_COPY,
  deliveryFeeOf,
  deliveryPaymentLine,
  deliveryZoneOf,
  isUsableDeliveryAddress,
  normalizeDeliveryAddress,
  restaurantOffersDelivery,
} from "../lib/order/deliveryOptions.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");

// ── 1. La verdad del toggle: default APAGADO ────────────────────────────────
assert.equal(restaurantOffersDelivery({}), false, "sin campo = no entrega");
assert.equal(restaurantOffersDelivery({ deliveryEnabled: "true" }), false, "solo boolean true");
assert.equal(restaurantOffersDelivery({ deliveryEnabled: true }), true);

// ── 2. Envío: número sano o cero ────────────────────────────────────────────
assert.equal(deliveryFeeOf({}), 0);
assert.equal(deliveryFeeOf({ deliveryFee: -5 }), 0, "negativo = 0");
assert.equal(deliveryFeeOf({ deliveryFee: "abc" }), 0);
assert.equal(deliveryFeeOf({ deliveryFee: 50 }), 50);
assert.equal(deliveryFeeOf({ deliveryFee: 12.345 }), 12.35, "centavos");
assert.equal(deliveryZoneOf({ deliveryZone: "  Solo la ciudad " }), "Solo la ciudad");
assert.equal(deliveryZoneOf({}), "");

// ── 3. Dirección: texto libre, limpio, con tope; "aquí" no cuenta ────────────
assert.equal(normalizeDeliveryAddress("  casa   azul\n frente al colmado "), "casa azul frente al colmado");
assert.equal(normalizeDeliveryAddress("x".repeat(500)).length, DELIVERY_ADDRESS_MAX);
assert.equal(isUsableDeliveryAddress("aquí"), false);
assert.equal(isUsableDeliveryAddress(null), false);
assert.equal(isUsableDeliveryAddress("Calle Duarte #12, casa azul"), true);

// ── 4. Copy: "al recibir", jamás "al recoger" en modo domicilio ─────────────
for (const k of ["cash", "card", "transfer"]) {
  const c = DELIVERY_CHOICE_COPY[k];
  assert.ok(c && c.title && c.sub && c.cta, `copy de ${k}`);
  for (const t of [c.title, c.sub, c.cta, deliveryPaymentLine(k)]) {
    assert.ok(!/recoger|mostrador/i.test(t), `a domicilio no dice "recoger/mostrador": ${t}`);
  }
}
assert.ok(/recibir/.test(deliveryPaymentLine("nada")), "línea genérica dice al recibir");

// ── 5. buildOrderPayload: delivery solo sin mesa + con dirección; envío sumado ─
const payload = read("lib/order/buildOrderPayload.ts");
assert.ok(
  /!tableNumber && input\.fulfillment === "delivery" && deliveryAddress\.length > 0/.test(payload),
  "delivery exige: sin mesa, elegido, con dirección",
);
assert.ok(/ORDER_TYPE_DELIVERY/.test(payload), "usa la constante canónica");
assert.ok(
  /const total = Math\.round\(\(itemsTotal \+ deliveryFee\) \* 100\) \/ 100/.test(payload),
  "el envío se SUMA al total",
);
assert.ok(/payload\.deliveryAddress = deliveryAddress/.test(payload), "guarda deliveryAddress");
assert.ok(/if \(deliveryFee > 0\) payload\.deliveryFee = deliveryFee/.test(payload), "guarda deliveryFee solo > 0");

const types = read("lib/types/order.ts");
assert.ok(/ORDER_TYPE_DELIVERY = "delivery"/.test(types), 'orderType "delivery" — el mismo que lee la app');

// ── 6. Checkout: la opción existe SOLO si el local entrega, y pide dirección ─
const checkout = read("app/menu/[restaurantId]/checkout/page.tsx");
assert.ok(/setDeliveryOffered\(restaurantOffersDelivery\(data\)\)/.test(checkout), "checkout lee deliveryEnabled");
assert.ok(/deliveryOffered && !tableNumber \?/.test(checkout), "el selector no aparece con mesa ni sin toggle");
assert.ok(/esDomicilio && !isUsableDeliveryAddress\(deliveryAddress\)/.test(checkout), "valida la dirección antes de crear");
assert.ok(/fulfillment: esDomicilio \? "delivery" : "pickup"/.test(checkout), "manda fulfillment");
assert.ok(/formatPrice\(totalConEnvio\)/.test(checkout), "el botón cobra platillos + envío");

// ── 7. Pedidos y WhatsApp pintan la dirección ───────────────────────────────
const pedidos = read("app/vendor/pedidos/page.tsx");
assert.ok(/order\.orderType === "delivery" && order\.deliveryAddress\?\.trim\(\)/.test(pedidos), "Pedidos pinta la dirección");
assert.ok(!/"Delivery"\}/.test(pedidos), 'chip en cristiano: "A domicilio", no "Delivery"');
const wa = read("lib/order/formatWhatsappMessage.ts");
assert.ok(/\*A domicilio:\* \$\{address\}/.test(wa), "la dirección viaja en el WhatsApp");

// ── 8. Mercado Pago cobra el envío ──────────────────────────────────────────
const mp = read("app/api/mercado-pago/create-preference/route.ts");
assert.ok(/title: "Envío a domicilio", quantity: 1, unit_price: deliveryFee/.test(mp), "MP recibe el envío como renglón");

// ── 9. Configuración guarda los tres campos con los nombres canónicos ───────
const config = read("app/vendor/configuracion/page.tsx");
for (const must of ["deliveryEnabled,", "deliveryFee:", "deliveryZone:"]) {
  assert.ok(config.includes(must), `Configuración guarda ${must}`);
}

console.log("✅ delivery: contrato OK");
