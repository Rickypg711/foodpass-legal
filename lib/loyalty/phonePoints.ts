// lib/loyalty/phonePoints.ts
//
// Phone Points v1 — STRATEGY_MENU_FIRST_AND_PHONE_LOYALTY.md §4.
// The phone number IS the loyalty account. Points credit ONLY on confirmed
// payment + known identity, transactionally:
//
//   restaurants/{rid}/phoneCustomers/{phoneDigits}
//     { phone, name, points, visits, totalSpend, firstVisitRewardUnlocked,
//       createdAt, lastVisitAt }
//
// Every credit burns the restaurant's monthly counter (scanCount — same field
// the app's scan limit uses) so web loyalty can't tunnel around the 50/mes
// free tier. At the cap: no credit, no error — loyalty goes quiet (§4:
// "stop promising, don't break the menu").
//
// Idempotency: order.loyaltyAwarded flag, checked and set inside the
// transaction — an order can never credit twice.

import {
  arrayUnion,
  doc,
  runTransaction,
  serverTimestamp,
  Timestamp,
  type Firestore,
} from "firebase/firestore";

const DEFAULT_MONTHLY_LIMIT = 50;

export type EarnPolicy = { base: number; step: number };

/** Same fallbacks as the app's LoyaltyEarnPolicyConfig (mirrors order page). */
export function earnPolicyFromRestaurant(
  d: Record<string, unknown>,
): EarnPolicy {
  const nested = d.loyaltyEarnPolicy;
  if (nested && typeof nested === "object") {
    const m = nested as Record<string, unknown>;
    const base = Number(m.basePointsPerPurchase);
    const step = Number(m.spendStepAmount);
    if (Number.isFinite(base) && base >= 1 && Number.isFinite(step) && step >= 1) {
      return { base: Math.floor(base), step: Math.floor(step) };
    }
  }
  const cc = typeof d.currencyCode === "string" ? d.currencyCode.trim().toUpperCase() : "MXN";
  return { base: 1, step: cc === "USD" ? 2 : 30 };
}

type OrderItemLike = {
  isUpsell?: boolean;
  upsellBonusPoints?: number;
};

/** base + floor(total/step) + upsell bonuses (mirrors LoyaltyPurchaseEarnPolicy). */
export function computeOrderPoints(
  total: number,
  items: OrderItemLike[] | undefined,
  earn: EarnPolicy,
): number {
  if (!Number.isFinite(total) || total <= 0) return 0;
  const base = earn.base + Math.floor(total / earn.step);
  const bonus = (items ?? []).reduce(
    (s, it) =>
      s +
      (it?.isUpsell === true &&
      typeof it.upsellBonusPoints === "number" &&
      it.upsellBonusPoints > 0
        ? Math.floor(it.upsellBonusPoints)
        : 0),
    0,
  );
  return base + bonus;
}

function sameCalendarMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

/** Pro plan check from canonical restaurant fields (v1: plan + expiry). */
function hasUnlimitedLoyalty(rdata: Record<string, unknown>): boolean {
  if (rdata.plan !== "pro") return false;
  const exp = rdata.subscriptionAccessExpiresAt;
  if (exp instanceof Timestamp) {
    return exp.toDate().getTime() > Date.now();
  }
  return true;
}

export type PhoneCreditResult =
  | { credited: true; phone: string; points: number; firstVisit: boolean }
  | {
      credited: false;
      reason:
        | "order_missing"
        | "already_awarded"
        | "no_phone"
        | "not_paid"
        | "cap_reached"
        | "zero_points";
    };

/**
 * Credits phone-keyed loyalty for a PAID order. Call after the vendor marks
 * an order cobrada (cash/card) or when completing an MP-paid order.
 * Safe to call repeatedly — the loyaltyAwarded flag makes it a no-op after
 * the first success.
 */
