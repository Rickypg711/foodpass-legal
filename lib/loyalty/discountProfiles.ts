// lib/loyalty/discountProfiles.ts
//
// Discount Profiles (Pro feature) — owner-defined special discounts (staff,
// family&friends) assigned to a customer's phone number and auto-applied at
// the caja. Built from Pecado Escondido's real spec (Jul 2026):
// staff = per-category (bebidas X% / alimentos Y%), family = % on total.
//
// INVARIANTS (see memory discount_profiles_build.md):
// - Only the owner creates/assigns profiles. Staff cannot self-discount.
// - Order totals are saved NET of discount → points/commission math
//   everywhere (web, app, functions) needs no changes and can't be farmed.
// - Parity: same Firestore schema read by web POS and app POS.

export type DiscountProfile = {
  id: string;
  name: string;
  type: "per_category" | "total";
  /** per_category */
  bebidasPct?: number;
  alimentosPct?: number;
  /** total */
  totalPct?: number;
  /** false = no acumula puntos ni desbloquea bienvenida (el descuento ES su
   * beneficio). Ausente/true = junta puntos normal, calculados sobre lo pagado. */
  earnsPoints?: boolean;
};

const BEBIDA_RE =
  /bebida|drink|refresco|cerveza|caf[eé]|coffee|jugo|agua|licuado|smoothie|soda|t[eé]s?\b|cocktail|coctel|vino|beer/i;

export function isBebidaCategory(categoryName: string | undefined | null): boolean {
  return !!categoryName && BEBIDA_RE.test(categoryName);
}

function clampPct(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, n));
}

export function parseDiscountProfiles(raw: unknown): DiscountProfile[] {
  if (!Array.isArray(raw)) return [];
  const out: DiscountProfile[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const m = r as Record<string, unknown>;
    const id = typeof m.id === "string" ? m.id : "";
    const name = typeof m.name === "string" ? m.name.trim() : "";
    const type = m.type === "per_category" || m.type === "total" ? m.type : null;
    if (!id || !name || !type) continue;
    out.push({
      id,
      name,
      type,
      bebidasPct: clampPct(m.bebidasPct),
      alimentosPct: clampPct(m.alimentosPct),
      totalPct: clampPct(m.totalPct),
      earnsPoints: m.earnsPoints !== false,
    });
  }
  return out;
}

export type DiscountCartLine = {
  price: number;
  quantity: number;
  categoryName?: string | null;
};

export type DiscountResult = {
  amount: number;
  breakdown?: { bebidas: number; alimentos: number };
};

/** Computes the discount for a cart under a profile. Never negative, never
 * more than the subtotal. Rounded to cents. */
export function computeDiscount(
  lines: DiscountCartLine[],
  profile: DiscountProfile,
): DiscountResult {
  const subtotal = lines.reduce(
    (s, l) => s + (Number(l.price) || 0) * (Number(l.quantity) || 0),
    0,
  );
  if (subtotal <= 0) return { amount: 0 };

  let amount = 0;
  let bebidas = 0;
  let alimentos = 0;

  if (profile.type === "total") {
    amount = (subtotal * clampPct(profile.totalPct)) / 100;
  } else {
    for (const l of lines) {
      const lineTotal = (Number(l.price) || 0) * (Number(l.quantity) || 0);
      if (lineTotal <= 0) continue;
      if (isBebidaCategory(l.categoryName)) {
        bebidas += (lineTotal * clampPct(profile.bebidasPct)) / 100;
      } else {
        alimentos += (lineTotal * clampPct(profile.alimentosPct)) / 100;
      }
    }
    amount = bebidas + alimentos;
  }

  amount = Math.min(amount, subtotal);
  amount = Math.round(amount * 100) / 100;
  if (profile.type === "per_category") {
    return {
      amount,
      breakdown: {
        bebidas: Math.round(bebidas * 100) / 100,
        alimentos: Math.round(alimentos * 100) / 100,
      },
    };
  }
  return { amount };
}

/** TEMP founder testing: estos restaurantes usan descuentos sin Pro.
 * Solo Luzz Pizza (cuenta del fundador) para probar el flujo end-to-end.
 * TODO: quitar antes de vender la feature como Pro-only. */
const FOUNDER_TEST_RESTAURANT_IDS = ["kdjJsNwriU4AL4528a4d"];

export function isFounderTestRestaurant(restaurantId: string | null | undefined): boolean {
  return !!restaurantId && FOUNDER_TEST_RESTAURANT_IDS.includes(restaurantId);
}

/** Lee `subscriptionAccessExpiresAt` en cualquiera de sus formas (Timestamp de
 * Firestore, Date, epoch ms, ISO string) y devuelve epoch ms, o null si falta
 * o no se puede interpretar. */
function accessExpiresAtMs(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (v instanceof Date) {
    const ms = v.getTime();
    return Number.isFinite(ms) ? ms : null;
  }
  if (typeof v === "string") {
    const ms = Date.parse(v);
    return Number.isFinite(ms) ? ms : null;
  }
  if (typeof v === "object") {
    const o = v as {
      toMillis?: () => number;
      toDate?: () => Date;
      seconds?: number;
      _seconds?: number;
    };
    if (typeof o.toMillis === "function") {
      const ms = o.toMillis();
      return Number.isFinite(ms) ? ms : null;
    }
    if (typeof o.toDate === "function") {
      const ms = o.toDate().getTime();
      return Number.isFinite(ms) ? ms : null;
    }
    const secs = typeof o.seconds === "number" ? o.seconds : o._seconds;
    if (typeof secs === "number" && Number.isFinite(secs)) return secs * 1000;
  }
  return null;
}

/** Pro gate — MISMA semántica canónica que subscription_tier_service.dart y que
 * `canonicalPro` en app/vendor/plan/page.tsx: el status por sí solo NO basta,
 * el acceso tiene que seguir vigente.
 *
 * Bug corregido el 28 jul 2026: antes sólo miraba `subscriptionAccessStatus`,
 * así que un status pegado en "active" con `subscriptionAccessExpiresAt` vencido
 * daba Pro gratis para siempre (caso real: restaurants/5XMZ7lSRhLTH7ppKR8FQ,
 * "active" con expiración 15-may-2026).
 *
 * Fail-closed a propósito: sin fecha de expiración → false. */
export function discountsEnabled(
  rdata: Record<string, unknown> | undefined,
  restaurantId?: string | null,
  now: number = Date.now(),
): boolean {
  if (isFounderTestRestaurant(restaurantId)) return true;
  if (!rdata) return false;
  if (rdata.subscriptionPlan !== "pro") return false;
  const status = rdata.subscriptionAccessStatus;
  if (status !== "active" && status !== "trialing") return false;
  const expiresMs = accessExpiresAtMs(rdata.subscriptionAccessExpiresAt);
  return expiresMs != null && expiresMs > now;
}
