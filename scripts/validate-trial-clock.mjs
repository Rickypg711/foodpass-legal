/**
 * El reloj de la prueba + el consentimiento en la pared (9-sep-2026) — candado.
 *
 * Decisión de Ricardo (9-sep): la prueba de 14 días NO se arranca sola. La
 * pared (ProWall) pide UN toque ("Empezar mis 14 días gratis"), confirma la
 * fecha exacta y "Seguir" repite la acción. Desde entonces el panel enseña el
 * reloj (TrialClock) leyendo private/billing vía fetchWithBilling:
 *
 *   counting    → días 14→4 · endingSoon → ≤3 días · ended → 7 días después
 *   de vencer si cayó a gratis · hidden → paga Pro, fundador, resto.
 *
 * Los nombres y umbrales son el contrato con la app
 * (FOODPASS/lib/subscription/trial_clock.dart). Si la app existe, se lee.
 *
 * Run: node scripts/validate-trial-clock.mjs
 * Requiere Node >= 22.18 (type stripping nativo para importar el .ts).
 */

import { readFileSync, existsSync } from "node:fs";

import {
  trialClockState,
  trialDaysLeft,
  longDateEs,
  weekdayEs,
  trialEndsWhenEs,
  TRIAL_ENDING_SOON_DAYS,
  TRIAL_ENDED_WINDOW_DAYS,
} from "../lib/subscription/trialClock.ts";
import { TRIAL_DAYS } from "../lib/subscription/entitlement.ts";

let failed = 0;
function check(label, actual, expected) {
  if (actual !== expected) {
    console.error(`FAIL ${label}: esperaba ${JSON.stringify(expected)}, obtuvo ${JSON.stringify(actual)}`);
    failed = 1;
  }
}
const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");

const DAY = 24 * 60 * 60 * 1000;
const MIN = 60 * 1000;
// Hora local, a propósito: los días se cuentan como los cuenta el dueño.
const now = new Date(2026, 8, 9, 12, 0).getTime(); // 9 sep 2026, mediodía
const S = (o) => trialClockState({ now, ...o });
const trialing = (endsAt) => ({ status: "trialing", plan: "pro", trialEndsAt: endsAt });

// ── 1. Umbrales — el contrato con la app ──
check("TRIAL_DAYS = 14", TRIAL_DAYS, 14);
check("endingSoon a partir de 3 días", TRIAL_ENDING_SOON_DAYS, 3);
check("ended dura 7 días", TRIAL_ENDED_WINDOW_DAYS, 7);

// ── 2. La tabla de verdad ──
{
  // Recién otorgada: 14 días exactos.
  const r = S(trialing(now + 14 * DAY));
  check("día 14 → counting", r.state, "counting");
  check("día 14 → daysLeft 14", r.daysLeft, 14);
  check("día 14 → endsAt", r.endsAt, now + 14 * DAY);

  check("día 4 → counting", S(trialing(now + 4 * DAY)).state, "counting");
  check("3 días y 1 min → counting (ceil = 4)", S(trialing(now + 3 * DAY + MIN)).state, "counting");

  // Exactamente 3 días → endingSoon.
  const three = S(trialing(now + 3 * DAY));
  check("exactamente 3 días → endingSoon", three.state, "endingSoon");
  check("exactamente 3 días → daysLeft 3", three.daysLeft, 3);
  check("2 días → endingSoon", S(trialing(now + 2 * DAY)).state, "endingSoon");

  // El último día (quedan 5 horas): daysLeft 1, endingSoon.
  const last = S(trialing(now + 5 * 60 * MIN));
  check("último día → endingSoon", last.state, "endingSoon");
  check("último día → daysLeft 1 (ceil)", last.daysLeft, 1);
  check("último día → termina hoy", trialEndsWhenEs(last.endsAt, now), "hoy");

  // Vencida hace un minuto: ended, aunque el sweeper todavía diga trialing.
  const justEnded = S(trialing(now - MIN));
  check("vencida hace 1 min (status trialing pegado) → ended", justEnded.state, "ended");
  check("vencida → daysLeft 0", justEnded.daysLeft, 0);
  check("vencida hace 1 min, ya en free → ended",
    S({ status: "expired", plan: "free", trialEndsAt: now - MIN }).state, "ended");
  check("vencida hace 6 días → ended",
    S({ status: "expired", plan: "free", trialEndsAt: now - 6 * DAY }).state, "ended");
  check("vencida hace 7 días + 1 min → hidden",
    S({ status: "expired", plan: "free", trialEndsAt: now - 7 * DAY - MIN }).state, "hidden");

  // Quien paga Pro no tiene reloj — ni con la prueba vigente ni recién vencida.
  check("paga Pro (active) con trialEndsAt futuro → hidden",
    S({ status: "active", plan: "pro", trialEndsAt: now + 5 * DAY }).state, "hidden");
  check("paga Pro (active) con trialEndsAt vencido ayer → hidden",
    S({ status: "active", plan: "pro", trialEndsAt: now - DAY }).state, "hidden");

  // Fundador: jamás.
  check("fundador en prueba → hidden", S({ ...trialing(now + 5 * DAY), founder: true }).state, "hidden");
  check("fundador vencido → hidden",
    S({ status: "expired", plan: "free", trialEndsAt: now - DAY, founder: true }).state, "hidden");

  // Nunca probó.
  check("sin trialEndsAt → hidden", S({ status: null, plan: "free", trialEndsAt: null }).state, "hidden");
  check("free sin prueba → hidden", S({ status: "expired", plan: "free", trialEndsAt: undefined }).state, "hidden");

  // daysLeft nunca negativo.
  check("trialDaysLeft nunca negativo", trialDaysLeft(now - 3 * DAY, now), 0);
}

