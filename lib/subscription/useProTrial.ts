"use client";

/**
 * La prueba de Pro desde una PARED (8-sep-2026, reverse trial).
 *
 * Antes la prueba de 14 días sin tarjeta se arrancaba en UN solo lugar: el
 * botón de /vendor/plan (handleStartTrial). Desde el 8-sep la pared de la Caja
 * también la ofrece cuando el restaurante todavía puede: el dueño pide ver su
 * historial, agregar un PIN o abrir una mesa, y en vez de mandarlo a otra
 * página, la puerta se abre ahí mismo. Desde el 9-sep con UN toque del dueño
 * ("Empezar mis 14 días gratis"): la pared jamás llama a `start()` sola.
 *
 * Mismas reglas que /vendor/plan: el otorgamiento es 100% del servidor
 * (callable startProTrial, FOODPASS/functions/subscription_trial.js) — el
 * reloj, el candado anti-repetición (private/trial) y la escritura de los
 * campos canónicos en private/billing. Aquí sólo se pide y se refleja.
 */

import { useCallback, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { getFirebaseFunctions } from "@/lib/firebase";
import { entitlementOf, type Entitlement } from "@/lib/subscription/entitlement";

export type ProTrialError = "already_used" | "already_pro" | "failed";

export function proTrialErrorMessage(code: ProTrialError): string {
  switch (code) {
    case "already_used":
      return "Este restaurante ya usó su prueba de Pro.";
    case "already_pro":
      return "Ya tienes Pro activo.";
    default:
      return "No pudimos abrir tu prueba. Intenta de nuevo en un momento.";
  }
}

/** Mapea el error del callable a un código chico (mismos textos que /vendor/plan). */
export function proTrialErrorCode(e: unknown): ProTrialError {
  const msg = (e as { message?: string })?.message ?? "";
  if (msg.includes("already_used")) return "already_used";
  if (msg.includes("already_pro")) return "already_pro";
  return "failed";
}

/**
 * Pide la prueba al servidor y regresa el entitlement nuevo (trialing, 14
 * días) sin releer Firestore: el servidor ya escribió exactamente eso.
 */
export async function startProTrialFromWeb(restaurantId: string): Promise<Entitlement> {
  const fn = httpsCallable<
    { restaurantId: string; source: string },
    { ok: boolean; days: number; endsAtMs: number }
  >(getFirebaseFunctions(), "startProTrial");
  const res = await fn({ restaurantId, source: "web" });
  const endsAtMs = res.data?.endsAtMs ?? null;
  if (!res.data?.ok || !endsAtMs) throw new Error("trial_failed");
  return entitlementOf({
    subscriptionPlan: "pro",
    subscriptionAccessStatus: "trialing",
    subscriptionAccessExpiresAt: endsAtMs,
    subscriptionTrialEndsAt: endsAtMs,
  });
}

export type ProTrialState = {
  starting: boolean;
  /** Entitlement recién otorgado (trialing) — null hasta que el servidor diga que sí. */
  granted: Entitlement | null;
  error: ProTrialError | null;
  start: () => Promise<Entitlement | null>;
};

/** Hook: arranca la prueba desde cualquier pared. Idempotente por render. */
export function useProTrial(restaurantId: string | null | undefined): ProTrialState {
  const [starting, setStarting] = useState(false);
  const [granted, setGranted] = useState<Entitlement | null>(null);
  const [error, setError] = useState<ProTrialError | null>(null);

  const start = useCallback(async () => {
    if (!restaurantId || starting) return null;
    setStarting(true);
    setError(null);
    try {
      const ent = await startProTrialFromWeb(restaurantId);
      setGranted(ent);
      return ent;
    } catch (e) {
      setError(proTrialErrorCode(e));
      return null;
    } finally {
      setStarting(false);
    }
  }, [restaurantId, starting]);

  return { starting, granted, error, start };
}
