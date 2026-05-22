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
  /** When false, Agregar is disabled and onAdd is not called. */
  orderingEnabled?: boolean;
};

export function MenuItemCard({
  name,
  description,
  price,
  imageUrl,
  onAdd,
  orderingEnabled = true,
}: MenuItemCardProps) {
  return (
    <li
      className="flex gap-3 rounded-[14px] bg-white p-4"
      style={{ boxShadow: "0 1px 0 rgba(28, 37, 38, 0.06)" }}
    >
      <div className="h-24 w-24 shrink-0 overflow-hidden rounded-[10px] bg-neutral-200">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt=""
            width={96}
            height={96}
            unoptimized
            className="h-24 w-24 object-cover"
          />
        ) : (
          <div className="flex h-24 w-24 items-center justify-center text-2xl text-neutral-400">
            🍽
          </div>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <p className="line-clamp-2 font-semibold text-[#1C2526]">{name}</p>
          <p className="shrink-0 text-base font-bold" style={{ color: "#F28C38" }}>
            {formatPrice(price)}
          </p>
        </div>
        {description ? (
          <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-[#1C2526]/75">
            {description}
          </p>
        ) : null}
        {orderingEnabled ? (
          <button
            type="button"
            onClick={onAdd}
            className="mt-2 self-end rounded-lg px-3 py-1.5 text-sm font-semibold text-white"
            style={{ backgroundColor: "#F28C38" }}
          >
            Agregar
          </button>
        ) : (
          <button
            type="button"
            disabled
            aria-disabled
            className="mt-2 cursor-not-allowed self-end rounded-lg px-3 py-1.5 text-sm font-semibold text-white opacity-50"
            style={{ backgroundColor: "#F28C38" }}
          >
            Agregar
          </button>
        )}
      </div>
    </li>
  );
}
