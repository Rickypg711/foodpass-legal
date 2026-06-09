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
    if (ch < oh || (ch === oh && cm <= om)) return false;
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

// ─── Persist (mirrors RestaurantReadinessService.persistReadinessForRestaurantId) ─

export async function persistReadiness(restaurantId: string): Promise<void> {
  const db = getFirebaseDb();
  const rSnap = await getDoc(doc(db, "restaurants", restaurantId));
  if (!rSnap.exists()) return;
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
}
