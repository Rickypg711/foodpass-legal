// lib/upsellSuggestionCache.ts
//
// Cache + precalentado de la sugerencia de upsell (`getUpsellSuggestion`, la
// Cloud Function con IA — el mismo cerebro que la tarjeta del app).
//
// El problema que resuelve: la tarjeta del checkout pedía la sugerencia AL
// MONTAR — round-trip a Functions (+ arranque en frío + pitch de IA) = la
// tarjeta aparecía segundos tarde y brincaba el layout. Ahora el MENÚ
// precalienta la sugerencia desde que el carrito tiene platillos (mientras el
// cliente sigue escogiendo), y el checkout la lee ya resuelta → pinta al
// instante en el caso común.
//
// Cache por (restaurante + firma del carrito ordenada): agregar/quitar
// platillos cambia la firma y dispara UNA sola llamada nueva; los errores no
// se cachean. Defensivo igual que siempre: cualquier fallo = null = la
// tarjeta simplemente no sale — nunca rompe el checkout.

import { httpsCallable } from "firebase/functions";
import { getFirebaseFunctions } from "@/lib/firebase";

export type UpsellSuggestion = {
  menuItemId: string;
  name: string;
  price: number;
  priceDelta: number;
  category: string;
  type: string;
  pitchTitle: string;
  pitchBody: string;
  bonusPoints?: number;
  surprise?: boolean;
  accelerated?: boolean;
};

const cache = new Map<string, Promise<UpsellSuggestion | null>>();

export function upsellCartSignature(cartItemIds: string[]): string {
  return [...cartItemIds].sort().join(",");
}

export function fetchUpsellSuggestion(
  restaurantId: string,
  cartItemIds: string[],
): Promise<UpsellSuggestion | null> {
  if (!restaurantId || cartItemIds.length === 0) return Promise.resolve(null);
  const key = `${restaurantId}|${upsellCartSignature(cartItemIds)}`;
  let p = cache.get(key);
  if (!p) {
    p = (async () => {
      try {
        const fn = httpsCallable(getFirebaseFunctions(), "getUpsellSuggestion");
        const res = await fn({ restaurantId, cartItemIds });
        const data = res.data as { suggestion?: UpsellSuggestion | null };
        return data?.suggestion ?? null;
      } catch {
        cache.delete(key); // errores no se cachean — el siguiente intento reintenta
        return null;
      }
    })();
    cache.set(key, p);
  }
  return p;
}

/** Fire-and-forget: el menú lo llama cuando cambia el carrito (con debounce). */
export function warmUpsellSuggestion(restaurantId: string, cartItemIds: string[]): void {
  void fetchUpsellSuggestion(restaurantId, cartItemIds);
}
