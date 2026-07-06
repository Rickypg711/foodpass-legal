"use client";

import { confirmRemoveCartLine } from "@/lib/cart/confirmRemoveLine";
import { useCart } from "@/lib/cart/CartProvider";
import { formatPrice } from "@/lib/priceFormat";

export function CheckoutCartLines() {
  const { lines, incrementLine, decrementLine, removeLine } = useCart();

  return (
    <ul className="mb-4 flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm">
      <li className="pb-1 text-sm font-semibold text-[#1C2526]/70">Tu pedido</li>
      {lines.map((l) => (
        <li
          key={l.menuItemId}
          className="flex items-center justify-between gap-3 border-b border-black/5 pb-3 last:border-0"
        >
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold leading-snug text-[#1C2526]">{l.name}</p>
            <p className="mt-0.5 text-xs text-[#1C2526]/55">{formatPrice(l.price)} c/u</p>
            <button
              type="button"
              aria-label={`Eliminar ${l.name}`}
              onClick={() => {
                if (confirmRemoveCartLine()) {
                  removeLine(l.menuItemId);
                }
              }}
              className="mt-1 text-xs font-medium text-[#1C2526]/45 underline underline-offset-2 transition-colors hover:text-red-700"
            >
              Quitar
            </button>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <p className="text-sm font-bold tabular-nums text-[#1C2526]">
              {formatPrice(l.subtotal)}
            </p>
            <div className="flex items-center rounded-full border border-[#1C2526]/10 bg-[#FAF7F2]">
              <button
                type="button"
                aria-label={`Quitar uno de ${l.name}`}
                onClick={() => decrementLine(l.menuItemId)}
                className="flex h-9 w-9 items-center justify-center rounded-full text-base font-semibold text-[#1C2526] transition-colors hover:bg-white"
              >
                −
              </button>
              <span className="min-w-[1.75rem] text-center text-sm font-bold tabular-nums">
                {l.quantity}
              </span>
              <button
                type="button"
                aria-label={`Agregar uno de ${l.name}`}
                onClick={() => incrementLine(l.menuItemId)}
                className="flex h-9 w-9 items-center justify-center rounded-full text-base font-semibold text-[#F28C38] transition-colors hover:bg-white"
              >
                +
              </button>
            </div>
          </div>
        </li>
      ))}
      <li className="flex items-center justify-between border-t border-black/10 pt-3">
        <span className="text-base font-bold text-[#1C2526]">Total</span>
        <span className="text-lg font-bold tabular-nums text-[#F28C38]">
          {formatPrice(lines.reduce((s, line) => s + line.subtotal, 0))}
        </span>
      </li>
    </ul>
  );
}
