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
