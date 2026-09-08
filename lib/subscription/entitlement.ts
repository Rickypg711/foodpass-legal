/**
 * LA REGLA ÚNICA DE "¿ESTE RESTAURANTE TIENE PRO?" (lado web).
 *
 * Gemela exacta de FOODPASS/functions/subscription_entitlement.js y de
 * lib/loyalty/discount_profiles.dart. Regla de paridad: el dinero, los puntos y
 * los descuentos NUNCA divergen entre web y app — el plan tampoco.
 *
 * SEMÁNTICA CANÓNICA:
 *   Pro = subscriptionPlan === "pro"
 *         Y status ∈ {active, trialing}
 *         Y subscriptionAccessExpiresAt > ahora
 *   Sin fecha de expiración → NO es Pro. Fail-closed a propósito.
 *
 * ÚNICA EXCEPCIÓN — legado sin backfill: un doc con el viejo `plan: "pro"` y
 * CERO campos canónicos nunca pasó por el backfill; se le respeta el acceso.
 * En cuanto exista cualquier campo canónico, el canónico manda y manda estricto.
 *
 * Antes de esto había cuatro checks distintos que no coincidían (auditoría
 * 6-ago-2026). Uno de ellos, el de la AI en el servidor, era fail-OPEN.
 */

export const TRIAL_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

const ACCESS_GRANTING = new Set(["active", "trialing"]);

const CANONICAL_FIELDS = [
  "subscriptionPlan",
  "subscriptionAccessStatus",
  "subscriptionAccessExpiresAt",
] as const;

export type Entitlement = {
  isPro: boolean;
  isTrialing: boolean;
  status: string | null;
  accessExpiresAtMs: number | null;
  trialDaysLeft: number;
  grandfathered: boolean;
  /** true si esta casa YA usó su prueba alguna vez (aunque ya haya vencido). */
  trialEverGranted: boolean;
  /** true si se le puede ofrecer la prueba gratis ahora mismo. */
  canStartTrial: boolean;
};

/** Lee un timestamp en cualquiera de sus formas (Timestamp, Date, ms, ISO). */
export function accessExpiresAtMs(v: unknown): number | null {
  if (v == null) return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.getTime();
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const ms = Date.parse(v);
    return Number.isFinite(ms) ? ms : null;
  }
  if (typeof v === "object") {
    const o = v as {
      toMillis?: () => number;
      toDate?: () => Date;
      seconds?: number;
      _seconds?: number;
    };
    if (typeof o.toMillis === "function") {
      const ms = o.toMillis();
      return Number.isFinite(ms) ? ms : null;
    }
    if (typeof o.toDate === "function") {
      const ms = o.toDate().getTime();
      return Number.isFinite(ms) ? ms : null;
    }
    const secs = typeof o.seconds === "number" ? o.seconds : o._seconds;
    if (typeof secs === "number" && Number.isFinite(secs)) return secs * 1000;
  }
  return null;
}

function hasNoCanonicalFields(rdata: Record<string, unknown>): boolean {
  return !CANONICAL_FIELDS.some(
    (k) => rdata[k] !== undefined && rdata[k] !== null,
  );
}

/** Estado completo del plan. Única fuente de verdad de la web. */
export function entitlementOf(
  rdata: Record<string, unknown> | undefined | null,
  now: number = Date.now(),
): Entitlement {
  const empty: Entitlement = {
    isPro: false,
    isTrialing: false,
    status: null,
    accessExpiresAtMs: null,
    trialDaysLeft: 0,
    grandfathered: false,
    trialEverGranted: false,
    canStartTrial: false,
  };
  if (!rdata) return empty;

  const status = (rdata.subscriptionAccessStatus as string | undefined) ?? null;
  const expiresMs = accessExpiresAtMs(rdata.subscriptionAccessExpiresAt);
  // `subscriptionTrialEndsAt` es el sello de "ya usó su prueba" AUNQUE haya
  // vencido — no es un permiso de acceso. Es el mismo campo que la app consulta
  // para dejar de ofrecer la prueba de la tienda (SubscriptionTiersPage), así
  // que respetarlo aquí es lo que evita el doble dip 14 + 14 = 28 días.
  const trialEverGranted = rdata.subscriptionTrialEndsAt != null;

  if (rdata.plan === "pro" && hasNoCanonicalFields(rdata)) {
    return { ...empty, isPro: true, status, grandfathered: true, trialEverGranted };
  }

  const accessLive = expiresMs != null && expiresMs > now;
  const isPro =
    rdata.subscriptionPlan === "pro" &&
    status != null &&
    ACCESS_GRANTING.has(status) &&
    accessLive;
  const isTrialing = isPro && status === "trialing";
  const trialDaysLeft =
    isTrialing && expiresMs != null
      ? Math.max(0, Math.ceil((expiresMs - now) / DAY_MS))
      : 0;

  return {
    isPro,
    isTrialing,
    status,
    accessExpiresAtMs: expiresMs,
    trialDaysLeft,
    grandfathered: false,
    trialEverGranted,
    canStartTrial: !isPro && !trialEverGranted,
  };
}

