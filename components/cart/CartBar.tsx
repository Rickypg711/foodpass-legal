"use client";

import Link from "next/link";
import { MenuAppRewardsCta } from "@/components/menu/MenuAppRewardsCta";
import { formatPrice } from "@/lib/priceFormat";
import { useCart } from "@/lib/cart/CartProvider";
import { useWebOrdering } from "@/lib/ordering/WebOrderingContext";
import type { MenuSkinId } from "@/lib/menu/menuSkin";

export function CartBar({
  restaurantId,
  restaurantName,
  firstVisitRewardLabel = null,
  loyaltyLive = true,
  skin = null,
}: {
  restaurantId: string;
  restaurantName: string;
  firstVisitRewardLabel?: string | null;
  loyaltyLive?: boolean;
  /** Piel del local (10-sep): "pecado" pinta la barra crema con el botón rojo de su papel;
   *  "negroblanco", papel con píldora negra. */
  skin?: MenuSkinId | null;
}) {
  const pecado = skin === "pecado";
  const nb = skin === "negroblanco";
  const bl = skin === "blooms";
  const mx = skin === "mixteco";
  const lp = skin === "laspic";
  const tp = skin === "tortasperras";
  const { itemCount, subtotal, cartReady } = useCart();
  const { webOrderingAvailable, webOrderingReady } = useWebOrdering();

  // Resuelto y SIN pedidos web → la página muestra su propio dock (app CTA).
  if (webOrderingReady && !webOrderingAvailable) {
    return null;
  }

  // Mientras resuelve, el dock pinta DE UNA VEZ con el upsell de la app
  // (no depende de nada asíncrono) — solo el botón del carrito espera a
  // que el carrito hidrate. Antes todo el dock aparecía tarde.
  const hasItems = webOrderingReady && cartReady && itemCount > 0;

  // CON EL CARRITO VACÍO, esta barra NO existe.
  //
  // Su único contenido entonces era repetir el premio que el bloque de arriba
  // acaba de decir — el mismo mensaje dos veces en una pantalla, y una franja
  // fija comiéndose el menú justo cuando la persona lo está leyendo.
  //
  // Aparece cuando tiene un trabajo: ya hay algo en el carrito. Ahí el premio
  // deja de ser un dato repetido y se vuelve un empujón mientras arma el
  // pedido, junto al botón de pagar.
  if (!hasItems) return null;

  return (
    <div
      className={
        "fixed bottom-0 left-0 right-0 z-40 border-t px-4 py-2.5 backdrop-blur-md " +
        (pecado
          ? "border-[#a61c21]/20 bg-[#ffeecf]/95 shadow-[0_-8px_32px_rgba(60,10,5,0.25)]"
          : nb
            ? "border-[#0b0b0b]/10 bg-[#f4f3ef]/92 shadow-[0_-12px_36px_-16px_rgba(0,0,0,0.35)]"
            : bl
              ? "border-[#ff5c9a]/20 bg-[#fff6f4]/94 shadow-[0_-12px_36px_-16px_rgba(232,64,127,0.4)]"
              : mx
                ? "border-[#234933]/15 bg-[#f6f5e0]/95 shadow-[0_-12px_36px_-16px_rgba(20,50,35,0.55)]"
                : lp
                  ? "border-[#141414]/15 bg-[#fbf8f2]/95 shadow-[0_-12px_36px_-16px_rgba(0,0,0,0.35)]"
                  : tp
                    ? "border-[#cf1225]/20 bg-[#e9e7e2]/95 shadow-[0_-12px_36px_-16px_rgba(120,10,15,0.4)]"
            : "border-[#1C2526]/10 bg-[#FAF7F2]/95 shadow-[0_-8px_32px_rgba(28,37,38,0.08)]")
      }
      style={{ paddingBottom: "max(10px, env(safe-area-inset-bottom))" }}
    >
      <div className="mx-auto w-full max-w-3xl lg:max-w-4xl space-y-2">
        <Link
          href={`/menu/${encodeURIComponent(restaurantId)}/checkout`}
          className={
            pecado
              ? "flex min-h-11 w-full items-center justify-between rounded-full bg-[#a61c21] px-5 py-2.5 text-[#ffeecf] shadow-[0_3px_0_#7a1014] transition-colors hover:bg-[#8f151a]"
              : nb
                ? "flex min-h-12 w-full items-center justify-between rounded-full bg-[#0b0b0b] px-5 py-3 text-white transition-transform hover:scale-[1.005] active:scale-[0.995]"
                : bl
                  ? "flex min-h-12 w-full items-center justify-between rounded-full bg-[#ff5c9a] px-5 py-3 text-white shadow-[0_10px_24px_-10px_rgba(255,92,154,0.95)] transition-transform hover:scale-[1.005] active:scale-[0.995]"
                  : mx
                    ? "flex min-h-12 w-full items-center justify-between rounded-full bg-[#234933] px-5 py-3 text-[#f6f5e0] shadow-[0_10px_24px_-10px_rgba(20,50,35,0.9)] transition-transform hover:scale-[1.005] active:scale-[0.995]"
                    : lp
                      ? "flex min-h-12 w-full items-center justify-between rounded-full bg-[#141414] px-5 py-3 text-[#fbf8f2] shadow-[0_10px_24px_-12px_rgba(0,0,0,0.8)] transition-transform hover:scale-[1.005] active:scale-[0.995]"
                      : tp
                        ? "flex min-h-12 w-full items-center justify-between rounded-full bg-[#cf1225] px-5 py-3 text-[#f4f1ea] shadow-[0_10px_24px_-12px_rgba(120,10,15,0.9)] transition-transform hover:scale-[1.005] active:scale-[0.995]"
                : "flex min-h-11 w-full items-center justify-between rounded-xl bg-[#F28C38] px-4 py-2.5 text-[#1C2526] shadow-md transition-colors hover:bg-[#c46644]"
          }
        >
          <span
            className={
              pecado
                ? "[font-family:var(--pc-name),'Arial_Narrow',sans-serif] text-[16px] font-extrabold uppercase tracking-wide"
                : nb
                  ? "[font-family:var(--nb-mono),ui-monospace,monospace] text-[11.5px] uppercase tracking-[0.16em] text-white/75"
                  : bl
                    ? "text-[12px] font-extrabold uppercase tracking-[0.14em] text-white/85"
                    : mx
                      ? "[font-family:var(--mx-display),Impact,sans-serif] text-[12px] uppercase tracking-[0.14em] text-[#f6f5e0]/85"
                      : lp
                        ? "text-[12px] font-semibold uppercase tracking-[0.16em] text-[#fbf8f2]/80"
                        : tp
                          ? "[font-family:var(--tp-display),'Arial_Narrow',sans-serif] text-[13px] uppercase tracking-[0.1em] text-[#f4f1ea]/85"
                  : "text-sm font-semibold"
            }
          >
            {itemCount} {itemCount === 1 ? "artículo" : "artículos"}
          </span>
          <span
            className={
              pecado
                ? "[font-family:var(--pc-name),'Arial_Narrow',sans-serif] text-[16px] font-extrabold uppercase italic tabular-nums tracking-wide"
                : nb
                  ? "text-[15px] font-semibold tabular-nums tracking-[-0.01em]"
                  : bl
                    ? "text-[15px] font-extrabold tabular-nums"
                    : mx
                      ? "[font-family:var(--mx-display),Impact,sans-serif] text-[14px] tracking-[0.08em] tabular-nums"
                      : lp
                        ? "text-[15px] font-semibold tabular-nums tracking-[0.04em]"
                        : tp
                          ? "[font-family:var(--tp-display),'Arial_Narrow',sans-serif] text-[15px] tracking-[0.06em] tabular-nums"
                  : "text-sm font-bold tabular-nums"
            }
          >
            Ver carrito · {formatPrice(subtotal)}
          </span>
        </Link>
        {/* SIEMPRE compacto, con o sin carrito.
            Antes, con el carrito vacío salía la versión rica — un bloque de
            ~140px fijo abajo, que se come casi el 20% de la pantalla de un
            teléfono MIENTRAS la persona está leyendo el menú, y que nunca se
            va. Es el mismo problema que ya se había arreglado en el dock de
            "cerrado" y que aquí se quedó suelto.
            La versión rica ahora vive en el FLUJO de la página, arriba: ahí
            empuja en vez de tapar, se lee al entrar, y se va con el scroll. */}
        <MenuAppRewardsCta
          restaurantId={restaurantId}
          restaurantName={restaurantName}
          variant="compact"
          firstVisitRewardLabel={firstVisitRewardLabel}
          loyaltyLive={loyaltyLive}
          skin={skin}
        />
      </div>
    </div>
  );
}
