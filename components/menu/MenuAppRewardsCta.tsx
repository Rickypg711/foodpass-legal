"use client";

import { trackWebMenuDownloadClick } from "@/lib/analytics";

export function menuDownloadHref(restaurantId: string): string {
  return `/download.html?type=menu&restaurantId=${encodeURIComponent(restaurantId)}`;
}

type MenuAppRewardsCtaProps = {
  restaurantId: string;
  restaurantName: string;
  /** compact = below checkout; prominent = primary bottom CTA; banner = MP unavailable; browse = ordering off */
  variant: "compact" | "prominent" | "banner" | "browse";
  disabled?: boolean;
  /**
   * The restaurant's first-visit reward (e.g. "Personal queso"). When set,
   * the CTA sells the CONCRETE reward ("🎁 gratis en tu primera visita")
   * instead of generic "guarda tus puntos" copy — concrete converts.
   */
  firstVisitRewardLabel?: string | null;
};

export function MenuAppRewardsCta({
  restaurantId,
  restaurantName,
  variant,
  disabled = false,
  firstVisitRewardLabel = null,
}: MenuAppRewardsCtaProps) {
  const href = restaurantId ? menuDownloadHref(restaurantId) : "#";
  const isDisabled = disabled || !restaurantId;
  const reward = firstVisitRewardLabel?.trim() || null;
  // Honest mechanic: 1st visit UNLOCKS the gift, it's claimed on the next
  // visit within 7 days. Sell the gift in the headline, the rule in the sub.
  const headline = reward
    ? `🎁 Regalo de bienvenida: ${reward} GRATIS`
    : "Descarga Comeleal y guarda tus puntos";
  const subline = reward
    ? "Tu 1ª compra lo desbloquea y lo reclamas en la siguiente. Descarga Comeleal para no perderlo."
    : "Gana recompensas con este restaurante";

  function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
    if (isDisabled) {
      e.preventDefault();
      return;
    }
    trackWebMenuDownloadClick({
      restaurantId,
      restaurantName: restaurantName || "Restaurante",
    });
  }

  /** "Mis puntos" — balance check by phone (no app, SMS-verified). */
  const pointsLink = restaurantId ? (
    <a
      href={`/menu/${encodeURIComponent(restaurantId)}/puntos`}
      className="block py-1 text-center text-xs font-semibold text-[#1C2526]/55 underline underline-offset-2 hover:text-[#F28C38]"
    >
      ⭐ ¿Ya has comprado aquí? Ver mis puntos
    </a>
  ) : null;

  if (variant === "compact") {
    return (
      <a
        href={href}
        onClick={handleClick}
        className={
          "block min-h-10 rounded-lg py-2 text-center text-sm font-semibold text-[#F28C38] underline decoration-[#F28C38]/40 underline-offset-2 transition-colors hover:text-[#d67428] " +
          (isDisabled ? "pointer-events-none opacity-60" : "")
        }
      >
        {reward
          ? `🎁 ${reward} gratis de bienvenida — descarga Comeleal`
          : "Descarga Comeleal y guarda tus puntos"}
      </a>
    );
  }

  if (variant === "banner") {
    return (
      <div className="space-y-3">
        <div
          className="rounded-2xl border border-[#F28C38]/20 bg-white p-4 text-sm text-[#1C2526] shadow-sm"
          role="status"
        >
          <p className="font-semibold">
            {reward ? headline : "Este lugar tiene recompensas en Comeleal"}
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-[#1C2526]/70">
            {reward
              ? subline
              : "Descarga la app para acumular puntos y volver fácil a tus favoritos."}
          </p>
        </div>
        <a
          href={href}
          onClick={handleClick}
          aria-disabled={isDisabled}
          className={
            "menu-cta-enter menu-cta-pulse mx-auto block min-h-11 w-full max-w-md rounded-xl py-3 text-center text-sm font-semibold text-white " +
            (isDisabled ? "pointer-events-none opacity-60" : "")
          }
        >
          Descargar Comeleal
        </a>
        {pointsLink}
      </div>
    );
  }

  if (variant === "browse") {
    return (
      <div className="space-y-3">
        <p className="text-center text-sm font-medium text-[#1C2526]/75">
          {reward ? headline : "Este lugar tiene recompensas en Comeleal"}
        </p>
        <p className="text-center text-xs leading-relaxed text-[#1C2526]/70">
          {reward
            ? subline
            : "Descarga la app para acumular puntos y volver fácil a tus favoritos."}
        </p>
        <a
          href={href}
          onClick={handleClick}
          aria-disabled={isDisabled}
          className={
            "menu-cta-enter menu-cta-pulse mx-auto block min-h-11 w-full max-w-md rounded-xl py-3 text-center text-sm font-semibold text-white " +
            (isDisabled ? "pointer-events-none opacity-60" : "")
          }
        >
          Descargar Comeleal
        </a>
        {pointsLink}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[#F28C38]/15 bg-white/90 px-3 py-2.5 text-center shadow-sm">
      <p className="text-sm font-semibold text-[#1C2526]">{headline}</p>
      <p className="mt-0.5 text-xs text-[#1C2526]/65">{subline}</p>
      <a
        href={href}
        onClick={handleClick}
        aria-disabled={isDisabled}
        className={
          "menu-cta-enter mt-2 inline-flex min-h-10 w-full items-center justify-center rounded-xl bg-[#F28C38] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#d67428] " +
          (isDisabled ? "pointer-events-none opacity-60" : "")
        }
      >
        Descargar Comeleal
      </a>
      {pointsLink}
    </div>
  );
}
