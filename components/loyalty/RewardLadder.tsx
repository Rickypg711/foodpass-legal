"use client";

// components/loyalty/RewardLadder.tsx
//
// PREMIOS FANTASMA — el robo #1 del teardown de la app de Owner/Metro Pizza:
// la escalera COMPLETA de premios visible SIN sesión, en gris con candado y
// los puntos que cuesta cada uno. Deseo antes que fricción: el comensal ve
// exactamente qué comida gratis se está perdiendo ANTES de dar su número.
//
// Modos:
// - Fantasma (currentPoints == null): todo bloqueado, "🔒 N ⭐".
// - Con saldo (currentPoints >= 0, tras verificar SMS): las tarjetas
//   alcanzadas se encienden ("✅ Ya lo tienes") y las demás dicen
//   "Te faltan N ⭐" — el mismo lenguaje que la app (parity de copy).
//
// Los premios son PLATILLOS REALES del menú (RewardTier→menuItem), así que
// cuando el surface tiene el menú a la mano pasamos las fotos por
// `menuItems` y la escalera las pinta — premio con foto > texto (Owner
// nunca muestra un premio sin foto).

import Image from "next/image";
import {
  parseFirstVisitReward,
  parseRewardTiers,
  type RewardTierOption,
} from "@/lib/loyalty/rewardCatalog";
import {
  earnPolicyFromRestaurant,
  earnRuleLine,
} from "@/lib/loyalty/earnPolicy";

export type LadderMenuItem = { name: string; imageUrl: string | null };

/** ¿Hay algo que pintar? (tiers o premio de bienvenida) — para que los
 *  surfaces no rendereen una sección vacía. */
export function hasRewardLadder(
  restaurantData: Record<string, unknown> | null | undefined,
): boolean {
  if (!restaurantData) return false;
  return (
    parseRewardTiers(restaurantData.rewardTiers).length > 0 ||
    parseFirstVisitReward(restaurantData.firstPurchaseReward) !== null
  );
}

function photoFor(
  tier: RewardTierOption,
  menuItems: LadderMenuItem[] | undefined,
): string | null {
  if (!menuItems || menuItems.length === 0) return null;
  const wanted = tier.name.trim().toLowerCase();
  const hit = menuItems.find(
    (m) => m.imageUrl && m.name.trim().toLowerCase() === wanted,
  );
  return hit?.imageUrl ?? null;
}

function TierRow({
  tier,
  imageUrl,
  currentPoints,
  welcomeUnlocked,
}: {
  tier: RewardTierOption;
  imageUrl: string | null;
  /** null = modo fantasma (sin saldo conocido). */
  currentPoints: number | null;
  welcomeUnlocked: boolean;
}) {
  const ghost = currentPoints === null;
  const reached = tier.isFirstVisit
    ? welcomeUnlocked
    : !ghost && (currentPoints ?? 0) >= tier.points;
  const missing = tier.isFirstVisit
    ? 0
    : Math.max(0, tier.points - (currentPoints ?? 0));

  return (
    <li
      className={
        "flex items-center gap-3 rounded-xl border px-3 py-2.5 " +
        (reached
          ? "border-[#F28C38]/40 bg-[#FFF3E8]"
          : "border-[#1C2526]/8 bg-white")
      }
    >
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt={tier.name}
          width={48}
          height={48}
          unoptimized
          className={
            "h-12 w-12 shrink-0 rounded-lg object-cover " +
            (reached ? "" : "opacity-60 grayscale")
          }
        />
      ) : (
        <div
          className={
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#F28C38]/10 text-xl " +
            (reached ? "" : "opacity-70")
          }
          aria-hidden
        >
          {tier.isFirstVisit ? "🎁" : "🍽"}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p
          className={
            "truncate text-sm font-semibold " +
            (reached ? "text-[#1C2526]" : "text-[#1C2526]/70")
          }
        >
          {tier.name}
        </p>
        <p className="text-xs text-[#1C2526]/55">
          {tier.isFirstVisit
            ? reached
              ? "Ya es tuyo. Pídelo en tu siguiente visita"
              : "Gratis con tu primera compra, para tu siguiente visita"
            : reached
              ? "Pídelo al pagar en el local"
              : ghost
                ? "Junta puntos con cada compra"
                : `Te faltan ${missing} ⭐`}
        </p>
      </div>
      <span
        className={
          "shrink-0 rounded-full px-2.5 py-1 text-xs font-bold " +
          (reached
            ? "bg-[#F28C38] text-[#1C2526]"
            : "bg-[#1C2526]/6 text-[#1C2526]/60")
        }
      >
        {tier.isFirstVisit
          ? reached
            ? "✅ Tuyo"
            : "🎁 1ª visita"
          : reached
            ? "✅ Canjeable"
            : `🔒 ${tier.points} ⭐`}
      </span>
    </li>
  );
}

export function RewardLadder({
  restaurantData,
  menuItems,
  currentPoints = null,
  welcomeUnlocked = false,
  showEarnRule = true,
}: {
  restaurantData: Record<string, unknown>;
  /** Menú del restaurante (para pintar la foto real del platillo-premio). */
  menuItems?: LadderMenuItem[];
  /** Saldo verificado del cliente; null = modo fantasma (anónimo). */
  currentPoints?: number | null;
  welcomeUnlocked?: boolean;
  showEarnRule?: boolean;
}) {
  const welcome = parseFirstVisitReward(restaurantData.firstPurchaseReward);
  const tiers = parseRewardTiers(restaurantData.rewardTiers);
  if (!welcome && tiers.length === 0) return null;

  const rule = earnRuleLine(earnPolicyFromRestaurant(restaurantData));

  return (
    <div>
      {showEarnRule ? (
        <p className="mb-3 text-xs font-semibold text-[#1C2526]/65">
          ⭐ Así se gana: {rule}. Los cambias por platillos gratis.
        </p>
      ) : null}
      <ul className="space-y-2">
        {welcome ? (
          <TierRow
            tier={welcome}
            imageUrl={photoFor(welcome, menuItems)}
            currentPoints={currentPoints}
            welcomeUnlocked={welcomeUnlocked}
          />
        ) : null}
        {tiers.map((t) => (
          <TierRow
            key={t.id}
            tier={t}
            imageUrl={photoFor(t, menuItems)}
            currentPoints={currentPoints}
            welcomeUnlocked={welcomeUnlocked}
          />
        ))}
      </ul>
    </div>
  );
}
