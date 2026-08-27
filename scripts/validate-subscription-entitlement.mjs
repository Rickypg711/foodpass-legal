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

// ── private/billing: los LECTORES web leen la verdad, no el doc público ──
// Caso real 27-ago-2026: la migración del 24-ago movió los campos de
// suscripción a restaurants/{rid}/private/billing y borró los del doc
// público; la web siguió leyendo el público → TODO restaurante pagado veía
// "Free" (Pecado Escondido reclamando por WhatsApp con 2×$299 cobrados).
{
  const { readFileSync } = await import("node:fs");
  const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");

  // 1. La lista de campos de la web es ESPEJO de la de la app (Dart).
  const { BILLING_FIELD_NAMES } = await import("../lib/subscription/billingDoc.ts");
  const dart = readFileSync(
    "/Users/ricardoparedes/projects/FOODPASS/lib/subscription/restaurant_private_docs.dart",
    "utf8",
  );
  for (const f of BILLING_FIELD_NAMES) {
    check(`campo espejo en la app: ${f}`, dart.includes(`'${f}'`), true);
  }
  check(
    "misma cantidad de campos que la app (billingFieldNames)",
    (dart.match(/'subscription[A-Za-z]+'/g) ?? []).filter((s, i, a) => a.indexOf(s) === i).length,
    BILLING_FIELD_NAMES.length,
  );

  // 2. Cada lector de plan/gate Pro pasa por el merge de private/billing.
  for (const [name, path, marker] of [
    ["layout (badge)", "../app/vendor/layout.tsx", "fetchWithBilling("],
    ["panel (cuota lealtad)", "../app/vendor/page.tsx", "fetchWithBilling("],
    ["plan", "../app/vendor/plan/page.tsx", "fetchWithBilling("],
    ["configuración", "../app/vendor/configuracion/page.tsx", "fetchWithBilling("],
    ["caja (gate descuentos ×2)", "../app/vendor/pos/page.tsx", "fetchWithBilling("],
    ["clientes (gate descuentos)", "../app/vendor/clientes/page.tsx", "fetchWithBilling("],
    ["phonePoints (tope Free en tx)", "../lib/loyalty/phonePoints.ts", "tryTxGetBillingData("],
  ]) {
    check(`lector migrado: ${name}`, read(path).includes(marker), true);
  }
  check(
    "caja: los DOS gates migrados",
    (read("../app/vendor/pos/page.tsx").match(/fetchWithBilling\(/g) ?? []).length >= 2,
    true,
  );

  // 3. La CUOTA también es privada: phonePoints quema scanCount en
  // private/usage (jamás en el doc público) y el panel la lee fundida.
  const pp = read("../lib/loyalty/phonePoints.ts");
  check("phonePoints lee usage en tx", pp.includes("tryTxGetUsageData("), true);
  check(
    "phonePoints quema el contador en private/usage",
    pp.includes("usageRef(db, restaurantId)"),
    true,
  );
  check(
    "phonePoints NO escribe scanCount al doc público",
    /tx\.update\(restaurantRef,\s*\{\s*scanCount/.test(pp),
    false,
  );
  const { USAGE_FIELD_NAMES } = await import("../lib/subscription/billingDoc.ts");
  for (const f of USAGE_FIELD_NAMES) {
    check(`campo usage espejo en la app: ${f}`, dart.includes(`'${f}'`), true);
  }
}

if (failed) {
  console.error("validate-subscription-entitlement: FAILED");
  process.exit(1);
}
console.log("validate-subscription-entitlement: OK");
