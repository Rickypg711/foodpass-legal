"use client";

import { trackWebMenuDownloadClick } from "@/lib/analytics";

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
}: MenuAppRewardsCtaProps) {
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
      <p className="px-2 py-1.5 text-center text-[13px] font-semibold leading-snug text-[#1C2526]/60">
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
    <div className="overflow-hidden rounded-2xl border border-[#F28C38]/18 bg-gradient-to-br from-[#FFF8F2] to-white shadow-[0_1px_3px_rgba(28,37,38,0.05)]">
      <div className="flex items-start gap-3 p-4">
        <span
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#F28C38]/12 text-[19px]"
          aria-hidden
        >
          {reward ? "🎁" : "⭐"}
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.09em] text-[#F28C38]">
            {eyebrow}
          </p>
          <p className="mt-1 text-[17px] font-bold leading-tight text-[#1C2526]">{title}</p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-[#1C2526]/65">{explain}</p>
        </div>
      </div>

      {/* Pie discreto: las dos salidas opcionales, al mismo peso. Ninguna es
          un botón — el botón de esta página es "Ordenar", no "Descargar". */}
      {restaurantId ? (
        <div className="flex items-stretch border-t border-[#1C2526]/[0.07] text-[12.5px] font-semibold">
          <a
            href={`/menu/${encodeURIComponent(restaurantId)}/puntos`}
            className="flex-1 px-3 py-2.5 text-center text-[#1C2526]/55 transition-colors hover:bg-[#F28C38]/[0.06] hover:text-[#F28C38]"
          >
            Ver mis puntos
          </a>
          <span className="my-2 w-px bg-[#1C2526]/[0.07]" aria-hidden />
          <a
            href={href}
            onClick={handleClick}
            aria-disabled={isDisabled}
            className={
              "flex-1 px-3 py-2.5 text-center text-[#1C2526]/55 transition-colors hover:bg-[#F28C38]/[0.06] hover:text-[#F28C38] " +
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
