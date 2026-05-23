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
          "mt-2 block text-center text-sm font-semibold text-[#F28C38] underline " +
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
          className="rounded-xl border border-[#F28C38]/25 bg-white p-4 text-sm text-[#1C2526]"
          role="status"
        >
          <p className="font-semibold">Este restaurante también vive en Comeleal</p>
          <p className="mt-1 text-xs leading-relaxed text-[#1C2526]/75">
            Descarga la app para ver recompensas y volver fácil. Gana recompensas cuando visites
            este lugar.
          </p>
        </div>
        <a
          href={href}
          onClick={handleClick}
          aria-disabled={isDisabled}
          className={
            "menu-cta-enter menu-cta-pulse mx-auto block w-full max-w-md rounded-xl py-3 text-center text-sm font-semibold text-white " +
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
        <p className="text-center text-sm text-[#1C2526]/75">Abre Comeleal y gana recompensas</p>
        <a
          href={href}
          onClick={handleClick}
          aria-disabled={isDisabled}
          className={
            "menu-cta-enter menu-cta-pulse mx-auto block w-full max-w-xs rounded-xl py-3 text-center text-sm font-semibold text-white sm:max-w-md " +
            (isDisabled ? "pointer-events-none opacity-60" : "")
          }
        >
          Gana puntos con este pedido 🔥
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-2 text-center">
      <p className="text-sm font-semibold text-[#1C2526]">Descarga Comeleal y guarda tus puntos</p>
      <p className="text-xs text-[#1C2526]/75">Gana recompensas con este restaurante</p>
      <a
        href={href}
        onClick={handleClick}
        aria-disabled={isDisabled}
        className={
          "menu-cta-enter mx-auto block w-full max-w-md rounded-xl border-2 border-[#F28C38] bg-white py-3 text-sm font-semibold text-[#F28C38] " +
          (isDisabled ? "pointer-events-none opacity-60" : "")
        }
      >
        Descargar Comeleal
      </a>
    </div>
  );
}
