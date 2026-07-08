"use client";

// Phone Points v1 — customer-facing balance on the receipt page.
// The customer verifies their number ONCE via Firebase Phone auth (SMS code,
// invisible reCAPTCHA). The phone credential is LINKED to the anonymous web
// session (same uid → order stays readable) and token.phone_number unlocks
// reading their own restaurants/{rid}/phoneCustomers/{last10} doc.
// STRATEGY_MENU_FIRST_AND_PHONE_LOYALTY.md §4 — OTP only at claim time,
// NEVER in the earn path.

import { useRef, useState } from "react";
import {
  linkWithPhoneNumber,
  signInWithCredential,
  PhoneAuthProvider,
  RecaptchaVerifier,
  type ConfirmationResult,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { ensureAnonymousUser, getFirebaseAuth } from "@/lib/auth";
import { getFirebaseDb } from "@/lib/firebase";

type Step = "idle" | "sending" | "code" | "verifying" | "done" | "error";

type Balance = {
  points: number;
  visits: number;
  firstVisitRewardUnlocked: boolean;
} | null;

type TierLite = { id: string; name: string; points: number };

/** rewardTiers from the (public-read) restaurant doc — `visitsRequired` is
 * legacy-named but holds POINTS. First-visit tier handled separately. */
function parseTiers(raw: unknown): TierLite[] {
  if (!Array.isArray(raw)) return [];
  const tiers: TierLite[] = [];
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

function toE164Mx(digits: string): string {
  const d = digits.replace(/\D/g, "");
  if (d.length === 10) return `+52${d}`;
  return `+${d}`;
}

export function PhonePointsCard({
  restaurantId,
  restaurantName,
  phone,
}: {
  restaurantId: string;
  restaurantName: string;
  phone: string;
}) {
  const [step, setStep] = useState<Step>("idle");
  const [code, setCode] = useState("");
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [balance, setBalance] = useState<Balance>(null);
  const [tiers, setTiers] = useState<TierLite[]>([]);
  const confirmRef = useRef<ConfirmationResult | null>(null);
  const verifierRef = useRef<RecaptchaVerifier | null>(null);
  const recaptchaHostRef = useRef<HTMLDivElement | null>(null);

  const phone10 = last10(phone);
  if (phone10.length < 10) return null;

  async function sendCode() {
    setStep("sending");
    setErrMsg(null);
    try {
      const auth = getFirebaseAuth();
      const user = await ensureAnonymousUser();
      // Phone auth already linked on this session → skip straight to reading.
      if (user.phoneNumber && user.phoneNumber.endsWith(phone10)) {
        await loadBalance();
        return;
      }
      if (!verifierRef.current && recaptchaHostRef.current) {
        verifierRef.current = new RecaptchaVerifier(auth, recaptchaHostRef.current, {
          size: "invisible",
        });
      }
      if (!verifierRef.current) throw new Error("recaptcha_unavailable");
      confirmRef.current = await linkWithPhoneNumber(
        user,
        toE164Mx(phone),
        verifierRef.current,
      );
      setStep("code");
    } catch (e) {
      console.error("[PhonePointsCard] sendCode", e);
      setErrMsg("No pudimos enviar el código. Intenta de nuevo.");
      setStep("error");
      // reCAPTCHA instances are single-use on failure — drop it for retry.
      verifierRef.current?.clear();
      verifierRef.current = null;
    }
  }

  async function confirmCode() {
    const confirmation = confirmRef.current;
    if (!confirmation || code.trim().length < 6) return;
    setStep("verifying");
    setErrMsg(null);
    try {
      await confirmation.confirm(code.trim());
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
        // Number already belongs to another account (e.g. app user or a
        // previous session): sign in with the verified credential instead of
        // linking. Firebase throws either code depending on provider mix.
        try {
          const cred =
            PhoneAuthProvider.credentialFromError(e as Parameters<typeof PhoneAuthProvider.credentialFromError>[0]) ??
            PhoneAuthProvider.credential(confirmation.verificationId, code.trim());
          await signInWithCredential(getFirebaseAuth(), cred);
          await loadBalance();
          return;
        } catch (e2) {
          console.error("[PhonePointsCard] signInWithCredential", e2);
        }
      }
      console.error("[PhonePointsCard] confirmCode", e);
      setErrMsg("Código incorrecto o expirado. Intenta de nuevo.");
      setStep("code");
    }
  }

  async function loadBalance() {
    // Reward tiers (public restaurant doc) — for the progress/unlocked lines.
    try {
      const rSnap = await getDoc(doc(getFirebaseDb(), "restaurants", restaurantId));
      setTiers(parseTiers(rSnap.data()?.rewardTiers));
    } catch {
      /* progress lines are optional */
    }
    const snap = await getDoc(
      doc(getFirebaseDb(), "restaurants", restaurantId, "phoneCustomers", phone10),
    );
    if (snap.exists()) {
      const d = snap.data() as Record<string, unknown>;
      setBalance({
        points: Number(d.points) || 0,
        visits: Number(d.visits) || 0,
        firstVisitRewardUnlocked: d.firstVisitRewardUnlocked === true,
      });
    } else {
      setBalance(null);
    }
    setStep("done");
  }

  return (
    <div className="rounded-2xl border border-[#F28C38]/35 bg-white p-4">
      <div ref={recaptchaHostRef} />
      {step === "done" ? (
        balance ? (
          <div className="text-center">
            <p className="text-base font-bold text-[#1C2526]">
              ⭐ Tienes {balance.points} punto{balance.points !== 1 ? "s" : ""} en{" "}
              {restaurantName}
            </p>
            <p className="mt-1 text-xs text-[#1C2526]/60">
              {balance.visits} visita{balance.visits !== 1 ? "s" : ""}
              {balance.firstVisitRewardUnlocked
                ? " · 🎁 Tienes un premio de bienvenida desbloqueado — pregunta en el local"
                : ""}
            </p>
            {(() => {
              const unlocked = tiers.filter((t) => balance.points >= t.points);
              const next = tiers.find((t) => balance.points < t.points);
              if (unlocked.length === 0 && !next) return null;
              return (
                <div className="mt-3 space-y-1.5 border-t border-[#F28C38]/15 pt-3 text-left">
                  {unlocked.map((t) => (
                    <p key={t.id} className="text-xs font-semibold text-[#1C2526]">
                      🎁 Ya puedes canjear:{" "}
                      <span style={{ color: "#F28C38" }}>{t.name}</span>{" "}
                      <span className="text-[#1C2526]/50">
                        ({t.points} pts) — pídelo al pagar en el local
                      </span>
                    </p>
                  ))}
                  {next ? (
                    <p className="text-xs text-[#1C2526]/60">
                      ⏳ Te faltan{" "}
                      <span className="font-bold" style={{ color: "#F28C38" }}>
                        {next.points - balance.points} puntos
                      </span>{" "}
                      para: {next.name}
                    </p>
                  ) : null}
                </div>
              );
            })()}
          </div>
        ) : (
          <p className="text-center text-sm text-[#1C2526]/70">
            Aún no tienes puntos aquí — se acreditan cuando el restaurante
            confirma tu pago. ⭐
          </p>
        )
      ) : step === "code" || step === "verifying" ? (
        <div className="text-center">
          <p className="text-sm font-semibold text-[#1C2526]">
            Te enviamos un código por SMS a tu número
          </p>
          <div className="mt-3 flex items-center justify-center gap-2">
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="000000"
              className="w-32 rounded-xl border border-[#1C2526]/15 bg-[#FAF7F2] px-3 py-2.5 text-center text-lg font-bold tracking-[0.3em] outline-none focus:border-[#F28C38]"
              disabled={step === "verifying"}
            />
            <button
              type="button"
              onClick={confirmCode}
              disabled={step === "verifying" || code.length < 6}
              className="rounded-xl bg-[#F28C38] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
            >
              {step === "verifying" ? "Verificando…" : "Ver puntos"}
            </button>
          </div>
          {errMsg ? <p className="mt-2 text-xs text-red-700">{errMsg}</p> : null}
        </div>
      ) : (
        <div className="text-center">
          <p className="text-sm font-semibold text-[#1C2526]">
            ⭐ Tus puntos quedan guardados en tu número
          </p>
          <p className="mt-1 text-xs text-[#1C2526]/60">
            Verifica tu WhatsApp ({phone10.slice(0, 3)} ··· {phone10.slice(-2)}) y
            ve tu saldo en {restaurantName}.
          </p>
          <button
            type="button"
            onClick={sendCode}
            disabled={step === "sending"}
            className="mt-3 inline-flex min-h-10 items-center justify-center rounded-xl border border-[#F28C38] bg-white px-5 py-2 text-sm font-bold text-[#F28C38] disabled:opacity-50"
          >
            {step === "sending" ? "Enviando código…" : "Ver mis puntos"}
          </button>
          {errMsg ? <p className="mt-2 text-xs text-red-700">{errMsg}</p> : null}
        </div>
      )}
    </div>
  );
}
