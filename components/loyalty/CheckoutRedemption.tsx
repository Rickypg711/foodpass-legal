"use client";

// Checkout redemption — "usa tus premios en este pedido" (STRATEGY §4).
// Shows redeemable tiers for the typed phone WHEN the session is verified for
// that number (rules gate the balance read behind the OTP token). Unverified
// sessions get a one-tap inline SMS verification. Selecting a reward attaches
// an UNPRIVILEGED redemptionRequest to the order; the deduction executes
// vendor-side at cobro with a live balance re-check — this component can't
// touch balances and neither can a tampered client.

import { useEffect, useRef, useState } from "react";
import {
  linkWithPhoneNumber,
  signInWithCredential,
  signInWithPhoneNumber,
  PhoneAuthProvider,
  RecaptchaVerifier,
  type ConfirmationResult,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { ensureAnonymousUser, getFirebaseAuth, waitForAuthReady } from "@/lib/auth";
import { getFirebaseDb } from "@/lib/firebase";
import type { OrderRedemptionRequest } from "@/lib/types/order";

type Tier = { id: string; name: string; points: number };

function parseTiers(raw: unknown): Tier[] {
  if (!Array.isArray(raw)) return [];
  const tiers: Tier[] = [];
  raw.forEach((t, i) => {
    if (!t || typeof t !== "object") return;
    const tier = t as Record<string, unknown>;
    if (tier.isFirstVisitReward === true) return;
    const points = Number(tier.visitsRequired);
    const name =
      (typeof tier.menuItemName === "string" && tier.menuItemName.trim()) ||
      (typeof tier.description === "string" && tier.description.trim()) ||
      "";
    if (!name || !Number.isFinite(points) || points <= 0) return;
    tiers.push({
      id: typeof tier.id === "string" ? tier.id : `tier_${i}`,
      name,
      points: Math.floor(points),
    });
  });
  return tiers.sort((a, b) => a.points - b.points);
}

function last10(digits: string): string {
  const d = digits.replace(/\D/g, "");
  return d.length > 10 ? d.slice(-10) : d;
}

export function CheckoutRedemption({
  restaurantId,
  phoneDigits,
  selected,
  onSelect,
  onLoyalty,
}: {
  restaurantId: string;
  /** Digits from the checkout phone field (>= 10 to activate). */
  phoneDigits: string;
  selected: OrderRedemptionRequest | null;
  onSelect: (r: OrderRedemptionRequest | null) => void;
  /** Reports the verified balance + full tier list (goal-gradient upsell)
   * + the name on file (checkout autofill for returning customers). */
  onLoyalty?: (info: { points: number; tiers: Tier[]; name?: string }) => void;
}) {
  const phone10 = last10(phoneDigits);
  const active = phone10.length === 10;

  const [state, setState] = useState<
    "idle" | "verified" | "otp_sending" | "otp_code" | "otp_verifying" | "none"
  >("idle");
  const [points, setPoints] = useState(0);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [code, setCode] = useState("");
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const confirmRef = useRef<ConfirmationResult | null>(null);
  const verifierRef = useRef<RecaptchaVerifier | null>(null);
  const recaptchaHostRef = useRef<HTMLDivElement | null>(null);
  const loadedForRef = useRef<string>("");

  // When the typed number matches an already-verified session → load balance
  // silently. Waits for auth restore (currentUser is null for ~1s on fresh
  // page loads — a sync check would miss verified sessions).
  useEffect(() => {
    if (!active) {
      setState("idle");
      onSelect(null);
      return;
    }
    if (loadedForRef.current === phone10) return;
    let cancelled = false;
    void (async () => {
      const u = await waitForAuthReady();
      if (cancelled) return;
      if (u?.phoneNumber && u.phoneNumber.endsWith(phone10)) {
        loadedForRef.current = phone10;
        await loadBalance();
      } else {
        setState("idle");
        onSelect(null);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phone10, active]);

  async function loadBalance() {
    try {
      const db = getFirebaseDb();
      const [pcSnap, rSnap] = await Promise.all([
        getDoc(doc(db, "restaurants", restaurantId, "phoneCustomers", phone10)),
        getDoc(doc(db, "restaurants", restaurantId)),
      ]);
      const pts = Number(pcSnap.data()?.points) || 0;
      const savedName = (pcSnap.data()?.name as string | undefined)?.trim();
      const allTiers = parseTiers(rSnap.data()?.rewardTiers);
      setPoints(pts);
      setTiers(allTiers.filter((t) => pts >= t.points));
      setState(
        pts > 0 && allTiers.some((t) => pts >= t.points) ? "verified" : "none",
      );
      onLoyalty?.({ points: pts, tiers: allTiers, name: savedName });
    } catch {
      setState("none");
    }
  }

  async function startOtp() {
    setErrMsg(null);
    setState("otp_sending");
    try {
      const auth = getFirebaseAuth();
      const user = await ensureAnonymousUser();
      // Session already verified for THIS number → no OTP needed at all.
      if (user.phoneNumber && user.phoneNumber.endsWith(phone10)) {
        loadedForRef.current = phone10;
        await loadBalance();
        return;
      }
      if (!verifierRef.current && recaptchaHostRef.current) {
        verifierRef.current = new RecaptchaVerifier(auth, recaptchaHostRef.current, {
          size: "invisible",
        });
      }
      if (!verifierRef.current) throw new Error("recaptcha_unavailable");
      // Session with a DIFFERENT phone already linked can't link a second
      // one (auth/provider-already-linked) → sign in fresh instead.
      confirmRef.current = user.phoneNumber
        ? await signInWithPhoneNumber(auth, `+52${phone10}`, verifierRef.current)
        : await linkWithPhoneNumber(user, `+52${phone10}`, verifierRef.current);
      setState("otp_code");
    } catch (e) {
      console.error("[CheckoutRedemption] startOtp", e);
      setErrMsg("No pudimos enviar el código. Intenta de nuevo.");
      setState("idle");
      verifierRef.current?.clear();
      verifierRef.current = null;
    }
  }

  async function confirmOtp() {
    const confirmation = confirmRef.current;
    if (!confirmation || code.trim().length < 6) return;
    setState("otp_verifying");
    setErrMsg(null);
    try {
      await confirmation.confirm(code.trim());
      loadedForRef.current = phone10;
      await loadBalance();
    } catch (e: unknown) {
      const codeStr =
        typeof e === "object" && e !== null && "code" in e
          ? String((e as { code?: unknown }).code)
          : "";
      if (
        codeStr === "auth/credential-already-in-use" ||
        codeStr === "auth/account-exists-with-different-credential"
      ) {
        try {
          const cred =
            PhoneAuthProvider.credentialFromError(e as Parameters<typeof PhoneAuthProvider.credentialFromError>[0]) ??
            PhoneAuthProvider.credential(confirmation.verificationId, code.trim());
          await signInWithCredential(getFirebaseAuth(), cred);
          loadedForRef.current = phone10;
          await loadBalance();
          return;
        } catch (e2) {
          console.error("[CheckoutRedemption] signInWithCredential", e2);
        }
      }
      setErrMsg("Código incorrecto o expirado. Intenta de nuevo.");
      setState("otp_code");
    }
  }

  if (!active) return null;

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <div ref={recaptchaHostRef} />
      {state === "verified" ? (
        <>
          <p className="text-sm font-semibold">
            🎁 Tienes {points} puntos aquí — ¿usar un premio en este pedido?
          </p>
          <div className="mt-2.5 flex flex-col gap-2">
            {tiers.map((t) => {
              const isSel = selected?.tierId === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() =>
                    onSelect(
                      isSel ? null : { tierId: t.id, name: t.name, points: t.points },
                    )
                  }
                  aria-pressed={isSel}
                  className={`flex items-center justify-between gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors ${
                    isSel
                      ? "border-[#16A34A] bg-[#F0FBF4] ring-2 ring-[#16A34A]/25"
                      : "border-[#1C2526]/12 bg-[#FAF7F2] hover:border-[#16A34A]/50"
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">
                      {isSel ? "✓ " : ""}{t.name} GRATIS
                    </span>
                    <span className="block text-xs text-[#1C2526]/55">
                      Canje de {t.points} puntos — te quedarían {points - t.points}
                    </span>
                  </span>
                  <span className="text-lg" aria-hidden>🎁</span>
                </button>
              );
            })}
          </div>
          {selected ? (
            <p className="mt-2 text-xs text-[#1C2526]/55">
              El restaurante confirma tu premio al cobrar — lo verás en tu
              pedido.
            </p>
          ) : null}
        </>
      ) : state === "otp_code" || state === "otp_verifying" ? (
        <>
          <p className="text-sm font-semibold">
            Te enviamos un código por SMS para ver tus premios
          </p>
          <div className="mt-2.5 flex items-center gap-2">
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="000000"
              className="w-28 rounded-xl border border-[#1C2526]/15 bg-[#FAF7F2] px-3 py-2.5 text-center text-base font-bold tracking-[0.25em] outline-none focus:border-[#F28C38]"
              disabled={state === "otp_verifying"}
            />
            <button
              type="button"
              onClick={confirmOtp}
              disabled={state === "otp_verifying" || code.length < 6}
              className="rounded-xl bg-[#F28C38] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
            >
              {state === "otp_verifying" ? "…" : "Ver premios"}
            </button>
          </div>
          {errMsg ? <p className="mt-2 text-xs text-red-700">{errMsg}</p> : null}
        </>
      ) : state === "none" ? (
        <p className="text-xs text-[#1C2526]/55">
          ⭐ Este número aún no tiene premios canjeables aquí — este pedido te
          suma puntos.
        </p>
      ) : (
        <button
          type="button"
          onClick={startOtp}
          disabled={state === "otp_sending"}
          className="text-left text-xs font-semibold text-[#F28C38] underline underline-offset-2 disabled:opacity-60"
        >
          {state === "otp_sending"
            ? "Enviando código…"
            : "🎁 ¿Ya tienes puntos con este número? Verifícate y usa tus premios en este pedido"}
        </button>
      )}
    </div>
  );
}
