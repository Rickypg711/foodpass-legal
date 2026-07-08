"use client";

// comeleal.com/puntos — the CUSTOMER front door. Verify your number once
// (SMS) and see your points at EVERY restaurant. Cross-restaurant read via
// collectionGroup(phoneCustomers) where phone == last10 (rules: only your
// own verified number; index: fieldOverride phone ASC COLLECTION_GROUP).

import Link from "next/link";
import { useRef, useState } from "react";
import {
  linkWithPhoneNumber,
  signInWithCredential,
  PhoneAuthProvider,
  RecaptchaVerifier,
  type ConfirmationResult,
} from "firebase/auth";
import {
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { ensureAnonymousUser, getFirebaseAuth } from "@/lib/auth";
import { getFirebaseDb } from "@/lib/firebase";
import { getRestaurantImageUrl } from "@/lib/restaurantImage";

type Step = "idle" | "sending" | "code" | "verifying" | "done" | "error";

type Balance = {
  restaurantId: string;
  restaurantName: string;
  points: number;
  visits: number;
  rewardUnlocked: boolean;
  logoUrl: string | null;
};

function last10(digits: string): string {
  const d = digits.replace(/\D/g, "");
  return d.length > 10 ? d.slice(-10) : d;
}

export default function PuntosGlobalPage() {
  const [phoneInput, setPhoneInput] = useState("");
  const [step, setStep] = useState<Step>("idle");
  const [code, setCode] = useState("");
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [balances, setBalances] = useState<Balance[]>([]);
  const confirmRef = useRef<ConfirmationResult | null>(null);
  const verifierRef = useRef<RecaptchaVerifier | null>(null);
  const recaptchaHostRef = useRef<HTMLDivElement | null>(null);

  const digits = last10(phoneInput);
  const valid = digits.length === 10;

  async function sendCode() {
    if (!valid) return;
    setStep("sending");
    setErrMsg(null);
    try {
      const auth = getFirebaseAuth();
      const user = await ensureAnonymousUser();
      if (user.phoneNumber && user.phoneNumber.endsWith(digits)) {
        await loadBalances();
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
        `+52${digits}`,
        verifierRef.current,
      );
      setStep("code");
    } catch (e) {
      console.error("[puntos] sendCode", e);
      setErrMsg("No pudimos enviar el código. Intenta de nuevo.");
      setStep("error");
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
      await loadBalances();
    } catch (e: unknown) {
      const codeStr =
        typeof e === "object" && e !== null && "code" in e
          ? String((e as { code?: unknown }).code)
          : "";
      // The code VERIFIED but the number already belongs to another account
      // (e.g. an app account or a previous session). Sign in with the
      // verified credential instead of linking. Firebase throws either of
      // these two codes depending on the account's provider mix.
      if (
        codeStr === "auth/credential-already-in-use" ||
        codeStr === "auth/account-exists-with-different-credential"
      ) {
        try {
          const cred =
            PhoneAuthProvider.credentialFromError(e as Parameters<typeof PhoneAuthProvider.credentialFromError>[0]) ??
            PhoneAuthProvider.credential(confirmation.verificationId, code.trim());
          await signInWithCredential(getFirebaseAuth(), cred);
          await loadBalances();
          return;
        } catch (e2) {
          console.error("[puntos] signInWithCredential", e2);
          setErrMsg(
            "Tu número ya está ligado a una cuenta. Pide un código nuevo e intenta otra vez.",
          );
          setStep("idle");
          return;
        }
      }
      console.error("[puntos] confirmCode", e);
      setErrMsg("Código incorrecto o expirado. Intenta de nuevo.");
      setStep("code");
    }
  }

  async function loadBalances() {
    const snap = await getDocs(
      query(collectionGroup(getFirebaseDb(), "phoneCustomers"), where("phone", "==", digits)),
    );
    const list: Balance[] = snap.docs
      .map((d) => {
        const data = d.data() as Record<string, unknown>;
        return {
          restaurantId:
            (data.restaurantId as string) ?? d.ref.parent.parent?.id ?? "",
          restaurantName: (data.restaurantName as string) ?? "Restaurante",
          points: Number(data.points) || 0,
          visits: Number(data.visits) || 0,
          rewardUnlocked: data.firstVisitRewardUnlocked === true,
          logoUrl: null,
        };
      })
      .sort((a, b) => b.points - a.points);

    // Restaurant logos (public-read docs) — the wallet feel. Failures are
    // cosmetic: card renders with the 🍽 fallback.
    const db = getFirebaseDb();
    await Promise.all(
      list.map(async (b) => {
        if (!b.restaurantId) return;
        try {
          const rSnap = await getDoc(doc(db, "restaurants", b.restaurantId));
          b.logoUrl = getRestaurantImageUrl(
            rSnap.data() as Record<string, unknown> | undefined,
          );
        } catch {
          /* keep fallback */
        }
      }),
    );

    setBalances(list);
    setStep("done");
  }

  return (
    <div className="min-h-screen text-[#1C2526]" style={{ backgroundColor: "#F0E3D2" }}>
      <header className="px-4 py-3 shadow-sm" style={{ backgroundColor: "#F28C38" }}>
        <div className="mx-auto flex max-w-md items-center gap-3">
          <Link
            href="/"
            aria-label="Inicio"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-lg text-white"
          >
            ←
          </Link>
          <h1 className="text-lg font-bold text-white">⭐ Mis puntos</h1>
        </div>
      </header>

      <main className="mx-auto max-w-md space-y-4 px-4 py-6">
        <div ref={recaptchaHostRef} />

        {step === "done" ? (
          balances.length > 0 ? (
            <>
              <p className="text-center text-sm font-semibold">
                Tus puntos, guardados en tu número:
              </p>
              {balances.map((b) => (
                <div key={b.restaurantId} className="rounded-2xl bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    {b.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={b.logoUrl}
                        alt=""
                        className="h-12 w-12 shrink-0 rounded-xl object-cover shadow-sm ring-1 ring-[#1C2526]/10"
                      />
                    ) : (
                      <div
                        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#F28C38]/12 text-xl"
                        aria-hidden
                      >
                        🍽
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-bold">{b.restaurantName}</p>
                      <p className="mt-0.5 text-xs text-[#1C2526]/60">
                        {b.visits} visita{b.visits !== 1 ? "s" : ""}
                        {b.rewardUnlocked
                          ? " · 🎁 premio de bienvenida disponible"
                          : ""}
                      </p>
                    </div>
                    <span className="shrink-0 text-xl font-extrabold" style={{ color: "#F28C38" }}>
                      {b.points} ⭐
                    </span>
                  </div>
                  <Link
                    href={`/menu/${encodeURIComponent(b.restaurantId)}`}
                    className="mt-2 inline-block text-xs font-semibold text-[#F28C38] underline"
                  >
                    Ver menú y ordenar →
                  </Link>
                </div>
              ))}
            </>
          ) : (
            <div className="rounded-2xl bg-white p-5 text-center">
              <p className="text-sm font-semibold">
                Aún no tienes puntos con este número.
              </p>
              <p className="mt-1 text-xs text-[#1C2526]/60">
                Se guardan solitos cuando compras en lugares con Comeleal y das
                tu número. ⭐
              </p>
            </div>
          )
        ) : step === "code" || step === "verifying" ? (
          <div className="rounded-2xl bg-white p-5 text-center">
            <p className="text-sm font-semibold">
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
          <div className="rounded-2xl bg-white p-5 text-center">
            <p className="text-base font-bold">Tus puntos viven en tu número</p>
            <p className="mt-1 text-xs text-[#1C2526]/60">
              Escribe tu WhatsApp y te mandamos un código para ver tu saldo en
              todos tus lugares. Sin apps, sin cuentas.
            </p>
            <input
              type="tel"
              inputMode="numeric"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              placeholder="Ej. 614 123 4567"
              maxLength={16}
              className="mt-4 w-full rounded-xl border border-[#1C2526]/12 bg-[#FAF7F2] px-3.5 py-3 text-center text-[15px] outline-none focus:border-[#F28C38]"
            />
            <button
              type="button"
              disabled={!valid || step === "sending"}
              onClick={sendCode}
              className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[#F28C38] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
            >
              {step === "sending" ? "Enviando código…" : "Ver mis puntos"}
            </button>
            {errMsg ? <p className="mt-2 text-xs text-red-700">{errMsg}</p> : null}
          </div>
        )}
      </main>
    </div>
  );
}
