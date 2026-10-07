"use client";

// Hoja para elegir las opciones de un platillo antes de agregarlo al carrito
// (salsa, aderezo, extras). Aparece solo si el platillo TIENE grupos; si no,
// el "+" sigue agregando directo como siempre.

import { useMemo, useState } from "react";
import { formatPrice } from "@/lib/priceFormat";
import {
  groupHasAvailableOption,
  isOptionAvailable,
  type MenuItemOptionGroup,
} from "@/lib/menu/optionGroups";
import type { SelectedOptionGroup } from "@/lib/cart/types";
import type { MenuSkinId } from "@/lib/menu/menuSkin";

export type ItemOptionsSheetProps = {
  open: boolean;
  itemName: string;
  basePrice: number;
  groups: MenuItemOptionGroup[];
  /**
   * Opciones que ya vienen elegidas al abrir (6-oct-2026, piel omu): tocar la pastilla "Pareja" del boneless
   * abre la hoja con Pareja marcado y solo falta la salsa. `{ [groupId]: [optionId] }`. Debe ser un objeto
   * estable (vive en el estado de quien abre la hoja), no uno nuevo en cada render.
   */
  initialPicked?: Record<string, string[]> | null;
  onCancel: () => void;
  /**
   * `quantity` = cuántos IGUALES se agregan de un jalón (el "− 1 +" de la hoja).
   * Nació el 10-sep-2026 con La Familia: 3 toritos de campechano eran abrir la
   * hoja 3 veces. Quien use la hoja TIENE que respetarlo (candado en
   * validate-cart-options): si lo ignora, el cliente pide 3 y le llega 1.
   */
  onConfirm: (selected: SelectedOptionGroup[], quantity: number) => void;
  /**
   * Solo en la Caja: prende/apaga una opción ("agotado hoy") desde la misma hoja
   * con la que el cajero ordena. El menú del cliente NO lo pasa: ahí la opción
   * apagada solo se ve tachada. Se guarda al momento, no hay "guardar".
   */
  onToggleAvailability?: (groupId: string, optionId: string, available: boolean) => void;
  /**
   * Piel del local (11-sep, Mixteco): la hoja por la que pasa CADA pedido se viste como su menú. Solo el menú del
   * cliente la pasa; la Caja no, y sin piel la hoja es la de siempre, clase por clase.
   */
  skin?: MenuSkinId | null;
};

/** Tope del "− 1 +": más que esto es un pedido de evento, no un toque de más. */
const MAX_QTY = 99;

/** La ropa de la hoja. La lógica (qué falta, cuánto cuesta, cuántos) no cambia con la piel. */
type SheetLook = {
  backdrop: string;
  panel: string;
  title: string;
  subtitle: string;
  groupName: string;
  status: (falta: boolean) => string;
  hasta: string;
  option: (disponible: boolean, on: boolean) => string;
  delta: (on: boolean) => string;
  footer: string;
  qtyLabel: string;
  qtyBtn: string;
  qtyNum: string;
  cancel: string;
  confirm: string;
};

const LOOK_DEFAULT: SheetLook = {
  backdrop: "animate-backdrop-in fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center",
  panel: "animate-sheet-up max-h-[85vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-xl sm:max-w-md sm:rounded-3xl",
  title: "text-lg font-bold text-[#1C2526]",
  subtitle: "text-sm text-[#1C2526]/50",
  groupName: "text-sm font-bold text-[#1C2526]",
  status: (falta) => `text-[11px] font-semibold ${falta ? "text-[#F28C38]" : "text-[#1C2526]/35"}`,
  hasta: "text-[11px] text-[#1C2526]/35",
  option: (disponible, on) =>
    `flex items-center justify-between rounded-xl border px-3 py-2.5 text-left text-sm transition-colors ${
      !disponible
        ? "cursor-not-allowed border-[#1C2526]/8 bg-[#FAF7F2] text-[#1C2526]/35 line-through"
        : on
          ? "border-[#F28C38] bg-[#F28C38]/8 font-semibold text-[#1C2526]"
          : "border-[#1C2526]/10 bg-[#FAF7F2] text-[#1C2526]/80 hover:border-[#1C2526]/25"
    }`,
  delta: () => "text-xs font-semibold text-[#F28C38]",
  footer: "sticky bottom-0 -mx-5 mt-2 border-t border-black/5 bg-white px-5 pb-1 pt-3",
  qtyLabel: "text-sm font-semibold text-[#1C2526]/70",
  qtyBtn:
    "h-10 w-10 rounded-full border border-[#1C2526]/15 text-lg font-bold text-[#1C2526] transition-colors hover:bg-[#FAF7F2] disabled:opacity-30",
  qtyNum: "w-7 text-center text-base font-bold tabular-nums text-[#1C2526]",
  cancel:
    "rounded-xl border border-[#1C2526]/12 px-4 py-3 text-sm font-semibold text-[#1C2526]/70 transition-colors hover:bg-[#FAF7F2]",
  confirm:
    "flex-1 rounded-xl bg-[#F28C38] py-3 text-sm font-bold text-[#1C2526] transition-colors hover:bg-[#c46644] disabled:cursor-not-allowed disabled:opacity-45",
};

