"use client";

// PosRedemption — in-store redemption inside the Caja/POS checkout dialog.
//
// The cashier types the customer's phone (already the loyalty habit) → this
// widget shows the balance and everything redeemable (welcome reward + unlocked
// tiers). Applying a reward asks for the customer's CÓDIGO DE CANJE — the
// rotating 4-digit code on their verified "Mis puntos" page — so an employee
// can't burn a customer's points without the customer present (see
// lib/loyalty/redeemCode.ts for the threat model). A no-code override exists
// for edge cases but is recorded on the order for the owner to audit.
//
// Deduction does NOT happen here: the order carries redemptionRequest and the
// transactional engine (creditPhonePointsForOrder) applies it at cobro with a
// live balance re-check — same path as web checkout redemptions.

import { useEffect, useRef, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import {
  redeemableRewards,
  type RewardTierOption,
} from "@/lib/loyalty/rewardCatalog";
import { validateRedemptionCode } from "@/lib/loyalty/redeemCode";

export type PosRedemptionSelection = {
  tierId: string;
  name: string;
  points: number;
  /** true = código de canje validated; false = cashier override (audited). */
  verified: boolean;
};

function last10(digits: string): string {
  const d = digits.replace(/\D/g, "");
  return d.length > 10 ? d.slice(-10) : d;
}

export function PosRedemption({
  restaurantId,
  phoneDigits,
  onSelect,
  onCustomerName,
}: {
  restaurantId: string;
  phoneDigits: string;
  onSelect: (sel: PosRedemptionSelection | null) => void;
  /** Name on file for this phone — autofill the ticket name. */
  onCustomerName?: (name: string) => void;
}) {
  const phone10 = last10(phoneDigits);
  const active = phone10.length === 10;

  const [loading, setLoading] = useState(false);
  const [points, setPoints] = useState(0);
  const [rewards, setRewards] = useState<RewardTierOption[]>([]);
  const [known, setKnown] = useState(false);
  const [picked, setPicked] = useState<RewardTierOption | null>(null);
  const [code, setCode] = useState("");
  const [codeState, setCodeState] = useState<"idle" | "checking" | "ok" | "bad">(
    "idle",
  );
  const loadedForRef = useRef<string>("");

  // Debounced lookup once 10 digits are in.
  useEffect(() => {
    if (!active) {
      loadedForRef.current = "";
      setRewards([]);
      setPicked(null);
      setKnown(false);
      onSelect(null);
      return;
    }
    if (loadedForRef.current === phone10) return;
    const t = setTimeout(() => {
      void (async () => {
        setLoading(true);
        try {
          const db = getFirebaseDb();
          const [pcSnap, rSnap] = await Promise.all([
            getDoc(doc(db, "restaurants", restaurantId, "phoneCustomers", phone10)),
            getDoc(doc(db, "restaurants", restaurantId)),
          ]);
          loadedForRef.current = phone10;
          // New number = new customer: drop any selection from the previous one.
          setPicked(null);
          setCode("");
          setCodeState("idle");
          onSelect(null);
          const pc = pcSnap.data() as Record<string, unknown> | undefined;
          const pts = Number(pc?.points) || 0;
          const name = typeof pc?.name === "string" ? pc.name.trim() : "";
          setKnown(pcSnap.exists());
          setPoints(pts);
          setRewards(
            redeemableRewards({
              restaurantData: rSnap.data() as Record<string, unknown> | undefined,
              points: pts,
              welcomeUnlocked: pc?.firstVisitRewardUnlocked === true,
            }),
          );
          if (name && onCustomerName) onCustomerName(name);
        } catch {
          // lookup is best-effort — earning still works without it
        } finally {
          setLoading(false);
        }
      })();
    }, 450);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phone10, active, restaurantId]);

  function pick(t: RewardTierOption) {
    if (picked?.id === t.id) {
      setPicked(null);
      setCode("");
      setCodeState("idle");
      onSelect(null);
      return;
    }
    setPicked(t);
    setCode("");
    setCodeState("idle");
    onSelect(null); // not applied until code (or override)
  }

  async function checkCode() {
    if (!picked || code.replace(/\D/g, "").length !== 4) return;
    setCodeState("checking");
    const ok = await validateRedemptionCode(code, phone10, restaurantId);
    if (ok) {
      setCodeState("ok");
      onSelect({
        tierId: picked.id,
        name: picked.name,
        points: picked.points,
        verified: true,
      });
    } else {
      setCodeState("bad");
    }
  }

  function applyWithoutCode() {
    if (!picked) return;
    const sure = window.confirm(
      "¿Aplicar el premio SIN código de verificación?\n\nQuedará registrado como canje no verificado — el dueño puede auditarlo en el pedido.",
    );
    if (!sure) return;
    setCodeState("ok");
    onSelect({
      tierId: picked.id,
      name: picked.name,
      points: picked.points,
      verified: false,
    });
  }

  if (!active) return null;

  return (
    <div
      className="rounded-2xl p-4"
      style={{ background: "rgba(22,163,74,0.06)", border: "1px solid rgba(22,163,74,0.2)" }}
    >
      {loading ? (
        <p className="text-[12px]" style={{ color: "rgba(28,37,38,0.5)" }}>
          Buscando puntos de este número…
        </p>
      ) : !known ? (
        <p className="text-[12px]" style={{ color: "rgba(28,37,38,0.5)" }}>
          ⭐ Número nuevo — esta venta le empieza a juntar puntos.
        </p>
      ) : rewards.length === 0 ? (
        <p className="text-[12px]" style={{ color: "rgba(28,37,38,0.55)" }}>
          ⭐ Este cliente tiene <b>{points} pts</b> — todavía sin premios canjeables.
        </p>
      ) : (
        <>
          <p className="text-[13px] font-bold" style={{ color: "#1C2526" }}>
            🎁 Premios disponibles ({points} pts)
          </p>
          <div className="mt-2 flex flex-col gap-1.5">
            {rewards.map((t) => {
              const isSel = picked?.id === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => pick(t)}
                  className="flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left transition-all"
                  style={
                    isSel
                      ? { background: "rgba(22,163,74,0.12)", border: "2px solid #16A34A" }
                      : { background: "#fff", border: "2px solid rgba(28,37,38,0.08)" }
                  }
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-bold" style={{ color: "#1C2526" }}>
                      {isSel ? "✓ " : ""}{t.name} — GRATIS
                    </span>
                    <span className="block text-[11px]" style={{ color: "rgba(28,37,38,0.5)" }}>
                      {t.isFirstVisit
                        ? "Premio de bienvenida (1a compra)"
                        : `Canje de ${t.points} pts — le quedan ${points - t.points}`}
                    </span>
                  </span>
                  <span aria-hidden>🎁</span>
                </button>
              );
            })}
          </div>

          {picked && codeState !== "ok" ? (
            <div className="mt-3">
              <p className="text-[11px] font-semibold" style={{ color: "rgba(28,37,38,0.6)" }}>
                🔐 Pídele su <b>código de canje</b> — lo ve en{" "}
                <span className="font-bold">comeleal.com/puntos</span> en su teléfono
              </p>
              <div className="mt-1.5 flex items-center gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value.replace(/\D/g, ""));
                    if (codeState === "bad") setCodeState("idle");
                  }}
                  placeholder="0000"
                  className="w-24 rounded-xl px-3 py-2 text-center text-[16px] font-extrabold tracking-[0.3em] outline-none"
                  style={{ background: "#fff", border: "1px solid rgba(28,37,38,0.15)", color: "#1C2526" }}
                />
                <button
                  type="button"
                  onClick={checkCode}
                  disabled={codeState === "checking" || code.length !== 4}
                  className="rounded-xl px-4 py-2 text-[12px] font-bold text-white disabled:opacity-40"
                  style={{ background: "#16A34A" }}
                >
                  {codeState === "checking" ? "…" : "Validar"}
                </button>
              </div>
              {codeState === "bad" ? (
                <p className="mt-1 text-[11px] font-semibold" style={{ color: "#dc2626" }}>
                  Código incorrecto — pídele que refresque su página de puntos.
                </p>
              ) : null}
              <button
                type="button"
                onClick={applyWithoutCode}
                className="mt-2 text-[11px] underline underline-offset-2"
                style={{ color: "rgba(28,37,38,0.45)" }}
              >
                Aplicar sin código (queda registrado)
              </button>
            </div>
          ) : picked && codeState === "ok" ? (
            <p className="mt-2.5 text-[12px] font-bold" style={{ color: "#16A34A" }}>
              ✓ {picked.name} se agrega GRATIS al ticket
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
