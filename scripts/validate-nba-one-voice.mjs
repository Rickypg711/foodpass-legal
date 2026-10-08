// Una sola voz (8-oct-2026): cuando la web corrige el código del consejo en
// vivo, el texto sale del cerebro (vendorInsights.copyByCode, premios on/off),
// no de su copia local, que se desviaba ("¿tu número, para avisarte de promos?").
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../app/vendor/page.tsx", import.meta.url), "utf8");
assert.ok(page.includes("function brainCopyFor("), "existe brainCopyFor");
assert.ok(page.includes("ins?.copyByCode"), "lee copyByCode del cerebro");
assert.ok(page.includes("brainCopyFor(ins, nbaCode, r.loyaltyReady !== false)?.title ?? getNbaFallbackTitle(nbaCode)"), "título corregido: cerebro primero");
assert.ok(page.includes("brainCopyFor(ins, nbaCode, r.loyaltyReady !== false)?.body ?? getNbaFallbackBody(nbaCode"), "cuerpo corregido: cerebro primero");
assert.ok(page.includes("m.title_es_off") && page.includes("m.body_es_off"), "premios apagados: versión _off");
assert.ok(!page.includes("para avisarte de promos?"), "la copia local ya no dice 'para avisarte de promos'");
console.log("✅ validate-nba-one-voice: el código corregido habla con la voz del cerebro");