/** Mixteco: su hoja crema, su verde, su letra de molde (components/menu/skins/mixteco.tsx). */
const MX_DISPLAY = "[font-family:var(--mx-display),Impact,sans-serif] font-normal";
const LOOK_MIXTECO: SheetLook = {
  backdrop: "animate-backdrop-in fixed inset-0 z-50 flex items-end justify-center bg-[#0f2219]/60 sm:items-center",
  panel: "animate-sheet-up mx-sheet max-h-[85vh] w-full overflow-y-auto rounded-t-[22px] p-5 shadow-xl sm:max-w-md sm:rounded-[10px]",
  title: `${MX_DISPLAY} text-[20px] uppercase leading-tight tracking-[0.1em] text-[#234933]`,
  subtitle: "mt-0.5 text-[15px] text-[#1f3a2b]/75",
  groupName: `${MX_DISPLAY} text-[14px] uppercase tracking-[0.14em] text-[#234933]`,
  status: (falta) => `text-[11.5px] font-bold uppercase tracking-[0.1em] ${falta ? "text-[#8a3f22]" : "text-[#2f7a50]"}`,
  hasta: "text-[12px] text-[#1f3a2b]/70",
  option: (disponible, on) =>
    `flex items-center justify-between rounded-full border-2 px-4 py-2.5 text-left text-[15px] transition-colors ${
      !disponible
        ? "cursor-not-allowed border-[#234933]/10 bg-white/40 text-[#1f3a2b]/35 line-through"
        : on
          ? "border-[#234933] bg-[#234933] font-semibold text-[#f6f5e0]"
          : "border-[#234933]/20 bg-white/60 text-[#1f3a2b] hover:border-[#234933]/60"
    }`,
  delta: (on) => `text-[13px] font-bold ${on ? "text-[#cfe3cb]" : "text-[#2f7a50]"}`,
  footer: "sticky bottom-0 -mx-5 mt-2 border-t border-[#234933]/15 bg-[#f6f5e0] px-5 pb-1 pt-3",
  qtyLabel: "text-[14px] font-semibold text-[#1f3a2b]/80",
  qtyBtn:
    "h-10 w-10 rounded-full border-2 border-[#234933]/30 text-lg font-bold text-[#234933] transition-colors hover:bg-[#234933]/10 disabled:opacity-30",
  qtyNum: "w-7 text-center text-base font-bold tabular-nums text-[#234933]",
  cancel:
    "rounded-full border-2 border-[#234933]/25 px-4 py-3 text-sm font-semibold text-[#1f3a2b]/80 transition-colors hover:bg-[#234933]/10",
  confirm: `${MX_DISPLAY} flex-1 rounded-full bg-[#234933] py-3 text-[14px] uppercase tracking-[0.1em] text-[#f6f5e0] transition-colors hover:bg-[#1b3a28] disabled:cursor-not-allowed disabled:opacity-45`,
};

/** LasPic: su hoja blanca editorial, su serif, píldoras negras (components/menu/skins/laspic.tsx). */
const LP_SERIF = "[font-family:var(--lp-serif),'Times_New_Roman',serif] font-normal";
const LOOK_LASPIC: SheetLook = {
  backdrop: "animate-backdrop-in fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center",
  panel: "animate-sheet-up lp-sheet max-h-[85vh] w-full overflow-y-auto rounded-t-[18px] p-5 shadow-xl sm:max-w-md sm:rounded-[6px]",
  title: `${LP_SERIF} text-[28px] leading-tight text-[#141414]`,
  subtitle: "text-[14px] text-[#141414]/60",
  groupName: "text-[12.5px] font-semibold uppercase tracking-[0.16em] text-[#141414]",
  status: (falta) => `text-[11px] font-semibold uppercase tracking-[0.1em] ${falta ? "text-[#d23f2c]" : "text-[#141414]/45"}`,
  hasta: "text-[12px] text-[#141414]/55",
  option: (disponible, on) =>
    `flex items-center justify-between rounded-full border-[1.5px] px-4 py-2.5 text-left text-[15px] transition-colors ${
      !disponible
        ? "cursor-not-allowed border-[#141414]/10 text-[#141414]/35 line-through"
        : on
          ? "border-[#141414] bg-[#141414] font-medium text-[#fffdf8]"
          : "border-[#141414]/25 bg-transparent text-[#141414] hover:border-[#141414]"
    }`,
  delta: (on) => `text-[13px] font-semibold ${on ? "text-[#f2c230]" : "text-[#d23f2c]"}`,
  footer: "sticky bottom-0 -mx-5 mt-2 border-t border-[#141414]/15 bg-[#fffdf8] px-5 pb-1 pt-3",
  qtyLabel: "text-[14px] font-medium text-[#141414]/75",
  qtyBtn:
    "h-10 w-10 rounded-full border-[1.5px] border-[#141414]/40 text-lg font-semibold text-[#141414] transition-colors hover:bg-[#141414]/5 disabled:opacity-30",
  qtyNum: "w-7 text-center text-base font-semibold tabular-nums text-[#141414]",
  cancel:
    "rounded-full border-[1.5px] border-[#141414]/30 px-4 py-3 text-sm font-medium text-[#141414]/80 transition-colors hover:bg-[#141414]/5",
  confirm:
    "flex-1 rounded-full bg-[#141414] py-3 text-[13px] font-semibold uppercase tracking-[0.14em] text-[#fffdf8] transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-45",
};

