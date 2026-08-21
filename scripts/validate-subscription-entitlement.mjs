/**
 * La regla única de Pro (web) + elegibilidad de la prueba gratis.
 * Espejo exacto de FOODPASS/functions/subscription_entitlement.test.js —
 * paridad web↔servidor. Si estos dos archivos dejan de coincidir, un
 * restaurante vería un plan distinto según por dónde entre.
 *
 * Run: node scripts/validate-subscription-entitlement.mjs
 */

import {
  entitlementOf,
  isProActive,
  TRIAL_DAYS,
} from "../lib/subscription/entitlement.ts";

let failed = 0;
function check(label, actual, expected) {
  if (actual !== expected) {
    console.error(`FAIL ${label}: esperaba ${expected}, obtuvo ${actual}`);
    failed = 1;
  }
}

const DAY = 24 * 60 * 60 * 1000;
const now = Date.UTC(2026, 7, 6, 12); // 6 ago 2026
const future = (d) => now + d * DAY;
const past = (d) => now - d * DAY;
const ts = (ms) => ({ toMillis: () => ms });

const pro = (status, expiresAt, extra = {}) => ({
  subscriptionPlan: "pro",
  subscriptionAccessStatus: status,
  ...(expiresAt === undefined ? {} : { subscriptionAccessExpiresAt: expiresAt }),
  ...extra,
});

// ── semántica canónica ──
check("active vigente", isProActive(pro("active", ts(future(20))), now), true);
check("trialing vigente da acceso completo", isProActive(pro("trialing", ts(future(14))), now), true);
check("active vencido", isProActive(pro("active", ts(past(1))), now), false);
check("trialing vencido muere solo", isProActive(pro("trialing", ts(past(1))), now), false);
check("EL HUECO: pro canónico sin fecha", isProActive(pro("active", undefined), now), false);
check("status expired con fecha viva", isProActive(pro("expired", ts(future(10))), now), false);
check("vacío", isProActive(undefined, now), false);
check("objeto vacío", isProActive({}, now), false);

// ── legado sin backfill ──
check("legado plan pro sin canónicos", isProActive({ plan: "pro" }, now), true);
check(
  "un campo canónico y ya manda el canónico",
  isProActive({ plan: "pro", subscriptionAccessStatus: "expired" }, now),
  false,
);

// ── días restantes ──
check("14 días", entitlementOf(pro("trialing", ts(future(14))), now).trialDaysLeft, 14);
check(
  "últimas horas siguen contando 1",
  entitlementOf(pro("trialing", ts(now + 3 * 60 * 60 * 1000)), now).trialDaysLeft,
  1,
);
check("pagado no reporta días de prueba", entitlementOf(pro("active", ts(future(30))), now).trialDaysLeft, 0);

// ── elegibilidad de la prueba: UNA por restaurante, para siempre ──
check("gratis y limpio puede probar", entitlementOf({}, now).canStartTrial, true);
check(
  "ya usó prueba de la tienda (anti doble dip 14+14)",
  entitlementOf({ subscriptionTrialEndsAt: ts(past(60)) }, now).canStartTrial,
  false,
);
check(
  "prueba vencida hace meses sigue siendo no",
  entitlementOf(pro("expired", ts(past(30)), { subscriptionTrialEndsAt: ts(past(30)) }), now).canStartTrial,
  false,
);
check("ya paga Pro no necesita prueba", entitlementOf(pro("active", ts(future(20))), now).canStartTrial, false);
check("Pro vencido sin prueba previa SÍ puede", entitlementOf(pro("expired", ts(past(10))), now).canStartTrial, true);
check("trialEverGranted marca el sello", entitlementOf({ subscriptionTrialEndsAt: ts(past(1)) }, now).trialEverGranted, true);

// ── constante ──
check("la prueba dura 14 días", TRIAL_DAYS, 14);

if (failed) {
  console.error("validate-subscription-entitlement: FAILED");
  process.exit(1);
}
console.log("validate-subscription-entitlement: OK");
