"use client";

import { CartProvider } from "@/lib/cart/CartProvider";
import { isWebOrderingEnabled } from "@/lib/ordering/flags";
import { WebOrderingProvider } from "@/lib/ordering/WebOrderingContext";
import { captureOrderSource } from "@/lib/order/orderAttribution";
import { useParams } from "next/navigation";
import { useEffect, type ReactNode } from "react";

export default function MenuRestaurantLayoutClient({
  children,
}: {
  children: ReactNode;
}) {
  const params = useParams();
  const restaurantId = typeof params.restaurantId === "string" ? params.restaurantId : "";

  // De dónde vino el pedido (9-oct-2026): /menu/{rid}?src=winback se recuerda
  // para este local y el checkout lo pega al pedido (lib/order/orderAttribution.ts).
  useEffect(() => {
    captureOrderSource(restaurantId);
  }, [restaurantId]);

  if (!isWebOrderingEnabled() || !restaurantId) {
    return <>{children}</>;
  }

  return (
    <WebOrderingProvider restaurantId={restaurantId}>
      <CartProvider restaurantId={restaurantId}>{children}</CartProvider>
    </WebOrderingProvider>
  );
}
