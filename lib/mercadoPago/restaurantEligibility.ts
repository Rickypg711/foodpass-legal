/** Restaurant IDs that must never receive web checkout or MP preferences. */
export const BLOCKED_RESTAURANT_IDS = new Set([
  "694xqeERzye5QZeHpl93",
]);

export type RestaurantMpEligibility = {
  eligible: boolean;
  reason?: string;
  mercadoPagoConnected: boolean;
};

export function evaluateRestaurantMpEligibility(
  restaurantId: string,
  data: Record<string, unknown> | undefined,
): RestaurantMpEligibility {
  if (BLOCKED_RESTAURANT_IDS.has(restaurantId)) {
    return {
      eligible: false,
      reason: "restaurant_id_blocked",
      mercadoPagoConnected: false,
    };
  }
  if (!data) {
    return {
      eligible: false,
      reason: "restaurant_not_found",
      mercadoPagoConnected: false,
    };
  }
  const status = (data.status as string | undefined)?.trim().toLowerCase() ?? "";
  const isSetupComplete = data.isSetupComplete === true;
  const connected = data.mercadoPagoConnected === true;

  if (status !== "active" || !isSetupComplete) {
    return {
      eligible: false,
      reason: "restaurant_not_active_canonical",
      mercadoPagoConnected: connected,
    };
  }
  if (!connected) {
    return {
      eligible: false,
      reason: "mercado_pago_not_connected",
      mercadoPagoConnected: false,
    };
  }
  return { eligible: true, mercadoPagoConnected: true };
}
