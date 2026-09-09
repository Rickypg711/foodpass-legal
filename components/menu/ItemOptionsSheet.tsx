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

export type ItemOptionsSheetProps = {
  open: boolean;
  itemName: string;
  basePrice: number;
  groups: MenuItemOptionGroup[];
  onCancel: () => void;
  onConfirm: (selected: SelectedOptionGroup[]) => void;
  /**
   * Solo en la Caja: prende/apaga una opción ("agotado hoy") desde la misma hoja
   * con la que el cajero ordena. El menú del cliente NO lo pasa: ahí la opción
   * apagada solo se ve tachada. Se guarda al momento, no hay "guardar".
   */
  onToggleAvailability?: (groupId: string, optionId: string, available: boolean) => void;
};

export function ItemOptionsSheet({
  open,
  itemName,
  basePrice,
  groups,
  onCancel,
  onConfirm,
  onToggleAvailability,
}: ItemOptionsSheetProps) {
  const [picked, setPicked] = useState<Record<string, string[]>>({});
  /** Modo "marcar agotados": tocar una opción la apaga o la prende en vez de elegirla. */
  const [marcando, setMarcando] = useState(false);

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
    onConfirm(selected);
    setPicked({});
  }

  return (
    <div className="animate-backdrop-in fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
      <div className="animate-sheet-up max-h-[85vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-xl sm:max-w-md sm:rounded-3xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-[#1C2526]">{itemName}</h3>
            <p className="text-sm text-[#1C2526]/50">
              {marcando
                ? "Toca una opción para apagarla o prenderla. Se guarda al momento."
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
                <p className="text-sm font-bold text-[#1C2526]">{g.name}</p>
                {g.required && (
                  <span className={`text-[11px] font-semibold ${falta ? "text-[#F28C38]" : "text-[#1C2526]/35"}`}>
                    {falta ? "Falta elegir" : "Listo"}
                  </span>
                )}
                {g.max > 1 && (
                  <span className="text-[11px] text-[#1C2526]/35">Hasta {g.max}</span>
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
                      className={`flex items-center justify-between rounded-xl border px-3 py-2.5 text-left text-sm transition-colors ${
                        !disponible
                          ? "cursor-not-allowed border-[#1C2526]/8 bg-[#FAF7F2] text-[#1C2526]/35 line-through"
                          : on
                            ? "border-[#F28C38] bg-[#F28C38]/8 font-semibold text-[#1C2526]"
                            : "border-[#1C2526]/10 bg-[#FAF7F2] text-[#1C2526]/80 hover:border-[#1C2526]/25"
                      }`}
                    >
                      <span>{o.name}</span>
                      {!disponible ? (
                        <span className="text-[11px] font-bold no-underline text-red-600">Agotado hoy</span>
                      ) : (
                        o.priceDelta > 0 && (
                          <span className="text-xs font-semibold text-[#F28C38]">
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

        <div className="sticky bottom-0 -mx-5 mt-2 flex gap-2 border-t border-black/5 bg-white px-5 pb-1 pt-3">
          <button
            type="button"
            onClick={() => {
              setPicked({});
              onCancel();
            }}
            className="rounded-xl border border-[#1C2526]/12 px-4 py-3 text-sm font-semibold text-[#1C2526]/70 transition-colors hover:bg-[#FAF7F2]"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={faltantes.length > 0 || sinOpciones.length > 0 || marcando}
            className="flex-1 rounded-xl bg-[#F28C38] py-3 text-sm font-bold text-[#1C2526] transition-colors hover:bg-[#c46644] disabled:cursor-not-allowed disabled:opacity-45"
          >
            {sinOpciones.length > 0
              ? `Sin ${sinOpciones[0]!.name.toLowerCase()} hoy`
              : faltantes.length > 0
                ? `Elige ${faltantes[0]!.name.toLowerCase()}`
                : `Agregar — ${formatPrice(basePrice + delta)}`}
          </button>
        </div>
      </div>
    </div>
  );
}