/** Tortas Perras: su papel hueso, nombres en rojo versales (components/menu/skins/tortasperras.tsx). */
const TP_DISPLAY = "[font-family:var(--tp-display),'Arial_Narrow',sans-serif] font-normal";
const LOOK_TORTAS: SheetLook = {
  backdrop: "animate-backdrop-in fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center",
  panel: "animate-sheet-up tp-sheet max-h-[85vh] w-full overflow-y-auto rounded-t-[18px] p-5 shadow-xl sm:max-w-md sm:rounded-[6px]",
  title: `${TP_DISPLAY} text-[26px] uppercase leading-tight tracking-[0.03em] text-[#cf1225]`,
  subtitle: "text-[14px] text-[#2b2a28]/65",
  groupName: "text-[12px] font-bold uppercase tracking-[0.14em] text-[#2b2a28]",
  status: (falta) => `text-[11px] font-bold uppercase tracking-[0.1em] ${falta ? "text-[#cf1225]" : "text-[#2b2a28]/45"}`,
  hasta: "text-[12px] text-[#2b2a28]/55",
  option: (disponible, on) =>
    `flex items-center justify-between rounded-full border-[1.5px] px-4 py-2.5 text-left text-[15px] transition-colors ${
      !disponible
        ? "cursor-not-allowed border-[#2b2a28]/10 text-[#2b2a28]/35 line-through"
        : on
          ? "border-[#cf1225] bg-[#cf1225] font-semibold text-[#f4f1ea]"
          : "border-[#2b2a28]/25 bg-transparent text-[#2b2a28] hover:border-[#cf1225]"
    }`,
  delta: (on) => `text-[13px] font-semibold ${on ? "text-[#f4f1ea]" : "text-[#cf1225]"}`,
  footer: "sticky bottom-0 -mx-5 mt-2 border-t border-[#2b2a28]/15 bg-[#e9e7e2] px-5 pb-1 pt-3",
  qtyLabel: "text-[14px] font-medium text-[#2b2a28]/75",
  qtyBtn:
    "h-10 w-10 rounded-full border-[1.5px] border-[#2b2a28]/35 text-lg font-semibold text-[#2b2a28] transition-colors hover:bg-[#2b2a28]/5 disabled:opacity-30",
  qtyNum: "w-7 text-center text-base font-semibold tabular-nums text-[#2b2a28]",
  cancel:
    "rounded-full border-[1.5px] border-[#2b2a28]/30 px-4 py-3 text-sm font-medium text-[#2b2a28]/80 transition-colors hover:bg-[#2b2a28]/5",
  confirm: `${TP_DISPLAY} flex-1 rounded-full bg-[#cf1225] py-3 text-[14px] uppercase tracking-[0.08em] text-[#f4f1ea] transition-colors hover:bg-[#b3121a] disabled:cursor-not-allowed disabled:opacity-45`,
};

