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

  if (!webOrderingReady || !webOrderingAvailable || !cartReady) {
    return null;
  }

  const hasItems = itemCount > 0;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-[#1C2526]/10 bg-[#FAF7F2]/95 px-4 py-2.5 shadow-[0_-8px_32px_rgba(28,37,38,0.08)] backdrop-blur-md"
      style={{ paddingBottom: "max(10px, env(safe-area-inset-bottom))" }}
    >
      <div className="mx-auto w-full max-w-3xl lg:max-w-4xl space-y-2">
        {hasItems ? (
          <Link
            href={`/menu/${encodeURIComponent(restaurantId)}/checkout`}
            className="flex min-h-11 w-full items-center justify-between rounded-xl bg-[#F28C38] px-4 py-2.5 text-white shadow-md transition-colors hover:bg-[#c46644]"
          >
            <span className="text-sm font-semibold">
              {itemCount} {itemCount === 1 ? "artículo" : "artículos"}
            </span>
            <span className="text-sm font-bold tabular-nums">
              Ver carrito · {formatPrice(subtotal)}
            </span>
          </Link>
        ) : null}
        <MenuAppRewardsCta
          restaurantId={restaurantId}
          restaurantName={restaurantName}
          variant={hasItems ? "compact" : "prominent"}
          firstVisitRewardLabel={firstVisitRewardLabel}
        />
      </div>
    </div>
  );
}
