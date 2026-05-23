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
};

export function MenuAppRewardsCta({
  restaurantId,
  restaurantName,
  variant,
  disabled = false,
}: MenuAppRewardsCtaProps) {
  const href = restaurantId ? menuDownloadHref(restaurantId) : "#";
  const isDisabled = disabled || !restaurantId;

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

  if (variant === "compact") {
    return (
      <a
        href={href}
        onClick={handleClick}
        className={
          "block min-h-10 rounded-lg py-2 text-center text-sm font-semibold text-[#F28C38] underline decoration-[#F28C38]/40 underline-offset-2 transition-colors hover:text-[#e07d30] " +
          (isDisabled ? "pointer-events-none opacity-60" : "")
        }
      >
        Descarga Comeleal y guarda tus puntos
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
          <p className="font-semibold">Este restaurante también vive en Comeleal</p>
          <p className="mt-1.5 text-xs leading-relaxed text-[#1C2526]/70">
            Descarga la app para ver recompensas y volver fácil. Gana recompensas cuando visites
            este lugar.
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
      </div>
    );
  }

  if (variant === "browse") {
    return (
      <div className="space-y-3">
        <p className="text-center text-sm font-medium text-[#1C2526]/75">
          Abre Comeleal y gana recompensas
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
          Gana puntos con este pedido 🔥
        </a>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[#F28C38]/15 bg-white/90 px-3 py-2.5 text-center shadow-sm">
      <p className="text-sm font-semibold text-[#1C2526]">Descarga Comeleal y guarda tus puntos</p>
      <p className="mt-0.5 text-xs text-[#1C2526]/65">Gana recompensas con este restaurante</p>
      <a
        href={href}
        onClick={handleClick}
        aria-disabled={isDisabled}
        className={
          "menu-cta-enter mt-2 inline-flex min-h-10 w-full items-center justify-center rounded-xl border-2 border-[#F28C38] bg-white px-4 py-2 text-sm font-semibold text-[#F28C38] transition-colors hover:bg-[#F28C38]/5 " +
          (isDisabled ? "pointer-events-none opacity-60" : "")
        }
      >
        Descargar Comeleal
      </a>
    </div>
  );
}