/** IGO: su hoja blanca con marco verde y la etiqueta verde (components/menu/skins/igo.tsx). */
const IGO_NAME = "[font-family:var(--igo-name),'Arial_Narrow',sans-serif]";
const LOOK_IGO: SheetLook = {
  backdrop: "animate-backdrop-in fixed inset-0 z-50 flex items-end justify-center bg-[#08301a]/55 sm:items-center",
  panel: "animate-sheet-up igo-sheet max-h-[85vh] w-full overflow-y-auto rounded-t-[18px] p-5 shadow-xl sm:max-w-md sm:rounded-[6px]",
  title: `${IGO_NAME} text-[24px] font-medium uppercase leading-tight tracking-[0.02em] text-[#0b652a]`,
  subtitle: "text-[14px] italic text-[#2b2b2b]/65",
  groupName: `${IGO_NAME} text-[13px] font-medium uppercase tracking-[0.1em] text-[#2b2b2b]`,
  status: (falta) => `text-[11px] font-bold uppercase tracking-[0.1em] ${falta ? "text-[#0b652a]" : "text-[#2b2b2b]/45"}`,
  hasta: "text-[12px] text-[#2b2b2b]/55",
  option: (disponible, on) =>
    `flex items-center justify-between rounded-full border-[1.5px] px-4 py-2.5 text-left text-[15px] transition-colors ${
      !disponible
        ? "cursor-not-allowed border-[#2b2b2b]/10 text-[#2b2b2b]/35 line-through"
        : on
          ? "border-[#0b652a] bg-[#0b652a] font-semibold text-[#f7f8f8]"
          : "border-[#2b2b2b]/25 bg-transparent text-[#2b2b2b] hover:border-[#0b652a]"
    }`,
  delta: (on) => `text-[13px] font-semibold ${on ? "text-[#f7f8f8]" : "text-[#0b652a]"}`,
  footer: "sticky bottom-0 -mx-5 mt-2 border-t border-[#0b652a]/20 bg-[#f7f8f8] px-5 pb-1 pt-3",
  qtyLabel: "text-[14px] font-medium text-[#2b2b2b]/75",
  qtyBtn:
    "h-10 w-10 rounded-full border-[1.5px] border-[#0b652a]/40 text-lg font-semibold text-[#0b652a] transition-colors hover:bg-[#0b652a]/10 disabled:opacity-30",
  qtyNum: "w-7 text-center text-base font-semibold tabular-nums text-[#0b652a]",
  cancel:
    "rounded-full border-[1.5px] border-[#2b2b2b]/30 px-4 py-3 text-sm font-medium text-[#2b2b2b]/80 transition-colors hover:bg-[#2b2b2b]/5",
  confirm: `${IGO_NAME} flex-1 rounded-full bg-[#0b652a] py-3 text-[15px] font-medium uppercase tracking-[0.06em] text-[#f7f8f8] transition-colors hover:bg-[#094f21] disabled:cursor-not-allowed disabled:opacity-45`,
};

/** Omu: tarjeta blanca con cabecera roja sobre su hoja negra (components/menu/skins/omu.tsx). */
const OMU_NAME_S = "[font-family:var(--omu-sans),Montserrat,system-ui,sans-serif]";
const LOOK_OMU: SheetLook = {
  backdrop: "animate-backdrop-in fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center",
  panel: "animate-sheet-up max-h-[85vh] w-full overflow-y-auto rounded-t-[18px] bg-[#f9f8f8] p-5 text-[#151311] shadow-xl sm:max-w-md sm:rounded-[10px]",
  title: `${OMU_NAME_S} text-[22px] font-extrabold uppercase leading-tight tracking-[0.01em] text-[#151311]`,
  subtitle: "text-[13px] font-medium uppercase tracking-[0.03em] text-[#151311]/65",
  groupName: `${OMU_NAME_S} text-[12px] font-extrabold uppercase tracking-[0.08em] text-[#d40607]`,
  status: (falta) => `text-[11px] font-extrabold uppercase tracking-[0.1em] ${falta ? "text-[#d40607]" : "text-[#151311]/45"}`,
  hasta: "text-[12px] text-[#151311]/55",
  option: (disponible, on) =>
    `flex items-center justify-between rounded-full border-2 px-4 py-2.5 text-left text-[14px] font-bold uppercase tracking-[0.01em] transition-colors ${
      !disponible
        ? "cursor-not-allowed border-[#151311]/10 text-[#151311]/35 line-through"
        : on
          ? "border-[#f10809] bg-[#f10809] text-[#f9f8f8]"
          : "border-[#151311]/20 bg-transparent text-[#151311] hover:border-[#f10809]"
    }`,
  delta: (on) => `text-[13px] font-extrabold ${on ? "text-[#f9f8f8]" : "text-[#d40607]"}`,
  footer: "sticky bottom-0 -mx-5 mt-2 border-t border-[#151311]/10 bg-[#f9f8f8] px-5 pb-1 pt-3",
  qtyLabel: "text-[14px] font-semibold text-[#151311]/75",
  qtyBtn:
    "h-10 w-10 rounded-full border-2 border-[#151311]/30 text-lg font-bold text-[#151311] transition-colors hover:bg-[#151311]/5 disabled:opacity-30",
  qtyNum: "w-7 text-center text-base font-extrabold tabular-nums text-[#151311]",
  cancel:
    "rounded-full border-2 border-[#151311]/25 px-4 py-3 text-sm font-semibold text-[#151311]/80 transition-colors hover:bg-[#151311]/5",
  confirm: `${OMU_NAME_S} flex-1 rounded-full bg-[#f10809] py-3 text-[14px] font-extrabold uppercase tracking-[0.06em] text-[#f9f8f8] transition-colors hover:bg-[#d40607] disabled:cursor-not-allowed disabled:opacity-45`,
};

