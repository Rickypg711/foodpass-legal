"use client";

import { CartProvider } from "@/lib/cart/CartProvider";
import { isWebOrderingEnabled } from "@/lib/ordering/flags";
import { useParams } from "next/navigation";
import type { ReactNode } from "react";

export default function MenuRestaurantLayoutClient({
  children,
}: {
  children: ReactNode;
}) {
  const params = useParams();
  const restaurantId = typeof params.restaurantId === "string" ? params.restaurantId : "";

  if (!isWebOrderingEnabled() || !restaurantId) {
    return <>{children}</>;
  }

  return <CartProvider restaurantId={restaurantId}>{children}</CartProvider>;
}