// ── 3. Fechas en español (hora local) ──
{
  const t = new Date(2026, 8, 23, 12).getTime(); // 23 sep 2026 = miércoles
  check("weekdayEs", weekdayEs(t), "miércoles");
  check("longDateEs sin coma", longDateEs(t), "miércoles 23 de septiembre");
  check("termina mañana", trialEndsWhenEs(new Date(2026, 8, 10, 3).getTime(), now), "mañana");
  check("termina el sábado", trialEndsWhenEs(new Date(2026, 8, 12, 12).getTime(), now), "el sábado");
}

// ── 4. La pared pide consentimiento: nada se dispara solo ──
{
  const wall = read("../components/vendor/ProWall.tsx");
  check("ProWall: sin useEffect (nada arranca solo)", wall.includes("useEffect"), false);
  check("ProWall: sin autostart", /autostart/i.test(wall), false);
  check("ProWall: el botón de consentimiento", wall.includes("Empezar mis ${TRIAL_DAYS} días gratis"), true);
  check("ProWall: la prueba solo arranca desde un onClick",
    (wall.match(/onClick=\{\(\) => void trial\.start\(\)\}/g) ?? []).length >= 1, true);
  check("ProWall: 'Ahora no'", wall.includes("Ahora no"), true);
  check("ProWall: confirma la fecha exacta", wall.includes("Tienes Pro hasta el {") && wall.includes("longDateEs("), true);
  check("ProWall: 'Sin tarjeta, sin cobros.'", wall.includes("Sin tarjeta, sin cobros."), true);
  check("ProWall: 'Seguir' repite la acción (onUnlocked)", wall.includes(">\n          Seguir\n        </button>") && wall.includes("onUnlocked(PRO_ENTITLEMENTS, granted)"), true);
  check("ProWall: reintento en palabras llanas", wall.includes("Intentar de nuevo") && wall.includes('proTrialErrorMessage("failed")'), true);
  check("ProWall: sin prueba → 'Ver planes' a /vendor/plan", wall.includes("Ver planes") && wall.includes('href="/vendor/plan"'), true);
  check("ProWall: role=dialog", wall.includes('role="dialog"'), true);
  check("ProWall: Escape cierra", wall.includes('e.key === "Escape"'), true);
  check("ProWall: foco en el botón principal", wall.includes("autoFocus"), true);
  check("ProWall: botones ≥44px", wall.includes("min-h-[48px]") && wall.includes("min-h-[44px]"), true);
  check("ProWall: en móvil no se mete bajo el nav (pb-[72px])", wall.includes("pb-[72px]"), true);
  check("ProWall: jamás 'upgrade'", /upgrade/i.test(wall), false);
  check("ProWall: jamás 'desbloquea'", /desbloque/i.test(wall), false);
  check("ProWall: tinta oscura sobre naranja", wall.includes("INK_DARK") && !/color:\s*"#fff/i.test(wall), true);
  const hook = read("../lib/subscription/useProTrial.ts");
  check("hook: source web", hook.includes('source: "web"'), true);
}

// ── 5. El reloj en el panel, leyendo private/billing ──
{
  const panel = read("../app/vendor/page.tsx");
  // El cerebro emite trial_ending_soon / trial_ended (functions/restaurant_brain.js): el botón del NBA va a planes, no a recompensas.
  check("NBA trial_ending_soon → 'Seguir con Pro'", /case "trial_ending_soon": return "Seguir con Pro";/.test(panel), true);
  check("NBA trial_ended → 'Volver a Pro'", /case "trial_ended": return "Volver a Pro";/.test(panel), true);
  check("NBA trial_* → /vendor/plan", /case "trial_ending_soon":\n\s*case "trial_ended": return "\/vendor\/plan";/.test(panel), true);
  check("panel: renderiza <TrialClock", panel.includes("<TrialClock"), true);
  check("panel: lee private/billing (fetchWithBilling)", panel.includes("fetchWithBilling("), true);
  check("panel: status del reloj sale del doc fundido", panel.includes("rTruth.subscriptionAccessStatus"), true);
  check("panel: trialEndsAt sale del doc fundido", panel.includes("rTruth.subscriptionTrialEndsAt"), true);
  check("panel: bypass de fundador", panel.includes("isFounderTestRestaurant(rid)"), true);

  const clock = read("../components/vendor/TrialClock.tsx");
  check("TrialClock: usa trialClockState", clock.includes("trialClockState("), true);
  // Los tres copys, tal cual.
  check("copy counting", clock.includes("Pro de prueba") && clock.includes("te quedan {clock.daysLeft} días"), true);
  check("copy endingSoon", clock.includes("Tu prueba termina {trialEndsWhenEs(clock.endsAt, nowMs)}.") && clock.includes("Sigue con Pro por {PRO_PRICE_LABEL} al mes."), true);
  check("botón endingSoon", clock.includes("Seguir con Pro"), true);
  check("copy ended", clock.includes("Tu prueba terminó.") && clock.includes("Sigues gratis: cobras igual, sin mesas ni segundo PIN."), true);
  check("botón ended", clock.includes("Volver a Pro"), true);
  check("TrialClock: liga a /vendor/plan", clock.includes('href="/vendor/plan"'), true);
  check("TrialClock: cerrar por estado (localStorage) con try/catch",
    clock.includes("localStorage") && clock.includes("try {") && clock.includes("catch"), true);
  check("TrialClock: llave por restaurante y estado", clock.includes("comeleal.trialClock.${restaurantId}.${state}"), true);
  check("TrialClock: no es modal", /role="dialog"|aria-modal/.test(clock), false);
  check("TrialClock: sin precio a mano", /\$(299|499)/.test(clock), false);
  check("TrialClock: jamás 'upgrade'", /upgrade/i.test(clock), false);
  check("TrialClock: tinta oscura sobre naranja", clock.includes("INK_DARK") && !/color:\s*"#fff/i.test(clock), true);

  // trialClock.ts importa limpio desde Node: sin "@/".
  const lib = read("../lib/subscription/trialClock.ts");
  check("trialClock.ts: sin imports '@/'", lib.includes('from "@/'), false);
}

// ── 6. Paridad con la app (si el Dart ya existe): mismos nombres y umbrales ──
{
  const dartPath = "/Users/ricardoparedes/projects/FOODPASS/lib/subscription/trial_clock.dart";
  if (existsSync(dartPath)) {
    const dart = readFileSync(dartPath, "utf8");
    for (const name of ["counting", "endingSoon", "ended", "hidden", "trialClockState"]) {
      check(`Dart: ${name}`, dart.includes(name), true);
    }
    check("Dart: umbral 3 días", /3\b/.test(dart), true);
    check("Dart: ventana 7 días", /7\b/.test(dart), true);
  } else {
    console.log("validate-trial-clock: trial_clock.dart aún no existe (la app va en paralelo); paridad pendiente");
  }
}

if (failed) {
  console.error("validate-trial-clock: FAILED");
  process.exit(1);
}
console.log("validate-trial-clock: OK");