/** Kame: hoja verde pizarrón con títulos amarillos y píldoras doradas (components/menu/skins/kame.tsx). */
const KAME_NAME_S = "[font-family:var(--kame-display),'League_Spartan',Futura,sans-serif]";
const LOOK_KAME: SheetLook = {
  backdrop: "animate-backdrop-in fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center",
  panel: "animate-sheet-up max-h-[85vh] w-full overflow-y-auto rounded-t-[24px] border-t-4 border-[#f7cf1d] bg-[#263532] p-5 text-[#fbf3d0] shadow-xl sm:max-w-md sm:rounded-[20px] sm:border-4",
  title: `${KAME_NAME_S} text-[26px] font-black uppercase leading-none text-[#f7cf1d]`,
  subtitle: "text-[14px] leading-snug text-[#d8b25a]",
  groupName: `${KAME_NAME_S} text-[13px] font-bold uppercase tracking-[0.1em] text-[#f0dc78]`,
  status: (falta) => `${KAME_NAME_S} text-[11px] font-bold uppercase tracking-[0.1em] ${falta ? "text-[#ff8f7a]" : "text-[#fbf3d0]/50"}`,
  hasta: "text-[12px] text-[#fbf3d0]/60",
  option: (disponible, on) =>
    `flex items-center justify-between rounded-full border-[1.5px] px-4 py-2.5 text-left text-[15px] font-semibold transition-colors ${
      !disponible
        ? "cursor-not-allowed border-[#fbf3d0]/10 text-[#fbf3d0]/35 line-through"
        : on
          ? "border-[#f7cf1d] bg-[#f7cf1d] text-[#263532]"
          : "border-[#f0dc78]/30 bg-transparent text-[#fbf3d0] hover:border-[#f7cf1d]"
    }`,
  delta: (on) => `text-[13px] font-bold ${on ? "text-[#263532]" : "text-[#edb64a]"}`,
  footer: "sticky bottom-0 -mx-5 mt-2 border-t border-[#efd250]/20 bg-[#263532] px-5 pb-1 pt-3",
  qtyLabel: "text-[14px] font-semibold text-[#fbf3d0]/80",
  qtyBtn:
    "h-10 w-10 rounded-full border-[1.5px] border-[#f0dc78]/40 text-lg font-bold text-[#f0dc78] transition-colors hover:bg-[#f0dc78]/10 disabled:opacity-30",
  qtyNum: `${KAME_NAME_S} w-7 text-center text-[17px] font-bold tabular-nums text-[#fbf3d0]`,
  cancel:
    "rounded-full border-[1.5px] border-[#fbf3d0]/30 px-4 py-3 text-sm font-semibold text-[#fbf3d0]/85 transition-colors hover:bg-[#fbf3d0]/10",
  confirm: `${KAME_NAME_S} flex-1 rounded-full bg-[#f7cf1d] pb-2.5 pt-3.5 text-[15px] font-black uppercase tracking-[0.06em] text-[#263532] transition-colors hover:bg-[#ffe04a] disabled:cursor-not-allowed disabled:opacity-45`,
};

/** Suadero: plato blanco con letras de madera y botones rojo sombrero (components/menu/skins/suadero.tsx). */
const SD_NAME_S = "[font-family:var(--sd-name),'Alfa_Slab_One',Rockwell,serif]";
const LOOK_SUADERO: SheetLook = {
  backdrop: "animate-backdrop-in fixed inset-0 z-50 flex items-end justify-center bg-[#3a2314]/60 sm:items-center",
  panel: "animate-sheet-up max-h-[85vh] w-full overflow-y-auto rounded-t-[26px] border-t-4 border-[#612f18] bg-[#fdfdfb] p-5 text-[#3a2314] shadow-xl sm:max-w-md sm:rounded-[26px] sm:border-4",
  title: `${SD_NAME_S} text-[24px] leading-tight text-[#3a2314]`,
  subtitle: "text-[14px] leading-snug text-[#3a2314]/65",
  groupName: `${SD_NAME_S} text-[13px] uppercase tracking-[0.1em] text-[#612f18]`,
  status: (falta) => `text-[11px] font-bold uppercase tracking-[0.1em] ${falta ? "text-[#c6361c]" : "text-[#3a2314]/45"}`,
  hasta: "text-[12px] text-[#3a2314]/55",
  option: (disponible, on) =>
    `flex items-center justify-between rounded-full border-2 px-4 py-2.5 text-left text-[15px] font-bold transition-colors ${
      !disponible
        ? "cursor-not-allowed border-[#3a2314]/10 text-[#3a2314]/35 line-through"
        : on
          ? "border-[#c6361c] bg-[#b32e16] text-[#f0e9d3]"
          : "border-[#9f4c24]/35 bg-white text-[#3a2314] hover:border-[#c6361c]"
    }`,
  delta: (on) => `text-[13px] font-bold ${on ? "text-[#f0e9d3]" : "text-[#c6361c]"}`,
  footer: "sticky bottom-0 -mx-5 mt-2 border-t border-[#612f18]/15 bg-[#fdfdfb] px-5 pb-1 pt-3",
  qtyLabel: "text-[14px] font-bold text-[#3a2314]/75",
  qtyBtn:
    "h-10 w-10 rounded-full border-2 border-[#9f4c24]/40 text-lg font-bold text-[#612f18] transition-colors hover:bg-[#9f4c24]/10 disabled:opacity-30",
  qtyNum: `${SD_NAME_S} w-7 text-center text-[17px] tabular-nums text-[#3a2314]`,
  cancel:
    "rounded-full border-2 border-[#3a2314]/20 px-4 py-3 text-sm font-bold text-[#3a2314]/80 transition-colors hover:bg-[#3a2314]/5",
  confirm: `${SD_NAME_S} flex-1 rounded-full bg-[#b32e16] py-3 text-[15px] uppercase tracking-[0.06em] text-[#f0e9d3] transition-colors hover:bg-[#a92c16] disabled:cursor-not-allowed disabled:opacity-45`,
};

