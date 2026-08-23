/**
 * TypeScript port of restaurant_readiness_evaluator.dart + RestaurantReadinessService.
 * Single source of truth for isSetupComplete / setupIncompleteReasons on the web.
 */

import {
  doc,
  getDoc,
  updateDoc,
  collection,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";

export * from "@/lib/readiness/evaluate";
import { evaluateReadiness, type ReadinessResult } from "@/lib/readiness/evaluate";

// ─── Persist (mirrors RestaurantReadinessService.persistReadinessForRestaurantId) ─

export async function persistReadiness(
  restaurantId: string,
): Promise<ReadinessResult | null> {
  const db = getFirebaseDb();
  const rSnap = await getDoc(doc(db, "restaurants", restaurantId));
  if (!rSnap.exists()) return null;
  const data = rSnap.data() as Record<string, unknown>;

  const menuSnap = await getDocs(collection(db, "restaurants", restaurantId, "menu"));
  const menuItemCount = menuSnap.size;

  const result = evaluateReadiness(data, menuItemCount);
  const status = result.isComplete ? "active" : "setup";

  await updateDoc(doc(db, "restaurants", restaurantId), {
    isSetupComplete: result.isComplete,
    setupIncompleteReasons: result.reasons,
    status,
    lastUpdated: serverTimestamp(),
  });

  // Returned so save flows can WARN the vendor when this write just demoted
  // the restaurant to "setup" (which pauses web Mercado Pago checkout).
  return result;
}