/** Atajo booleano — lo que consumen los gates de features. */
export function isProActive(
  rdata: Record<string, unknown> | undefined | null,
  now: number = Date.now(),
): boolean {
  return entitlementOf(rdata, now).isPro;
}

// ─────────────────────────────────────────────────────────────────────────────
// LA TABLA DE ENTITLEMENTS — la reja de Pro vive en la Caja (8-sep-2026).
//
// Decisión de Ricardo (7-sep noche, FOODPASS/docs/PLAN_REJA_CAJA_8_SEP.md):
// free = menú, QR, pedidos, puntos SIN tope, clientes, win-back, export.
// Pro (499 MXN) = historial >30 días, 2° cajero con PIN, mesas, reportes >30 días.
//
// Espejo exacto de `EffectiveEntitlements` en
// FOODPASS/lib/subscription/services/subscription_tier_service.dart — los
// CUATRO nombres de abajo existen allá con el mismo significado, y el candado
// scripts/validate-caja-pro-gate.mjs lee el Dart para afirmarlo.
// ─────────────────────────────────────────────────────────────────────────────

import { isFounderTestRestaurant } from "./founderBypass.ts";

/** Ventana de historial del plan gratis (días). Más que esto = pared 1. */
export const HISTORY_DAYS_FREE = 30;
/** PINs de la caja en el plan gratis: 1 (el dueño). El 2° = pared 2. */
export const POS_STAFF_FREE_LIMIT = 1;

/** Las tres paredes de la Caja. `reports` usa la misma pared que `history`. */
export type CajaWall = "history" | "posStaff" | "tableTabs";

export type Entitlements = {
  plan: "free" | "pro";
  /** Días de historial visibles. `null` = sin límite (Pro). */
  historyDays: number | null;
  /** Segundo cajero y siguientes en el roster `posStaff`. */
  posStaffAccess: boolean;
  /** Abrir cuentas de mesa desde la Caja y agregarles rondas. */
  tableTabsAccess: boolean;
  /** Reportes más allá de `historyDays` (7/30 días siguen gratis). */
  reportsAccess: boolean;
};

export const FREE_ENTITLEMENTS: Entitlements = Object.freeze({
  plan: "free",
  historyDays: HISTORY_DAYS_FREE,
  posStaffAccess: false,
  tableTabsAccess: false,
  reportsAccess: false,
});

export const PRO_ENTITLEMENTS: Entitlements = Object.freeze({
  plan: "pro",
  historyDays: null,
  posStaffAccess: true,
  tableTabsAccess: true,
  reportsAccess: true,
});

/**
 * Qué puede hacer ESTE restaurante en la Caja. `rdata` debe venir fundido con
 * private/billing (fetchWithBilling) — la regla única de Pro es la de arriba.
 * El bypass de fundador (Luzz) abre todo: jamás ve una pared en operación.
 */
export function entitlementsOf(
  rdata: Record<string, unknown> | undefined | null,
  restaurantId?: string | null,
  now: number = Date.now(),
): Entitlements {
  if (isFounderTestRestaurant(restaurantId)) return PRO_ENTITLEMENTS;
  return isProActive(rdata, now) ? PRO_ENTITLEMENTS : FREE_ENTITLEMENTS;
}

/** ¿Se puede pedir una ventana de `days` días? `null` = todo el historial. */
export function historyAllowed(e: Entitlements, days: number | null): boolean {
  if (e.historyDays == null) return true;
  if (days == null) return false;
  return days <= e.historyDays;
}

/** true cuando la pared está CERRADA para este plan (hay que enseñarla). */
export function wallClosed(e: Entitlements, wall: CajaWall): boolean {
  switch (wall) {
    case "history":
      return e.historyDays != null;
    case "posStaff":
      return !e.posStaffAccess;
    case "tableTabs":
      return !e.tableTabsAccess;
  }
}
