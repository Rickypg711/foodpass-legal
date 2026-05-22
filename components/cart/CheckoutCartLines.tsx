"use client";

import { confirmRemoveCartLine } from "@/lib/cart/confirmRemoveLine";
import { useCart } from "@/lib/cart/CartProvider";
import { formatPrice } from "@/lib/priceFormat";

export function CheckoutCartLines() {
  const { lines, incrementLine, decrementLine, removeLine } = useCart();

  return (
    <ul className="mb-6 flex flex-col gap-3 rounded-xl bg-white p-4">
      {lines.map((l) => (
        <li
          key={l.menuItemId}
          className="flex flex-col gap-2 border-b border-black/5 pb-3 last:border-0 last:pb-0"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[#1C2526]">{l.name}</p>
              <p className="text-xs text-[#1C2526]/65">{formatPrice(l.price)} c/u</p>
            </div>
            <p className="shrink-0 text-sm font-bold" style={{ color: "#F28C38" }}>
              {formatPrice(l.subtotal)}
            </p>
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label={`Quitar uno de ${l.name}`}
                onClick={() => decrementLine(l.menuItemId)}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-black/10 text-lg font-semibold text-[#1C2526]"
              >
                −
              </button>
              <span className="min-w-[2rem] text-center text-sm font-semibold">
                {l.quantity}
              </span>
              <button
                type="button"
                aria-label={`Agregar uno de ${l.name}`}
                onClick={() => incrementLine(l.menuItemId)}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-black/10 text-lg font-semibold text-[#1C2526]"
              >
                +
              </button>
            </div>
            <button
              type="button"
              aria-label={`Eliminar ${l.name}`}
              onClick={() => {
                if (confirmRemoveCartLine()) {
                  removeLine(l.menuItemId);
                }
              }}
              className="text-xs font-semibold text-red-700 underline"
            >
              Eliminar
            </button>
          </div>
        </li>
      ))}
      <li className="flex justify-between border-t border-black/10 pt-3 font-bold">
        <span>Total</span>
        <span style={{ color: "#F28C38" }}>
          {formatPrice(lines.reduce((s, line) => s + line.subtotal, 0))}
        </span>
      </li>
    </ul>
  );
}
