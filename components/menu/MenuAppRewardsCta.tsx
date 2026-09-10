"use client";

import { trackWebMenuDownloadClick } from "@/lib/analytics";
import type { MenuSkinId } from "@/lib/menu/menuSkin";

export function menuDownloadHref(restaurantId: string): string {
  return `/download.html?type=menu&restaurantId=${encodeURIComponent(restaurantId)}`;
}

type MenuAppRewardsCtaProps = {
  restaurantId: string;
  restaurantName: string;
  /** compact = una línea (carrito con items / cerrado); el resto = tarjeta. */
  variant: "compact" | "prominent" | "banner" | "browse";
  disabled?: boolean;
  /**
   * Premio de bienvenida del restaurante (ej. "Shilanga"). Cuando existe, se
   * vende el premio CONCRETO en vez de "junta puntos" — lo concreto convierte.
   */
  firstVisitRewardLabel?: string | null;
  /**
   * Premios apagados (5-sep): false = no hay nada que ganar aquí, así que
   * este aviso NO existe (ni "junta puntos" ni la app como cartera).
   */
  loyaltyLive?: boolean;
  /** Piel del local (10-sep): "pecado" pinta la tarjeta como su papel (crema y rojo). */
  skin?: MenuSkinId | null;
};

/**
 * Aviso de recompensas en la página del restaurante.
 *
 * REGLA DE JERARQUÍA — el premio manda, el teléfono es el mecanismo, la app es
 * comodidad opcional. Esta página es del RESTAURANTE, no de Comeleal: poner
 * "Descargar Comeleal" como botón principal contradice lo que se le vende al
 * dueño (esto es tuyo, no un marketplace) y además miente — los puntos se
 * acumulan con el teléfono al pagar, sin instalar nada. La app baja a link.
 */
export function MenuAppRewardsCta({
  restaurantId,
  restaurantName,
  variant,
  disabled = false,
  firstVisitRewardLabel = null,
  loyaltyLive = true,
  skin = null,
}: MenuAppRewardsCtaProps) {
  if (!loyaltyLive) return null;
  const pecado = skin === "pecado";
  const nb = skin === "negroblanco";
  const href = restaurantId ? menuDownloadHref(restaurantId) : "#";
  const isDisabled = disabled || !restaurantId;
  const reward = firstVisitRewardLabel?.trim() || null;

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

  // ── Una línea. Va cuando el carrito YA tiene cosas o el lugar está cerrado.
  // Aquí no hay links a propósito: si alguien está a medio pedido, sacarlo a
  // una tienda de apps le cuesta el pedido al restaurante.
  if (variant === "compact") {
    return (
      <p className={"px-2 py-1.5 text-center text-[13px] font-semibold leading-snug " + (pecado ? "text-[#a61c21]/80" : nb ? "text-[#0b0b0b]/60" : "text-[#1C2526]/60")}>
        {reward ? (
          <>
            <span aria-hidden>🎁</span> {reward} gratis en tu siguiente visita
          </>
        ) : (
          <>
            <span aria-hidden>⭐</span> Cada compra te suma puntos aquí
          </>
        )}
      </p>
    );
  }

  const eyebrow = reward ? "Regalo de bienvenida" : "Recompensas";
  const title = reward ?? "Junta puntos en cada compra";
  const explain = reward
    // "al pagar" y no "en la caja": esta página tiene pedidos EN LÍNEA. Quien
    // la lee puede estar pidiendo para recoger, a domicilio o desde una mesa
    // con el QR — en ninguno de esos casos hay una caja enfrente. Y en un
    // pedido web el teléfono se pide en el checkout, no en un mostrador.
    // "Al pagar" es cierto en los CUATRO caminos.
    ? "Es tuyo en tu siguiente visita. Solo da tu teléfono al pagar."
    : "Cámbialos por comida gratis. Solo da tu teléfono al pagar.";

  return (
    <div
      className={
        pecado
          ? "overflow-hidden rounded-[22px] bg-[#fbaa19] text-[#a61c21] shadow-[0_12px_32px_rgba(60,10,5,0.28)]"
          : nb
            ? "overflow-hidden rounded-[28px] bg-[#0b0b0b] text-white"
            : "overflow-hidden rounded-2xl border border-[#F28C38]/18 bg-gradient-to-br from-[#FFF8F2] to-white shadow-[0_1px_3px_rgba(28,37,38,0.05)]"
      }
    >
      <div className="flex items-start gap-3 p-4">
        <span
          className={
            "grid h-10 w-10 shrink-0 place-items-center rounded-full text-[19px] " +
            (pecado ? "bg-[#ffeecf]" : nb ? "bg-white/10" : "bg-[#F28C38]/12")
          }
          aria-hidden
        >
          {reward ? "🎁" : "⭐"}
        </span>

        <div className="min-w-0 flex-1">
          <p className={"text-[10.5px] font-bold uppercase tracking-[0.09em] " + (pecado ? "text-[#a61c21]/75" : nb ? "text-white/55" : "text-[#F28C38]")}>
            {eyebrow}
          </p>
          <p
            className={
              pecado
                ? "mt-1 [font-family:var(--pc-name),'Arial_Narrow',sans-serif] text-[22px] font-extrabold uppercase italic leading-none tracking-wide text-[#a61c21]"
                : nb
                  ? "mt-1 text-[20px] font-semibold leading-tight tracking-[-0.03em] text-white"
                  : "mt-1 text-[17px] font-bold leading-tight text-[#1C2526]"
            }
          >
            {title}
          </p>
          <p className={"mt-1.5 text-[13px] leading-relaxed " + (pecado ? "font-medium text-[#a61c21]/85" : nb ? "text-white/65" : "text-[#1C2526]/65")}>{explain}</p>
        </div>
      </div>

      {/* Pie discreto: las dos salidas opcionales, al mismo peso. Ninguna es
          un botón — el botón de esta página es "Ordenar", no "Descargar". */}
      {restaurantId ? (
        <div className={"flex items-stretch border-t text-[12.5px] font-semibold " + (pecado ? "border-[#a61c21]/20" : nb ? "border-white/10" : "border-[#1C2526]/[0.07]")}>
          <a
            href={`/menu/${encodeURIComponent(restaurantId)}/puntos`}
            className={
              "flex-1 px-3 py-2.5 text-center transition-colors " +
              (pecado ? "font-bold text-[#a61c21]/85 hover:bg-[#a61c21]/10" : nb ? "text-white/70 hover:bg-white/5 hover:text-white" : "text-[#1C2526]/55 hover:bg-[#F28C38]/[0.06] hover:text-[#F28C38]")
            }
          >
            Ver mis puntos
          </a>
          <span className={"my-2 w-px " + (pecado ? "bg-[#a61c21]/20" : nb ? "bg-white/10" : "bg-[#1C2526]/[0.07]")} aria-hidden />
          <a
            href={href}
            onClick={handleClick}
            aria-disabled={isDisabled}
            className={
              "flex-1 px-3 py-2.5 text-center transition-colors " +
              (pecado ? "font-bold text-[#a61c21]/85 hover:bg-[#a61c21]/10 " : nb ? "text-white/70 hover:bg-white/5 hover:text-white " : "text-[#1C2526]/55 hover:bg-[#F28C38]/[0.06] hover:text-[#F28C38] ") +
              (isDisabled ? "pointer-events-none opacity-50" : "")
            }
          >
            Descargar la app
          </a>
        </div>
      ) : null}
    </div>
  );
}
