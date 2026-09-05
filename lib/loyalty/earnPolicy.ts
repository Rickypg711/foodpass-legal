// lib/loyalty/earnPolicy.ts
//
// Política de acumulación de puntos — módulo PURO (cero imports de Firebase)
// para poder usarse igual en componentes cliente Y en layouts server (SEO/
// schema). Única fuente de la regla; phonePoints.ts la re-exporta para no
// romper a sus importadores (checkout / order page).
//
// Regla (espejo de LoyaltyEarnPolicyConfig en la app — parity rule):
//   puntos = base + floor(total / step)   [+ bonos de upsell, eso vive en
//   computeOrderPoints de phonePoints.ts]

export type EarnPolicy = { base: number; step: number };

/**
 * Paso de gasto por moneda para "1 punto extra por cada $X" (espejo de
 * LoyaltyEarnPolicyConfig.defaultSpendStepForNewVenue en la app). Todos
 * valen más o menos lo mismo (~USD 2): MXN 30 · USD 2 · DOP 100 · COP 8,000.
 * 5-sep-2026: Central Fast Food (RD) nació con paso 30 en pesos dominicanos
 * y regalaba puntos ~3x más rápido en valor real. México sigue en 30.
 */
export function defaultSpendStepForCurrency(currencyCode: unknown): number {
  const cc = typeof currencyCode === "string" ? currencyCode.trim().toUpperCase() : "MXN";
  switch (cc) {
    case "USD":
      return 2;
    case "DOP":
      return 100;
    case "COP":
      return 8000;
    default:
      return 30;
  }
}

/** La política que se guarda al nacer (alta) o al cambiar de país/moneda. */
export function newVenueEarnPolicy(currencyCode: string): {
  currencyCode: string;
  basePointsPerPurchase: number;
  spendStepAmount: number;
} {
  const cc = currencyCode.trim().toUpperCase() || "MXN";
  return { currencyCode: cc, basePointsPerPurchase: 1, spendStepAmount: defaultSpendStepForCurrency(cc) };
}

/** Same fallbacks as the app's LoyaltyEarnPolicyConfig (mirrors order page). */
export function earnPolicyFromRestaurant(
  d: Record<string, unknown>,
): EarnPolicy {
  const nested = d.loyaltyEarnPolicy;
  if (nested && typeof nested === "object") {
    const m = nested as Record<string, unknown>;
    const base = Number(m.basePointsPerPurchase);
    const step = Number(m.spendStepAmount);
    if (Number.isFinite(base) && base >= 1 && Number.isFinite(step) && step >= 1) {
      return { base: Math.floor(base), step: Math.floor(step) };
    }
  }
  return { base: 1, step: defaultSpendStepForCurrency(d.currencyCode) };
}

/**
 * La regla en UNA línea (robo del "Earn 10 points for every $1" de Owner):
 * "1 punto por compra + 1 extra por cada $30". Siempre calculada de la
 * config REAL del restaurante — nunca hardcodear el número en copy.
 */
export function earnRuleLine(p: EarnPolicy): string {
  const base =
    p.base === 1 ? "1 punto por compra" : `${p.base} puntos por compra`;
  return `${base} + 1 extra por cada $${p.step}`;
}
