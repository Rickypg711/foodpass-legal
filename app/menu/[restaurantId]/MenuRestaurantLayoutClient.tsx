"use client";

import { CartProvider } from "@/lib/cart/CartProvider";
import { isWebOrderingEnabled } from "@/lib/ordering/flags";
import { WebOrderingProvider } from "@/lib/ordering/WebOrderingContext";
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

  return (
    <WebOrderingProvider restaurantId={restaurantId}>
      <CartProvider restaurantId={restaurantId}>{children}</CartProvider>
    </WebOrderingProvider>
  );
}
