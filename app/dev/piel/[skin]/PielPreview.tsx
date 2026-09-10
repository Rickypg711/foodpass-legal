"use client";

import MenuView from "@/app/menu/[restaurantId]/MenuView";
import { CartProvider } from "@/lib/cart/CartProvider";
import { WebOrderingPreviewProvider } from "@/lib/ordering/WebOrderingContext";
import { pielFixture } from "../fixtures";

export function PreviewTag() {
  return (
    <p className="pointer-events-none fixed right-2 top-2 z-[60] rounded-full bg-[#fe3030] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white shadow-lg">
      Vista previa · precios de muestra
    </p>
  );
}

export default function PielPreview({ skin }: { skin: string }) {
  const fx = pielFixture(skin);
  if (!fx) return <p className="p-8 text-sm">No hay vista previa para la piel &quot;{skin}&quot;.</p>;
  return (
    <WebOrderingPreviewProvider>
      <CartProvider restaurantId={fx.id}>
        <PreviewTag />
        <MenuView restaurantId={fx.id} initial={fx.initial} preview />
      </CartProvider>
    </WebOrderingPreviewProvider>
  );
}
