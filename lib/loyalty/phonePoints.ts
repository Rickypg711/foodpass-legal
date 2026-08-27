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
// free tier. At the cap: the customer is STILL saved to the CRM (phone, visit,
// spend — captured numbers are never thrown away) but earns 0 points, and the
// result carries capReached so the UI warns the owner (docs/PRICING.md,
// "cap honesto"). Redemptions are never blocked by the cap.
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
import {
  timestampToMillis,
  welcomeStillClaimable,
} from "@/lib/loyalty/rewardCatalog";
import { parseDiscountProfiles } from "@/lib/loyalty/discountProfiles";
import { isProActive } from "@/lib/subscription/entitlement";
import {
  mergeBillingOverPublic,
  mergeUsageOverPublic,
  tryTxGetBillingData,
  tryTxGetUsageData,
  usageRef,
} from "@/lib/subscription/billingDoc";
import {
  earnPolicyFromRestaurant,
  type EarnPolicy,
} from "@/lib/loyalty/earnPolicy";

// La política de earn vive ahora en lib/loyalty/earnPolicy.ts (módulo puro,
// usable server-side para SEO). Re-export para no romper a los importadores
// existentes (checkout / order page).
export { earnPolicyFromRestaurant };
export type { EarnPolicy };

const DEFAULT_MONTHLY_LIMIT = 50;

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

/** Pro = la REGLA ÚNICA (entitlement.ts). Antes miraba solo el legado
 * `plan` — tras la migración a private/billing eso dejaba a TODO Pro con el
 * tope de Free. El rdata que llega aquí ya viene fundido con private/billing. */
function hasUnlimitedLoyalty(rdata: Record<string, unknown>): boolean {
  return isProActive(rdata);
}

