// lib/restaurantDocCache.ts
//
// UNA sola lectura del doc del restaurante por sesión de página, compartida
// entre el menú del cliente, el WebOrderingProvider y el checkout. Antes cada
// uno hacía su propio getDoc del MISMO doc (2-3 viajes en serie) y la barra
// del carrito + upsell de la app aparecían tarde esperando el suyo.
//
// Cache por promesa (se comparte aun cuando los llamadores llegan al mismo
// tiempo). Los errores NO se cachean — el siguiente intento vuelve a leer.

import { doc, getDoc, type DocumentSnapshot } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";

const cache = new Map<string, Promise<DocumentSnapshot>>();

export function getRestaurantSnapOnce(restaurantId: string): Promise<DocumentSnapshot> {
  let p = cache.get(restaurantId);
  if (!p) {
    p = getDoc(doc(getFirebaseDb(), "restaurants", restaurantId));
    p.catch(() => {
      cache.delete(restaurantId);
    });
    cache.set(restaurantId, p);
  }
  return p;
}
