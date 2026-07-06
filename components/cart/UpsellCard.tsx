"use client";

// Customer-facing upsell card for the WEB checkout (comeleal.com/menu).
// Calls the `getUpsellSuggestion` Cloud Function with the current cart and shows
// a 1-tap "add this" card with an AI-written pitch (size-up / drink / learned
// co-purchase). Same brain as the Flutter app card.
//
// POINTS-POWERED UPSELL (locked mechanic — docs/UPSELL_ENGINE_PLAN.md):
// adding EARNS bonus loyalty points (full price, never a discount, never spends
// points). The server decides the bonus + the occasional 🎰 doble puntos roll;
// points credit at loyalty award time (order scan), carried on the order item.
//
// Defensive: on any error or when there's no suggestion, it renders nothing —
// it can never break the checkout flow.

import { useEffect, useRef, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { getFirebaseFunctions } from "@/lib/firebase";
import { useCart } from "@/lib/cart/CartProvider";

type Suggestion = {
  menuItemId: string;
  name: string;
  price: number;
  priceDelta: number;
  category: string;
  type: string;
  pitchTitle: string;
  pitchBody: string;
  bonusPoints?: number;
  surprise?: boolean;
  accelerated?: boolean;
};

export function UpsellCard({ restaurantId }: { restaurantId: string }) {
  const { lines, addItem } = useCart();
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [added, setAdded] = useState<{ bonus: number; surprise: boolean } | null>(
    null,
  );
  const [barFilled, setBarFilled] = useState(false);
  const lastSig = useRef<string>("");

  const sig = lines
    .map((l) => l.menuItemId)
    .sort()
    .join(",");

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (added) return; // keep the celebration on screen after the add
      if (sig === lastSig.current) return; // cart unchanged → keep suggestion
      lastSig.current = sig;
      const ids = lines.map((l) => l.menuItemId);
      if (!restaurantId || ids.length === 0) {
        setSuggestion(null);
        return;
      }
      try {
        const fn = httpsCallable(getFirebaseFunctions(), "getUpsellSuggestion");
        const res = await fn({ restaurantId, cartItemIds: ids });
        const data = res.data as { suggestion?: Suggestion | null };
        if (!cancelled) setSuggestion(data?.suggestion ?? null);
      } catch {
        if (!cancelled) setSuggestion(null); // never break checkout
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [sig, restaurantId, lines, added]);

  // Animate the boost bar right after the add (visible progress at the moment
  // of the yes — hook #1 of the locked mechanic).
  useEffect(() => {
    if (!added) return;
    const t = setTimeout(() => setBarFilled(true), 60);
    return () => clearTimeout(t);
  }, [added]);

  if (added) {
    const headline = added.surprise
      ? `🎰 ¡DOBLE PUNTOS! +${added.bonus} puntos ⭐`
      : `🎉 ¡Agregado! +${added.bonus} puntos ⭐`;
    return (
      <div className="mb-4 rounded-xl border border-[#F28C38] bg-[#FFF3E8] p-4">
        <p className="text-sm font-bold text-[#B05E14]">{headline}</p>
        <p className="text-xs text-black/70">
          {added.bonus > 0
            ? "Se suman a tu recompensa al recoger tu orden."
            : "Buen ojo. 😋"}
        </p>
        {added.bonus > 0 ? (
          <div className="mt-2 h-3 overflow-hidden rounded-full bg-black/10">
            <div
              className="h-full rounded-full bg-[#F28C38] shadow-[0_0_8px_rgba(242,140,56,0.6)] transition-[width] duration-700 ease-out"
              style={{ width: barFilled ? "100%" : "35%" }}
            />
          </div>
        ) : null}
      </div>
    );
  }

  if (!suggestion) return null;

  const delta = Number.isFinite(suggestion.priceDelta)
    ? suggestion.priceDelta
    : suggestion.price;
  const bonus = Math.max(0, Math.floor(suggestion.bonusPoints ?? 0));
  const surprise = suggestion.surprise === true;

  return (
    <div className="mb-4 rounded-xl border border-[#F28C38]/40 bg-[#FFF3E8] p-4">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <p className="text-sm font-bold">
            {suggestion.pitchTitle || "¿Le agregas algo?"}
          </p>
          <p className="text-xs text-black/70">
            {suggestion.pitchBody || suggestion.name}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            addItem({
              menuItemId: suggestion.menuItemId,
              name: suggestion.name,
              price: suggestion.price,
              imageUrl: null,
              isUpsell: true,
              upsellBonusPoints: bonus,
              upsellSurprise: surprise,
            });
            setAdded({ bonus, surprise });
          }}
          className="shrink-0 rounded-lg bg-[#F28C38] px-4 py-2 text-sm font-semibold text-white"
        >
          + ${Math.round(delta)}
        </button>
      </div>
      {bonus > 0 ? (
        surprise ? (
          <span className="mt-2 inline-block rounded-full bg-gradient-to-r from-[#F28C38] to-[#E85D75] px-3 py-1 text-xs font-bold text-white">
            🎰 ¡DOBLE PUNTOS! +{bonus} puntos si lo agregas
          </span>
        ) : (
          <span className="mt-2 inline-block rounded-full bg-[#F28C38]/15 px-3 py-1 text-xs font-semibold text-[#B05E14]">
            +{bonus} puntos para tu recompensa ⭐
          </span>
        )
      ) : null}
    </div>
  );
}