export type PhoneCreditResult =
  | {
      credited: true;
      phone: string;
      points: number;
      firstVisit: boolean;
      /** Monthly free-tier cap hit: customer WAS saved to the CRM but earned 0
       * points. Surface this to the owner (POS aviso / Panel banner) — never
       * let the cap fail silently. */
      capReached?: boolean;
      /** The order's redemptionRequest passed the live balance re-check and
       * was executed (order.redemptionResult === "applied"). Lets the POS
       * receipt say "🎁 Premio canjeado" truthfully without re-reading the
       * order doc. */
      redemptionApplied?: boolean;
    }
  | {
      credited: false;
      reason:
        | "order_missing"
        | "already_awarded"
        | "no_phone"
        | "not_paid"
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
    // La verdad de suscripción vive en private/billing y la cuota
    // (scanCount/lastReset) en private/usage (migración 24-ago); try-read:
    // un lector sin permiso (cliente anónimo) cae al doc público. En
    // transacción TODAS las lecturas van antes de cualquier escritura.
    const rdata = mergeUsageOverPublic(
      mergeBillingOverPublic(
        (restSnap.data() ?? {}) as Record<string, unknown>,
        await tryTxGetBillingData(tx, db, restaurantId),
      ),
      await tryTxGetUsageData(tx, db, restaurantId),
    );

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

    // Redemption request (checkout: customer-written / POS: cashier-written) —
    // executed here with a live balance re-check. Faked/double requests fail
    // safely.
    const rr = order.redemptionRequest as
      | { tierId?: unknown; name?: unknown; points?: unknown }
      | undefined;
    const redemptionCost =
      rr && Number.isFinite(Number(rr.points)) && Number(rr.points) > 0
        ? Math.floor(Number(rr.points))
        : 0;
    // Welcome reward: 0-pt one-time redemption gated by firstVisitRewardUnlocked.
    const welcomeRequested =
      rr != null && String(rr.tierId ?? "") === "first_visit";

    if (points <= 0 && redemptionCost <= 0 && !welcomeRequested && !capReached) {
      return { credited: false, reason: "zero_points" } as const;
    }
    // At the cap we do NOT bail out: the customer must still be saved to the
    // CRM (phone, visit, spend) — losing captured numbers at the cap was a
    // bug against the owner. Only the points earn (0) stops; the caller gets
    // capReached to warn the owner loudly (PRICING.md "cap honesto").

    const phoneRef = doc(db, "restaurants", restaurantId, "phoneCustomers", phone);
    const phoneSnap = await tx.get(phoneRef);
    const prev = (phoneSnap.data() ?? {}) as Record<string, unknown>;
    // "Primera visita" = sin compras confirmadas, no solo doc-inexistente:
    // el quick-assign de descuentos en la caja pre-crea el doc (solo
    // discountProfileId) antes de la primera compra — eso NO debe robarle
    // el premio de bienvenida ni el createdAt (ancla de la ventana de 7 días).
    const firstVisit = !phoneSnap.exists() || !(Number(prev.visits) > 0);

    // Descuentos especiales: perfil con earnsPoints=false (p.ej. Staff) no
    // acumula puntos ni desbloquea el premio de bienvenida — el descuento ES
    // su beneficio. La visita y el gasto SÍ se registran (CRM del dueño), y
    // al no ganar puntos tampoco quema el contador mensual.
    const assignedPid =
      typeof prev.discountProfileId === "string" ? prev.discountProfileId : "";
    const noEarn =
      !!assignedPid &&
      parseDiscountProfiles(rdata.discountProfiles).find(
        (p) => p.id === assignedPid,
      )?.earnsPoints === false;
    const earnedPoints = noEarn ? 0 : points;

    // Loop de auditoría de descuentos: contadores por cliente (acotados, no
    // arrays) — alimentan Reportes ("$X dados este mes") y al brain para
    // detectar abuso ("este número usó Staff 43 veces"). Se escriben en la
    // MISMA transacción que el crédito de puntos: un solo escritor, cero drift.
    const da = order.discountApplied as { amount?: unknown } | undefined;
    const discountAmount = Number(da?.amount) || 0;

    const balanceAfterEarn = (Number(prev.points) || 0) + earnedPoints;
    // Window enforced at apply time too: an expired welcome reward can't be
    // redeemed even if a stale client still offers it.
    const welcomeApplied =
      welcomeRequested &&
      prev.firstVisitRewardUnlocked === true &&
      welcomeStillClaimable(timestampToMillis(prev.createdAt));
    const redemptionApplied =
      welcomeApplied || (redemptionCost > 0 && balanceAfterEarn >= redemptionCost);
    const finalPoints =
      !welcomeApplied && redemptionApplied
        ? balanceAfterEarn - redemptionCost
        : balanceAfterEarn;

    const name = String(order.customerName ?? "").trim();
    const restaurantName = String(rdata.name ?? "").trim();
    const redemptionVia = order.orderSource === "pos" ? "pos" : "checkout";
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
        // NEXT visit (§4). Redeeming it consumes the unlock permanently.
        firstVisitRewardUnlocked: welcomeApplied
          ? false
          : prev.firstVisitRewardUnlocked === true
            ? true
            : firstVisit && !noEarn,
        ...(welcomeApplied
          ? { firstVisitRewardRedeemedAt: serverTimestamp() }
          : {}),
        lastVisitAt: serverTimestamp(),
        ...(discountAmount > 0
          ? {
              discountsGivenTotal:
                Math.round(((Number(prev.discountsGivenTotal) || 0) + discountAmount) * 100) / 100,
              discountsGivenCount: (Number(prev.discountsGivenCount) || 0) + 1,
              lastDiscountAt: serverTimestamp(),
            }
          : {}),
        ...(firstVisit ? { createdAt: serverTimestamp() } : {}),
        source: firstVisit ? "web_order" : (prev.source ?? "web_order"),
        ...(redemptionApplied
          ? {
              lastRedemptionAt: serverTimestamp(),
              redemptions: arrayUnion({
                tierId: String(rr?.tierId ?? ""),
                name: String(rr?.name ?? ""),
                points: welcomeApplied ? 0 : redemptionCost,
                at: Timestamp.now(),
                via: redemptionVia,
              }),
            }
          : {}),
      },
      { merge: true },
    );

    tx.update(orderRef, {
      loyaltyAwarded: true,
      phonePointsAwarded: earnedPoints,
      phoneLoyaltyAt: serverTimestamp(),
      ...(redemptionCost > 0 || welcomeRequested
        ? { redemptionResult: redemptionApplied ? "applied" : "insufficient" }
        : {}),
    });

    // Counter burns only when something was EARNED. El contador vive en
    // private/usage (espejo de phone_points_service.dart): `set` con merge,
    // no `update` — el doc privado puede no existir todavía y un update
    // sobre doc ausente revienta la transacción entera (y con ella el cobro).
    if (earnedPoints > 0) {
      tx.set(
        usageRef(db, restaurantId),
        {
          scanCount: effectiveCount + 1,
          ...(inSameMonth ? {} : { lastReset: Timestamp.fromDate(now) }),
        },
        { merge: true },
      );
    }

    return {
      credited: true,
      phone,
      points: earnedPoints,
      firstVisit,
      ...(capReached ? { capReached: true } : {}),
      ...(redemptionApplied ? { redemptionApplied: true } : {}),
    } as const;
  });
}
