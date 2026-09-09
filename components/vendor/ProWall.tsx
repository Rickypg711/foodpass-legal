"use client";

/**
 * LA pared de Pro — una sola, para las tres puertas de la Caja (8-sep-2026).
 *
 *   history   → ver más de 30 días (Reportes / historial)
 *   posStaff  → agregar el 2° PIN al equipo de la caja
 *   tableTabs → abrir una cuenta de mesa desde la Caja
 *
 * Comportamiento (9-sep-2026, reverse trial con consentimiento — Verna /
 * Poyar / Hormozi): la pared NO arranca la prueba sola. Si el restaurante
 * todavía puede (canStartTrial), enseña el copy canónico y UN botón:
 * "Empezar mis 14 días gratis". Al tocarlo se pide la prueba al servidor
 * (startProTrial, source web) y, cuando dice que sí, la pared confirma la
 * fecha exacta y un solo botón "Seguir" repite la acción que detuvo. Si ya
 * usó su prueba, enseña el precio y la liga a /vendor/plan. El bypass de
 * fundador nunca llega aquí (entitlementsOf abre todo).
 *
 * Sin efectos al montar, a propósito: nada se dispara solo. El candado
 * scripts/validate-trial-clock.mjs lo afirma.
 *
 * Copy (nivel secundaria, sin anglicismos, siempre "menú"): ver WALL_COPY. La
 * (9-sep noche, Ricardo: la pared NO trae su WhatsApp — "no quiero que me escriban".)
 *
 * Contraste: los botones naranja llevan tinta oscura (INK_DARK), como el resto
 * del panel — jamás blanco sobre naranja. Botones de 44px o más, foco en el
 * botón principal, Escape cierra, role="dialog".
 */

import type { KeyboardEvent, ReactNode } from "react";
import Link from "next/link";
import { INK_DARK } from "@/lib/brand/brandColor";
import {
  PRO_ENTITLEMENTS,
  TRIAL_DAYS,
  type CajaWall,
  type Entitlement,
  type Entitlements,
} from "@/lib/subscription/entitlement";
import { PRO_PRICE_LABEL } from "@/lib/subscription/pricing";
import { longDateEs } from "@/lib/subscription/trialClock";
import { proTrialErrorMessage, useProTrial } from "@/lib/subscription/useProTrial";

/** El texto de la pared — el mismo en las tres puertas y en la app. */
export const WALL_COPY = `Esto es Pro. Tu Caja sigue gratis. Por ${PRO_PRICE_LABEL} al mes ves todo tu historial, tu equipo cobra con su PIN y llevas mesas. Pruébalo ${TRIAL_DAYS} días, sin tarjeta.`;
// Sin prueba que ofrecer (ya la usó): el mismo copy SIN prometer 14 días.
// Regla "jamás prometer lo que no existe"; espejo de cajaProWallBodyNoTrial (app).
export const WALL_COPY_NO_TRIAL = `Esto es Pro. Tu Caja sigue gratis. Por ${PRO_PRICE_LABEL} al mes ves todo tu historial, tu equipo cobra con su PIN y llevas mesas.`;
/** El botón de consentimiento — el mismo texto en la app. */
export const WALL_TRIAL_CTA = `Empezar mis ${TRIAL_DAYS} días gratis`;

// Hormozi ($100M Offers, 9-sep): "vende las vacaciones, no el vuelo". El
// título dice la función; ESTA línea dice lo que el dueño compra. Va arriba
// del copy canónico. ESPEJO de cajaProWallHint* en la app (.arb).
export const WALL_OUTCOME: Record<CajaWall, string> = {
  history: "Para ver tu mes completo y saber si vas mejor que el pasado.",
  posStaff: "Para que cada venta quede con el nombre de quien cobró. Se acaba el \"yo no fui\" en la caja.",
  tableTabs: "Para que la mesa 4 no se te pierda entre rondas en la noche llena.",
};

const WALL_TITLE: Record<CajaWall, string> = {
  history: "Ver más de 30 días",
  posStaff: "Un PIN más para tu equipo",
  tableTabs: "Cuentas por mesa",
};


const PRIMARY_BTN =
  "flex min-h-[48px] w-full items-center justify-center rounded-2xl px-4 py-3 text-[14px] font-extrabold transition hover:opacity-90 disabled:opacity-60";
const SECONDARY_BTN =
  "mt-2 flex min-h-[44px] w-full items-center justify-center rounded-2xl px-4 py-2.5 text-[13px] font-semibold transition hover:opacity-80";
