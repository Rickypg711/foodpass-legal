"use client";

import { confirmRemoveCartLine } from "@/lib/cart/confirmRemoveLine";
import { useCart } from "@/lib/cart/CartProvider";
import { formatPrice } from "@/lib/priceFormat";
import { describeSelectedOptions } from "@/lib/cart/lineId";
import { DEFAULT_FLOW, type FlowTheme } from "@/components/menu/skins/flowTheme";

export function CheckoutCartLines({ theme: th = DEFAULT_FLOW }: { theme?: FlowTheme }) {
  const { lines, incrementLine, decrementLine, removeLine, setLineNotes } = useCart();

  return (
    <ul className={th.cartList}>
      <li className={th.cartTitle}>Tu pedido</li>
      {lines.map((l) => (
        <li
          key={l.lineId}
          className={th.cartLine}
        >
          <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className={th.cartName}>{l.name}</p>
            {describeSelectedOptions(l.selectedOptions) && (
              <p className={th.cartOptions}>
                {describeSelectedOptions(l.selectedOptions)}
              </p>
            )}
            <p className={th.cartMuted}>{formatPrice(l.price)} c/u</p>
            <button
              type="button"
              aria-label={`Eliminar ${l.name}`}
              onClick={() => {
                if (confirmRemoveCartLine()) {
                  removeLine(l.lineId);
                }
              }}
              className={th.cartRemove}
            >
              Quitar
            </button>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <p className={th.cartSubtotal}>
              {formatPrice(l.subtotal)}
            </p>
            <div className={th.stepper}>
              <button
                type="button"
                aria-label={`Quitar uno de ${l.name}`}
                onClick={() => decrementLine(l.lineId)}
                className={th.stepperMinus}
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
                className={th.stepperPlus}
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
            className={th.cartNote}
          />
        </li>
      ))}
      <li className="flex items-center justify-between border-t border-black/10 pt-3">
        <span className={th.cartTotalLabel}>Total</span>
        <span className={th.cartTotal}>
          {formatPrice(lines.reduce((s, line) => s + line.subtotal, 0))}
        </span>
      </li>
    </ul>
  );
}
