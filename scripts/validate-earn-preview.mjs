/**
 * Lo que se gana se dice ANTES de pedir el teléfono — y solo donde es verdad.
 *
 * POR QUÉ EXISTE: robo del 5-sep-2026 (Fluxsales: "Acumulas 37 Boras con este
 * pedido"). La captura de teléfono es el número muerto de Comeleal; la razón
 * para darlo tiene que estar a la vista antes del campo, no en el ticket.
 *
 * Contrato (lib/loyalty/earnPreview.ts + app/menu/[id]/checkout/page.tsx):
 *  1. Misma fórmula que acredita: base + floor(total/step), con la política
 *     del local (USD paso 2 también).
 *  2. Sin nada que ganar (loyaltyReady false) no se promete NADA — ni puntos
 *     ni bienvenida. Decisión 5-sep: nadie promete puntos sin premios.
 *  3. La bienvenida es razón para VOLVER, nunca "gratis hoy".
 *  4. El checkout pinta la línea de puntos del preview. La de bienvenida, solo
 *     lo que es verdad (10-oct-2026): nunca a quien ya compró en el local; sin
 *     saber quién es, "si es tu primera compra aquí". Las frases y sus casos
 *     viven en lib/order/checkoutReview.ts (scripts/validate-checkout-review.mjs).
 *
 * Run: node scripts/validate-earn-preview.mjs
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(join(root, "lib/loyalty/earnPreview.ts"), "utf8");
const page = readFileSync(join(root, "app/menu/[restaurantId]/checkout/page.tsx"), "utf8");

// --- Puro: reimplementación mínima del módulo para probar la regla sin alias @/
const evaluate = readFileSync(join(root, "lib/readiness/evaluate.ts"), "utf8");
assert.ok(evaluate.includes("return data.loyaltyReady !== false;"), "la promesa de puntos debe seguir colgada de loyaltyReady");
assert.ok(src.includes("restaurantPromisesPoints(restaurantData)"), "el preview debe pasar por restaurantPromisesPoints (sin premios no hay promesa)");
assert.ok(src.includes("earnPolicyFromRestaurant("), "los puntos salen de la política real, no de un número a mano");
assert.ok(src.includes("policy.base + Math.floor(orderTotal / policy.step)"), "misma fórmula que acredita: base + floor(total/step)");
assert.ok(src.includes("parseFirstVisitReward("), "la bienvenida se lee del doc, no se inventa");
const review = readFileSync(join(root, "lib/order/checkoutReview.ts"), "utf8");
assert.ok(review.includes("te espera en tu próxima visita"), "la bienvenida es razón para volver");
assert.ok(src.includes('checkoutWelcomeLine(p.welcomeRewardName, "unknown")'), "sin saber quién es, la bienvenida va con \"si es tu primera compra\"");
assert.ok(!src.includes("`Deja tu número"), "la promesa a ciegas de la bienvenida no regresa");
assert.ok(!/gratis hoy|GRATIS hoy/.test(src), "la bienvenida jamás se vende como regalo de hoy");
assert.ok(src.includes('n === 1 ? "1 punto"'), "singular: 1 punto");

// 4. El checkout la usa, y la bienvenida depende de si ya compró aquí
assert.ok(page.includes("buildEarnPreview("), "el checkout debe construir el preview");
assert.ok(page.includes("earnPreviewLine("), "el checkout debe pintar la línea de puntos del preview");
const welcomeAt = page.indexOf("const welcomeLine = checkoutWelcomeLine(");
assert.ok(welcomeAt > 0, "el checkout debe pintar la línea de bienvenida con checkoutWelcomeLine");
const guard = page.slice(Math.max(0, welcomeAt - 400), welcomeAt + 250);
assert.ok(guard.includes("standingFor.phone === phone10"), "lo que sabemos del comensal vale solo para el número que tecleó");
assert.ok(/standing,\s*\)/.test(guard), "la bienvenida se decide con el standing del comensal");
assert.ok(!page.includes("welcomePreviewLine("), "el checkout ya no pinta la bienvenida a ciegas");
assert.ok(page.includes("loyaltyLive"), "el checkout sigue gateado por la promesa de puntos");

// 5. La Caja web dice lo mismo que la Caja de la app (paridad)
const pos = readFileSync(join(root, "app/vendor/pos/page.tsx"), "utf8");
assert.ok(pos.includes("cashierEarnLine(earnPreview)"), "la Caja web debe decir cuántos puntos junta ESTA venta");
assert.ok(pos.includes("buildEarnPreview(restaurantData, effTotal)"), "la Caja web calcula el preview con el NETO (mismo monto que acredita)");
const posWelcome = pos.indexOf("cashierWelcomeLine(earnPreview) ?");
assert.ok(posWelcome > 0 && pos.slice(posWelcome - 80, posWelcome).includes("phoneDigitsTyped.length < 10"), "en la Caja web la bienvenida solo se enseña mientras faltan dígitos");
assert.ok(src.includes("Con esta compra junta"), "voz de cajero: 'Con esta compra junta N puntos'");

console.log("✅ validate-earn-preview: lo que se gana se dice antes del teléfono, y solo donde es verdad");
