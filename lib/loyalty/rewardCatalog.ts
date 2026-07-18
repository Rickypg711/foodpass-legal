// lib/loyalty/rewardCatalog.ts
//
// Shared parsing of a restaurant's redeemable rewards:
// - rewardTiers: points-based tiers (visitsRequired = POINTS, legacy key)
// - firstPurchaseReward: welcome reward (0 pts, unlocked after 1st purchase)
//
// Used by the customer web checkout, the customer puntos pages, and the
// vendor Caja/POS so every surface shows the exact same catalog.

export const FIRST_VISIT_TIER_ID = "first_visit";

/** Days the welcome reward stays claimable after unlock (same rule as the app). */
export const FIRST_VISIT_CLAIM_DAYS = 7;

/**
 * Is the welcome reward still inside its 7-day claim window?
 * Unknown unlock date fails OPEN (claimable) — never punish missing data.
 */
export function welcomeStillClaimable(
  unlockedAtMs: number | null | undefined,
  nowMs: number = Date.now(),
): boolean {
  if (!unlockedAtMs) return true;
  return nowMs - unlockedAtMs <= FIRST_VISIT_CLAIM_DAYS * 86400000;
}

/** Firestore Timestamp | Date | undefined → epoch ms (null when absent). */
export function timestampToMillis(ts: unknown): number | null {
  if (!ts) return null;
  if (ts instanceof Date) return ts.getTime();
  const maybe = ts as { toMillis?: () => number };
  return typeof maybe.toMillis === "function" ? maybe.toMillis() : null;
}

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
 * @param welcomeUnlockedAtMs  when the unlock happened (doc createdAt) — the
 *   welcome reward is only offered inside its 7-day claim window.
 */
export function redeemableRewards(params: {
  restaurantData: Record<string, unknown> | undefined;
  points: number;
  welcomeUnlocked: boolean;
  welcomeUnlockedAtMs?: number | null;
}): RewardTierOption[] {
  const { restaurantData, points, welcomeUnlocked, welcomeUnlockedAtMs } = params;
  const out: RewardTierOption[] = [];
  const welcome = parseFirstVisitReward(restaurantData?.firstPurchaseReward);
  if (welcome && welcomeUnlocked && welcomeStillClaimable(welcomeUnlockedAtMs)) out.push(welcome);
  for (const t of parseRewardTiers(restaurantData?.rewardTiers)) {
    if (points >= t.points) out.push(t);
  }
  return out;
}
