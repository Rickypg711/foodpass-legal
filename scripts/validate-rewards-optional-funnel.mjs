#!/usr/bin/env node
/**
 * Candado 7-sep-2026: los PREMIOS SALIERON DEL EMBUDO (decisión de Ricardo).
 *
 * Por qué: 10 de 24 locales en `setup` estaban atorados SOLO por
 * `reward_tiers` — con nombre, horario y menú puestos — y el primer paso
 * tras reclamar el demo era la página de premios. Los premios son
 * opcionales: viven en loyaltyReady/loyaltyGaps, el NBA los empuja con
 * números, y nunca bloquean `active` ni son paso obligatorio del wizard.
 *
 * Espejo: functions/reward_recommendation_ai.js y
 * lib/services/restaurant_readiness_evaluator.dart (tests candado en FOODPASS).
 *
 * Run: node scripts/validate-rewards-optional-funnel.mjs
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { evaluateReadiness } from "../lib/readiness/evaluate.ts";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const base = {
  name: "Tacos", address: "Calle 1", phone: "6141234567", categories: ["tacos"],
  businessHours: { Monday: { openingTime: { hour: 9, minute: 0 }, closingTime: { hour: 18, minute: 0 } } },
  hoursConfirmed: true,
};

// 1. Sin tiers, sin bienvenida, sin decidir: ACTIVE. Lealtad en pausa.
{
  const r = evaluateReadiness({ ...base, rewardTiers: [], firstPurchaseReward: { enabled: false } }, 10);
  assert.deepEqual(r.reasons, [], "reward_tiers ya no es razón de setup");
  assert.equal(r.isComplete, true);
  assert.equal(r.loyaltyReady, false);
  assert.ok(r.loyaltyGaps.includes("reward_tiers"), "sigue reportado como hueco de lealtad");
}
// 2. Tier inválido tampoco degrada.
{
  const r = evaluateReadiness({ ...base, rewardTiers: [{ id: "t", visitsRequired: 5 }] }, 10);
  assert.ok(!r.reasons.includes("reward_tiers"));
  assert.equal(r.isComplete, true);
}
// 3. Lo que SÍ bloquea sigue bloqueando.
{
  const r = evaluateReadiness({ ...base, businessHours: {}, hoursConfirmed: false, rewardTiers: [] }, 0);
  assert.deepEqual(r.reasons, ["business_hours", "menu_items"]);
}

// 4. El embudo no manda a premios: claim → horario; horario → menú/festejo; menú → festejo.
{
  const modal = read("components/home/ActivarModal.tsx");
  // Se busca la RUTA (router.push / ternario), no la palabra: el comentario
  // que explica el cambio sí puede nombrar la página de premios.
  assert.ok(!/["'`]\/vendor\/setup\/recompensas[^"'`]*["'`]/.test(modal), "el claim ya no aterriza en premios");
  assert.ok(modal.includes('"/vendor/setup/horario?wizard=1&born=demo"'), "demo-born va a su horario");
  const horario = read("app/vendor/setup/horario/page.tsx");
  assert.ok(!horario.includes("/vendor/setup/recompensas?wizard=1"), "horario no encadena a premios");
  const menu = read("app/vendor/setup/menu/page.tsx");
  assert.ok(menu.includes('isWizard ? "/vendor/setup/done"'), "menú en wizard cierra con el festejo");
  assert.ok(!menu.includes("/vendor/setup/recompensas?wizard=1"), "menú no encadena a premios");
}
// 5. Wizard: dos pasos obligatorios + premios como tarjeta opcional (la página NO se borró).
{
  const setup = read("app/vendor/setup/page.tsx");
  assert.ok(!setup.includes('key: "rewards" as const'), "Recompensas no es paso obligatorio");
  assert.ok(setup.includes("const total = 2;"), "dos pasos");
  assert.ok(setup.includes('href: "/vendor/setup/recompensas"'), "la tarjeta opcional sigue apuntando a la página de premios");
  assert.ok(/opcional/i.test(setup), "se dice que es opcional");
  const stepper = read("components/vendor/WizardStepper.tsx");
  assert.ok(!stepper.includes('key: "rewards"'), "el stepper tiene dos estaciones");
  const done = read("app/vendor/setup/done/page.tsx");
  assert.ok(!/horario, menú y recompensas/.test(done), "el festejo no promete premios que no existen");
  assert.ok(done.includes("/vendor/setup/recompensas"), "pero ofrece ponerlos (opcional)");
}
// 6. La página de premios sigue existiendo (no se borra nada).
{
  const rewards = read("app/vendor/setup/recompensas/page.tsx");
  assert.ok(rewards.length > 1000, "la página de premios vive");
}

console.log("validate-rewards-optional-funnel: OK");
