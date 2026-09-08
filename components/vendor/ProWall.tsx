"use client";

/**
 * LA pared de Pro — una sola, para las tres puertas de la Caja (8-sep-2026).
 *
 *   history   → ver más de 30 días (Reportes / historial)
 *   posStaff  → agregar el 2° PIN al equipo de la caja
 *   tableTabs → abrir una cuenta de mesa desde la Caja
 *
 * Comportamiento (plan §4.6, reverse trial): si el restaurante todavía puede
 * arrancar su prueba (canStartTrial), la pared la arranca SOLA al abrirse y
 * abre la puerta ahí mismo — 14 días, sin tarjeta, una vez por restaurante.
 * Si ya la usó, enseña el precio y la liga a /vendor/plan.
 *
 * Copy (nivel secundaria, sin anglicismos, siempre "menú"): ver WALL_COPY. La
 * cosa humana de Pro es el WhatsApp directo de Ricardo (PUBLIC_WHATSAPP_WA_ME).
 *
 * Contraste: los botones naranja llevan tinta oscura (INK_DARK), como el resto
 * del panel — jamás blanco sobre naranja.
 */

import { useEffect, useRef } from "react";
import Link from "next/link";
import { INK_DARK } from "@/lib/brand/brandColor";
import { PUBLIC_WHATSAPP_WA_ME } from "@/lib/contactEmail";
import {
  PRO_ENTITLEMENTS,
  TRIAL_DAYS,
  type CajaWall,
  type Entitlement,
  type Entitlements,
} from "@/lib/subscription/entitlement";
import { PRO_PRICE_LABEL } from "@/lib/subscription/pricing";
import { proTrialErrorMessage, useProTrial } from "@/lib/subscription/useProTrial";

/** El texto de la pared — el mismo en las tres puertas y en la app. */
export const WALL_COPY = `Esto es Pro. Tu Caja sigue gratis. Por ${PRO_PRICE_LABEL} al mes ves todo tu historial, tu equipo cobra con su PIN y llevas mesas. Pruébalo ${TRIAL_DAYS} días, sin tarjeta.`;
export const WALL_HUMAN_LINE = "Y tienes mi WhatsApp directo.";

const WALL_TITLE: Record<CajaWall, string> = {
  history: "Ver más de 30 días",
  posStaff: "Un PIN más para tu equipo",
  tableTabs: "Cuentas por mesa",
};

const WHATSAPP_WALL_URL =
  `${PUBLIC_WHATSAPP_WA_ME}?text=` +
  encodeURIComponent("Hola Ricardo, tengo una duda de Pro en mi Caja de Comeleal 🙏");

export function ProWall({
  wall,
  restaurantId,
  entitlement,
  onUnlocked,
  onClose,
}: {
  wall: CajaWall;
  restaurantId: string;
  /** Estado del plan (entitlementOf sobre el doc fundido con private/billing). */
  entitlement: Entitlement;
  /** La puerta se abrió (prueba otorgada): el caller guarda los entitlements
   * nuevos y repite la acción que la pared detuvo. */
  onUnlocked: (entitlements: Entitlements, entitlement: Entitlement) => void;
  onClose: () => void;
}) {
  const trial = useProTrial(restaurantId);
  const { start } = trial;
  const autostarted = useRef(false);

  // Reverse trial: la pared arranca la prueba sola si todavía se puede.
  useEffect(() => {
    if (autostarted.current) return;
    if (!entitlement.canStartTrial) return;
    autostarted.current = true;
    void start();
  }, [entitlement.canStartTrial, start]);

  const starting = trial.starting || (entitlement.canStartTrial && !trial.granted && !trial.error);
  const granted = trial.granted;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center px-4 pb-[72px] md:items-center md:pb-0"
      style={{ background: "rgba(28,37,38,0.55)", backdropFilter: "blur(6px)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="pro-wall-title"
    >
      <div
        className="w-full max-w-md rounded-3xl p-6 md:p-7"
        style={{ background: "#ffffff", boxShadow: "0 24px 64px rgba(28,37,38,0.2)" }}
      >
        <p
          className="text-[10px] font-bold uppercase tracking-widest"
          style={{ color: "#F28C38" }}
        >
          ⭐ Pro
        </p>
        <h2
          id="pro-wall-title"
          className="mt-1 text-[20px] font-extrabold leading-tight"
          style={{ color: INK_DARK }}
        >
          {WALL_TITLE[wall]}
        </h2>

        <p className="mt-3 text-[14px] leading-relaxed" style={{ color: "rgba(28,37,38,0.7)" }}>
          {WALL_COPY}
        </p>
        <p className="mt-2 text-[13px] font-semibold" style={{ color: INK_DARK }}>
          {WALL_HUMAN_LINE}{" "}
          <a
            href={WHATSAPP_WALL_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2"
            style={{ color: "#25D366" }}
          >
            Escríbeme →
          </a>
        </p>

        {granted ? (
          /* ── La puerta ya se abrió ── */
          <>
            <div
              className="mt-5 rounded-2xl px-4 py-3"
              style={{ background: "rgba(242,140,56,0.1)", border: "1px solid rgba(242,140,56,0.3)" }}
            >
              <p className="text-[14px] font-bold" style={{ color: INK_DARK }}>
                🎉 Listo. Tienes Pro {granted.trialDaysLeft || TRIAL_DAYS} días, sin tarjeta.
              </p>
              <p className="mt-1 text-[12px]" style={{ color: "rgba(28,37,38,0.6)" }}>
                Al terminar no se rompe nada: tu Caja sigue gratis y tus clientes siguen juntando puntos.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onUnlocked(PRO_ENTITLEMENTS, granted)}
              className="mt-4 w-full rounded-2xl px-4 py-3.5 text-[14px] font-extrabold transition hover:opacity-90"
              style={{ background: "#F28C38", color: INK_DARK }}
            >
              Continuar →
            </button>
          </>
        ) : starting ? (
          /* ── Abriendo la prueba (automático) ── */
          <div className="mt-5 flex items-center gap-3 rounded-2xl px-4 py-3" style={{ background: "#F5F3EF" }}>
            <svg className="h-5 w-5 shrink-0 animate-spin" style={{ color: "#F28C38" }} fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 12 5.373 12 12H4z" />
            </svg>
            <p className="text-[13px] font-semibold" style={{ color: INK_DARK }}>
              Abriendo tu prueba de {TRIAL_DAYS} días…
            </p>
          </div>
        ) : (
          /* ── Ya usó su prueba (o falló): el precio y la página del plan ── */
          <>
            {trial.error && trial.error !== "already_used" && (
              <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-600">
                {proTrialErrorMessage(trial.error)}
              </p>
            )}
            <Link
              href="/vendor/plan"
              className="mt-5 block w-full rounded-2xl px-4 py-3.5 text-center text-[14px] font-extrabold transition hover:opacity-90"
              style={{ background: "#F28C38", color: INK_DARK }}
            >
              Ver Pro — {PRO_PRICE_LABEL}/mes →
            </Link>
            <button
              type="button"
              onClick={onClose}
              className="mt-2 w-full rounded-2xl px-4 py-3 text-[13px] font-semibold"
              style={{ background: "rgba(28,37,38,0.06)", color: "rgba(28,37,38,0.6)" }}
            >
              Ahora no
            </button>
          </>
        )}
      </div>
    </div>
  );
}
