/**
 * Evaluador PURO de readiness — sin Firebase, para poder ejecutarlo en tests.
 *
 * Se separó de `vendorReadiness.ts` el 23 ago 2026: ese módulo importa el SDK
 * de Firestore en el top level, así que `node --experimental-strip-types` no
 * lo podía cargar y esta lógica NUNCA se ejecutó en una prueba. El costo se
 * cobró el mismo día — ver `scripts/validate-readiness-hours.mjs`.
 *
 * Espejo de `restaurant_readiness_evaluator.dart`. Si tocas uno, toca el otro.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ReadinessResult {
  isComplete: boolean;
  reasons: string[];
}

export type SetupStep = "business" | "hours" | "menu" | "rewards";

// ─── Evaluator (mirrors restaurant_readiness_evaluator.dart) ─────────────────

function isBusinessHoursValid(businessHours: Record<string, unknown>): boolean {
  const days = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
  for (const day of days) {
    const d = businessHours[day] as Record<string, unknown> | undefined;
    if (!d) continue;
    if (d.isClosed === true) continue;
    const open = d.openingTime as Record<string, number> | undefined;
    const close = d.closingTime as Record<string, number> | undefined;
    if (!open || !close) return false;
    const oh = open.hour ?? 0, om = open.minute ?? 0;
    const ch = close.hour ?? 0, cm = close.minute ?? 0;
    // Un horario NOCTURNO (cierra al día siguiente: 13:00 → 01:00) es válido.
    // `lib/schedule.ts` y `BusinessHoursUtils.activeWindowAt` YA lo soportan
    // con el derrame de ayer; este validador lo rechazaba y dejaba al
    // restaurante en `status: "setup"` — que pausa el checkout de Mercado
    // Pago. Dos módulos opinando distinto sobre el mismo dato. Lo único
    // inválido de verdad es una ventana de duración CERO.
    if (ch === oh && cm === om) return false;
  }
  return true;
}

function isHoursConfirmed(data: Record<string, unknown>): boolean {
  // null → grandfathered (treated as confirmed for existing restaurants)
  if (data.hoursConfirmed == null) return true;
  return data.hoursConfirmed === true;
}

function hasEnabledFirstPurchaseReward(fpr: unknown): boolean {
  if (!fpr || typeof fpr !== "object") return false;
  const r = fpr as Record<string, unknown>;
  return r.enabled === true && typeof r.menuItemName === "string" && (r.menuItemName as string).trim().length > 0;
}

function hasValidRewardTiers(raw: unknown): boolean {
  if (!Array.isArray(raw) || raw.length === 0) return false;
  return raw.every((t) => {
    if (!t || typeof t !== "object") return false;
    const tier = t as Record<string, unknown>;
    return tier.hasMenuItem === true;
  });
}

export function evaluateReadiness(
  restaurantData: Record<string, unknown>,
  menuItemCount: number
): ReadinessResult {
  const reasons: string[] = [];

  if (!((restaurantData.name as string | undefined)?.trim())) reasons.push("name");
  if (!((restaurantData.address as string | undefined)?.trim())) reasons.push("address");
  if (!((restaurantData.phone as string | undefined)?.trim())) reasons.push("phone");

  const cats = restaurantData.categories as unknown[] | undefined;
  if (!cats || cats.length === 0) reasons.push("category");

  const hours = (restaurantData.businessHours as Record<string, unknown>) ?? {};
  if (!isBusinessHoursValid(hours) || !isHoursConfirmed(restaurantData)) {
    reasons.push("business_hours");
  }

  if (menuItemCount < 1) reasons.push("menu_items");

  if (!hasEnabledFirstPurchaseReward(restaurantData.firstPurchaseReward)) {
    reasons.push("first_purchase_reward");
  }

  if (!hasValidRewardTiers(restaurantData.rewardTiers)) {
    reasons.push("reward_tiers");
  }

  return { isComplete: reasons.length === 0, reasons };
}

/** Groups `setupIncompleteReasons` codes into the 4 UI step groups. */
export function stepGroupFromReasons(reasons: string[]): Record<SetupStep, boolean> {
  const set = new Set(reasons);
  return {
    business: ["name","address","phone","category"].some((c) => set.has(c)),
    hours: set.has("business_hours"),
    menu: set.has("menu_items"),
    rewards: set.has("reward_tiers") || set.has("first_purchase_reward"),
  };
}

export function completedStepCount(reasons: string[]): number {
  const pending = stepGroupFromReasons(reasons);
  return 4 - Object.values(pending).filter(Boolean).length;
}
