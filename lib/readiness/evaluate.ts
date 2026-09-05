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

/**
 * Desde el 5-sep-2026 el readiness tiene DOS verdades, no una:
 *
 * - `isComplete` / `reasons`: ¿el local terminó de nacer? Nombre, dirección,
 *   teléfono, categoría, horario y menú. Los premios por puntos SOLO bloquean
 *   cuando el dueño nunca ha decidido sobre ellos (`loyaltyOptedOut` false).
 * - `loyaltyReady`: ¿hay algo que ganar? Un premio por puntos o una bienvenida
 *   prendida. Gobierna el escáner y la lista de puntos de la app, NO el status.
 *
 * Por qué: dos dueños en una semana (CURANDERO, CENTRAL FAST FOOD) apagaron
 * los premios a propósito y el checker los degradó a `setup` — panel en modo
 * primer día y "termina tu configuración" sobre un local con 62 platillos y
 * ventas reales. Apagar premios es su derecho: el producto lo informa (esta
 * página, 2-sep) y el cerebro lo persigue con SUS números, pero no lo castiga.
 * La bienvenida dejó de bloquear `active` (decisión 2-sep).
 *
 * Espejo exacto de restaurant_readiness_evaluator.dart y de
 * evaluateRestaurantReadinessForRewards (functions). Si tocas uno, toca los tres.
 */
export interface ReadinessResult {
  /** Terminó de nacer: `reasons` vacío. */
  isComplete: boolean;
  /**
   * Razones que BLOQUEAN `active`. Nunca incluye `first_purchase_reward`
   * (desde 5-sep) ni `reward_tiers` cuando `loyaltyOptedOut`.
   */
  reasons: string[];
  /** Hay algo que ganar: tiers válidos o bienvenida prendida. */
  loyaltyReady: boolean;
  /**
   * El dueño guardó la pantalla de premios con TODO apagado
   * (`rewardsConfigured === true` sin tiers ni bienvenida). Decisión suya.
   */
  loyaltyOptedOut: boolean;
  /** Informativo, nunca bloquea: lo que falta de lealtad, para persuadir. */
  loyaltyGaps: string[];
}

/**
 * `rewardsConfigured === true`: el dueño guardó su pantalla de premios al
 * menos una vez (web desde el 2-sep, app desde el 5-sep). Única señal de
 * "apagado a propósito" vs "nunca lo armó" (el borrador de la IA lo espera).
 */
export function isRewardsOptOutAttested(data: Record<string, unknown>): boolean {
  return data.rewardsConfigured === true;
}

/**
 * Campos derivados que TODO escritor persiste juntos en `restaurants/{id}`
 * (web: persistReadiness; app: readinessFieldsForFirestore; functions:
 * applyRewardDraft). Una sola forma para que ningún lado olvide uno.
 */
export function readinessFieldsForFirestore(result: ReadinessResult): {
  isSetupComplete: boolean;
  setupIncompleteReasons: string[];
  status: "active" | "setup";
  loyaltyReady: boolean;
  loyaltyOptedOut: boolean;
} {
  return {
    isSetupComplete: result.isComplete,
    setupIncompleteReasons: result.reasons,
    status: result.isComplete ? "active" : "setup",
    loyaltyReady: result.loyaltyReady,
    loyaltyOptedOut: result.loyaltyOptedOut,
  };
}

/**
 * ¿Se le puede PROMETER puntos al comensal en este local? Solo cuando hay
 * algo que ganar (`loyaltyReady !== false`). Con los premios apagados los
 * puntos siguen acumulándose en silencio en su número (progreso dotado: el
 * día que el dueño ponga un premio, ya llevan camino) pero ninguna pantalla,
 * ticket ni mensaje dice "ganaste puntos" — sería una promesa que el producto
 * no puede cumplir. Espejo de `restaurantPromisesPoints` en la app.
 */
export function restaurantPromisesPoints(data: Record<string, unknown> | null | undefined): boolean {
  if (!data) return true;
  return data.loyaltyReady !== false;
}

/**
 * Diners (búsqueda, feed, cerca de ti, puntos): solo locales completos CON
 * algo que ganar. Un local que apagó sus premios es invisible en la app de
 * puntos — igual que antes del 5-sep — pero su menú y su QR viven aquí.
 * Espejo de `isRestaurantVisibleToDiners` en la app. Docs anteriores al
 * 5-sep no traen `loyaltyReady`: completo implicaba premios.
 */
