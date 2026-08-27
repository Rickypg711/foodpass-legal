/**
 * Horario NOCTURNO y readiness — contrato.
 *
 * POR QUE EXISTE: el 23 ago 2026 se le puso a Sushin-Gon su horario real
 * (13:00 -> 01:00, sushi a domicilio que cierra a la 1 AM) y el guardado lo
 * degrado a `status: "setup"` con reason `business_hours`. Causa: DOS modulos
 * opinaban distinto sobre el mismo dato. `lib/schedule.ts` soporta nocturno
 * con derrame de ayer; `isBusinessHoursValid` lo rechazaba por `close < open`.
 * Y `status: "setup"` pausa el checkout de Mercado Pago — o sea que un
 * horario legitimo apagaba la venta.
 *
 * Este script ejecuta las DOS capas sobre los MISMOS datos y exige que
 * coincidan. Si alguien vuelve a "arreglar" una sin la otra, truena aqui.
 *
 * Run: node scripts/validate-readiness-hours.mjs
 */

import assert from "node:assert/strict";
import { evaluateReadiness } from "../lib/readiness/evaluate.ts";
import {
  expectedDayProgressPercent,
  isOpenNow,
  isPositivelyClosedNow,
} from "../lib/schedule.ts";

const DIAS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const dia = (o, c) => ({
  isClosed: false,
  openingTime: { hour: o, minute: 0 },
  closingTime: { hour: c, minute: 0 },
});
const horario = (o, c) => Object.fromEntries(DIAS.map((d) => [d, dia(o, c)]));

const baseRestaurante = (o, c) => ({
  name: "Prueba",
  address: "Calle 1",
  phone: "+52 614 000 0000",
  categories: ["Sushi"],
  businessHours: horario(o, c),
  firstPurchaseReward: { enabled: true, menuItemName: "Shilanga" },
  rewardTiers: [{ hasMenuItem: true }],
});

// ── 1. El caso que rompio: 13:00 -> 01:00 tiene que ser VALIDO ──────────────
{
  const r = evaluateReadiness(baseRestaurante(13, 1), 10);
  assert.ok(
    !r.reasons.includes("business_hours"),
    `nocturno 13:00->01:00 debe ser valido, reasons=${JSON.stringify(r.reasons)}`,
  );
  assert.equal(r.isComplete, true, "nocturno completo no debe degradar a setup");
}

// ── 2. Diurno normal sigue valido ──────────────────────────────────────────
{
  const r = evaluateReadiness(baseRestaurante(9, 17), 10);
  assert.ok(!r.reasons.includes("business_hours"), "diurno 9->17 debe ser valido");
}

// ── 3. Ventana de duracion CERO sigue invalida (unico caso que se rechaza) ──
{
  const r = evaluateReadiness(baseRestaurante(13, 13), 10);
  assert.ok(
    r.reasons.includes("business_hours"),
    "una ventana de duracion cero debe seguir siendo invalida",
  );
}

// ── 4. Faltar closingTime sigue invalido ───────────────────────────────────
{
  const data = baseRestaurante(13, 1);
  delete data.businessHours.Monday.closingTime;
  const r = evaluateReadiness(data, 10);
  assert.ok(r.reasons.includes("business_hours"), "sin closingTime debe ser invalido");
}

// ── 5. LAS DOS CAPAS DE ACUERDO: lo que readiness acepta, schedule lo abre ──
// Sabado 22 ago 2026 23:30 y domingo 00:30 — la ventana que estaba muerta.
{
  const rdata = baseRestaurante(13, 1);
  const r = evaluateReadiness(rdata, 10);
  assert.ok(!r.reasons.includes("business_hours"), "readiness acepta el nocturno");

  for (const [etiqueta, t] of [
    ["sab 23:30", new Date(2026, 7, 22, 23, 30)],
    ["dom 00:30", new Date(2026, 7, 23, 0, 30)],
  ]) {
    assert.equal(isOpenNow(rdata, t), true, `${etiqueta} debe estar ABIERTO`);
    assert.equal(
      isPositivelyClosedNow(rdata, t),
      false,
      `${etiqueta} NO debe bloquear el pedido`,
    );
  }
  // Y a la 1:30, ya cerro de verdad.
  const tarde = new Date(2026, 7, 23, 1, 30);
  assert.equal(isOpenNow(rdata, tarde), false, "01:30 ya cerro");
}

// ── expectedDayProgressPercent — el ritmo a meta HONESTO (robo de la app,
// 27-ago): se mide contra la ventana de apertura, no contra un día de 24h.
{
  // Abierto 8:00–20:00 (12h): a las 14:00 va el 50% de la ventana.
  const rdata = { businessHours: horario(8, 20) };
  const mediodia = new Date(2026, 7, 26, 14, 0); // miércoles 26-ago
  assert.equal(
    Math.round(expectedDayProgressPercent(rdata, mediodia)),
    50,
    "14:00 en ventana 8-20 = 50% esperado",
  );
  // Antes de abrir: 0% (día abierto, aún no empieza la ventana).
  const alba = new Date(2026, 7, 26, 6, 0);
  assert.equal(expectedDayProgressPercent(rdata, alba), 0, "antes de abrir = 0%");
  // Hoy CERRADO → null: la línea de ritmo no se muestra (jamás inventa).
  const cerrado = {
    businessHours: {
      ...horario(8, 20),
      Wednesday: { ...dia(8, 20), isClosed: true },
      Tuesday: { ...dia(8, 20), isClosed: true },
    },
  };
  assert.equal(
    expectedDayProgressPercent(cerrado, mediodia),
    null,
    "día cerrado = null (sin línea de ritmo)",
  );
  // Derrame nocturno: abre 22:00, cierra 2:00 — a la 1:00 va el 75% del
  // turno de ANOCHE (misma regla que activeWindowAt / la app).
  const nocturno = { businessHours: horario(22, 2) };
  const unaAM = new Date(2026, 7, 26, 1, 0);
  assert.equal(
    Math.round(expectedDayProgressPercent(nocturno, unaAM)),
    75,
    "1 AM en turno 22-02 = 75% del turno de anoche",
  );
}

console.log("validate-readiness-hours: OK");
