"use client";

// Menu item card — modern food-ordering pattern (text left, square image
// right, add control anchored to the image corner), like the big delivery
// apps but in Comeleal's brand. Handles missing images gracefully: the text
// simply spans the card and the add control sits at the right edge.

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

function AddButton({ name, onAdd }: { name: string; onAdd: () => void }) {
  return (
    <button
      type="button"
      aria-label={`Agregar ${name}`}
      onClick={onAdd}
      className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-xl font-semibold text-[#F28C38] shadow-[0_2px_10px_rgba(28,37,38,0.18)] ring-1 ring-black/5 transition-transform hover:scale-105 active:scale-95"
    >
      +
    </button>
  );
}

function QuantityStepper({
  name,
  quantity,
  onIncrement,
  onDecrement,
}: {
  name: string;
  quantity: number;
  onIncrement?: () => void;
  onDecrement?: () => void;
}) {
  return (
    <div className="flex items-center rounded-full bg-white shadow-[0_2px_10px_rgba(28,37,38,0.18)] ring-1 ring-black/5">
      <button
        type="button"
        aria-label={`Quitar uno de ${name}`}
        onClick={onDecrement}
        className="flex h-10 w-10 items-center justify-center rounded-full text-lg font-semibold text-[#1C2526] transition-colors hover:bg-[#FAF7F2]"
      >
        −
      </button>
      <span className="min-w-[1.5rem] text-center text-sm font-bold tabular-nums text-[#1C2526]">
        {quantity}
      </span>
      <button
        type="button"
        aria-label={`Agregar uno de ${name}`}
        onClick={onIncrement}
        className="flex h-10 w-10 items-center justify-center rounded-full text-lg font-semibold text-[#F28C38] transition-colors hover:bg-[#FFF3E8]"
      >
        +
      </button>
    </div>
  );
}

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
  const control = !orderingEnabled ? null : quantity > 0 ? (
    <QuantityStepper
      name={name}
      quantity={quantity}
      onIncrement={onIncrement}
      onDecrement={onDecrement}
    />
  ) : (
    <AddButton name={name} onAdd={onAdd} />
  );

  return (
    <li className="rounded-2xl border border-[#1C2526]/[0.06] bg-white p-3 shadow-sm transition-shadow hover:shadow-md sm:p-3.5">
      <div className="flex items-stretch gap-3">
        {/* Text block */}
        <div className="flex min-w-0 flex-1 flex-col py-0.5">
          <p className="line-clamp-2 text-[15px] font-semibold leading-snug text-[#1C2526] sm:text-base">
            {name}
          </p>
          {description ? (
            <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-[#1C2526]/60">
              {description}
            </p>
          ) : null}
          <p className="mt-auto pt-2 text-[15px] font-bold tabular-nums text-[#1C2526]">
            {formatPrice(price)}
          </p>
        </div>

        {/* Image block with the add control anchored to its corner */}
        {imageUrl ? (
          <div className="relative h-[104px] w-[104px] shrink-0 sm:h-28 sm:w-28">
            <Image
              src={imageUrl}
              alt=""
              width={112}
              height={112}
              unoptimized
              className="h-full w-full rounded-xl object-cover"
            />
            {control ? (
              <div className="absolute -bottom-1.5 -right-1.5">{control}</div>
            ) : null}
          </div>
        ) : control ? (
          <div className="flex shrink-0 items-center pl-1">{control}</div>
        ) : null}
      </div>
    </li>
  );
}
