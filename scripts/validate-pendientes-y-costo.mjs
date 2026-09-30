#!/usr/bin/env node
// Candado (30-sep-2026): el consejo del Panel dice el costo del problema en
// pesos y trae la cola de pendientes ("tres cosas listas: sí, sí, no").
// Espejo de test/dashboard/pendientes_y_costo_test.dart en FOODPASS.
//
//   1. "Esto te cuesta $X": vendorInsights.stake_es (dinero REAL que el
//      cerebro ya sumó) va como línea bajo el título. Jamás proyección.
//   2. Cola: vendorInsights.queue → hasta 3 consejos; el principal como
//      siempre, los otros en "Pendientes" con su "sí" (el mismo botón del
//      consejo, como link) y su "Ahora no". El "no" se anota en ownerActions
//      (nba_skip), se esconde al instante y el cerebro lo descansa 14 días.
//
// Run: node scripts/validate-pendientes-y-costo.mjs
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const page = readFileSync("app/vendor/page.tsx", "utf8");
const lib = readFileSync("lib/ownerActions.ts", "utf8");
const code = page.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "");

// 1. El costo en pesos: se lee del cerebro, va bajo el título, en tinta.
assert.match(page, /nbaStake: nbaOverridden \? null : \(\(typeof ins\?\.stake_es === "string"/, "stake_es se lee del cerebro; con el código corregido, no");
assert.match(page, /\{first\.stake && \(\s*<p className="mt-0\.5 text-\[15px\] font-semibold leading-\[22px\]" style=\{\{ color: INK_MUTED \}\}>\{first\.stake\}<\/p>/, "el costo va bajo el título, en tinta (ni rojo ni naranja)");

// 2. La cola: hasta 3, resuelta con la misma regla, sin repetidos, sin stable.
assert.match(page, /const NBA_QUEUE_MAX = 3;/);
assert.match(page, /if \(!code \|\| code === "stable" \|\| code === "unknown"\) continue;/);
assert.match(page, /if \(resolve\(code\) !== code\) continue;/, "si el readiness o la prueba lo cambian, ya no es ese consejo");
assert.match(page, /if \(seen\.has\(code\)\) continue;/);
assert.match(page, /if \(out\.length >= NBA_QUEUE_MAX - 1\) break;/);
assert.match(page, /nbaQueue: nbaOverridden\s*\?\s*\[\]\s*:\s*parseNbaQueue\(ins\?\.queue, nbaCode/, "con el código principal corregido, la cola del cerebro es de otro día");

// 3. "Ahora no": nba_skip, al instante, y los de 14 días antes del refresco.
assert.match(page, /const NBA_SKIP_DAYS = 14;/);
assert.match(page, /logOwnerAction\(restaurantId, "nba_skip", \{ actionCode: code \}\)/);
assert.match(page, /where\("type", "==", "nba_skip"\)/, "los \"no\" de los últimos 14 días también cuentan");
assert.match(page, /\.filter\(\(i\) => !skipped\.has\(i\.actionCode\)\)/);
assert.equal((code.match(/>\s*Ahora no\s*</g) || []).length, 2, "principal + pendientes");
assert.match(page, /actionCode: "keep_going",/, "sin nada que hacer: 'vas avanzando'");
assert.match(page, /\{items\.length > 0 && \(\s*<button/, "sin pendientes no hay 'Ahora no'");
assert.match(lib, /"nba_skip"/, "el rastro conoce nba_skip");

// 4. Pendientes: tarjeta blanca con borde, el "sí" es el mismo botón como link.
assert.match(page, />Pendientes<\/p>/);
assert.match(page, /<div className="mt-2 rounded-xl bg-white" style=\{\{ border: `1px solid \$\{BORDER\}` \}\}>/);
assert.match(page, /function PendingAdviceRow\(/);
assert.match(page, /ctaLabel=\{getNbaCtaLabel\(item\.actionCode, atRiskShown\(metrics\)\)\}/);
assert.match(page, /ctaHref=\{getNbaCtaHref\(item\.actionCode\)\}/);
assert.match(page, /borderBottom: `1px solid \$\{HAIRLINE\}`/);
// La lista de "escríbele hoy" solo con el principal REAL (no promovido).
assert.match(page, /const showWinback = actionCode === "send_winback" && actionCode === mainCode && winbackToday\.length > 0;/);
// Sin emojis ni sombras en la sección.
const section = code.slice(code.indexOf("function AICoachPreviewCard("), code.indexOf("Bloques del panel (9-sep-2026)"));
assert.doesNotMatch(section, /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u, "sin emojis");
assert.doesNotMatch(section, /shadow-/, "sin sombras");

// 5. Repo hermano: cerebro y reglas.
const brainPath = "/Users/ricardoparedes/projects/FOODPASS/functions/restaurant_brain.js";
if (existsSync(brainPath)) {
  const brain = readFileSync(brainPath, "utf8");
  assert.match(brain, /const ACTION_QUEUE_MAX = 3;/);
  assert.match(brain, /const ACTION_DISMISS_DAYS = 14;/);
  assert.match(brain, /stake_es: stakeOf\(recAction\),/);
  assert.match(brain, /DATO EN PESOS \(real, de sus propias ventas; úsalo tal cual\)/);
  const rules = readFileSync("/Users/ricardoparedes/projects/FOODPASS/firestore.rules", "utf8");
  assert.match(rules, /type in \['nba_tap', 'winback_send', 'nba_skip'\]/);
}

console.log("✅ validate-pendientes-y-costo: costo en pesos bajo el título y cola de pendientes con sí / ahora no");
