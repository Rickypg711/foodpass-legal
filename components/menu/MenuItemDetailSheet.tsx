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
import type { MenuSkinId } from "@/lib/menu/menuSkin";

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
  /** Piel del local (11-sep, Mixteco): la hoja se viste como su menú. Sin piel, la de siempre clase por clase. */
  skin?: MenuSkinId | null;
};

type DetailLook = {
  backdrop: string;
  panel: string;
  close: string;
  imageWrap: string;
  title: string;
  hint: string;
  description: string;
  price: string;
  add: string;
};

const LOOK_DEFAULT: DetailLook = {
  backdrop: "animate-backdrop-in fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center",
  panel: "animate-sheet-up relative max-h-[90vh] w-full overflow-y-auto rounded-t-3xl bg-white shadow-xl sm:max-w-md sm:rounded-3xl",
  close:
    "absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-lg text-[#1C2526]/70 shadow ring-1 ring-black/5 hover:text-[#1C2526]",
  imageWrap: "relative aspect-[4/3] w-full overflow-hidden rounded-t-3xl bg-[#FAF7F2]",
  title: "text-xl font-bold leading-tight tracking-tight text-[#1C2526]",
  hint: "mt-2 inline-flex w-fit items-center rounded-full bg-[#F28C38]/10 px-2.5 py-1 text-xs font-semibold text-[#B05E14]",
  description: "mt-2 text-[15px] leading-relaxed text-[#1C2526]/70",
  price: "text-xl font-bold tabular-nums text-[#1C2526]",
  add: "rounded-xl bg-[#F28C38] px-5 py-3 text-sm font-bold text-[#1C2526] shadow-sm transition-all hover:opacity-90 active:scale-[0.98]",
};

/** Mixteco: su hoja crema, su verde, su letra de molde (components/menu/skins/mixteco.tsx). */
const MX_DISPLAY = "[font-family:var(--mx-display),Impact,sans-serif] font-normal";
const LOOK_MIXTECO: DetailLook = {
  backdrop: "animate-backdrop-in fixed inset-0 z-50 flex items-end justify-center bg-[#0f2219]/60 sm:items-center",
  panel: "animate-sheet-up mx-sheet relative max-h-[90vh] w-full overflow-y-auto rounded-t-[22px] shadow-xl sm:max-w-md sm:rounded-[10px]",
  close:
    "absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-[#f6f5e0] text-lg text-[#234933] shadow ring-2 ring-[#234933]/20 hover:ring-[#234933]/60",
  imageWrap: "relative aspect-[4/3] w-full overflow-hidden rounded-t-[22px] bg-[#e9e7cf] sm:rounded-t-[10px]",
  title: `${MX_DISPLAY} text-[22px] uppercase leading-tight tracking-[0.1em] text-[#234933]`,
  hint: "mt-2 inline-flex w-fit items-center rounded-full bg-[#234933]/10 px-3 py-1 text-[11.5px] font-bold uppercase tracking-[0.12em] text-[#2f7a50]",
  description: "mt-2 text-[16px] leading-relaxed text-[#1f3a2b]/85",
  price: `${MX_DISPLAY} text-[22px] tracking-[0.12em] tabular-nums text-[#234933]`,
  add: `${MX_DISPLAY} rounded-full bg-[#234933] px-6 py-3 text-[14px] uppercase tracking-[0.1em] text-[#f6f5e0] shadow-[0_10px_22px_-12px_rgba(20,50,35,0.9)] transition-all hover:bg-[#1b3a28] active:scale-[0.98]`,
};

/** LasPic: su hoja blanca editorial y su serif (components/menu/skins/laspic.tsx). */
const LP_SERIF = "[font-family:var(--lp-serif),'Times_New_Roman',serif] font-normal";
const LOOK_LASPIC: DetailLook = {
  backdrop: "animate-backdrop-in fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center",
  panel: "animate-sheet-up lp-sheet relative max-h-[90vh] w-full overflow-y-auto rounded-t-[18px] shadow-xl sm:max-w-md sm:rounded-[6px]",
  close:
    "absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full border-[1.5px] border-[#141414] bg-[#fffdf8] text-lg text-[#141414] hover:bg-[#141414] hover:text-[#fffdf8]",
  imageWrap: "relative aspect-[4/3] w-full overflow-hidden rounded-t-[18px] bg-[#efe9df] sm:rounded-t-[6px]",
  title: `${LP_SERIF} text-[30px] leading-tight text-[#141414]`,
  hint: "mt-2 inline-flex w-fit items-center rounded-full border border-[#d23f2c]/40 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#d23f2c]",
  description: "mt-2 text-[16px] leading-relaxed text-[#141414]/75",
  price: "text-[22px] font-medium tabular-nums text-[#141414]",
  add: "rounded-full bg-[#141414] px-6 py-3 text-[13px] font-semibold uppercase tracking-[0.14em] text-[#fffdf8] transition-all hover:bg-black active:scale-[0.98]",
};

