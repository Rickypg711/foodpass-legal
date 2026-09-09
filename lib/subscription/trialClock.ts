/**
 * EL RELOJ DE LA PRUEBA (9-sep-2026) — la matemática pura, sin React.
 *
 * Reverse trial a la Verna / Poyar: el dueño arranca sus 14 días con UN toque
 * en la pared (ProWall) y desde entonces el panel le enseña el reloj. Tres
 * estados, los mismos nombres en la app (lib/subscription/trial_clock.dart):
 *
 *   counting    → días 14→4: neutro, "te quedan N días"
 *   endingSoon  → días 3→0: cálido, "termina el martes, sigue con Pro"
 *   ended       → 7 días después de vencer, si cayó a gratis: "terminó, sigues gratis"
 *   hidden      → todo lo demás (paga Pro, fundador, nunca probó, ya pasó la semana)
 *
 * Entrada: los campos canónicos de private/billing (fetchWithBilling). Salida:
 * el estado + días que quedan (ceil, hora local) + la fecha de fin.
 *
 * Sin imports con "@/" a propósito (como discountProfiles.ts): el candado
 * scripts/validate-trial-clock.mjs lo importa desde Node y corre la tabla de
 * verdad. Los umbrales son el contrato con la app — no se cambian de un lado.
 */

export const TRIAL_ENDING_SOON_DAYS = 3;
export const TRIAL_ENDED_WINDOW_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

import { BUSINESS_DAY_CUTOFF_HOUR, businessDayStart } from "../businessDay.ts";

export type TrialClockStateName = "counting" | "endingSoon" | "ended" | "hidden";

export type TrialClockInput = {
  /** subscriptionAccessStatus: "trialing" | "active" | "expired" | … */
  status: string | null | undefined;
  /** subscriptionPlan: "pro" | "free" | … */
  plan: string | null | undefined;
  /** subscriptionTrialEndsAt en ms (null si nunca probó). */
  trialEndsAt: number | null | undefined;
  now: number;
  /** Bypass de fundador (Luzz): jamás ve el reloj. */
  founder?: boolean;
  /** Corte de jornada del local (default 4 AM). Espejo de la app:
   * los días se cuentan en JORNADAS, no en calendario, para que "te quedan
   * 3 días" diga lo mismo en el teléfono y en la web. */
  cutoffHour?: number;
};

export type TrialClockState = {
  state: TrialClockStateName;
  /** Jornadas que quedan (0 = el último día, o ya venció / no aplica). */
  daysLeft: number;
  /** Fin de la prueba en ms, o null si no hay prueba. */
  endsAt: number | null;
};

const HIDDEN: TrialClockState = { state: "hidden", daysLeft: 0, endsAt: null };

/** Días enteros hacia arriba entre `now` y `endsAt` (nunca negativo). */
/** Jornadas que faltan: jornada del fin − jornada de hoy (redondeado).
 * El último día de la prueba es 0. PARIDAD: lib/subscription/trial_clock.dart. */
export function trialDaysLeft(
  endsAt: number,
  now: number,
  cutoffHour: number = BUSINESS_DAY_CUTOFF_HOUR,
): number {
  const endDay = businessDayStart(new Date(endsAt), cutoffHour).getTime();
  const today = businessDayStart(new Date(now), cutoffHour).getTime();
  return Math.max(0, Math.round((endDay - today) / DAY_MS));
}

export function trialClockState({
  status,
  plan,
  trialEndsAt,
  now,
  founder = false,
  cutoffHour = BUSINESS_DAY_CUTOFF_HOUR,
}: TrialClockInput): TrialClockState {
  if (founder) return HIDDEN;
  if (trialEndsAt == null || !Number.isFinite(trialEndsAt)) return HIDDEN;

  // Quien paga Pro no tiene reloj: ya se quedó.
  const paying = plan === "pro" && status === "active";
  if (paying) return HIDDEN;

  if (status === "trialing" && trialEndsAt > now) {
    const daysLeft = trialDaysLeft(trialEndsAt, now, cutoffHour);
    return {
      state: daysLeft <= TRIAL_ENDING_SOON_DAYS ? "endingSoon" : "counting",
      daysLeft,
      endsAt: trialEndsAt,
    };
  }

  // Venció (aunque el sweeper todavía diga "trialing": el acceso ya no vive) y
  // cayó a gratis → una semana de "terminó, sigues gratis".
  if (now >= trialEndsAt && now < trialEndsAt + TRIAL_ENDED_WINDOW_DAYS * DAY_MS) {
    return { state: "ended", daysLeft: 0, endsAt: trialEndsAt };
  }

  return HIDDEN;
}

// ── Fechas en español, sin depender del ICU del navegador ────────────────────

const WEEKDAYS_ES = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MONTHS_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** "martes" — día de la semana en hora local. */
export function weekdayEs(ms: number): string {
  return WEEKDAYS_ES[new Date(ms).getDay()];
}

/** "martes 23 de septiembre" — fecha larga en hora local, sin coma. */
export function longDateEs(ms: number): string {
  const d = new Date(ms);
  return `${WEEKDAYS_ES[d.getDay()]} ${d.getDate()} de ${MONTHS_ES[d.getMonth()]}`;
}

/** "hoy" | "mañana" | "el martes" — para "Tu prueba termina …". */
export function trialEndsWhenEs(
  endsAt: number,
  now: number,
  cutoffHour: number = BUSINESS_DAY_CUTOFF_HOUR,
): string {
  // En jornadas (corte 4 AM), como la app: a la 1 AM sigue siendo "hoy".
  const left = trialDaysLeft(endsAt, now, cutoffHour);
  if (left === 0) return "hoy";
  if (left === 1) return "mañana";
  return `el ${weekdayEs(businessDayStart(new Date(endsAt), cutoffHour).getTime())}`;
}
