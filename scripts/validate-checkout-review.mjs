/**
 * Cierre del pedido: solo se dice lo que es verdad, y gastar puntos es a propósito (10-oct-2026).
 *
 * POR QUÉ EXISTE: en el simulador, el cierre del pedido de la app le prometió el regalo de bienvenida a un
 * cliente con 63 puntos en ese local, y un premio de 50 puntos quedó elegido al deslizar la pantalla. La web
 * tenía la misma promesa a ciegas ("Deja tu número y tu X de bienvenida te espera…").
 *
 * ESPEJO de FOODPASS test/orders/checkout_review_test.dart: mismos casos, mismas frases.
 *
 * Contrato (lib/order/checkoutReview.ts + checkout/page.tsx + CheckoutRedemption.tsx):
 *  1. A quien ya compró en el local nunca se le promete la bienvenida.
 *  2. La cuenta de puntos es la del cobro: suma lo ganado, descuenta el premio solo si alcanza.
 *  3. El premio se usa con su botón ("Usar" / "Quitar"), no tocando la fila.
 *  4. El 409 `order_needs_review` llega al comensal con su mensaje; los mensajes técnicos del servidor no.
 *  5. Los eventos del cierre existen con los mismos nombres que en la app y no llevan datos personales.
 *
 * Run: node --experimental-strip-types scripts/validate-checkout-review.mjs
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CheckoutPaymentError,
  checkoutErrorCode,
  checkoutPointsLedger,
  checkoutStanding,
  checkoutWelcomeLine,
  pointsLeftLine,
  redemptionLine,
} from "../lib/order/checkoutReview.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");

// 1. ¿Primera compra aquí?
assert.equal(checkoutStanding({ verified: false, walletKnown: false, walletVisits: 0 }), "unknown");
assert.equal(checkoutStanding({ verified: true, walletKnown: false, walletVisits: 0 }), "unknown");
assert.equal(checkoutStanding({ verified: true, walletKnown: true, walletVisits: 0 }), "first");
assert.equal(checkoutStanding({ verified: true, walletKnown: true, walletVisits: 4 }), "returning");

assert.equal(checkoutWelcomeLine("Pepperoni", "returning"), null, "a quien ya compró aquí NUNCA se le promete");
assert.equal(
  checkoutWelcomeLine("Pepperoni", "first"),
  "Es tu primera compra aquí. Tu Pepperoni de bienvenida te espera en tu próxima visita",
);
assert.equal(
  checkoutWelcomeLine("Pepperoni", "unknown"),
  "Si es tu primera compra aquí, tu Pepperoni de bienvenida te espera en tu próxima visita",
);
for (const s of ["first", "returning", "unknown"]) {
  assert.equal(checkoutWelcomeLine(null, s), null, "local sin regalo de bienvenida: nada, sea quien sea");
  assert.equal(checkoutWelcomeLine("  ", s), null);
}

// 2. Cuenta de puntos (mismos números que la prueba de la app)
assert.deepEqual(checkoutPointsLedger({ balance: 63, earn: 7, spend: 50 }), {
  spendApplies: true,
  after: 20,
  leftBeforeEarning: 13,
});
assert.equal(checkoutPointsLedger({ balance: 63, earn: 7, spend: 0 }).after, 70);
const corto = checkoutPointsLedger({ balance: 10, earn: 7, spend: 50 });
assert.equal(corto.spendApplies, false, "si no alcanza, no se descuenta (igual que al cobrar)");
assert.equal(corto.after, 17);
assert.equal(corto.leftBeforeEarning, 0);
assert.equal(redemptionLine("Mexicana", 50), "Mexicana con 50 puntos");
assert.equal(redemptionLine("Agua", 1), "Agua con 1 punto");
assert.equal(pointsLeftLine(13), "Te quedan 13 puntos.");
assert.equal(pointsLeftLine(1), "Te queda 1 punto.");

// Las mismas frases viven en la app (app_es.arb): si una cambia sin la otra, truena.
const arbPath = join(root, "..", "..", "projects", "FOODPASS", "lib", "l10n", "app_es.arb");
if (existsSync(arbPath)) {
  const arb = JSON.parse(readFileSync(arbPath, "utf8"));
  assert.equal(
    arb.cierreWelcomeFirst.replace("{reward}", "Pepperoni"),
    `${checkoutWelcomeLine("Pepperoni", "first")}.`,
    "bienvenida (primera compra): app y web dicen lo mismo",
  );
  assert.equal(
    arb.cierreWelcomeMaybe.replace("{reward}", "Pepperoni"),
    `${checkoutWelcomeLine("Pepperoni", "unknown")}.`,
    "bienvenida (sin saber quién es): app y web dicen lo mismo",
  );
  assert.ok(arb.cierreRewardLine.includes("{name} con {points} puntos"), "premio elegido: misma frase en la app");
  assert.ok(arb.cierreRewardLeft.includes("Te quedan {left} puntos."), "lo que queda: misma frase en la app");
  const pricing = read("lib/order/serverOrderPricing.ts");
  assert.ok(
    pricing.includes(arb.cierreErrNeedsReview.split(". ")[0]),
    "el mensaje del 409 en la app es el mismo que manda el servidor",
  );
} else {
  console.log("  (FOODPASS no está junto a este repo: se salta el espejo con app_es.arb)");
}

// 3. El premio se usa con su botón
const redemption = read("components/loyalty/CheckoutRedemption.tsx");
assert.ok(redemption.includes('{isSel ? "Quitar" : "Usar"}'), "cada premio trae su botón Usar / Quitar");
const rowAt = redemption.indexOf("tiers.map((t) =>");
const row = redemption.slice(rowAt, redemption.indexOf("{selected ?", rowAt));
assert.ok(/<div\s+key=\{t\.id\}/.test(row), "la fila del premio es un contenedor, no un botón de fila completa");
assert.equal((row.match(/onClick=/g) || []).length, 1, "un solo punto de toque por premio: su botón");
assert.ok(redemption.includes("standing: checkoutStanding("), "el canje reporta si el comensal ya compró aquí");
assert.ok(redemption.includes("pcSnap.data()?.visits"), "primera compra = cartera sin visitas (misma regla que el cobro)");

// 4. Errores
const needs = new CheckoutPaymentError("Un platillo de tu pedido cambió", "order_needs_review");
assert.equal(checkoutErrorCode(needs), "order_needs_review");
assert.equal(checkoutErrorCode(new CheckoutPaymentError("x", "network_error")), "offline");
assert.equal(checkoutErrorCode(new CheckoutPaymentError("x", "http_500")), "payment_failed");
assert.equal(checkoutErrorCode(new Error("permission-denied")), "unknown");
const client = read("lib/mercadoPago/createPreferenceClient.ts");
assert.ok(
  client.includes("code === ORDER_NEEDS_REVIEW_CODE && data.message"),
  "solo el mensaje del 409 order_needs_review se le enseña al comensal",
);
assert.ok(!client.includes("data.message ?? data.error"), "un código o mensaje técnico del servidor no llega a la pantalla");
const page = read("app/menu/[restaurantId]/checkout/page.tsx");
assert.ok(page.includes("trackCheckoutError({ restaurantId, code: checkoutErrorCode(err) })"), "cada error del cierre se mide con su código");
assert.ok(page.includes("redemptionLine(redemption.name, redemption.points)"), "el premio elegido se repite antes del botón");

// 5. Eventos (mismos nombres que la app) sin datos personales
const events = read("lib/analytics/orderEvents.ts");
const block = events.slice(events.indexOf("Cierre del pedido"));
for (const name of [
  "checkout_review_shown",
  "checkout_identity_prefilled",
  "checkout_redeem_selected",
  "checkout_redeem_unselected",
  "checkout_submit",
  "checkout_error",
]) {
  assert.ok(block.includes(`"${name}"`), `falta el evento ${name}`);
}
for (const banned of [/customerPhone/, /customerName/, /(^|[^\w])(phone|name)\s*:/m]) {
  assert.ok(!banned.test(block), `los eventos del cierre no llevan ${banned}`);
}

console.log("✅ validate-checkout-review: bienvenida solo a quien es nuevo, puntos como al cobrar, premio con su botón");
