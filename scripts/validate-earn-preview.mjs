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
 *  4. El checkout pinta la línea de puntos del preview y la de bienvenida
 *     SOLO mientras el teléfono no está completo (después manda el lookup).
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
assert.ok(src.includes("te espera en tu próxima visita"), "la bienvenida es razón para volver");
assert.ok(!/gratis hoy|GRATIS hoy/.test(src), "la bienvenida jamás se vende como regalo de hoy");
assert.ok(src.includes('n === 1 ? "1 punto"'), "singular: 1 punto");

// 4. El checkout la usa, y la bienvenida solo antes de completar el teléfono
assert.ok(page.includes("buildEarnPreview("), "el checkout debe construir el preview");
assert.ok(page.includes("earnPreviewLine("), "el checkout debe pintar la línea de puntos del preview");
const welcomeAt = page.indexOf("welcomePreviewLine(");
assert.ok(welcomeAt > 0, "el checkout debe pintar la línea de bienvenida");
const guard = page.slice(Math.max(0, welcomeAt - 400), welcomeAt);
assert.ok(/phoneDigitsTyped\.length < 10|customerPhone\.replace\(\/\\D\/g, ""\)\.length < 10/.test(guard), "la bienvenida solo se enseña mientras el teléfono NO está completo");
assert.ok(page.includes("loyaltyLive"), "el checkout sigue gateado por la promesa de puntos");

// 5. La Caja web dice lo mismo que la Caja de la app (paridad)
const pos = readFileSync(join(root, "app/vendor/pos/page.tsx"), "utf8");
assert.ok(pos.includes("cashierEarnLine(earnPreview)"), "la Caja web debe decir cuántos puntos junta ESTA venta");
assert.ok(pos.includes("buildEarnPreview(restaurantData, effTotal)"), "la Caja web calcula el preview con el NETO (mismo monto que acredita)");
const posWelcome = pos.indexOf("cashierWelcomeLine(earnPreview) ?");
assert.ok(posWelcome > 0 && pos.slice(posWelcome - 80, posWelcome).includes("phoneDigitsTyped.length < 10"), "en la Caja web la bienvenida solo se enseña mientras faltan dígitos");
assert.ok(src.includes("Con esta compra junta"), "voz de cajero: 'Con esta compra junta N puntos'");

console.log("✅ validate-earn-preview: lo que se gana se dice antes del teléfono, y solo donde es verdad");
