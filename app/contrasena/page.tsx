"use client";

/**
 * comeleal.com/contrasena — la página que abre el link del correo (18-sep-2026).
 *
 * Antes el link abría la página genérica de Google en foodpass-18b33.firebaseapp.com:
 * el correo decía Comeleal y la página decía otra cosa. Ahora todo el camino
 * se llama Comeleal: correo de Ricardo → esta página → el panel.
 *
 * Firebase manda aquí tres tipos de link (mismo "action URL" para todos):
 * - mode=resetPassword: el dueño escribe su contraseña nueva. Se valida el
 *   código, se guarda, y se le abre la sesión para caer directo en /vendor.
 * - mode=verifyEmail y mode=recoverEmail: se aplica el código y se confirma.
 * Un link caducado o ya usado ofrece pedir otro ahí mismo (lib/passwordReset).
 * El código del link jamás se guarda ni se manda a ningún lado nuestro.
 */

import { Suspense, useEffect, useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getFirebaseAuth } from "@/lib/auth";
import { requestPasswordReset } from "@/lib/passwordReset";

type Stage =
  | "checking"
  | "form"
  | "saving"
  | "done"
  | "expired"
  | "verified"
  | "recovered";

const BUTTON =
  "inline-flex w-full items-center justify-center rounded-full bg-[#F28C38] px-6 py-3 text-[15px] font-semibold text-[#1C2526] transition-colors hover:bg-[#E07B2A] disabled:cursor-not-allowed disabled:opacity-60";
const INPUT =
  "w-full rounded-xl border border-[#e8e6dc] bg-white px-4 py-3 text-base text-[#1C2526] outline-none placeholder:text-[#1C2526]/30 focus:border-[#F28C38]";
const ERROR =
  "mt-3 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-600";

