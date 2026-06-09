"use client";

import Image from "next/image";
import { formatPrice } from "@/lib/priceFormat";

export type MenuItemCardProps = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  onAdd: () => void;
  quantity?: number;
  onIncrement?: () => void;
  onDecrement?: () => void;
  /** When false, no Agregar button (browse-only item card). */
  orderingEnabled?: boolean;
};

export function MenuItemCard({
  name,
  description,
  price,
  imageUrl,
  onAdd,
  quantity = 0,
  onIncrement,
  onDecrement,
  orderingEnabled = true,
}: MenuItemCardProps) {
  return (
    <li className="overflow-hidden rounded-2xl border border-[#1C2526]/[0.07] bg-white shadow-sm transition-shadow hover:shadow-md">
      <div className="flex gap-0 sm:gap-0">
        <div className="relative h-[88px] w-[88px] shrink-0 sm:h-24 sm:w-24">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt=""
              width={96}
              height={96}
              unoptimized
              className="h-full w-full object-cover"
            />
          ) : (
            <div
              className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#F5EDE2] to-[#E8DDD0] text-lg text-[#1C2526]/25"
              aria-hidden
            >
              🍽
            </div>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-between p-3.5 sm:p-4">
          <div>
            <div className="flex items-start justify-between gap-3">
              <p className="line-clamp-2 text-[15px] font-semibold leading-snug text-[#1C2526] sm:text-base">
                {name}
              </p>
              <p className="shrink-0 text-base font-bold tabular-nums text-[#d97757]">
                {formatPrice(price)}
              </p>
            </div>
            {description ? (
              <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-[#1C2526]/65">
                {description}
              </p>
            ) : null}
          </div>
          {orderingEnabled ? (
            quantity > 0 ? (
              <div className="mt-3 flex items-center gap-1 sm:mt-2.5 sm:self-end">
                <button
                  type="button"
                  aria-label={`Quitar uno de ${name}`}
                  onClick={onDecrement}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#1C2526]/10 bg-white text-lg font-semibold text-[#1C2526] transition-colors hover:bg-[#FAF7F2] active:bg-[#F5EDE2]"
                >
                  −
                </button>
                <span className="min-w-[2.25rem] text-center text-sm font-semibold tabular-nums text-[#1C2526]">
                  {quantity}
                </span>
                <button
                  type="button"
                  aria-label={`Agregar uno de ${name}`}
                  onClick={onIncrement}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#d97757] text-lg font-semibold text-white shadow-sm transition-colors hover:bg-[#c46644] active:bg-[#d67428]"
                >
                  +
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={onAdd}
                className="mt-3 min-h-10 w-full rounded-xl bg-[#d97757] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#c46644] active:bg-[#d67428] sm:mt-2.5 sm:w-auto sm:self-end"
              >
                Agregar
              </button>
            )
          ) : null}
        </div>
      </div>
    </li>
  );
}
