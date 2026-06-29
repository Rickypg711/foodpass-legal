"use client";

// Customer-facing upsell card for the WEB checkout (comeleal.com/menu).
// Calls the `getUpsellSuggestion` Cloud Function with the current cart and shows
// a 1-tap "add this" card with an AI-written pitch (size-up / drink / learned
// co-purchase). Same brain as the Flutter app card.
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
};

export function UpsellCard({ restaurantId }: { restaurantId: string }) {
  const { lines, addItem } = useCart();
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const lastSig = useRef<string>("");

  const sig = lines
    .map((l) => l.menuItemId)
    .sort()
    .join(",");

  useEffect(() => {
    let cancelled = false;
    async function run() {
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
  }, [sig, restaurantId, lines]);

  if (!suggestion) return null;

  const delta = Number.isFinite(suggestion.priceDelta)
    ? suggestion.priceDelta
    : suggestion.price;

  return (
    <div className="mb-4 flex items-center gap-3 rounded-xl border border-[#F28C38]/40 bg-[#FFF3E8] p-4">
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
        onClick={() =>
          addItem({
            menuItemId: suggestion.menuItemId,
            name: suggestion.name,
            price: suggestion.price,
            imageUrl: null,
          })
        }
        className="shrink-0 rounded-lg bg-[#F28C38] px-4 py-2 text-sm font-semibold text-white"
      >
        + ${Math.round(delta)}
      </button>
    </div>
  );
}