/** Manantial: vitrina blanca con el morado de su pared y el azul rey del letrero (components/menu/skins/manantial.tsx). */
const MN_NAME_S = "[font-family:var(--mn-display),'Baloo_2',Nunito,sans-serif] font-bold";
const LOOK_MANANTIAL: SheetLook = {
  backdrop: "animate-backdrop-in fixed inset-0 z-50 flex items-end justify-center bg-[#2a1740]/60 sm:items-center",
  panel: "animate-sheet-up max-h-[85vh] w-full overflow-y-auto rounded-t-[26px] border-t-4 border-[#7b3fa6] bg-white p-5 text-[#2a1740] shadow-xl sm:max-w-md sm:rounded-[26px] sm:border-4",
  title: `${MN_NAME_S} text-[24px] leading-tight text-[#2a1740]`,
  subtitle: "text-[14px] leading-snug text-[#2a1740]/65",
  groupName: `${MN_NAME_S} text-[13px] uppercase tracking-[0.1em] text-[#5b2a80]`,
  status: (falta) => `text-[11px] font-bold uppercase tracking-[0.1em] ${falta ? "text-[#1d4ed8]" : "text-[#2a1740]/45"}`,
  hasta: "text-[12px] text-[#2a1740]/55",
  option: (disponible, on) =>
    `flex items-center justify-between rounded-full border-2 px-4 py-2.5 text-left text-[15px] font-bold transition-colors ${
      !disponible
        ? "cursor-not-allowed border-[#2a1740]/10 text-[#2a1740]/35 line-through"
        : on
          ? "border-[#1d4ed8] bg-[#7b3fa6] text-white"
          : "border-[#7b3fa6]/35 bg-white text-[#2a1740] hover:border-[#7b3fa6]"
    }`,
  delta: (on) => `text-[13px] font-bold ${on ? "text-white" : "text-[#1d4ed8]"}`,
  // -bottom-5 + pb-5: la barra tapa también el relleno de abajo (si no, el último sabor se asoma debajo de los botones).
  footer: "sticky -bottom-5 -mx-5 mt-2 border-t border-[#7b3fa6]/15 bg-white px-5 pb-5 pt-3",
  qtyLabel: "text-[14px] font-bold text-[#2a1740]/75",
  qtyBtn:
    "h-10 w-10 rounded-full border-2 border-[#7b3fa6]/40 text-lg font-bold text-[#5b2a80] transition-colors hover:bg-[#7b3fa6]/10 disabled:opacity-30",
  qtyNum: `${MN_NAME_S} w-7 text-center text-[17px] tabular-nums text-[#2a1740]`,
  cancel:
    "rounded-full border-2 border-[#2a1740]/20 px-4 py-3 text-sm font-bold text-[#2a1740]/80 transition-colors hover:bg-[#2a1740]/5",
  confirm: `${MN_NAME_S} flex-1 rounded-full bg-[#7b3fa6] py-3 text-[15px] uppercase tracking-[0.06em] text-white transition-colors hover:bg-[#5b2a80] disabled:cursor-not-allowed disabled:opacity-45`,
};

