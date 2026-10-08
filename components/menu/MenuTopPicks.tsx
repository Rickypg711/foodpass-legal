"use client";

// "Lo más pedido" (8-oct-2026): una fila arriba del menú de siempre (sin
// piel) con los platillos que más se pidieron en 30 días. Sale de
// restaurants/{id}.menuSignals.topItemIds (lo escribe el backend solo con 10+
// pedidos pagados). Sin dato no se pinta. Tocar uno abre su hoja de detalle.

import Image from "next/image";
import { formatPrice } from "@/lib/priceFormat";

export type MenuTopPick = {
  id: string;
  name: string;
  price: number;
  imageUrl: string | null;
};

export function MenuTopPicks({
  items,
  onOpen,
}: {
  items: MenuTopPick[];
  onOpen: (id: string) => void;
}) {
  if (!items.length) return null;
  return (
    <section aria-labelledby="menu-top-picks" className="mb-6">
      <h2
        id="menu-top-picks"
        className="mb-2.5 flex items-baseline gap-2.5 text-lg font-bold tracking-tight text-[#1C2526]"
      >
        <span className="h-5 w-1 self-center rounded-full bg-[#F28C38]" aria-hidden />
        Lo más pedido
      </h2>
      <ul className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
        {items.map((item) => (
          <li key={item.id} className="w-32 shrink-0">
            <button
              type="button"
              onClick={() => onOpen(item.id)}
              aria-label={`Ver ${item.name}`}
              className="block w-full text-left"
            >
              {item.imageUrl ? (
                <Image
                  src={item.imageUrl}
                  alt=""
                  width={128}
                  height={96}
                  unoptimized
                  className="h-24 w-32 rounded-xl object-cover shadow-sm"
                />
              ) : (
                <div className="flex h-24 w-32 items-center justify-center rounded-xl bg-white text-2xl shadow-sm ring-1 ring-black/5" aria-hidden>
                  🍽️
                </div>
              )}
              <p className="mt-1.5 line-clamp-2 text-[13px] font-semibold leading-snug text-[#1C2526]">
                {item.name}
              </p>
              <p className="text-[13px] font-medium tabular-nums text-[#1C2526]/70">
                {formatPrice(item.price)}
              </p>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
