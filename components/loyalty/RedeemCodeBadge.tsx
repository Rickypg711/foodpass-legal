"use client";

// RedeemCodeBadge — the customer's rotating código de canje for one
// restaurant. Rendered ONLY inside SMS-verified views (the puntos pages), so
// seeing a code proves the viewer controls the phone number. The cashier
// types this code in the Caja to apply the reward (lib/loyalty/redeemCode.ts).

import { useEffect, useState } from "react";
import {
  currentRedemptionCode,
  secondsUntilRotation,
} from "@/lib/loyalty/redeemCode";

export function RedeemCodeBadge({
  phoneDigits,
  restaurantId,
}: {
  phoneDigits: string;
  restaurantId: string;
}) {
  const [code, setCode] = useState<string>("····");
  const [secs, setSecs] = useState<number>(secondsUntilRotation());

  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      const c = await currentRedemptionCode(phoneDigits, restaurantId);
      if (!cancelled) setCode(c);
    }
    void refresh();
    const t = setInterval(() => {
      setSecs(secondsUntilRotation());
      void refresh();
    }, 5000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [phoneDigits, restaurantId]);

  const mm = Math.floor(secs / 60);
  const ss = String(secs % 60).padStart(2, "0");

  return (
    <div
      className="mt-2 flex items-center justify-between rounded-xl px-3 py-2"
      style={{ background: "rgba(22,163,74,0.08)", border: "1px dashed rgba(22,163,74,0.4)" }}
    >
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#16A34A" }}>
          🔐 Código de canje
        </p>
        <p className="text-[10px]" style={{ color: "rgba(28,37,38,0.45)" }}>
          Díselo al cobrar para usar tu premio · cambia en {mm}:{ss}
        </p>
      </div>
      <span
        className="text-[22px] font-extrabold tracking-[0.2em]"
        style={{ color: "#16A34A" }}
      >
        {code}
      </span>
    </div>
  );
}
