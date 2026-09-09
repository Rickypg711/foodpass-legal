"use client";

/**
 * EL RELOJ DE LA PRUEBA en el panel (9-sep-2026).
 *
 * Una franja delgada bajo el header de /vendor — no es modal ni toast. La
 * matemática vive en lib/subscription/trialClock.ts (mismos estados y umbrales
 * que la app: counting · endingSoon · ended · hidden). Los datos vienen de
 * private/billing a través de fetchWithBilling (el candado lo afirma).
 *
 *   counting    → neutro: "Pro de prueba · te quedan N días" → /vendor/plan
 *   endingSoon  → cálido, sin alarma: "Tu prueba termina el martes. Sigue con
 *                 Pro por {precio} al mes." + "Seguir con Pro"
 *   ended       → "Tu prueba terminó. Sigues gratis: cobras igual, sin mesas ni
 *                 segundo PIN." + "Volver a Pro" (7 días después de vencer)
 *
 * Nunca para quien paga Pro ni para el bypass de fundador. Se puede cerrar por
 * estado (localStorage por restaurante + estado, con try/catch: en privado o
 * sin storage el reloj simplemente vuelve a salir).
 *
 * Copy nivel secundaria; tinta oscura sobre naranja (INK_DARK), jamás blanco.
 */

import { useState } from "react";
import Link from "next/link";
import { INK_DARK } from "@/lib/brand/brandColor";
import { PRO_PRICE_LABEL } from "@/lib/subscription/pricing";
import {
  trialClockState,
  trialEndsWhenEs,
  type TrialClockStateName,
} from "@/lib/subscription/trialClock";

function dismissKey(restaurantId: string, state: TrialClockStateName): string {
  return `comeleal.trialClock.${restaurantId}.${state}`;
}

function readDismissed(key: string): boolean {
  try {
    return typeof window !== "undefined" && window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function writeDismissed(key: string): void {
  try {
    window.localStorage.setItem(key, "1");
  } catch {
    /* sin storage: la franja vuelve a salir la próxima vez, y está bien */
  }
}

export function TrialClock({
  restaurantId,
  status,
  plan,
  trialEndsAt,
  founder = false,
  now,
}: {
  restaurantId: string;
  /** subscriptionAccessStatus (private/billing, vía fetchWithBilling). */
  status: string | null | undefined;
  /** subscriptionPlan (private/billing, vía fetchWithBilling). */
  plan: string | null | undefined;
  /** subscriptionTrialEndsAt en ms. */
  trialEndsAt: number | null | undefined;
  founder?: boolean;
  /** Para pruebas; en producción es el reloj del navegador al montar. */
  now?: number;
}) {
  // El "ahora" se fija al montar (regla de pureza de React): el panel se
  // recarga cada vez que el dueño entra, así que el reloj no se atrasa.
  const [nowMs] = useState<number>(() => now ?? Date.now());
  const clock = trialClockState({ status, plan, trialEndsAt, now: nowMs, founder });
  const key = clock.state === "hidden" ? null : dismissKey(restaurantId, clock.state);
  const [dismissed, setDismissed] = useState<string | null>(() =>
    key && readDismissed(key) ? key : null,
  );

  if (clock.state === "hidden" || !key || clock.endsAt == null) return null;
  if (dismissed === key) return null;

  const dismiss = () => {
    writeDismissed(key);
    setDismissed(key);
  };

  const closeButton = (
    <button
      type="button"
      onClick={dismiss}
      aria-label="Cerrar"
      className="ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[16px] leading-none transition hover:bg-black/5"
      style={{ color: "rgba(28,37,38,0.45)" }}
    >
      ×
    </button>
  );

  if (clock.state === "counting") {
    return (
      <div
        role="status"
        className="flex items-center justify-between gap-3 px-4 py-2.5 md:px-8"
        style={{ background: "#F5F3EF", borderBottom: "1px solid rgba(28,37,38,0.07)" }}
      >
        <p className="min-w-0 text-[13px]" style={{ color: "rgba(28,37,38,0.7)" }}>
          <span className="mr-1.5">⭐</span>
          <span className="font-semibold" style={{ color: INK_DARK }}>Pro de prueba</span>
          {" · "}te quedan {clock.daysLeft} días
          {" · "}
          <Link href="/vendor/plan" className="font-semibold underline underline-offset-2" style={{ color: "#B45309" }}>
            Ver planes
          </Link>
        </p>
        {closeButton}
      </div>
    );
  }

  if (clock.state === "endingSoon") {
    return (
      <div
        role="status"
        className="flex flex-col gap-2 px-4 py-3 md:flex-row md:items-center md:justify-between md:px-8"
        style={{ background: "#FFF3E6", borderBottom: "1px solid rgba(242,140,56,0.35)" }}
      >
        <p className="min-w-0 text-[13px] leading-snug" style={{ color: INK_DARK }}>
          <span className="mr-1.5">⏳</span>
          <span className="font-bold">Tu prueba termina {trialEndsWhenEs(clock.endsAt, nowMs)}.</span>{" "}
          Sigue con Pro por {PRO_PRICE_LABEL} al mes.
        </p>
        <div className="flex items-center gap-1">
          <Link
            href="/vendor/plan"
            className="flex min-h-[40px] items-center justify-center rounded-xl px-4 text-[13px] font-extrabold transition hover:opacity-90"
            style={{ background: "#F28C38", color: INK_DARK }}
          >
            Seguir con Pro
          </Link>
          {closeButton}
        </div>
      </div>
    );
  }

  // ended
  return (
    <div
      role="status"
      className="flex flex-col gap-2 px-4 py-3 md:flex-row md:items-center md:justify-between md:px-8"
      style={{ background: "#ffffff", borderBottom: "1px solid rgba(28,37,38,0.1)" }}
    >
      <p className="min-w-0 text-[13px] leading-snug" style={{ color: "rgba(28,37,38,0.7)" }}>
        <span className="font-bold" style={{ color: INK_DARK }}>Tu prueba terminó.</span>{" "}
        Sigues gratis: cobras igual, sin mesas ni segundo PIN.
      </p>
      <div className="flex items-center gap-1">
        <Link
          href="/vendor/plan"
          className="flex min-h-[40px] items-center justify-center rounded-xl px-4 text-[13px] font-extrabold transition hover:opacity-90"
          style={{ background: "rgba(242,140,56,0.16)", color: INK_DARK, border: "1px solid rgba(242,140,56,0.45)" }}
        >
          Volver a Pro
        </Link>
        {closeButton}
      </div>
    </div>
  );
}
