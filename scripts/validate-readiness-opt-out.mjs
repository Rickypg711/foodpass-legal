/**
 * Apagar premios a propósito NO degrada a `setup` — candado del 5-sep-2026.
 *
 * POR QUÉ EXISTE: dos dueños reales en una semana (CURANDERO 1-sep, CENTRAL
 * FAST FOOD 4-sep) apagaron sus premios desde Recompensas y el checker los
 * mandó de vuelta a "termina tu configuración": panel en modo primer día y
 * escáner con "termina tu setup" sobre un local con menú, horario y ventas
 * reales en la Caja. Ricardo, 5-sep: "they should be complete, no reward,
 * not stuck in setup".
 *
 * Contrato (espejo EXACTO de restaurant_readiness_evaluator.dart y de
 * evaluateRestaurantReadinessForRewards en functions/reward_recommendation_ai.js;
 * el candado de la app es test/services/restaurant_readiness_opt_out_test.dart):
 *  1. `first_purchase_reward` NUNCA bloquea `active` (decisión 2-sep).
 *  2. `reward_tiers` bloquea SOLO si el dueño no ha decidido
 *     (`rewardsConfigured !== true`). El borrador de la IA sigue esperando al
 *     que nunca guardó la pantalla — el muro #1 del embudo no se abre.
 *  3. Pantalla guardada + todo apagado → loyaltyOptedOut, completo, active.
 *  4. `loyaltyReady` (algo que ganar) es OTRA verdad: gate del escáner y de
 *     la visibilidad para diners, jamás del status.
 *  5. El opt-out no perdona lo demás (horario, menú, datos).
 *  6. Los 5 campos persistidos salen de UNA sola función.
 *
 * Run: node scripts/validate-readiness-opt-out.mjs
 */

import assert from "node:assert/strict";
import {
  evaluateReadiness,
  readinessFieldsForFirestore,
  isRestaurantVisibleToDiners,
} from "../lib/readiness/evaluate.ts";

const DIAS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const horario = () => Object.fromEntries(DIAS.map((d) => [d, {
  isClosed: false,
  openingTime: { hour: 9, minute: 0 },
  closingTime: { hour: 17, minute: 0 },
}]));
const base = (overrides = {}) => ({
  name: "Prueba",
  address: "Calle 1",
  phone: "+52 614 000 0000",
  categories: ["Tacos"],
  businessHours: horario(),
  hoursConfirmed: true,
  firstPurchaseReward: { enabled: true, menuItemId: "m1", menuItemName: "Agua" },
  rewardTiers: [{ id: "t1", visitsRequired: 10, menuItemId: "m1", menuItemName: "Agua" }],
  ...overrides,
});

// ── 1. CURANDERO: tiers puestos, bienvenida apagada → active y escanea ──────
{
  const r = evaluateReadiness(base({
    rewardsConfigured: true,
    firstPurchaseReward: { enabled: false, menuItemId: null },
  }), 15);
  assert.deepEqual(r.reasons, []);
  assert.equal(r.isComplete, true);
  assert.equal(r.loyaltyReady, true, "hay tiers: sí hay algo que ganar");
  assert.equal(r.loyaltyOptedOut, false);
  assert.deepEqual(r.loyaltyGaps, ["first_purchase_reward"]);
}

// ── 2. CENTRAL FAST FOOD: pantalla guardada, sin tiers ni bienvenida → active ─
{
  const r = evaluateReadiness(base({
    rewardsConfigured: true,
    firstPurchaseReward: { enabled: false, menuItemId: null },
    rewardTiers: [],
  }), 62);
  assert.deepEqual(r.reasons, []);
  assert.equal(r.isComplete, true);
  assert.equal(r.loyaltyOptedOut, true);
  assert.equal(r.loyaltyReady, false, "nada que ganar: escáner en pausa");
  assert.deepEqual(readinessFieldsForFirestore(r), {
    isSetupComplete: true,
    setupIncompleteReasons: [],
    status: "active",
    loyaltyReady: false,
    loyaltyOptedOut: true,
  });
}

// ── 3. Sin tiers y SIN haber guardado premios sigue siendo paso pendiente ───
{
  const r = evaluateReadiness(base({
    firstPurchaseReward: { enabled: false },
    rewardTiers: [],
  }), 10);
  assert.deepEqual(r.reasons, ["reward_tiers"], "el muro #1 no se abre solo");
  assert.equal(r.isComplete, false);
  assert.equal(r.loyaltyOptedOut, false);
  assert.equal(readinessFieldsForFirestore(r).status, "setup");
}

// ── 4. Algo prendido (solo bienvenida) no es opt-out: tiers siguen pendientes ─
{
  const r = evaluateReadiness(base({ rewardsConfigured: true, rewardTiers: [] }), 10);
  assert.equal(r.loyaltyReady, true);
  assert.equal(r.loyaltyOptedOut, false);
  assert.deepEqual(r.reasons, ["reward_tiers"]);
}

// ── 5. El opt-out no perdona lo demás ───────────────────────────────────────
{
  const r = evaluateReadiness(base({
    rewardsConfigured: true,
    firstPurchaseReward: { enabled: false },
    rewardTiers: [],
    hoursConfirmed: false,
  }), 10);
  assert.deepEqual(r.reasons, ["business_hours"]);
  assert.equal(r.isComplete, false);
  assert.equal(r.loyaltyOptedOut, true);
}

// ── 6. Visibilidad para diners: completo + loyaltyReady false → invisible ───
{
  assert.equal(isRestaurantVisibleToDiners({ isSetupComplete: true, loyaltyReady: false }), false);
  assert.equal(isRestaurantVisibleToDiners({ isSetupComplete: true }), true, "doc viejo: completo implica premios");
  assert.equal(isRestaurantVisibleToDiners({ isSetupComplete: false, loyaltyReady: true }), false);
}

// ── 7. La página de premios avisa lo real: escáner en pausa, no "incompleto" ─
{
  const { readFileSync } = await import("node:fs");
  const page = readFileSync(new URL("../app/vendor/setup/recompensas/page.tsx", import.meta.url), "utf8");
  assert.ok(page.includes("function loyaltyOffIf("), "la consecuencia se calcula sobre loyaltyReady");
  assert.ok(page.includes("rewardsConfigured: true"), "evaluar el parche como si ya estuviera guardado (guardar ES la decisión)");
  assert.ok(!page.includes('.reasons\n    .some((r) => r === "first_purchase_reward"'), "ya no se lee `reasons` para la consecuencia");
}

console.log("validate-readiness-opt-out: OK");
