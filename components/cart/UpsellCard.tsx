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
// HONESTO (9-oct-2026, FOODPASS docs/UPSELL_9_OCT.md reglas 1, 5, 6, 7, 9 y 14): la frase de Gemini ya no se pinta;
// lib/order/upsellPresentation.ts dice solo hechos ("La gente lo pide junto" solo con evidencia del local), con
// "+$X" (precio completo de lo que entra) y el total nuevo antes del toque. No se sugiere lo que está fuera de su
// horario o pide opciones obligatorias. Mostrada / agregada / "no, gracias" se miden (trackUpsellEvent), igual que
// la app (lib/pages/orders/upsell_suggestion_card.dart).
//
// Defensive: on any error or when there's no suggestion, it renders nothing —
// it can never break the checkout flow.

import { useEffect, useRef, useState } from "react";
import { DEFAULT_FLOW, type FlowTheme } from "@/components/menu/skins/flowTheme";
import { useCart } from "@/lib/cart/CartProvider";
import {
  isUpsellDismissed,
  rememberUpsellDismissal,
} from "@/lib/cart/upsellDismissals";
import {
  fetchUpsellSuggestion,
  type UpsellSuggestion as Suggestion,
} from "@/lib/upsellSuggestionCache";
import { doc, getDoc } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import { trackUpsellEvent } from "@/lib/analytics/orderEvents";
import { formatPrice } from "@/lib/priceFormat";
import {
  UPSELL_COPY,
  upsellAddLabel,
  upsellItemSuggestible,
  upsellNewTotalLabel,
  upsellPresentation,
} from "@/lib/order/upsellPresentation";

/** ¿Se puede sugerir ahora? Lee el platillo; ante cualquier duda, no. */
async function suggestibleNow(
  restaurantId: string,
  menuItemId: string,
  restaurantData: Record<string, unknown> | null | undefined,
): Promise<boolean> {
  try {
    const snap = await getDoc(doc(getFirebaseDb(), "restaurants", restaurantId, "menu", menuItemId));
    const data = snap.data();
    if (!data) return false;
    return upsellItemSuggestible(data, restaurantData);
  } catch {
    return false;
  }
}

/** Goal-gradient context: the verified customer's balance + next goal, so the
 * bonus line can say "con esto te faltarían solo N pts para tu X GRATIS" —
 * the closer the goal feels, the harder people accelerate toward it. */
export type UpsellGoalContext = {
  balance: number;
  nextTierName: string;
  nextTierPoints: number;
  /** Earn policy (base + floor(total/step)) to estimate this order's points. */
  earnBase: number;
  earnStep: number;
  cartTotal: number;
  /** Every tier already unlocked (after any selected redemption): there is no
   * gap to count down — celebrate and push the canje instead. */
  maxed?: boolean;
  topTierName?: string;
};