/** Fresheria: página rosa con marco dorado, cursiva vino y píldoras magenta (components/menu/skins/fresheria.tsx). */
const FR_NAME_S = "[font-family:var(--fr-name),'Bree_Serif',Georgia,serif]";
const LOOK_FRESHERIA: SheetLook = {
  backdrop: "animate-backdrop-in fixed inset-0 z-50 flex items-end justify-center bg-[#56052d]/55 sm:items-center",
  panel: "animate-sheet-up max-h-[85vh] w-full overflow-y-auto rounded-t-[28px] border-t-2 border-[#9e6036] bg-[#feeef8] p-5 text-[#56052d] shadow-xl sm:max-w-md sm:rounded-[34px] sm:border-2",
  title: `${FR_NAME_S} text-[24px] leading-tight text-[#56052d]`,
  subtitle: "text-[13px] font-medium text-[#56052d]/65",
  groupName: `${FR_NAME_S} text-[15px] text-[#70244f]`,
  status: (falta) => `text-[11px] font-semibold uppercase tracking-[0.1em] ${falta ? "text-[#cb0465]" : "text-[#56052d]/45"}`,
  hasta: "text-[12px] text-[#56052d]/55",
  option: (disponible, on) =>
    `flex items-center justify-between rounded-full border-[1.5px] px-4 py-2.5 text-left text-[14.5px] font-medium transition-colors ${
      !disponible
        ? "cursor-not-allowed border-[#56052d]/10 text-[#56052d]/35 line-through"
        : on
          ? "border-[#cb0465] bg-[#cb0465] text-[#fffbfd]"
          : "border-[#9e6036] bg-[#fffbfd] text-[#56052d] hover:border-[#cb0465]"
    }`,
  delta: (on) => `text-[13px] font-semibold ${on ? "text-[#fffbfd]" : "text-[#cb0465]"}`,
  footer: "sticky bottom-0 -mx-5 mt-2 border-t border-[#9e6036]/40 bg-[#feeef8] px-5 pb-1 pt-3",
  qtyLabel: "text-[14px] font-medium text-[#56052d]/75",
  qtyBtn:
    "h-10 w-10 rounded-full border-[1.5px] border-[#9e6036] bg-[#fffbfd] text-lg font-semibold text-[#56052d] transition-colors hover:border-[#cb0465] disabled:opacity-30",
  qtyNum: "w-7 text-center text-base font-semibold tabular-nums text-[#56052d]",
  cancel:
    "rounded-full border-[1.5px] border-[#9e6036]/60 px-4 py-3 text-sm font-medium text-[#56052d]/80 transition-colors hover:bg-[#fffbfd]",
  confirm: `${FR_NAME_S} flex-1 rounded-full bg-[#cb0465] py-3 text-[16px] text-[#fffbfd] transition-colors hover:bg-[#a80353] disabled:cursor-not-allowed disabled:opacity-45`,
};

function lookFor(skin: MenuSkinId | null | undefined): SheetLook {
  if (skin === "fresheria") return LOOK_FRESHERIA;
  if (skin === "mixteco") return LOOK_MIXTECO;
  if (skin === "laspic") return LOOK_LASPIC;
  if (skin === "tortasperras") return LOOK_TORTAS;
  if (skin === "igo") return LOOK_IGO;
  if (skin === "omu") return LOOK_OMU;
  if (skin === "kame") return LOOK_KAME;
  if (skin === "suadero") return LOOK_SUADERO;
  if (skin === "manantial") return LOOK_MANANTIAL;
  return LOOK_DEFAULT;
}

