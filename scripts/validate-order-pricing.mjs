/**
 * El servidor cobra el precio del menú, no el que manda el teléfono
 * (10-oct-2026, FOODPASS/docs/PRECIO_EN_SERVIDOR_10_OCT.md).
 *
 * Qué amarra este candado:
 *  1. lib/order/orderPricing.cjs es el MISMO archivo que
 *     FOODPASS/functions/order_pricing.js (igual order_option_groups.cjs y los
 *     casos). Una sola regla de dinero para la ruta de la preferencia y para
 *     el webhook.
 *  2. Los casos espejo pasan aquí igual que en functions.
 *  3. El lector de opciones de ese archivo lee las descripciones igual que
 *     lib/menu/optionGroups.ts (el que usa el menú para cobrar en el carrito).
 *  4. create-preference cobra lo del servidor y el webhook compara contra eso.
 *
 * Corre con: npm run test:order-pricing
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { parseOptionGroupsFromDescription } from "../lib/menu/optionGroups.ts";

const require = createRequire(import.meta.url);
const pricing = require("../lib/order/orderPricing.cjs");
const { menuById, cases } = require("../lib/order/orderPricingCases.json");

const FOODPASS = "/Users/ricardoparedes/projects/FOODPASS";
let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`  ok  ${name}`);
}

// 1. Un solo archivo, dos lugares.
if (existsSync(`${FOODPASS}/functions/order_pricing.js`)) {
  check("orderPricing.cjs es idéntico a FOODPASS/functions/order_pricing.js", () => {
    assert.equal(
      readFileSync("lib/order/orderPricing.cjs", "utf8"),
      readFileSync(`${FOODPASS}/functions/order_pricing.js`, "utf8"),
      "Cambia la regla en FOODPASS/functions/order_pricing.js y copia el archivo tal cual a lib/order/orderPricing.cjs",
    );
  });
  check("order_option_groups.cjs es idéntico en los dos repos", () => {
    assert.equal(
      readFileSync("lib/order/order_option_groups.cjs", "utf8"),
      readFileSync(`${FOODPASS}/functions/order_option_groups.cjs`, "utf8"),
    );
  });
  check("los casos espejo son idénticos en los dos repos", () => {
    assert.equal(
      readFileSync("lib/order/orderPricingCases.json", "utf8"),
      readFileSync(`${FOODPASS}/functions/test/order_pricing_cases.json`, "utf8"),
    );
  });
} else {
  console.log("  --  FOODPASS no está en esta máquina: se salta la comparación de archivos");
}

// 2. Los mismos casos que corre functions.
for (const c of cases) {
  check(`precio del servidor: ${c.name}`, () => {
    const out = pricing.priceCustomerOrder({ order: c.order, menuById, restaurant: c.restaurant });
    assert.equal(out.priceable, c.expect.priceable);
    assert.equal(out.available, c.expect.available);
    assert.equal(out.serverTotal, c.expect.serverTotal);
    assert.equal(out.mismatch, c.expect.mismatch);
    assert.deepEqual(out.reasons, c.expect.reasons);
    if ("deliveryFee" in c.expect) assert.equal(out.deliveryFee, c.expect.deliveryFee);
    if ("currency" in c.expect) assert.equal(out.currency, c.expect.currency);
  });
}

// 3. Las opciones escritas en la descripción se leen igual que en el menú.
const DESCRIPCIONES = [
  ...Object.values(menuById).map((m) => m.description).filter(Boolean),
  "Elige tu salsa: Mango Habanero, Búfalo, BBQ.",
  "Rollo empanizado. Opcional: Camarón +$25, Res + Camarón +$35.",
  "Si la quieres de: Pollo, Res +$20, Mixta +$30",
  "Escoge tu tortilla: Maíz, Harina. Agrega: Queso +$15, Aguacate +$12.50.",
  "Elige tu tamaño: Chico, Mediano +$20, Grande +$40.50. Acompañada de: papas, ensalada.",
  "Selecciona el término: Medio, Tres cuartos, Bien cocido",
  "Extras: Tocino +$18, Huevo + 10, Doble carne (150 g, extra) +$45.",
  "Elige tu porción: Media, Entera +$60.",
  "Añade: Chile toreado, Cebolla asada.",
  "Elige tu salsa: Verde. Elige tu salsa: Roja, Macha.",
  "Sin opciones aquí, solo una descripción con: dos puntos.",
  "",
];
check("el lector de opciones del servidor coincide con el del menú", () => {
  for (const d of DESCRIPCIONES) {
    assert.deepEqual(
      pricing.parseOptionGroupsFromDescription(d),
      parseOptionGroupsFromDescription(d),
      `descripción: ${d}`,
    );
  }
  // Y de verdad leyó algo: si los dos lectores se rompieran igual, esto truena.
  const pizza = pricing.parseOptionGroupsFromDescription(menuById.pizza.description);
  assert.equal(pizza[0].name, "Tamaño");
  assert.equal(pizza[0].required, true);
  assert.deepEqual(pizza[0].options.map((o) => o.priceDelta), [0, 90, 150]);
});

// 4. La ruta cobra lo del servidor.
const route = readFileSync("app/api/mercado-pago/create-preference/route.ts", "utf8");
check("create-preference: el pedido del comensal se cobra con el precio del servidor", () => {
  const start = route.indexOf("if (isCustomerOrder(orderDoc)) {");
  const end = route.indexOf("} else {", start);
  assert.ok(start > 0 && end > start, "no encuentro la rama del pedido del comensal");
  const rama = route.slice(start, end);
  assert.match(rama, /priceOrderFromMenu\(db, restaurantId, orderDoc, restaurantData\)/);
  assert.match(rama, /items = preferenceItemsFrom\(pricing\)/);
  assert.match(rama, /orderTotal = pricing\.serverTotal/);
  assert.match(rama, /currency = pricing\.currency/);
  // Nada del pedido entra al cobro en esta rama.
  assert.doesNotMatch(rama, /order\.total|order\.items|order\.deliveryFee|it\.price/);
});
check("create-preference: el precio se guarda en el pedido antes de ir a Mercado Pago", () => {
  const guardar = route.indexOf('buildPricingAudit(pricing, { by: "create_preference", corrected: pricing.mismatch })');
  const cobrar = route.indexOf("fetch(MP_PREFERENCES_URL");
  assert.ok(guardar > 0 && cobrar > guardar);
});
check("create-preference: platillo apagado u opción agotada tampoco se cobra", () => {
  assert.ok(route.includes("if (!pricing.priceable || !pricing.available || !pricing.serverTotal || pricing.serverTotal <= 0) {"));
  assert.ok(route.includes('by: "create_preference_rejected"'));
});
check("create-preference: sin precio no hay preferencia, y el comensal lee por qué", () => {
  assert.match(route, /error: "order_needs_review", message: ORDER_NEEDS_REVIEW_MESSAGE/);
  assert.match(route, /status: 409/);
});
check("la preferencia va en la moneda del local", () => {
  const builder = readFileSync("lib/mercadoPago/buildPreferenceRequest.ts", "utf8");
  assert.equal((builder.match(/currency_id: "MXN"/g) ?? []).length, 0, "moneda cosida en la preferencia");
  assert.equal((builder.match(/currency_id: currency/g) ?? []).length, 2);
});

// 5. El camino de la ruta con un Firestore de mentira: lo que llega a Mercado Pago.
{
  const server = await import("../lib/order/serverOrderPricing.ts");
  const asked = [];
  const fakeDb = {
    collection: () => ({ doc: (rid) => ({ collection: () => ({ doc: (id) => ({ path: `restaurants/${rid}/menu/${id}`, id }) }) }) }),
    getAll: async (...refs) =>
      refs.map((r) => {
        asked.push(r.path);
        return { id: r.id, exists: Object.hasOwn(menuById, r.id), data: () => menuById[r.id] };
      }),
  };
  const sum = (items) => items.reduce((s, i) => s + Math.round(i.unit_price * 100) * i.quantity, 0) / 100;
  const cheat = {
    orderSource: "customer_web", paymentMethod: "mercado_pago", status: "payment_pending", orderType: "pickup",
    total: 1,
    items: [{ menuItemId: "taco", name: "Taco regalado", price: 0.08, quantity: 12, subtotal: 1 }],
  };

  const priced = await server.priceOrderFromMenu(fakeDb, "local1", cheat, {});
  check("ruta: pedido de $1 por 12 tacos llega a Mercado Pago en $300", () => {
    assert.deepEqual(asked, ["restaurants/local1/menu/taco"]);
    const items = server.preferenceItemsFrom(priced);
    assert.equal(sum(items), 300);
    assert.equal(priced.serverTotal, 300);
    assert.deepEqual(items, [{ title: "Taco de suadero", quantity: 12, unit_price: 25 }]);
  });

  // Lo que la ruta deja escrito en el pedido, y el reintento con ese pedido.
  const stored = {
    ...cheat,
    ...server.correctedOrderFields(cheat, priced),
    pricing: server.buildPricingAudit(priced, { by: "create_preference", corrected: priced.mismatch }),
  };
  check("ruta: el reintento cobra el precio que el servidor ya había fijado", () => {
    assert.equal(stored.total, 300);
    assert.equal(stored.pricing.clientTotal, 1);
    assert.equal(stored.pricing.corrected, true);
    const locked = server.lockedPricing(stored);
    assert.ok(locked);
    assert.equal(locked.serverTotal, 300);
    assert.equal(sum(server.preferenceItemsFrom(locked)), 300);
  });
  check("ruta: un pricing que no escribió create-preference no fija nada", () => {
    assert.equal(server.lockedPricing(cheat), null);
    assert.equal(server.lockedPricing({ ...stored, pricing: { ...stored.pricing, by: "order_created" } }), null);
    assert.equal(server.lockedPricing({ ...stored, pricing: { ...stored.pricing, priceable: false } }), null);
    assert.equal(server.lockedPricing({ ...stored, pricing: { ...stored.pricing, by: "create_preference_rejected" } }), null);
    // Guardado que no suma lo guardado: se calcula de nuevo.
    assert.equal(server.lockedPricing({ ...stored, pricing: { ...stored.pricing, serverTotal: 1 } }), null);
  });
  const delivery = await server.priceOrderFromMenu(
    fakeDb, "local1",
    { ...cheat, orderType: "delivery", deliveryFee: 0 },
    { deliveryEnabled: true, deliveryFee: 35 },
  );
  check("ruta: a domicilio suma el envío que puso el dueño", () => {
    const items = server.preferenceItemsFrom(delivery);
    assert.deepEqual(items.at(-1), { title: "Envío a domicilio", quantity: 1, unit_price: 35 });
    assert.equal(sum(items), 335);
  });
  const ghost = await server.priceOrderFromMenu(
    fakeDb, "local1", { ...cheat, items: [{ menuItemId: "fantasma", price: 1, quantity: 1, subtotal: 1 }] }, {},
  );
  check("ruta: platillo que no es de este local no tiene precio", () => {
    assert.equal(ghost.priceable, false);
    assert.equal(ghost.serverTotal, null);
  });
  check("el aviso al comensal no suena a robot ni promete nada", () => {
    assert.equal(
      server.ORDER_NEEDS_REVIEW_MESSAGE,
      "Un platillo de tu pedido cambió o ya no está disponible. Vuelve al menú y revisa tu pedido.",
    );
  });
}

// El otro lado: el webhook (functions) compara contra el precio del servidor.
if (existsSync(`${FOODPASS}/functions/mercadopago_webhook_logic.js`)) {
  check("webhook: compara el pago contra pricing.serverTotal y marca lo que no alcanza", () => {
    const logic = readFileSync(`${FOODPASS}/functions/mercadopago_webhook_logic.js`, "utf8");
    assert.match(logic, /require\('\.\/order_pricing'\)/);
    assert.match(logic, /p\.by === 'create_preference'/);
    assert.match(logic, /reason: 'amount_underpaid'/);
    const index = readFileSync(`${FOODPASS}/functions/index.js`, "utf8");
    assert.match(index, /isMoneyMismatchReason\(validation\.reason\)/);
    assert.match(index, /paymentMismatch:/);
  });
  check("reglas: el comensal no puede escribir pricing ni paymentMismatch", () => {
    const rules = readFileSync(`${FOODPASS}/firestore.rules`, "utf8");
    const keys = rules.slice(rules.indexOf("function customerOrderAllowedKeys()"), rules.indexOf("function orderAmountMax()"));
    assert.ok(keys.length > 0);
    assert.doesNotMatch(keys, /'pricing'|'paymentMismatch'|'mercadoPagoPaidAmount'/);
  });
}

console.log(`\nvalidate-order-pricing: ${passed} verificaciones OK`);
