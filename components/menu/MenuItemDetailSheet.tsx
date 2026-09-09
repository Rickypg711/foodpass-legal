"use client";

// Hoja de detalle de un platillo (9-sep-2026): tocar la tarjeta o la foto la
// abre con la imagen GRANDE, el nombre, la descripción completa y el precio.
// Paridad con la app (CustomerMenuScreen → _MenuItemDetailSheet). Cazado por
// Ricardo el día que Mi Ángel estrenó fotos: en la web tocar la foto no hacía
// nada. El "Agregar" de aquí manda al MISMO flujo que el "+" de la tarjeta
// (con opciones abre la hoja de opciones; sin opciones agrega directo).

import Image from "next/image";
import { useEffect } from "react";
import { formatPrice } from "@/lib/priceFormat";

export type MenuItemDetailSheetProps = {
  open: boolean;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  /** "🌶️ Elige tu salsa" / "Elige tamaño" — el mismo hint de la tarjeta. */
  optionsHint?: string | null;
  /** false → solo se ve (local cerrado o sin pedidos en línea). */
  orderingEnabled: boolean;
  onClose: () => void;
  onAdd: () => void;
};

export function MenuItemDetailSheet({
  open,
  name,
  description,
  price,
  imageUrl,
  optionsHint = null,
  orderingEnabled,
  onClose,
  onAdd,
}: MenuItemDetailSheetProps) {
  // Escape cierra, como cualquier hoja (el toque fuera y la ✕ también).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="animate-backdrop-in fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="animate-sheet-up relative max-h-[90vh] w-full overflow-y-auto rounded-t-3xl bg-white shadow-xl sm:max-w-md sm:rounded-3xl"
        role="dialog"
        aria-modal="true"
        aria-label={name}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          aria-label="Cerrar"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-lg text-[#1C2526]/70 shadow ring-1 ring-black/5 hover:text-[#1C2526]"
        >
          ✕
        </button>

        {imageUrl ? (
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-t-3xl bg-[#FAF7F2]">
            <Image
              src={imageUrl}
              alt={name}
              fill
              unoptimized
              sizes="(max-width: 640px) 100vw, 448px"
              className="object-cover"
              priority
            />
          </div>
        ) : null}

        <div className="p-5">
          <h2 className="text-xl font-bold leading-tight tracking-tight text-[#1C2526]">
            {name}
          </h2>
          {optionsHint ? (
            <span className="mt-2 inline-flex w-fit items-center rounded-full bg-[#F28C38]/10 px-2.5 py-1 text-xs font-semibold text-[#B05E14]">
              {optionsHint}
            </span>
          ) : null}
          {description ? (
            <p className="mt-2 text-[15px] leading-relaxed text-[#1C2526]/70">{description}</p>
          ) : null}
          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-xl font-bold tabular-nums text-[#1C2526]">{formatPrice(price)}</p>
            {orderingEnabled ? (
              <button
                type="button"
                onClick={onAdd}
                className="rounded-xl bg-[#F28C38] px-5 py-3 text-sm font-bold text-[#1C2526] shadow-sm transition-all hover:opacity-90 active:scale-[0.98]"
              >
                Agregar +
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