/** Tortas Perras: su papel hueso y el nombre en rojo versales (components/menu/skins/tortasperras.tsx). */
const TP_DISPLAY = "[font-family:var(--tp-display),'Arial_Narrow',sans-serif] font-normal";
const LOOK_TORTAS: DetailLook = {
  backdrop: "animate-backdrop-in fixed inset-0 z-50 flex items-end justify-center bg-[#3a0509]/60 sm:items-center",
  panel: "animate-sheet-up tp-sheet relative max-h-[90vh] w-full overflow-y-auto rounded-t-[18px] shadow-xl sm:max-w-md sm:rounded-[6px]",
  close:
    "absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full border-[1.5px] border-[#cf1225] bg-[#e9e7e2] text-lg text-[#cf1225] hover:bg-[#cf1225] hover:text-[#f4f1ea]",
  imageWrap: "relative aspect-[4/3] w-full overflow-hidden rounded-t-[18px] bg-[#dcd9d1] sm:rounded-t-[6px]",
  title: `${TP_DISPLAY} text-[28px] uppercase leading-tight tracking-[0.03em] text-[#cf1225]`,
  hint: "mt-2 inline-flex w-fit items-center rounded-full border border-[#cf1225]/40 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#cf1225]",
  description: "mt-2 text-[16px] leading-relaxed text-[#2b2a28]/85",
  price: "text-[22px] font-semibold tabular-nums text-[#2b2a28]",
  add: `${TP_DISPLAY} rounded-full bg-[#cf1225] px-6 py-3 text-[15px] uppercase tracking-[0.08em] text-[#f4f1ea] shadow-[0_10px_22px_-12px_rgba(120,10,15,0.9)] transition-all hover:bg-[#b3121a] active:scale-[0.98]`,
};

/** IGO: su hoja blanca con marco verde (components/menu/skins/igo.tsx). */
const IGO_NAME_D = "[font-family:var(--igo-name),'Arial_Narrow',sans-serif]";
const LOOK_IGO: DetailLook = {
  backdrop: "animate-backdrop-in fixed inset-0 z-50 flex items-end justify-center bg-[#08301a]/55 sm:items-center",
  panel: "animate-sheet-up igo-sheet relative max-h-[90vh] w-full overflow-y-auto rounded-t-[18px] shadow-xl sm:max-w-md sm:rounded-[6px]",
  close:
    "absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full border-[1.5px] border-[#0b652a] bg-[#f7f8f8] text-lg text-[#0b652a] hover:bg-[#0b652a] hover:text-[#f7f8f8]",
  imageWrap: "relative aspect-[4/3] w-full overflow-hidden rounded-t-[18px] bg-[#e8e9e6] sm:rounded-t-[6px]",
  title: `${IGO_NAME_D} text-[26px] font-medium uppercase leading-tight tracking-[0.02em] text-[#0b652a]`,
  hint: "mt-2 inline-flex w-fit items-center rounded-full border border-[#0b652a]/40 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.1em] text-[#0b652a]",
  description: "mt-2 text-[16px] italic leading-relaxed text-[#2b2b2b]/80",
  price: "text-[22px] font-semibold tabular-nums text-[#2b2b2b]",
  add: `${IGO_NAME_D} rounded-full bg-[#0b652a] px-6 py-3 text-[15px] font-medium uppercase tracking-[0.06em] text-[#f7f8f8] shadow-[0_10px_22px_-12px_rgba(11,101,42,0.9)] transition-all hover:bg-[#094f21] active:scale-[0.98]`,
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
  skin = null,
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
  const look =
    skin === "mixteco"
      ? LOOK_MIXTECO
      : skin === "laspic"
        ? LOOK_LASPIC
        : skin === "tortasperras"
          ? LOOK_TORTAS
          : skin === "igo"
            ? LOOK_IGO
            : LOOK_DEFAULT;

  return (
    <div
      className={look.backdrop}
      onClick={onClose}
      role="presentation"
    >
      <div
        className={look.panel}
        role="dialog"
        aria-modal="true"
        aria-label={name}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          aria-label="Cerrar"
          onClick={onClose}
          className={look.close}
        >
          ✕
        </button>

        {imageUrl ? (
          <div className={look.imageWrap}>
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

        <div className={imageUrl || (skin !== "mixteco" && skin !== "laspic" && skin !== "tortasperras" && skin !== "igo") ? "p-5" : "p-5 pt-6 pr-14"}>
          <h2 className={look.title}>
            {name}
          </h2>
          {optionsHint ? (
            <span className={look.hint}>
              {optionsHint}
            </span>
          ) : null}
          {description ? (
            <p className={look.description}>{description}</p>
          ) : null}
          <div className="mt-4 flex items-center justify-between gap-3">
            <p className={look.price}>{formatPrice(price)}</p>
            {orderingEnabled ? (
              <button
                type="button"
                onClick={onAdd}
                className={look.add}
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