export function UpsellCard({
  theme: th = DEFAULT_FLOW,
  restaurantId,
  goal = null,
  cartTotal = null,
  restaurantData = null,
}: {
  /** Ropa del flujo (piel del local); sin piel, el naranja de siempre. */
  theme?: FlowTheme;
  restaurantId: string;
  goal?: UpsellGoalContext | null;
  /** El total que se cobra hoy (con envío): "Tu total queda en $Y". null = no se promete total. */
  cartTotal?: number | null;
  /** Doc del local (ventanas por categoría) para no sugerir fuera de horario. */
  restaurantData?: Record<string, unknown> | null;
}) {
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
      // Cache precalentado desde el menú (mientras el cliente escogía) —
      // en el caso común esto resuelve al instante, sin brinco de layout.
      const s = await fetchUpsellSuggestion(restaurantId, ids);
      // dismissedSuggestionIds (robo #4 a Biomenus): un "no, gracias" se
      // respeta 14 días — la sugerencia rechazada no vuelve a aparecer.
      let next = s && isUpsellDismissed(restaurantId, s.menuItemId) ? null : s;
      // Sin un hecho que decir, nada (regla 7); fuera de horario u opciones obligatorias, nada (regla 9).
      if (next && !upsellPresentation(next as unknown as Record<string, unknown>, 0)) next = null;
      if (next && !(await suggestibleNow(restaurantId, next.menuItemId, restaurantData))) next = null;
      if (!cancelled) {
        setSuggestion(next);
        if (next) {
          trackUpsellEvent({ action: "shown", surface: "cart", restaurantId, menuItemId: next.menuItemId, upsellType: next.type });
        }
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [sig, restaurantId, lines, added, restaurantData]);

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
    // Goal-gradient in the celebration (verified customers): the cart already
    // includes the added item, so goal.cartTotal is the NEW total. The bar
    // fills to the REAL progress toward the next reward — endowed progress
    // beats theater.
    let goalGap: number | null = null;
    let goalPct: number | null = null;
    let goalLine: string | null = null;
    if (goal?.maxed) {
      goalGap = 0;
      goalPct = 100;
      goalLine = goal.topTierName
        ? `🏆 Tu ${goal.topTierName} va gratis: cámbialo arriba en este pedido`
        : "🏆 Ya tienes premios listos: cambia uno arriba en este pedido";
    } else if (goal && goal.nextTierPoints > 0) {
      const estimateEarn = (total: number) =>
        goal.earnBase + Math.floor(total / Math.max(1, goal.earnStep));
      const prospective = goal.balance + estimateEarn(goal.cartTotal) + added.bonus;
      goalGap = goal.nextTierPoints - prospective;
      goalPct = Math.max(
        8,
        Math.min(100, Math.round((prospective / goal.nextTierPoints) * 100)),
      );
      goalLine =
        goalGap <= 0
          ? `🎉 ¡Con este pedido DESBLOQUEAS tu ${goal.nextTierName} GRATIS!`
          : `🎯 Quedarás a solo ${goalGap} pts de tu ${goal.nextTierName} GRATIS`;
    }
    return (
      <div className={th.upsellBoxStrong}>
        <p className={`text-sm font-bold ${th.accentDeep}`}>{headline}</p>
        <p className="text-xs text-black/70">
          {added.bonus > 0
            ? "Se suman a tus puntos cuando el restaurante confirme tu pago."
            : "Buen ojo. 😋"}
        </p>
        {added.bonus > 0 && goalLine ? (
          <p
            className="mt-1 text-xs font-bold"
            style={(goalGap ?? 1) <= 0 ? { color: "#16A34A" } : th.accentDeepStyle}
          >
            {goalLine}
          </p>
        ) : null}
        {added.bonus > 0 ? (
          <div className="mt-2 h-3 overflow-hidden rounded-full bg-black/10">
            <div
              className={th.progressBar}
              style={{ width: barFilled ? `${goalPct ?? 100}%` : "35%" }}
            />
          </div>
        ) : null}
      </div>
    );
  }

  if (!suggestion) return null;
  const view = upsellPresentation(suggestion as unknown as Record<string, unknown>, cartTotal ?? 0);
  if (!view) return null;
  const delta = view.priceDelta;
  const bonus = Math.max(0, Math.floor(suggestion.bonusPoints ?? 0));
  const surprise = suggestion.surprise === true;

  return (
    <div className={`relative ${th.upsellBox}`}>
      {/* "No, gracias" — el rechazo SE RECUERDA (14 días). Una máquina que
          insiste con lo que ya le dijiste que no, deja de ser un mesero
          atento y se vuelve un vendedor necio. */}
      <button
        type="button"
        aria-label="No, gracias. No me lo vuelvas a sugerir"
        onClick={() => {
          trackUpsellEvent({ action: "dismissed", surface: "cart", restaurantId, menuItemId: suggestion.menuItemId, upsellType: suggestion.type });
          rememberUpsellDismissal(restaurantId, suggestion.menuItemId);
          setSuggestion(null);
        }}
        className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full text-[13px] text-black/35 transition-colors hover:bg-black/5 hover:text-black/60"
      >
        ✕
      </button>
      <div className="flex items-center gap-3 pr-5">
        <div className="flex-1">
          <p className="text-sm font-bold">{UPSELL_COPY[view.copy]}</p>
          <p className="text-sm">{view.name}</p>
          {cartTotal != null ? (
            <p className="text-xs tabular-nums text-black/70">{upsellNewTotalLabel(formatPrice(view.newTotal))}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => {
            trackUpsellEvent({ action: "added", surface: "cart", restaurantId, menuItemId: suggestion.menuItemId, upsellType: suggestion.type });
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
          className={`shrink-0 ${th.btnSmall}`}
        >
          {upsellAddLabel(formatPrice(delta))}
        </button>
      </div>
      {bonus > 0 ? (
        surprise ? (
          <span className={`mt-2 inline-block ${th.chipHot}`}>
            🎰 ¡DOBLE PUNTOS! +{bonus} puntos si lo agregas
          </span>
        ) : (
          <span className={`mt-2 inline-block ${th.chip}`}>
            +{bonus} puntos para tu recompensa ⭐
          </span>
        )
      ) : null}
      {(() => {
        // Goal-gradient line (verified customers only): estimate the balance
        // AFTER this order WITH the upsell, against their next reward.
        if (!goal) return null;
        if (goal.maxed) {
          return (
            <p className="mt-2 text-xs font-bold" style={{ color: "#16A34A" }}>
              {goal.topTierName
                ? `🏆 Tu ${goal.topTierName} va gratis: cámbialo arriba`
                : "🏆 Ya tienes premios listos: cambia uno arriba"}
            </p>
          );
        }
        if (goal.nextTierPoints <= 0) return null;
        const estimateEarn = (total: number) =>
          goal.earnBase + Math.floor(total / Math.max(1, goal.earnStep));
        const prospective =
          goal.balance + estimateEarn(goal.cartTotal + delta) + bonus;
        const gap = goal.nextTierPoints - prospective;
        return (
          <p className="mt-2 text-xs font-bold" style={gap <= 0 ? { color: "#16A34A" } : th.accentDeepStyle}>
            {gap <= 0
              ? `🎉 ¡Con esto DESBLOQUEAS tu ${goal.nextTierName} GRATIS!`
              : `🎯 Con esto te faltarían solo ${gap} pts para tu ${goal.nextTierName} GRATIS`}
          </p>
        );
      })()}
    </div>
  );
}
