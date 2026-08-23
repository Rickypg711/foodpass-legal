"use client";

import Link from "next/link";
import { MenuAppRewardsCta } from "@/components/menu/MenuAppRewardsCta";
import { formatPrice } from "@/lib/priceFormat";
import { useCart } from "@/lib/cart/CartProvider";
import { useWebOrdering } from "@/lib/ordering/WebOrderingContext";

export function CartBar({
  restaurantId,
  restaurantName,
  firstVisitRewardLabel = null,
}: {
  restaurantId: string;
  restaurantName: string;
  firstVisitRewardLabel?: string | null;
}) {
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

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-[#1C2526]/10 bg-[#FAF7F2]/95 px-4 py-2.5 shadow-[0_-8px_32px_rgba(28,37,38,0.08)] backdrop-blur-md"
      style={{ paddingBottom: "max(10px, env(safe-area-inset-bottom))" }}
    >
      <div className="mx-auto w-full max-w-3xl lg:max-w-4xl space-y-2">
        {hasItems ? (
          <Link
            href={`/menu/${encodeURIComponent(restaurantId)}/checkout`}
            className="flex min-h-11 w-full items-center justify-between rounded-xl bg-[#F28C38] px-4 py-2.5 text-[#1C2526] shadow-md transition-colors hover:bg-[#c46644]"
          >
            <span className="text-sm font-semibold">
              {itemCount} {itemCount === 1 ? "artículo" : "artículos"}
            </span>
            <span className="text-sm font-bold tabular-nums">
              Ver carrito · {formatPrice(subtotal)}
            </span>
          </Link>
        ) : null}
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
        />
      </div>
    </div>
  );
}
