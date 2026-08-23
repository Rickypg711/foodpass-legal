"use client";

import { confirmRemoveCartLine } from "@/lib/cart/confirmRemoveLine";
import { useCart } from "@/lib/cart/CartProvider";
import { formatPrice } from "@/lib/priceFormat";
import { describeSelectedOptions } from "@/lib/cart/lineId";

export function CheckoutCartLines() {
  const { lines, incrementLine, decrementLine, removeLine, setLineNotes } = useCart();

  return (
    <ul className="mb-4 flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm">
      <li className="pb-1 text-sm font-semibold text-[#1C2526]/70">Tu pedido</li>
      {lines.map((l) => (
        <li
          key={l.lineId}
          className="border-b border-black/5 pb-3 last:border-0"
        >
          <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold leading-snug text-[#1C2526]">{l.name}</p>
            {describeSelectedOptions(l.selectedOptions) && (
              <p className="mt-0.5 text-xs font-medium text-[#F28C38]">
                {describeSelectedOptions(l.selectedOptions)}
              </p>
            )}
            <p className="mt-0.5 text-xs text-[#1C2526]/55">{formatPrice(l.price)} c/u</p>
            <button
              type="button"
              aria-label={`Eliminar ${l.name}`}
              onClick={() => {
                if (confirmRemoveCartLine()) {
                  removeLine(l.lineId);
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
                onClick={() => decrementLine(l.lineId)}
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
                onClick={() => incrementLine(l.lineId)}
                className="flex h-9 w-9 items-center justify-center rounded-full text-base font-semibold text-[#F28C38] transition-colors hover:bg-white"
              >
                +
              </button>
            </div>
          </div>
          </div>

          {/* Nota por platillo. Los menús reales traen opciones que hoy viven
              como texto en la descripción ("Elige tu salsa: ...") y el pedido
              llegaba a la cocina sin ellas. Viaja al vendor y al WhatsApp. */}
          <input
            type="text"
            maxLength={140}
            value={l.notes ?? ""}
            onChange={(e) => setLineNotes(l.lineId, e.target.value)}
            placeholder="¿Algo especial? Ej: salsa búfalo, sin cebolla"
            aria-label={`Nota para ${l.name}`}
            className="mt-2 w-full rounded-xl border border-[#1C2526]/10 bg-[#FAF7F2] px-3 py-2 text-[13px] text-[#1C2526] placeholder-[#1C2526]/35 outline-none transition-colors focus:border-[#F28C38] focus:bg-white"
          />
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
