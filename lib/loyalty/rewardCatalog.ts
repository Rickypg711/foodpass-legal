// lib/loyalty/rewardCatalog.ts
//
// Shared parsing of a restaurant's redeemable rewards:
// - rewardTiers: points-based tiers (visitsRequired = POINTS, legacy key)
// - firstPurchaseReward: welcome reward (0 pts, unlocked after 1st purchase)
//
// Used by the customer web checkout, the customer puntos pages, and the
// vendor Caja/POS so every surface shows the exact same catalog.

export const FIRST_VISIT_TIER_ID = "first_visit";

export type RewardTierOption = {
  id: string;
  name: string;
  /** Points cost. 0 = welcome reward (no deduction, one-time unlock). */
  points: number;
  isFirstVisit: boolean;
};

/** Points tiers from restaurants/{id}.rewardTiers (excludes first-visit markers). */
export function parseRewardTiers(raw: unknown): RewardTierOption[] {
  if (!Array.isArray(raw)) return [];
  const tiers: RewardTierOption[] = [];
  raw.forEach((t, i) => {
    if (!t || typeof t !== "object") return;
    const tier = t as Record<string, unknown>;
    if (tier.isFirstVisitReward === true) return;
    const points = Number(tier.visitsRequired ?? tier.pointsRequired);
    const name =
      (typeof tier.menuItemName === "string" && tier.menuItemName.trim()) ||
      (typeof tier.description === "string" && tier.description.trim()) ||
      "";
    if (!name || !Number.isFinite(points) || points <= 0) return;
    tiers.push({
      id: typeof tier.id === "string" && tier.id ? tier.id : `tier_${i}`,
      name,
      points: Math.floor(points),
      isFirstVisit: false,
    });
  });
  return tiers.sort((a, b) => a.points - b.points);
}

/** Welcome reward from restaurants/{id}.firstPurchaseReward (null when disabled). */
export function parseFirstVisitReward(raw: unknown): RewardTierOption | null {
  if (!raw || typeof raw !== "object") return null;
  const m = raw as Record<string, unknown>;
  if (m.enabled !== true) return null;
  const name =
    typeof m.menuItemName === "string" && m.menuItemName.trim()
      ? m.menuItemName.trim()
      : null;
  if (!name) return null;
  return { id: FIRST_VISIT_TIER_ID, name, points: 0, isFirstVisit: true };
}

/**
 * Everything THIS customer can redeem right now.
 * @param points   current balance (phoneCustomers doc)
 * @param welcomeUnlocked  phoneCustomers.firstVisitRewardUnlocked === true
 */
export function redeemableRewards(params: {
  restaurantData: Record<string, unknown> | undefined;
  points: number;
  welcomeUnlocked: boolean;
}): RewardTierOption[] {
  const { restaurantData, points, welcomeUnlocked } = params;
  const out: RewardTierOption[] = [];
  const welcome = parseFirstVisitReward(restaurantData?.firstPurchaseReward);
  if (welcome && welcomeUnlocked) out.push(welcome);
  for (const t of parseRewardTiers(restaurantData?.rewardTiers)) {
    if (points >= t.points) out.push(t);
  }
  return out;
}
