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
  const cc = typeof d.currencyCode === "string" ? d.currencyCode.trim().toUpperCase() : "MXN";
  return { base: 1, step: cc === "USD" ? 2 : 30 };
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