export async function creditPhonePointsForOrder(params: {
  db: Firestore;
  restaurantId: string;
  orderId: string;
}): Promise<PhoneCreditResult> {
  const { db, restaurantId, orderId } = params;
  const orderRef = doc(db, "restaurants", restaurantId, "orders", orderId);
  const restaurantRef = doc(db, "restaurants", restaurantId);

  return runTransaction(db, async (tx) => {
    const orderSnap = await tx.get(orderRef);
    if (!orderSnap.exists()) {
      return { credited: false, reason: "order_missing" } as const;
    }
    const order = orderSnap.data() as Record<string, unknown>;

    if (order.loyaltyAwarded === true) {
      return { credited: false, reason: "already_awarded" } as const;
    }
    // Normalize to the last 10 digits (MX local) — one doc per number even if
    // the customer typed it with the 52 country prefix. Matches the rules'
    // token.phone_number check and the app's future OTP merge.
    let phone = String(order.customerPhone ?? "").replace(/\D/g, "");
    if (phone.length > 10) phone = phone.slice(-10);
    if (phone.length < 10) {
      return { credited: false, reason: "no_phone" } as const;
    }
    if (order.paymentStatus !== "paid") {
      return { credited: false, reason: "not_paid" } as const;
    }

    const restSnap = await tx.get(restaurantRef);
    const rdata = (restSnap.data() ?? {}) as Record<string, unknown>;

    // ── Monthly counter (same scanCount the app's limit enforces) ──────────
    const unlimited = hasUnlimitedLoyalty(rdata);
    const rawLimit = Number(rdata.monthlyLimit);
    const limit =
      Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : DEFAULT_MONTHLY_LIMIT;
    const lastReset =
      rdata.lastReset instanceof Timestamp ? rdata.lastReset.toDate() : null;
    const now = new Date();
    const inSameMonth = lastReset !== null && sameCalendarMonth(lastReset, now);
    const effectiveCount = inSameMonth ? Number(rdata.scanCount ?? 0) || 0 : 0;
    const capReached = !unlimited && effectiveCount >= limit;

    // Earning is gated by the cap; REDEEMING is not (deduction ≠ earn, and
    // blocking it would break a promise the customer already holds).
    const earn = earnPolicyFromRestaurant(rdata);
    const total = Number(order.total ?? 0) || 0;
    const items = (order.items as OrderItemLike[] | undefined) ?? [];
    const points = capReached ? 0 : computeOrderPoints(total, items, earn);

    // Checkout redemption request (unprivileged, customer-written) — executed
    // here with a live balance re-check. Faked/double requests fail safely.
    const rr = order.redemptionRequest as
      | { tierId?: unknown; name?: unknown; points?: unknown }
      | undefined;
    const redemptionCost =
      rr && Number.isFinite(Number(rr.points)) && Number(rr.points) > 0
        ? Math.floor(Number(rr.points))
        : 0;

    if (points <= 0 && redemptionCost <= 0) {
      return {
        credited: false,
        reason: capReached ? "cap_reached" : "zero_points",
      } as const;
    }

    const phoneRef = doc(db, "restaurants", restaurantId, "phoneCustomers", phone);
    const phoneSnap = await tx.get(phoneRef);
    const firstVisit = !phoneSnap.exists();
    const prev = (phoneSnap.data() ?? {}) as Record<string, unknown>;

    const balanceAfterEarn = (Number(prev.points) || 0) + points;
    const redemptionApplied =
      redemptionCost > 0 && balanceAfterEarn >= redemptionCost;
    const finalPoints = redemptionApplied
      ? balanceAfterEarn - redemptionCost
      : balanceAfterEarn;

    const name = String(order.customerName ?? "").trim();
    const restaurantName = String(rdata.name ?? "").trim();
    tx.set(
      phoneRef,
      {
        phone,
        restaurantId,
        ...(restaurantName ? { restaurantName } : {}),
        ...(name ? { name } : {}),
        points: finalPoints,
        visits: (Number(prev.visits) || 0) + 1,
        totalSpend: (Number(prev.totalSpend) || 0) + total,
        // First confirmed purchase unlocks the first-visit reward for the
        // NEXT visit (§4).
        firstVisitRewardUnlocked:
          prev.firstVisitRewardUnlocked === true ? true : firstVisit,
        lastVisitAt: serverTimestamp(),
        ...(firstVisit ? { createdAt: serverTimestamp() } : {}),
        source: firstVisit ? "web_order" : (prev.source ?? "web_order"),
        ...(redemptionApplied
          ? {
              lastRedemptionAt: serverTimestamp(),
              redemptions: arrayUnion({
                tierId: String(rr?.tierId ?? ""),
                name: String(rr?.name ?? ""),
                points: redemptionCost,
                at: Timestamp.now(),
                via: "checkout",
              }),
            }
          : {}),
      },
      { merge: true },
    );

    tx.update(orderRef, {
      loyaltyAwarded: true,
      phonePointsAwarded: points,
      phoneLoyaltyAt: serverTimestamp(),
      ...(redemptionCost > 0
        ? { redemptionResult: redemptionApplied ? "applied" : "insufficient" }
        : {}),
    });

    // Counter burns only when something was EARNED.
    if (points > 0) {
      tx.update(restaurantRef, {
        scanCount: effectiveCount + 1,
        ...(inSameMonth ? {} : { lastReset: Timestamp.fromDate(now) }),
      });
    }

    return { credited: true, phone, points, firstVisit } as const;
  });
}