const PRIMARY_STYLE = { background: "#F28C38", color: INK_DARK } as const;
const SECONDARY_STYLE = { background: "rgba(28,37,38,0.06)", color: "rgba(28,37,38,0.6)" } as const;

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
  const granted = trial.granted;

  // Escape cierra — salvo mientras el servidor está abriendo la prueba.
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape" && !trial.starting) {
      e.stopPropagation();
      onClose();
    }
  };

  let body: ReactNode;

  if (granted) {
    /* ── La puerta ya se abrió: la fecha exacta y un solo botón ── */
    const endsAt = granted.accessExpiresAtMs;
    body = (
      <>
        <div
          className="mt-5 rounded-2xl px-4 py-3"
          style={{ background: "rgba(242,140,56,0.1)", border: "1px solid rgba(242,140,56,0.3)" }}
          role="status"
        >
          <p className="text-[14px] font-bold" style={{ color: INK_DARK }}>
            🎉 Listo. Tienes Pro hasta el {endsAt != null ? longDateEs(endsAt) : `día ${TRIAL_DAYS}`}. Sin tarjeta, sin cobros.
          </p>
          <p className="mt-1 text-[12px]" style={{ color: "rgba(28,37,38,0.6)" }}>
            Al terminar no se rompe nada: tu Caja sigue gratis y tus clientes siguen juntando puntos.
          </p>
        </div>
        <button
          type="button"
          autoFocus
          onClick={() => onUnlocked(PRO_ENTITLEMENTS, granted)}
          className={`mt-4 ${PRIMARY_BTN}`}
          style={PRIMARY_STYLE}
        >
          Seguir
        </button>
      </>
    );
  } else if (trial.starting) {
    /* ── El servidor está abriendo la prueba ── */
    body = (
      <div
        className="mt-5 flex min-h-[48px] items-center gap-3 rounded-2xl px-4 py-3"
        style={{ background: "#F5F3EF" }}
        role="status"
        aria-live="polite"
      >
        <svg className="h-5 w-5 shrink-0 animate-spin" style={{ color: "#F28C38" }} fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 12 5.373 12 12H4z" />
        </svg>
        <p className="text-[13px] font-semibold" style={{ color: INK_DARK }}>
          Abriendo tu prueba de {TRIAL_DAYS} días…
        </p>
      </div>
    );
  } else if (trial.error === "already_pro") {
    /* ── El servidor dice que ya es Pro (el panel traía datos viejos) ── */
    body = (
      <>
        <p className="mt-4 rounded-xl px-3 py-2 text-[13px] font-semibold" style={{ background: "#F0FDF4", color: "#15803D" }}>
          {proTrialErrorMessage("already_pro")} Sigue, ya puedes usarlo.
        </p>
        <button
          type="button"
          autoFocus
          onClick={() => onUnlocked(PRO_ENTITLEMENTS, entitlement)}
          className={`mt-4 ${PRIMARY_BTN}`}
          style={PRIMARY_STYLE}
        >
          Seguir
        </button>
      </>
    );
  } else if (trial.error === "failed") {
    /* ── Falló: en palabras llanas, y se puede volver a intentar ── */
    body = (
      <>
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-600" role="alert">
          {proTrialErrorMessage("failed")}
        </p>
        <button
          type="button"
          autoFocus
          onClick={() => void trial.start()}
          className={`mt-4 ${PRIMARY_BTN}`}
          style={PRIMARY_STYLE}
        >
          Intentar de nuevo
        </button>
        <button type="button" onClick={onClose} className={SECONDARY_BTN} style={SECONDARY_STYLE}>
          Ahora no
        </button>
      </>
    );
  } else if (entitlement.canStartTrial && trial.error !== "already_used") {
    /* ── Todavía puede probar: UN toque para decir que sí ── */
    body = (
      <>
        <button
          type="button"
          autoFocus
          onClick={() => void trial.start()}
          className={`mt-5 ${PRIMARY_BTN}`}
          style={PRIMARY_STYLE}
        >
          {WALL_TRIAL_CTA}
        </button>
        <p className="mt-2 text-center text-[11px]" style={{ color: "rgba(28,37,38,0.4)" }}>
          Sin tarjeta · una vez por restaurante · al terminar regresas solo al plan gratis
        </p>
        <button type="button" onClick={onClose} className={SECONDARY_BTN} style={SECONDARY_STYLE}>
          Ahora no
        </button>
      </>
    );
  } else {
    /* ── Ya usó su prueba: el precio y la página del plan ── */
    body = (
      <>
        {trial.error === "already_used" && (
          <p className="mt-4 text-[12px] font-semibold" style={{ color: "rgba(28,37,38,0.55)" }}>
            {proTrialErrorMessage("already_used")}
          </p>
        )}
        <Link
          href="/vendor/plan"
          autoFocus
          className={`mt-5 ${PRIMARY_BTN}`}
          style={PRIMARY_STYLE}
        >
          Ver planes — {PRO_PRICE_LABEL}/mes →
        </Link>
        <button type="button" onClick={onClose} className={SECONDARY_BTN} style={SECONDARY_STYLE}>
          Ahora no
        </button>
      </>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center px-4 pb-[72px] md:items-center md:pb-0"
      style={{ background: "rgba(28,37,38,0.55)", backdropFilter: "blur(6px)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="pro-wall-title"
      onKeyDown={onKeyDown}
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
        <p className="mt-2 text-[15px] font-bold leading-snug" style={{ color: INK_DARK }}>
          {WALL_OUTCOME[wall]}
        </p>

        <p className="mt-3 text-[14px] leading-relaxed" style={{ color: "rgba(28,37,38,0.7)" }}>
          {entitlement.canStartTrial && trial.error !== "already_used" ? WALL_COPY : WALL_COPY_NO_TRIAL}
        </p>

        {body}
      </div>
    </div>
  );
}
