"use client";

/**
 * El toque de los lazos de patrones (7-oct-2026) dentro de "Tu siguiente
 * movimiento": la IA ya hizo el trabajo, el dueño lo aprueba con UN toque.
 *
 *   promo_weak_night → lee el mensaje y lo manda por WhatsApp (él elige a
 *                      quién: su lista, su estado). Nada se manda solo.
 *   publish_combo    → nombre y precio ya puestos (los puede cambiar) y
 *                      "Publicar combo" lo agrega a su menú.
 *   hide_stale_dish  → "Esconderlo del menú" (isAvailable:false; se prende
 *                      otra vez en Menú).
 *
 * Cada toque deja ownerActions nba_tap con su actionCode; la noche floja
 * lleva `target` = la noche (YYYY-MM-DD) para que el cerebro mida lo que
 * vendió. ESPEJO: FOODPASS lib/bottom_nav_pages/restarantowner/dashboard/
 * widgets/pattern_loop_action.dart.
 */

import { useState } from "react";
import Link from "next/link";
import { addDoc, collection, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import { buildWhatsappShareUrl } from "@/lib/order/formatWhatsappMessage";
import { logOwnerAction } from "@/lib/ownerActions";
import {
  LOOP_COPY,
  comboMenuDoc,
  parsePrice,
  promoResultLine,
  type PatternLoopCode,
  type PatternLoopsInsight,
} from "@/lib/vendor/patternLoops";

const INK = "#1C2526";
const INK_MUTED = "#3F4A4D";
const BORDER = "#D9D2C5";
const TILE = "#F0EBE1";
const LINK = "#8A4B12";
const BRAND = "#F28C38";
const BUTTON = "mt-3 flex h-12 w-full items-center justify-center rounded-xl text-[15px] font-semibold transition hover:opacity-90 disabled:opacity-60";

export function PatternLoopAction({
  restaurantId,
  code,
  loops,
}: {
  restaurantId: string;
  code: PatternLoopCode;
  loops: PatternLoopsInsight;
}) {
  if (code === "promo_weak_night" && loops.weakNight) return <PromoAction restaurantId={restaurantId} loops={loops} />;
  if (code === "publish_combo" && loops.combo) return <ComboAction restaurantId={restaurantId} loops={loops} />;
  if (code === "hide_stale_dish" && loops.staleDish) return <StaleAction restaurantId={restaurantId} loops={loops} />;
  return null;
}

function Done({ text, menuLink = false }: { text: string; menuLink?: boolean }) {
  return (
    <div className="mt-3">
      <p className="text-[15px] leading-[22px]" style={{ color: INK }} role="status">{text}</p>
      {menuLink && (
        <Link href="/vendor/menu" className="mt-1 inline-block text-[14px] font-semibold hover:underline" style={{ color: LINK }}>
          {LOOP_COPY.seeMenu} ›
        </Link>
      )}
    </div>
  );
}

function PromoAction({ restaurantId, loops }: { restaurantId: string; loops: PatternLoopsInsight }) {
  const w = loops.weakNight!;
  const [sent, setSent] = useState(w.alreadySent);
  const result = promoResultLine(loops.promoResults);
  function send() {
    logOwnerAction(restaurantId, "nba_tap", { actionCode: "promo_weak_night", target: w.targetDayKey });
    setSent(true);
    window.open(buildWhatsappShareUrl(w.message), "_blank");
  }
  return (
    <>
      <div className="mt-3 rounded-xl px-3.5 py-3" style={{ background: TILE }}>
        <p className="text-[13px] leading-4" style={{ color: INK_MUTED }}>{LOOP_COPY.promoPreviewLabel}</p>
        <p className="mt-1 whitespace-pre-line text-[15px] leading-[22px]" style={{ color: INK }}>{w.message}</p>
      </div>
      {result && <p className="mt-2 text-[13px] leading-4" style={{ color: INK_MUTED }}>{result}</p>}
      <button type="button" onClick={send} className={BUTTON} style={{ background: BRAND, color: INK }}>
        {LOOP_COPY.promoButton}
      </button>
      {sent && <Done text={LOOP_COPY.promoSentLine} />}
    </>
  );
}

function ComboAction({ restaurantId, loops }: { restaurantId: string; loops: PatternLoopsInsight }) {
  const c = loops.combo!;
  const [name, setName] = useState(c.name);
  const [price, setPrice] = useState(String(c.price));
  const [state, setState] = useState<"idle" | "saving" | "done" | "error">("idle");
  const priceN = parsePrice(price);
  async function publish() {
    if (priceN == null || state === "saving") return;
    setState("saving");
    try {
      const base = comboMenuDoc(c, name, priceN);
      await addDoc(collection(getFirebaseDb(), "restaurants", restaurantId, "menu"), {
        ...base,
        comboFromBrain: { ...base.comboFromBrain, createdAt: serverTimestamp() },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      logOwnerAction(restaurantId, "nba_tap", { actionCode: "publish_combo" });
      setState("done");
    } catch {
      setState("error");
    }
  }
  if (state === "done") return <Done text={LOOP_COPY.comboDoneLine} menuLink />;
  const input = "mt-1 h-11 w-full rounded-xl bg-white px-3 text-[15px] outline-none focus:ring-2 focus:ring-[#F28C38]";
  return (
    <>
      <div className="mt-3 grid grid-cols-[1fr_7rem] gap-2">
        <label className="block text-[13px]" style={{ color: INK_MUTED }}>
          {LOOP_COPY.comboNameLabel}
          <input value={name} onChange={(e) => setName(e.target.value)} className={input} style={{ border: `1px solid ${BORDER}`, color: INK }} />
        </label>
        <label className="block text-[13px]" style={{ color: INK_MUTED }}>
          {LOOP_COPY.comboPriceLabel}
          <input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} className={`${input} tabular-nums`} style={{ border: `1px solid ${BORDER}`, color: INK }} />
        </label>
      </div>
      <button type="button" onClick={publish} disabled={priceN == null || state === "saving"} className={BUTTON} style={{ background: BRAND, color: INK }}>
        {state === "saving" ? "Publicando…" : LOOP_COPY.comboButton}
      </button>
      {state === "error" && <p className="mt-2 text-[13px]" style={{ color: INK_MUTED }} role="alert">{LOOP_COPY.errorLine}</p>}
    </>
  );
}

function StaleAction({ restaurantId, loops }: { restaurantId: string; loops: PatternLoopsInsight }) {
  const d = loops.staleDish!;
  const [state, setState] = useState<"idle" | "saving" | "done" | "error">("idle");
  async function hide() {
    if (state === "saving") return;
    setState("saving");
    try {
      await updateDoc(doc(getFirebaseDb(), "restaurants", restaurantId, "menu", d.id), {
        isAvailable: false,
        updatedAt: serverTimestamp(),
      });
      logOwnerAction(restaurantId, "nba_tap", { actionCode: "hide_stale_dish" });
      setState("done");
    } catch {
      setState("error");
    }
  }
  if (state === "done") return <Done text={LOOP_COPY.staleDoneLine} menuLink />;
  return (
    <>
      <button type="button" onClick={hide} disabled={state === "saving"} className={BUTTON} style={{ background: BRAND, color: INK }}>
        {state === "saving" ? "Guardando…" : LOOP_COPY.staleButton}
      </button>
      {state === "error" && <p className="mt-2 text-[13px]" style={{ color: INK_MUTED }} role="alert">{LOOP_COPY.errorLine}</p>}
    </>
  );
}
