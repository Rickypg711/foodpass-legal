/**
 * Premios y readiness — contrato de paridad con la app.
 *
 * POR QUE EXISTE: el 24 ago 2026 se descubrio que la web leia
 * `tier.hasMenuItem === true` como campo GUARDADO, cuando en Dart es un getter
 * calculado de `menuItemId != null`. Los premios que aplica la IA se guardan
 * SIN esa bandera, asi que la app los daba por validos y la web por invalidos
 * — para siempre. El ultimo en escribir isSetupComplete ganaba, y cuando
 * ganaba la web el local perdia el escaner y Mercado Pago quedaba pausado.
 * Le paso a Luxo grill steak house y a Sr & Sra Perro.
 *
 * Este script fija el contrato del evaluador web: la senal canonica es
 * `menuItemId` (igual que reward_tier.dart), y `hasMenuItem: true` guardado
 * solo se acepta por compatibilidad con docs legados. Si alguien vuelve a
 * leer la bandera como fuente de verdad, truena aqui.
 *
 * Run: node scripts/validate-readiness-tiers.mjs
 */

import assert from "node:assert/strict";
import { evaluateReadiness } from "../lib/readiness/evaluate.ts";

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
  firstPurchaseReward: { enabled: true, menuItemId: "m1", menuItemName: "Agua" },
  rewardTiers: [{ id: "tier_1", visitsRequired: 10, menuItemId: "m1", menuItemName: "Agua" }],
  ...overrides,
});

// ── 1. EL CASO QUE ROMPIO: tier de la IA, sin hasMenuItem, debe ser VALIDO ──
// Forma exacta que escribe reward_recommendation_core.js (antes del sellado):
// {id, visitsRequired, menuItemId, menuItemName, menuItemDescription}
{
  const r = evaluateReadiness(base({
    rewardTiers: [
      { id: "tier_1", visitsRequired: 5, menuItemId: "m1", menuItemName: "Agua", menuItemDescription: "Natural" },
      { id: "tier_2", visitsRequired: 10, menuItemId: "m2", menuItemName: "Taco", menuItemDescription: "De suadero" },
    ],
  }), 10);
  assert.ok(
    !r.reasons.includes("reward_tiers"),
    `tier de la IA (menuItemId sin hasMenuItem) debe ser valido, reasons=${JSON.stringify(r.reasons)}`,
  );
  assert.equal(r.isComplete, true, "un local con tiers de la IA no debe degradar a setup");
}

// ── 2. Doc legado: hasMenuItem:true guardado SIN menuItemId sigue valido ────
{
  const r = evaluateReadiness(base({ rewardTiers: [{ hasMenuItem: true }] }), 10);
  assert.ok(!r.reasons.includes("reward_tiers"), "doc legado con la bandera guardada debe ser valido");
}

// ── 3. Tier sin menuItemId y sin bandera sigue INVALIDO ─────────────────────
{
  const r = evaluateReadiness(base({ rewardTiers: [{ id: "t", visitsRequired: 5 }] }), 10);
  assert.ok(!r.reasons.includes("reward_tiers"), "7-sep: los premios ya no bloquean active");
  assert.ok(r.loyaltyGaps.includes("reward_tiers"), "tier sin menuItemId ni bandera: sigue siendo hueco de lealtad");
}

// ── 4. UN solo tier malo invalida el conjunto (regla .every de la app) ──────
{
  const r = evaluateReadiness(base({
    rewardTiers: [
      { id: "t1", visitsRequired: 5, menuItemId: "m1" },
      { id: "t2", visitsRequired: 10 },
    ],
  }), 10);
  assert.ok(!r.reasons.includes("reward_tiers"), "7-sep: un tier invalido no degrada a setup");
  assert.ok(r.loyaltyGaps.includes("reward_tiers"), "basta un tier sin premio para que los tiers sigan siendo hueco");
}

// ── 5. menuItemId vacio o con espacios NO cuenta como premio ────────────────
{
  const r = evaluateReadiness(base({ rewardTiers: [{ id: "t", visitsRequired: 5, menuItemId: "  " }] }), 10);
  assert.ok(!r.reasons.includes("reward_tiers"), "7-sep: menuItemId en blanco no degrada a setup");
  assert.ok(r.loyaltyGaps.includes("reward_tiers"), "menuItemId en blanco: sigue siendo hueco");
}

// ── 6. Lista vacia sigue invalida (mientras el dueño no haya decidido) ─────
{
  const r = evaluateReadiness(base({ rewardTiers: [] }), 10);
  assert.ok(!r.reasons.includes("reward_tiers"), "7-sep: sin tiers el local sigue siendo active");
  assert.ok(r.loyaltyGaps.includes("reward_tiers"), "pero se reporta como hueco de lealtad");
  // Con la pantalla de premios guardada, apagar es decisión: ver
  // validate-readiness-opt-out.mjs (5-sep).
}

// ── 7. firstPurchaseReward: menuItemId es senal canonica, nombre es respaldo ─
{
  const conId = evaluateReadiness(base({
    firstPurchaseReward: { enabled: true, menuItemId: "m1" },
  }), 10);
  assert.ok(!conId.reasons.includes("first_purchase_reward"), "FPR con solo menuItemId debe ser valido");

  const conNombre = evaluateReadiness(base({
    firstPurchaseReward: { enabled: true, menuItemName: "Agua" },
  }), 10);
  assert.ok(!conNombre.reasons.includes("first_purchase_reward"), "FPR con solo nombre debe ser valido");

  // Desde el 5-sep la bienvenida apagada NO bloquea `active` (decisión
  // 2-sep): es un hueco informativo (loyaltyGaps) que el cerebro persigue.
  const apagado = evaluateReadiness(base({
    firstPurchaseReward: { enabled: false, menuItemId: "m1" },
  }), 10);
  assert.ok(!apagado.reasons.includes("first_purchase_reward"), "FPR apagado ya no bloquea active");
  assert.equal(apagado.isComplete, true, "con tiers puestos y bienvenida apagada el local es active");
  assert.ok(apagado.loyaltyGaps.includes("first_purchase_reward"), "pero sigue reportado como hueco");
}

console.log("validate-readiness-tiers: OK");
