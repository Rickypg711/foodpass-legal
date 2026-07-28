/**
 * Gate Pro de descuentos: el status NO basta, el acceso tiene que estar vigente.
 * Espejo exacto de FOODPASS/test/loyalty/discount_profiles_test.dart
 * (grupo 'discountsEnabled') — paridad de dinero web↔app.
 *
 * Bug corregido el 28 jul 2026: discountsEnabled sólo miraba
 * subscriptionAccessStatus, así que un status pegado en "active" con
 * subscriptionAccessExpiresAt vencido daba Pro gratis para siempre
 * (caso real: restaurants/5XMZ7lSRhLTH7ppKR8FQ, "active" exp. 15-may-2026).
 *
 * Run: node scripts/validate-discount-pro-gate.mjs
 * Requiere Node >= 22.18 (type stripping nativo para importar el .ts).
 */

import { discountsEnabled } from "../lib/loyalty/discountProfiles.ts";

let failed = 0;
function check(label, actual, expected) {
  if (actual !== expected) {
    console.error(`FAIL ${label}: esperaba ${expected}, obtuvo ${actual}`);
    failed = 1;
  }
}

const now = Date.UTC(2026, 6, 28, 12); // 28 jul 2026
const futuro = Date.UTC(2026, 7, 30); // 30 ago 2026
const pasado = Date.UTC(2026, 4, 15); // 15 may 2026 — caso real
const LUZZ = "kdjJsNwriU4AL4528a4d";

const pro = (status, expiresAt) => ({
  subscriptionPlan: "pro",
  subscriptionAccessStatus: status,
  ...(expiresAt === undefined ? {} : { subscriptionAccessExpiresAt: expiresAt }),
});

// Timestamp de Firestore (duck typing, sin importar el SDK).
const ts = (ms) => ({ toMillis: () => ms });

// --- vigente → true
check("active vigente", discountsEnabled(pro("active", ts(futuro)), null, now), true);
check("trialing vigente", discountsEnabled(pro("trialing", ts(futuro)), null, now), true);

// --- vencido → false (el bug)
check("active VENCIDO", discountsEnabled(pro("active", ts(pasado)), null, now), false);
check("trialing VENCIDO", discountsEnabled(pro("trialing", ts(pasado)), null, now), false);

// --- fail-closed sin fecha
check("sin expiresAt", discountsEnabled(pro("active", undefined), null, now), false);

// --- otras formas del timestamp
check("epoch ms vigente", discountsEnabled(pro("active", futuro), null, now), true);
check("Date vencido", discountsEnabled(pro("active", new Date(pasado)), null, now), false);
check(
  "ISO string vencido",
  discountsEnabled(pro("active", new Date(pasado).toISOString()), null, now),
  false,
);
check(
  "{seconds} vigente",
  discountsEnabled(pro("active", { seconds: Math.floor(futuro / 1000) }), null, now),
  true,
);

// --- plan / status inválidos
check("sin data", discountsEnabled(undefined, null, now), false);
check("plan free", discountsEnabled({ subscriptionPlan: "free" }, null, now), false);
check("past_due vigente", discountsEnabled(pro("past_due", ts(futuro)), null, now), false);

// --- founder test (Luzz) gana sobre todo
check("Luzz sin data", discountsEnabled(undefined, LUZZ, now), true);
check("Luzz plan free", discountsEnabled({ subscriptionPlan: "free" }, LUZZ, now), true);
check("Luzz vencido", discountsEnabled(pro("active", ts(pasado)), LUZZ, now), true);
check("otro id plan free", discountsEnabled({ subscriptionPlan: "free" }, "otro", now), false);

if (failed) {
  console.error("validate-discount-pro-gate: FAILED");
  process.exit(1);
}
console.log("validate-discount-pro-gate: OK");
