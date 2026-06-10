"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import { waitForAuthReady } from "@/lib/auth";

interface RewardTier {
  pointsRequired: number;
  menuItemName: string;
  menuItemDescription?: string;
  hasMenuItem?: boolean;
}

interface FirstPurchaseReward {
  enabled: boolean;
  menuItemName: string;
  menuItemDescription?: string;
  pointsAwarded: number;
}

interface RewardsData {
  rewardTiers: RewardTier[];
  firstPurchaseReward: FirstPurchaseReward | null;
}

function Spinner() {
  return (
    <svg className="h-5 w-5 animate-spin" style={{ color: "#d97757" }} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 12 5.373 12 12H4z" />
    </svg>
  );
}

export default function RecompensasPage() {
  const router = useRouter();
  const [data, setData] = useState<RewardsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      const u = await waitForAuthReady();
      if (!u || u.isAnonymous) { router.push("/activar"); return; }

      const db = getFirebaseDb();
      const userSnap = await getDoc(doc(db, "users", u.uid));
      const rid = userSnap.data()?.ownedRestaurantId as string | undefined;
      if (!rid) { router.push("/activar"); return; }
      setRestaurantId(rid);

      const restSnap = await getDoc(doc(db, "restaurants", rid));
      const d = restSnap.data() ?? {};

      const rawTiers = (d.rewardTiers as RewardTier[] | undefined) ?? [];
      const rawFpr = d.firstPurchaseReward as FirstPurchaseReward | undefined | null;

      setData({
        rewardTiers: rawTiers,
        firstPurchaseReward: rawFpr ?? null,
      });
      setLoading(false);
    }
    init().catch(() => setLoading(false));
  }, [router]);

  const hasFpr = data?.firstPurchaseReward?.enabled && data.firstPurchaseReward.menuItemName;
  const hasTiers = (data?.rewardTiers ?? []).length > 0;
  const hasAnyReward = hasFpr || hasTiers;

  return (
    <>
      <main className="px-4 pb-16 pt-5 md:px-8 md:pt-7">

        {/* Page title */}
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h1 className="text-[22px] font-extrabold tracking-tight" style={{ color: "#1C2526" }}>Recompensas</h1>
            <p className="mt-0.5 text-[13px]" style={{ color: "rgba(28,37,38,0.45)" }}>
              Programa de lealtad de tu restaurante
            </p>
          </div>
          {!loading && restaurantId && (
            <Link
              href={`/vendor/setup/recompensas?from=recompensas`}
              className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-[13px] font-bold"
              style={{ background: "#1C2526", color: "#ffffff" }}>
              ✏️ Editar
            </Link>
          )}
        </div>
        {loading ? (
          <div className="flex justify-center py-20">
            <Spinner />
          </div>
        ) : !hasAnyReward ? (
          /* Empty state */
          <div className="flex flex-col items-center py-20 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl text-[28px]"
              style={{ background: "rgba(217,119,87,0.08)" }}>🎁</div>
            <p className="mt-5 text-[18px] font-bold" style={{ color: "#1C2526" }}>
              Sin recompensas todavía
            </p>
            <p className="mt-2 max-w-xs text-[14px] leading-relaxed" style={{ color: "rgba(28,37,38,0.45)" }}>
              Configura las recompensas de tu programa de lealtad. Tus clientes las verán cuando ganen puntos.
            </p>
            <Link
              href="/vendor/setup/recompensas"
              className="mt-6 inline-flex items-center gap-2 rounded-xl px-6 py-3 text-[14px] font-bold text-white"
              style={{ background: "#d97757" }}>
              Configurar recompensas →
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {/* First purchase reward */}
            {hasFpr && data?.firstPurchaseReward && (
              <div className="rounded-2xl p-5"
                style={{ background: "#ffffff", border: "1px solid rgba(217,119,87,0.18)", boxShadow: "0 1px 4px rgba(28,37,38,0.05)" }}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl text-[18px]"
                    style={{ background: "rgba(217,119,87,0.08)" }}>⭐</div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest"
                      style={{ color: "rgba(217,119,87,0.75)" }}>Primera visita</p>
                    <p className="text-[15px] font-bold" style={{ color: "#1C2526" }}>Recompensa de bienvenida</p>
                  </div>
                </div>
                <div className="rounded-xl p-4 space-y-1"
                  style={{ background: "rgba(217,119,87,0.05)", border: "1px solid rgba(217,119,87,0.12)" }}>
                  <p className="text-[14px] font-semibold" style={{ color: "#1C2526" }}>
                    {data.firstPurchaseReward.menuItemName}
                  </p>
                  {data.firstPurchaseReward.menuItemDescription && (
                    <p className="text-[12px] leading-relaxed" style={{ color: "rgba(28,37,38,0.5)" }}>
                      {data.firstPurchaseReward.menuItemDescription}
                    </p>
                  )}
                  <p className="pt-1 text-[11px] font-bold" style={{ color: "#d97757" }}>
                    Se desbloquea en la 1ª visita y se regala en la 2ª
                  </p>
                </div>
              </div>
            )}

            {/* Reward tiers */}
            {hasTiers && (
              <div className="rounded-2xl overflow-hidden"
                style={{ background: "#ffffff", border: "1px solid rgba(28,37,38,0.07)", boxShadow: "0 1px 4px rgba(28,37,38,0.05)" }}>
                <div className="px-5 pt-5 pb-3 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl text-[18px]"
                    style={{ background: "rgba(28,37,38,0.05)" }}>🏆</div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest"
                      style={{ color: "rgba(28,37,38,0.35)" }}>Programa de puntos</p>
                    <p className="text-[15px] font-bold" style={{ color: "#1C2526" }}>Niveles de recompensa</p>
                  </div>
                </div>

                <div className="px-5 pb-5 space-y-3">
                  {data!.rewardTiers.map((tier, i) => (
                    <div key={i} className="rounded-xl p-4 flex items-center gap-4"
                      style={{ background: "#F5F3EF", border: "1px solid rgba(28,37,38,0.06)" }}>
                      {/* Points badge */}
                      <div className="shrink-0 flex flex-col items-center justify-center rounded-xl px-3 py-2.5 min-w-[62px]"
                        style={{ background: "#1C2526" }}>
                        <p className="font-mono text-[17px] font-bold text-white leading-none">
                          {tier.pointsRequired >= 1000
                            ? `${(tier.pointsRequired / 1000).toFixed(tier.pointsRequired % 1000 === 0 ? 0 : 1)}k`
                            : tier.pointsRequired}
                        </p>
                        <p className="text-[9px] font-semibold uppercase tracking-wide leading-none mt-1"
                          style={{ color: "rgba(255,255,255,0.55)" }}>pts</p>
                      </div>
                      {/* Name + description */}
                      <div className="min-w-0 flex-1">
                        <p className="text-[14px] font-semibold truncate" style={{ color: "#1C2526" }}>
                          {tier.menuItemName || <span style={{ color: "rgba(28,37,38,0.3)" }}>Sin nombre</span>}
                        </p>
                        {tier.menuItemDescription && (
                          <p className="mt-0.5 text-[12px] leading-snug line-clamp-2"
                            style={{ color: "rgba(28,37,38,0.45)" }}>
                            {tier.menuItemDescription}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* How it works callout */}
            <div className="rounded-2xl p-5"
              style={{ background: "#ffffff", border: "1px solid rgba(28,37,38,0.06)" }}>
              <p className="text-[12px] font-bold uppercase tracking-widest mb-3"
                style={{ color: "rgba(28,37,38,0.35)" }}>¿Cómo funciona?</p>
              <div className="space-y-2.5">
                {[
                  { emoji: "📷", text: "El cliente escanea su código en cada visita" },
                  { emoji: "🪙", text: "Acumula puntos automáticamente" },
                  { emoji: "🎁", text: "Canjea recompensas al alcanzar su nivel" },
                ].map((step) => (
                  <div key={step.text} className="flex items-start gap-3">
                    <span className="text-[15px] shrink-0">{step.emoji}</span>
                    <p className="text-[13px] leading-snug" style={{ color: "rgba(28,37,38,0.6)" }}>
                      {step.text}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Edit CTA */}
            <Link
              href="/vendor/setup/recompensas"
              className="flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-[14px] font-bold"
              style={{ background: "#1C2526", color: "#ffffff" }}>
              ✏️ Editar recompensas
            </Link>
          </div>
        )}
      </main>
    </>
  );
}