export function isRestaurantVisibleToDiners(data: Record<string, unknown> | undefined): boolean {
  if (!data) return false;
  if (data.isSetupComplete !== true) return false;
  return data.loyaltyReady !== false;
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

/**
 * PARIDAD: la app exige `enabled == true && menuItemId != null`
 * (FirstPurchaseRewardService.hasEnabledWithDescription → hasMenuItem →
 * getMenuItemId). Aquí se pedía el NOMBRE. Se aceptan los dos para no dejar
 * fuera ningún caso real, pero `menuItemId` es la señal canónica.
 */
function hasEnabledFirstPurchaseReward(fpr: unknown): boolean {
  if (!fpr || typeof fpr !== "object") return false;
  const r = fpr as Record<string, unknown>;
  if (r.enabled !== true) return false;
  const id = r.menuItemId;
  if (typeof id === "string" && id.trim().length > 0) return true;
  const name = r.menuItemName;
  return typeof name === "string" && name.trim().length > 0;
}

/**
 * PARIDAD CON LA APP (bug real, 24-ago-2026).
 *
 * Esto leía `tier.hasMenuItem === true` como si fuera un campo GUARDADO. No lo
 * es: en Dart `hasMenuItem` es un GETTER CALCULADO (RewardTier, reward_tier.dart)
 * que sale de `menuItemId != null`. Y los premios que aplica la IA se guardan
 * así:
 *
 *   {id, visitsRequired, menuItemId, menuItemName, menuItemDescription}
 *
 * — sin `hasMenuItem`. Resultado: la app leía esos tiers como VÁLIDOS y la web
 * como inválidos, para siempre. Los dos escriben isSetupComplete, así que
 * ganaba el último en escribir, y cuando ganaba la web el local quedaba
 * incompleto → **Mercado Pago pausado** en un local que ya estaba listo.
 * Le pasó a Luxo grill steak house y a Sr & Sra Perro.
 *
 * Ahora la señal canónica es `menuItemId`, igual que en Dart. Se sigue
 * aceptando `hasMenuItem === true` por compatibilidad con los tiers viejos que
 * sí lo traen guardado.
 */
function tierHasMenuItem(tier: Record<string, unknown>): boolean {
  const id = tier.menuItemId;
  if (typeof id === "string" && id.trim().length > 0) return true;
  // Docs legados que sí persistieron la bandera.
  return tier.hasMenuItem === true;
}

function hasValidRewardTiers(raw: unknown): boolean {
  if (!Array.isArray(raw) || raw.length === 0) return false;
  return raw.every((t) => {
    if (!t || typeof t !== "object") return false;
    return tierHasMenuItem(t as Record<string, unknown>);
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

  const hasWelcome = hasEnabledFirstPurchaseReward(restaurantData.firstPurchaseReward);
  const hasTiers = hasValidRewardTiers(restaurantData.rewardTiers);

  // El dueño ya DECIDIÓ sobre sus premios: guardó la pantalla y la dejó sin
  // nada prendido. Sin ese guardado, un local sin tiers sigue siendo un paso
  // pendiente (el borrador de la IA lo espera) — el muro #1 no se abre.
  const loyaltyOptedOut = isRewardsOptOutAttested(restaurantData) && !hasTiers && !hasWelcome;

  const loyaltyGaps: string[] = [];
  if (!hasWelcome) loyaltyGaps.push("first_purchase_reward");
  if (!hasTiers) loyaltyGaps.push("reward_tiers");

  if (!hasTiers && !loyaltyOptedOut) reasons.push("reward_tiers");

  return {
    isComplete: reasons.length === 0,
    reasons,
    loyaltyReady: hasTiers || hasWelcome,
    loyaltyOptedOut,
    loyaltyGaps,
  };
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

/**
 * Palomitas VERDADERAS para el WizardStepper. undefined cuando el doc no
 * trae reasons (restaurantes viejos) — ahí el stepper cae a su modo
 * posicional. Con reasons, la palomita dice la verdad: el camino del demo
 * brinca directo a Recompensas y pintaba "✓ Horario" sin horario
 * (cazado por Ricardo, 26-ago).
 */
export function wizardDoneKeys(
  reasons: unknown,
): Array<"horario" | "menu" | "rewards"> | undefined {
  if (!Array.isArray(reasons)) return undefined;
  const pending = stepGroupFromReasons(reasons as string[]);
  const out: Array<"horario" | "menu" | "rewards"> = [];
  if (!pending.hours) out.push("horario");
  if (!pending.menu) out.push("menu");
  if (!pending.rewards) out.push("rewards");
  return out;
}
