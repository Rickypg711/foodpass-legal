// 🌮 Tacos como filas — candado del 18-sep-2026 (docs/REFERIDOS_POR_TELEFONO.md §6 y §7).
//
// La bienvenida era un sí/no y un sí/no no puede guardar dos tacos ni dos
// fechas: con la bienvenida pendiente y el amigo pagando al día siguiente, el
// taco de referido se perdía. Ahora cada taco es una fila con su reloj.
//
// Cinco reglas que no se pueden volver a romper:
//   1. El reloj es min(visto + 7 d, nació + 30 d). Sin "visto", muere a los 30.
//   2. Se canjea SIEMPRE la fila viva que vence primero (igual en web, app y
//      servidor: si eligen distinto, a alguien se le pierde un taco).
//   3. Nadie recalcula el vencimiento: se lee `expiresAt`.
//   4. Fuera de la compuerta (o sin filas), la decisión es `null` = "usa la
//      regla vieja". Los locales que no están en esto siguen exactamente igual.
//   5. La web NUNCA escribe filas: no existe aquí ninguna función que lo haga.
// Run: node --experimental-strip-types scripts/validate-free-items.mjs

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  DAY_MS,
  SEEN_WINDOW_DAYS,
  BORN_CAP_DAYS,
  computeExpiresAtMs,
  isLive,
  liveRows,
  soonestLive,
  anyLive,
  freeItemsEnabled,
  freeItemClaimable,
  daysLeft,
  expiryLabel,
  toMs,
} from "../lib/loyalty/freeItems.ts";

const NOW = Date.parse("2026-09-18T20:00:00Z");
const d = (n) => n * DAY_MS;
const row = (extra = {}) => ({
  id: "r" + Math.random().toString(16).slice(2, 8),
  source: "welcome",
  itemName: "Taco suelto",
  bornAt: NOW,
  seenAt: null,
  expiresAt: NOW + d(30),
  redeemedAt: null,
  redeemedOrderId: null,
  ...extra,
});

// ── 1. El reloj ────────────────────────────────────────────────────────────
assert.equal(SEEN_WINDOW_DAYS, 7, "son 7 días desde que lo ve");
assert.equal(BORN_CAP_DAYS, 30, "y 30 desde que nace, tope duro");
assert.equal(
  computeExpiresAtMs(NOW, null),
  NOW + d(30),
  "sin verse, el taco muere a los 30 días de nacer",
);
assert.equal(
  computeExpiresAtMs(NOW - d(2), NOW),
  NOW + d(7),
  "visto pronto: 7 días desde que se vio",
);
assert.equal(
  computeExpiresAtMs(NOW - d(28), NOW),
  NOW - d(28) + d(30),
  "visto tarde: el tope de los 30 manda, no se estira",
);
assert.equal(
  computeExpiresAtMs(NOW - d(30), NOW),
  NOW - d(30) + d(30),
  "visto justo en el tope: no lo pasa",
);

// ── 2. Cuál se canjea ──────────────────────────────────────────────────────
const vencePrimero = row({source: "referral", expiresAt: NOW + d(5)});
const venceDespues = row({expiresAt: NOW + d(29)});
assert.equal(
  soonestLive([venceDespues, vencePrimero], NOW).id,
  vencePrimero.id,
  "se canjea el que vence primero, no el primero de la lista",
);
assert.deepEqual(
  liveRows([venceDespues, vencePrimero], NOW).map((r) => r.id),
  [vencePrimero.id, venceDespues.id],
  "la lista sale ordenada por vencimiento",
);
assert.equal(soonestLive([], NOW), null, "sin filas no hay nada que canjear");
assert.equal(
  soonestLive([row({expiresAt: NOW - d(1)})], NOW),
  null,
  "un taco vencido no se canjea",
);
assert.equal(
  soonestLive([row({redeemedAt: NOW - d(1)})], NOW),
  null,
  "un taco ya canjeado no se canjea dos veces",
);

