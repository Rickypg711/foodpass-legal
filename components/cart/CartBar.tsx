"use client";

import Link from "next/link";
import { formatPrice } from "@/lib/priceFormat";
import { useCart } from "@/lib/cart/CartProvider";

export function CartBar({ restaurantId }: { restaurantId: string }) {
  const { itemCount, subtotal, cartReady } = useCart();

  if (!cartReady || itemCount === 0) {
    return null;
  }

  return (
    <div
      className="fixed bottom-0 left-0 right-0 border-t border-black/5 px-4 py-3"
      style={{
        backgroundColor: "#F0E3D2",
        paddingBottom: "max(12px, env(safe-area-inset-bottom))",
      }}
    >
      <Link
        href={`/menu/${encodeURIComponent(restaurantId)}/checkout`}
        className="mx-auto flex w-full max-w-md items-center justify-between rounded-xl bg-[#F28C38] px-4 py-3 text-white shadow-md"
      >
        <span className="text-sm font-semibold">
          {itemCount} {itemCount === 1 ? "artículo" : "artículos"}
        </span>
        <span className="text-sm font-bold">Ver carrito · {formatPrice(subtotal)}</span>
      </Link>
    </div>
  );
}