export function ItemOptionsSheet({
  open,
  itemName,
  basePrice,
  groups,
  initialPicked = null,
  onCancel,
  onConfirm,
  onToggleAvailability,
  skin = null,
}: ItemOptionsSheetProps) {
  const [picked, setPicked] = useState<Record<string, string[]>>({});
  // Al abrir con algo ya elegido (la pastilla de tamaño), se marca. Se ajusta durante el render (no en un
  // efecto): el objeto de preselección cambia solo cuando quien abre la hoja cambia de platillo o de pastilla.
  const [seenInitial, setSeenInitial] = useState(initialPicked);
  if (initialPicked !== seenInitial) {
    setSeenInitial(initialPicked);
    if (initialPicked) setPicked(initialPicked);
  }
  /** Modo "marcar agotados": tocar una opción la apaga o la prende en vez de elegirla. */
  const [marcando, setMarcando] = useState(false);
  /** Cuántos iguales: 3 toritos de campechano en un solo toque. */
  const [qty, setQty] = useState(1);
  const look = lookFor(skin);

  const delta = useMemo(() => {
    let d = 0;
    for (const g of groups) {
      for (const oid of picked[g.id] ?? []) {
        d += g.options.find((o) => o.id === oid)?.priceDelta ?? 0;
      }
    }
    return d;
  }, [picked, groups]);

  const faltantes = groups.filter(
    (g) => g.required && (picked[g.id]?.length ?? 0) < Math.max(1, g.min),
  );
  // Grupo obligatorio con TODO agotado: no hay forma de armar el platillo hoy.
  const sinOpciones = groups.filter((g) => g.required && !groupHasAvailableOption(g));

  if (!open) return null;

  function toggle(g: MenuItemOptionGroup, optionId: string) {
    const opt = g.options.find((o) => o.id === optionId);
    if (opt && !isOptionAvailable(opt)) return; // agotado hoy: no se elige
    setPicked((prev) => {
      const cur = prev[g.id] ?? [];
      if (g.max <= 1) return { ...prev, [g.id]: cur[0] === optionId ? [] : [optionId] };
      if (cur.includes(optionId)) return { ...prev, [g.id]: cur.filter((x) => x !== optionId) };
      if (cur.length >= g.max) return prev;
      return { ...prev, [g.id]: [...cur, optionId] };
    });
  }

  function confirm() {
    if (faltantes.length > 0 || sinOpciones.length > 0) return;
    const selected: SelectedOptionGroup[] = groups
      .map((g) => ({
        groupId: g.id,
        groupName: g.name,
        options: (picked[g.id] ?? [])
          .map((oid) => g.options.find((o) => o.id === oid))
          .filter((o): o is NonNullable<typeof o> => o !== undefined && isOptionAvailable(o))
          .map((o) => ({ id: o.id, name: o.name, priceDelta: o.priceDelta })),
      }))
      .filter((g) => g.options.length > 0);
    onConfirm(selected, qty);
    setPicked({});
    setQty(1);
  }

  return (
    <div className={look.backdrop}>
      <div className={look.panel}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className={look.title}>{itemName}</h3>
            <p className={look.subtitle}>
              {marcando
                ? "Toca una opción para apagarla o prenderla en todos los platillos que la llevan. Se guarda al momento."
                : "Elige cómo lo quieres"}
            </p>
          </div>
          {onToggleAvailability && (
            <button
              type="button"
              onClick={() => setMarcando((m) => !m)}
              className={`shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] font-bold ${
                marcando
                  ? "bg-[#1C2526] text-white"
                  : "border border-[#1C2526]/15 text-[#1C2526]/70 hover:bg-[#FAF7F2]"
              }`}
            >
              {marcando ? "Listo" : "Marcar agotados"}
            </button>
          )}
        </div>

        {groups.map((g) => {
          const cur = picked[g.id] ?? [];
          const falta = g.required && cur.length < Math.max(1, g.min);
          return (
            <div key={g.id} className="mb-5">
              <div className="mb-2 flex items-baseline gap-2">
                <p className={look.groupName}>{g.name}</p>
                {g.required && (
                  <span className={look.status(falta)}>
                    {falta ? "Falta elegir" : "Listo"}
                  </span>
                )}
                {g.max > 1 && (
                  <span className={look.hasta}>Hasta {g.max}</span>
                )}
              </div>
              <div className="flex flex-col gap-2">
                {g.options.map((o) => {
                  const on = cur.includes(o.id);
                  const disponible = isOptionAvailable(o);
                  if (marcando) {
                    return (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => onToggleAvailability?.(g.id, o.id, !disponible)}
                        className={`flex items-center justify-between rounded-xl border px-3 py-2.5 text-left text-sm transition-colors ${
                          disponible
                            ? "border-[#1C2526]/10 bg-white text-[#1C2526]/80"
                            : "border-red-300 bg-red-50 text-[#1C2526]/50 line-through"
                        }`}
                      >
                        <span>{o.name}</span>
                        <span className={`text-[11px] font-bold ${disponible ? "text-[#1C2526]/40" : "text-red-600"}`}>
                          {disponible ? "Disponible" : "Agotado hoy"}
                        </span>
                      </button>
                    );
                  }
                  return (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => toggle(g, o.id)}
                      disabled={!disponible}
                      aria-disabled={!disponible}
                      aria-pressed={on}
                      className={look.option(disponible, on)}
                    >
                      <span>{o.name}</span>
                      {!disponible ? (
                        <span className="text-[11px] font-bold no-underline text-red-600">Agotado hoy</span>
                      ) : (
                        o.priceDelta > 0 && (
                          <span className={look.delta(on)}>
                            +{formatPrice(o.priceDelta)}
                          </span>
                        )
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        <div className={look.footer}>
          {!marcando && (
            <div className="mb-3 flex items-center justify-between">
              <span className={look.qtyLabel}>¿Cuántos?</span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  aria-label="Uno menos"
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  disabled={qty <= 1}
                  className={look.qtyBtn}
                >
                  −
                </button>
                <span className={look.qtyNum} aria-live="polite">
                  {qty}
                </span>
                <button
                  type="button"
                  aria-label="Uno más"
                  onClick={() => setQty((q) => Math.min(MAX_QTY, q + 1))}
                  disabled={qty >= MAX_QTY}
                  className={look.qtyBtn}
                >
                  +
                </button>
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setPicked({});
                setQty(1);
                onCancel();
              }}
              className={look.cancel}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={confirm}
              disabled={faltantes.length > 0 || sinOpciones.length > 0 || marcando}
              className={look.confirm}
            >
              {sinOpciones.length > 0
                ? `Sin ${sinOpciones[0]!.name.toLowerCase()} hoy`
                : faltantes.length > 0
                  ? `Elige ${faltantes[0]!.name.toLowerCase()}`
                  : `Agregar${qty > 1 ? ` ${qty}` : ""} — ${formatPrice((basePrice + delta) * qty)}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
