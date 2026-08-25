// Robo #5 — contrato del hub de servicio en mesa.
// Run: node scripts/validate-service-requests.mjs

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  SERVICE_COOLDOWN_MS,
  cooldownRemainingMs,
} from "../lib/order/serviceRequestCooldown.ts";

// ── 1. Cooldown: 30s exactos, cuenta regresiva y liberación ─────────────────
assert.equal(SERVICE_COOLDOWN_MS, 30_000, "el cooldown es 30s — el detalle que aguanta un viernes");
assert.equal(cooldownRemainingMs(null, 1000), 0, "sin envío previo no hay cooldown");
assert.equal(cooldownRemainingMs(1000, 1000), 30_000, "recién enviado = cooldown completo");
assert.equal(cooldownRemainingMs(1000, 16_000), 15_000, "a la mitad");
assert.equal(cooldownRemainingMs(1000, 31_000), 0, "a los 30s se libera");
assert.equal(cooldownRemainingMs(Number.NaN, 1000), 0, "basura no congela el botón");

// ── 2. Candados de fuente: el loop completo existe en las tres capas ────────
const rules = readFileSync(
  "/Users/ricardoparedes/projects/FOODPASS/firestore.rules",
  "utf8",
);
assert.ok(rules.includes("match /serviceRequests/{requestId}"), "reglas: la colección existe");
assert.ok(rules.includes("['call_waiter', 'ask_bill']"), "reglas: solo los dos tipos");
assert.ok(rules.includes(".hasOnly(['status', 'attendedAt', 'attendedBy'])"),
  "reglas: el equipo solo marca atendido — la petición es inmutable");

const menuView = readFileSync(new URL("../app/menu/[restaurantId]/MenuView.tsx", import.meta.url), "utf8");
assert.ok(menuView.includes("<TableServiceButtons"), "comensal: botones en el aviso de mesa");

const posPage = readFileSync(new URL("../app/vendor/pos/page.tsx", import.meta.url), "utf8");
assert.ok(posPage.includes("<ServiceRequestsBell"), "dueño: campana en la Caja");

console.log("validate-service-requests: OK");
