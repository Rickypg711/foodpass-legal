"use client";

// Hoja para elegir las opciones de un platillo antes de agregarlo al carrito
// (salsa, aderezo, extras). Aparece solo si el platillo TIENE grupos; si no,
// el "+" sigue agregando directo como siempre.

import { useMemo, useState } from "react";
import { formatPrice } from "@/lib/priceFormat";
import type { MenuItemOptionGroup } from "@/lib/menu/optionGroups";
import type { SelectedOptionGroup } from "@/lib/cart/types";

export type ItemOptionsSheetProps = {
  open: boolean;
  itemName: string;
  basePrice: number;
  groups: MenuItemOptionGroup[];
  onCancel: () => void;
  onConfirm: (selected: SelectedOptionGroup[]) => void;
};

export function ItemOptionsSheet({
  open,
  itemName,
  basePrice,
  groups,
  onCancel,
  onConfirm,
}: ItemOptionsSheetProps) {
  const [picked, setPicked] = useState<Record<string, string[]>>({});

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

  if (!open) return null;

  function toggle(g: MenuItemOptionGroup, optionId: string) {
    setPicked((prev) => {
      const cur = prev[g.id] ?? [];
      if (g.max <= 1) return { ...prev, [g.id]: cur[0] === optionId ? [] : [optionId] };
      if (cur.includes(optionId)) return { ...prev, [g.id]: cur.filter((x) => x !== optionId) };
      if (cur.length >= g.max) return prev;
      return { ...prev, [g.id]: [...cur, optionId] };
    });
  }

  function confirm() {
    if (faltantes.length > 0) return;
    const selected: SelectedOptionGroup[] = groups
      .map((g) => ({
        groupId: g.id,
        groupName: g.name,
        options: (picked[g.id] ?? [])
          .map((oid) => g.options.find((o) => o.id === oid))
          .filter((o): o is NonNullable<typeof o> => Boolean(o))
          .map((o) => ({ id: o.id, name: o.name, priceDelta: o.priceDelta })),
      }))
      .filter((g) => g.options.length > 0);
    onConfirm(selected);
    setPicked({});
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
      <div className="max-h-[85vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-xl sm:max-w-md sm:rounded-3xl">
        <div className="mb-4">
          <h3 className="text-lg font-bold text-[#1C2526]">{itemName}</h3>
          <p className="text-sm text-[#1C2526]/50">Elige cómo lo quieres</p>
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
                  return (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => toggle(g, o.id)}
                      className={`flex items-center justify-between rounded-xl border px-3 py-2.5 text-left text-sm transition-colors ${
                        on
                          ? "border-[#F28C38] bg-[#F28C38]/8 font-semibold text-[#1C2526]"
                          : "border-[#1C2526]/10 bg-[#FAF7F2] text-[#1C2526]/80 hover:border-[#1C2526]/25"
                      }`}
                    >
                      <span>{o.name}</span>
                      {o.priceDelta > 0 && (
                        <span className="text-xs font-semibold text-[#F28C38]">
                          +{formatPrice(o.priceDelta)}
                        </span>
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
            disabled={faltantes.length > 0}
            className="flex-1 rounded-xl bg-[#F28C38] py-3 text-sm font-bold text-white transition-colors hover:bg-[#c46644] disabled:cursor-not-allowed disabled:opacity-45"
          >
            {faltantes.length > 0
              ? `Elige ${faltantes[0]!.name.toLowerCase()}`
              : `Agregar — ${formatPrice(basePrice + delta)}`}
          </button>
        </div>
      </div>
    </div>
  );
}