function ContrasenaInner() {
  const params = useSearchParams();
  const router = useRouter();
  const mode = params.get("mode") ?? "";
  const code = params.get("oobCode") ?? "";

  const [stage, setStage] = useState<Stage>("checking");
  const [email, setEmail] = useState("");
  const [pass1, setPass1] = useState("");
  const [pass2, setPass2] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Para pedir otro link cuando el de este correo ya no sirve.
  const [again, setAgain] = useState("");
  const [againState, setAgainState] = useState<"idle" | "sending" | "sent" | "wait">("idle");
  const [againError, setAgainError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!code) {
        setStage("expired");
        return;
      }
      try {
        const fb = await import("firebase/auth");
        const auth = getFirebaseAuth();
        auth.languageCode = "es";
        if (mode === "resetPassword") {
          const correo = await fb.verifyPasswordResetCode(auth, code);
          if (!alive) return;
          setEmail(correo);
          setStage("form");
        } else if (mode === "verifyEmail") {
          await fb.applyActionCode(auth, code);
          if (alive) setStage("verified");
        } else if (mode === "recoverEmail") {
          await fb.applyActionCode(auth, code);
          if (alive) setStage("recovered");
        } else {
          setStage("expired");
        }
      } catch {
        // Caducado, ya usado o inválido: Firebase no distingue y nosotros tampoco.
        if (alive) setStage("expired");
      }
    })();
    return () => {
      alive = false;
    };
  }, [mode, code]);

  async function handleSave(ev: FormEvent) {
    ev.preventDefault();
    if (pass1.length < 6) {
      setError("Usa al menos 6 letras o números.");
      return;
    }
    if (pass1 !== pass2) {
      setError("Las dos contraseñas no son iguales.");
      return;
    }
    setError(null);
    setStage("saving");
    try {
      const fb = await import("firebase/auth");
      const auth = getFirebaseAuth();
      await fb.confirmPasswordReset(auth, code, pass1);
      // Ya con la contraseña guardada, abrirle la sesión y llevarlo a su panel.
      try {
        await fb.signInWithEmailAndPassword(auth, email, pass1);
        router.replace("/vendor");
        return;
      } catch {
        setStage("done");
      }
    } catch (e) {
      const c = (e as { code?: string } | null)?.code ?? "";
      if (c === "auth/weak-password") {
        setError("Esa contraseña es muy corta. Usa al menos 6.");
        setStage("form");
        return;
      }
      setStage("expired");
    }
  }

  async function handleAgain(ev: FormEvent) {
    ev.preventDefault();
    if (!again.trim()) {
      setAgainError("Escribe tu correo.");
      return;
    }
    setAgainError(null);
    setAgainState("sending");
    const r = await requestPasswordReset(again);
    setAgainState(r === "wait" ? "wait" : "sent");
  }

  return (
    <main className="min-h-screen bg-[#FAF7F2] px-4 py-10 text-[#1C2526]">
      <div className="mx-auto w-full max-w-md">
        <Link href="/" className="mb-8 flex items-center gap-2">
          <Image src="/comeleal-app-icon.png" alt="Comeleal" width={32} height={32} className="rounded-lg" />
          <span className="text-lg font-semibold">Comeleal</span>
        </Link>

        <section className="rounded-2xl border border-[#1C2526]/8 bg-white p-6 shadow-sm">
          {stage === "checking" && (
            <p className="text-sm text-[#1C2526]/60">Un momento…</p>
          )}

          {(stage === "form" || stage === "saving") && (
            <form onSubmit={handleSave} noValidate>
              <h1 className="text-xl font-semibold">Escribe tu contraseña nueva</h1>
              <p className="mt-1 text-sm text-[#1C2526]/60">
                Para <span className="font-medium text-[#1C2526]">{email}</span>
              </p>
              <label className="mt-5 block text-sm font-medium" htmlFor="pass1">
                Contraseña nueva
              </label>
              <input
                id="pass1"
                type="password"
                autoComplete="new-password"
                className={`${INPUT} mt-1`}
                value={pass1}
                onChange={(e) => setPass1(e.target.value)}
                autoFocus
              />
              <label className="mt-4 block text-sm font-medium" htmlFor="pass2">
                Otra vez, para estar seguros
              </label>
              <input
                id="pass2"
                type="password"
                autoComplete="new-password"
                className={`${INPUT} mt-1`}
                value={pass2}
                onChange={(e) => setPass2(e.target.value)}
              />
              {error && <div className={ERROR}>{error}</div>}
              <button type="submit" className={`${BUTTON} mt-5`} disabled={stage === "saving"}>
                {stage === "saving" ? "Guardando…" : "Guardar y entrar"}
              </button>
            </form>
          )}

          {stage === "done" && (
            <>
              <h1 className="text-xl font-semibold">Listo. Tu contraseña nueva ya está guardada.</h1>
              <p className="mt-2 text-sm text-[#1C2526]/60">Entra con tu correo y esa contraseña.</p>
              <Link href="/vendor" className={`${BUTTON} mt-5`}>
                Entrar
              </Link>
            </>
          )}

          {stage === "verified" && (
            <>
              <h1 className="text-xl font-semibold">Tu correo quedó verificado.</h1>
              <Link href="/vendor" className={`${BUTTON} mt-5`}>
                Entrar
              </Link>
            </>
          )}

          {stage === "recovered" && (
            <>
              <h1 className="text-xl font-semibold">Listo. Tu correo quedó como estaba.</h1>
              <p className="mt-2 text-sm text-[#1C2526]/60">
                Si tú no pediste ese cambio, pon una contraseña nueva ahora mismo desde
                &ldquo;¿Olvidaste tu contraseña?&rdquo; en comeleal.com.
              </p>
              <Link href="/" className={`${BUTTON} mt-5`}>
                Ir a comeleal.com
              </Link>
            </>
          )}

          {stage === "expired" && (
            <>
              <h1 className="text-xl font-semibold">Este link ya caducó o ya se usó.</h1>
              <p className="mt-2 text-sm text-[#1C2526]/60">
                Cada link sirve 1 hora y una sola vez. Escribe tu correo y te mandamos otro.
              </p>
              {againState === "sent" ? (
                <p className="mt-5 rounded-xl border border-[#F28C38]/30 bg-[#F28C38]/8 px-4 py-3 text-sm">
                  Te mandamos un correo nuevo. Revisa también spam.
                </p>
              ) : (
                <form onSubmit={handleAgain} noValidate>
                  <label className="mt-5 block text-sm font-medium" htmlFor="again">
                    Tu correo
                  </label>
                  <input
                    id="again"
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    className={`${INPUT} mt-1`}
                    value={again}
                    onChange={(e) => setAgain(e.target.value)}
                    placeholder="tucorreo@gmail.com"
                  />
                  {againError && <div className={ERROR}>{againError}</div>}
                  {againState === "wait" && (
                    <div className={ERROR}>
                      Ya te mandamos varios correos. Revisa spam o espera una hora.
                    </div>
                  )}
                  {/* Siempre vivo: un botón apagado parece roto. Si falta el correo, se dice. */}
                  <button type="submit" className={`${BUTTON} mt-5`} disabled={againState === "sending"}>
                    {againState === "sending" ? "Mandando…" : "Mándame otro link"}
                  </button>
                </form>
              )}
            </>
          )}
        </section>

        <p className="mt-6 text-center text-xs text-[#1C2526]/45">
          Si tú no pediste esto, no pasa nada: ignóralo y tu contraseña sigue igual.
        </p>
      </div>
    </main>
  );
}

export default function ContrasenaPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#FAF7F2]" />}>
      <ContrasenaInner />
    </Suspense>
  );
}