// ── 3. Vivo se LEE de expiresAt, no se recalcula ───────────────────────────
assert.equal(isLive(row({expiresAt: NOW + 1}), NOW), true);
assert.equal(isLive(row({expiresAt: NOW - 1}), NOW), false);
assert.equal(
  isLive(row({bornAt: NOW - d(900), expiresAt: NOW + d(3)}), NOW),
  true,
  "manda expiresAt aunque el taco haya nacido hace siglos",
);
assert.equal(
  isLive(row({expiresAt: undefined}), NOW),
  false,
  "sin expiresAt no se da por vivo (el servidor siempre lo pone)",
);
assert.equal(anyLive([row({expiresAt: NOW - 1}), row({expiresAt: NOW + 1})], NOW), true);

// Formas de fecha que llegan de Firestore, del Admin SDK y del JSON de la API.
assert.equal(toMs({ seconds: 1758225600 }), 1758225600000);
assert.equal(toMs({ _seconds: 1758225600, _nanoseconds: 5e8 }), 1758225600500);
assert.equal(toMs(new Date(NOW)), NOW);
assert.equal(toMs(NOW), NOW);
assert.equal(toMs(null), null);
assert.equal(toMs("mañana"), null);

// ── 4. La compuerta: los demás locales siguen como hoy ─────────────────────
assert.equal(freeItemsEnabled({}), false);
assert.equal(freeItemsEnabled({ freeItemsV2Enabled: false }), false);
assert.equal(freeItemsEnabled({ freeItemsV2Enabled: true }), true);
assert.equal(
  freeItemClaimable({}, { freeItems: [row()] }, NOW),
  null,
  "compuerta apagada = null = usa la regla vieja, no decidas por las filas",
);
assert.equal(
  freeItemClaimable({ freeItemsV2Enabled: true }, { firstVisitRewardUnlocked: true }, NOW),
  null,
  "compuerta prendida pero doc SIN migrar = null = regla vieja (no se le quita el taco)",
);
assert.equal(
  freeItemClaimable({ freeItemsV2Enabled: true }, { freeItems: [row({ expiresAt: NOW + d(2) })] }, NOW),
  true,
);
assert.equal(
  freeItemClaimable({ freeItemsV2Enabled: true }, { freeItems: [row({ expiresAt: NOW - d(2) })] }, NOW),
  false,
  "con la compuerta prendida y todo vencido, NO se canjea",
);

// ── 5. La web no escribe filas ─────────────────────────────────────────────
const src = readFileSync(new URL("../lib/loyalty/freeItems.ts", import.meta.url), "utf8");
for (const prohibido of ["setDoc", "updateDoc", "arrayUnion", "runTransaction", "getFirebaseAdminDb"]) {
  assert.ok(
    !src.includes(prohibido),
    `lib/loyalty/freeItems.ts no debe escribir nada (encontrado: ${prohibido}). Las filas son del servidor.`,
  );
}

// El canje de la web pide por INTENCIÓN, nunca escribiendo la fila.
const points = readFileSync(new URL("../lib/loyalty/phonePoints.ts", import.meta.url), "utf8");
assert.ok(
  points.includes("freeItemsRedeemIntent"),
  "el canje de la web debe pedirlo con freeItemsRedeemIntent",
);
assert.ok(
  !/freeItems\s*:/.test(points),
  "phonePoints.ts NUNCA debe escribir el campo freeItems (las reglas tampoco lo dejan)",
);

// ── Copy: secundaria, sin jerga ────────────────────────────────────────────
assert.equal(expiryLabel(row({ expiresAt: NOW + 1000 }), NOW), "vence hoy");
assert.equal(expiryLabel(row({ expiresAt: NOW + d(1) }), NOW), "vence mañana");
assert.match(expiryLabel(row({ expiresAt: NOW + d(5) }), NOW), /^vence el \d+ de \w+$/);
assert.equal(daysLeft(row({ expiresAt: NOW + d(3) }), NOW), 3);
assert.equal(daysLeft(row({ expiresAt: NOW - d(3) }), NOW), 0);

console.log("✅ tacos como filas: reloj, cuál se canjea, compuerta y 'la web no escribe' OK");
