/**
 * Bypass de fundador — Luzz Pizza (cuenta de Ricardo) usa las features Pro sin
 * plan para probar el flujo end-to-end. Vivía en lib/loyalty/discountProfiles.ts
 * (27-jul); se mudó aquí el 8-sep para que la tabla de entitlements de la Caja
 * (lib/subscription/entitlement.ts) lo reutilice sin importar descuentos (ciclo).
 *
 * Regla (decisión 8-sep, plan §6.3): un restaurante con bypass JAMÁS ve una
 * pared de Pro en plena operación — ni descuentos, ni historial, ni PIN, ni mesas.
 * TODO: quitar antes de vender la feature como Pro-only.
 */
export const FOUNDER_TEST_RESTAURANT_IDS = ["kdjJsNwriU4AL4528a4d"];

export function isFounderTestRestaurant(
  restaurantId: string | null | undefined,
): boolean {
  return !!restaurantId && FOUNDER_TEST_RESTAURANT_IDS.includes(restaurantId);
}
