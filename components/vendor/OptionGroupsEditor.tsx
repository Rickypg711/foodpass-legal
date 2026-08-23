"use client";

// Editor de grupos de opciones de un platillo (salsa, aderezo, extras con
// costo). Lo que se guarda aquí MANDA sobre lo que se detecta en la
// descripción — el parser es solo el arranque para menús ya importados.

import type { MenuItemOptionGroup } from "@/lib/menu/optionGroups";

function slug(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

export function OptionGroupsEditor({
  groups,
  onChange,
  detectedHint,
}: {
  groups: MenuItemOptionGroup[];
  onChange: (g: MenuItemOptionGroup[]) => void;
  detectedHint?: string | null;
}) {
  function updateGroup(i: number, patch: Partial<MenuItemOptionGroup>) {
    const next = [...groups];
    next[i] = { ...next[i]!, ...patch };
    onChange(next);
  }

  return (
    <div className="rounded-xl border border-[#141413]/10 bg-[#faf9f5] p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-bold text-[#141413]/70">Opciones que elige el cliente</p>
        <button
          type="button"
          onClick={() =>
            onChange([
              ...groups,
              {
                id: `grupo-${groups.length + 1}-${Date.now().toString(36)}`,
                name: "",
                required: true,
                min: 1,
                max: 1,
                options: [{ id: "op-1", name: "", priceDelta: 0 }],
              },
            ])
          }
          className="rounded-lg bg-[#141413] px-2.5 py-1 text-[11px] font-bold text-white"
        >
          + Grupo
        </button>
      </div>

      {groups.length === 0 && (
        <p className="text-[11px] leading-relaxed text-[#141413]/45">
          {detectedHint
            ? detectedHint
            : "Si este platillo se pide de varias formas (salsa, término, extras), agrega un grupo. Tu cliente lo va a elegir al ordenar y llega en el pedido."}
        </p>
      )}

      {groups.map((g, gi) => (
        <div key={g.id} className="mb-2 rounded-lg border border-[#141413]/10 bg-white p-2.5">
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Nombre del grupo (ej. Salsa)"
              value={g.name}
              onChange={(e) => updateGroup(gi, { name: e.target.value, id: slug(e.target.value) || g.id })}
              className="min-w-0 flex-1 rounded-lg border border-[#141413]/12 px-2 py-1.5 text-xs text-[#141413] placeholder-[#141413]/30 focus:border-[#F28C38] focus:outline-none"
            />
            <button
              type="button"
              onClick={() => onChange(groups.filter((_, i) => i !== gi))}
              className="shrink-0 text-[11px] font-semibold text-red-500 hover:underline"
            >
              Quitar
            </button>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-1.5 text-[11px] text-[#141413]/60">
              <input
                type="checkbox"
                checked={g.required}
                onChange={(e) =>
                  updateGroup(gi, { required: e.target.checked, min: e.target.checked ? 1 : 0 })
                }
              />
              Obligatorio
            </label>
            <label className="flex items-center gap-1.5 text-[11px] text-[#141413]/60">
              Puede elegir hasta
              <input
                type="number"
                min={1}
                max={10}
                value={g.max}
                onChange={(e) => updateGroup(gi, { max: Math.max(1, parseInt(e.target.value) || 1) })}
                className="w-14 rounded-lg border border-[#141413]/12 px-2 py-1 text-xs focus:border-[#F28C38] focus:outline-none"
              />
            </label>
          </div>

          <div className="mt-2 flex flex-col gap-1.5">
            {g.options.map((o, oi) => (
              <div key={oi} className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Opción (ej. Búfalo)"
                  value={o.name}
                  onChange={(e) => {
                    const opts = [...g.options];
                    opts[oi] = { ...o, name: e.target.value, id: slug(e.target.value) || `op-${oi + 1}` };
                    updateGroup(gi, { options: opts });
                  }}
                  className="min-w-0 flex-1 rounded-lg border border-[#141413]/12 px-2 py-1.5 text-xs placeholder-[#141413]/30 focus:border-[#F28C38] focus:outline-none"
                />
                <div className="flex shrink-0 items-center gap-1">
                  <span className="text-[11px] text-[#141413]/40">+$</span>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={o.priceDelta || 0}
                    onChange={(e) => {
                      const opts = [...g.options];
                      opts[oi] = { ...o, priceDelta: Math.max(0, parseFloat(e.target.value) || 0) };
                      updateGroup(gi, { options: opts });
                    }}
                    className="w-16 rounded-lg border border-[#141413]/12 px-2 py-1.5 text-xs focus:border-[#F28C38] focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => updateGroup(gi, { options: g.options.filter((_, i) => i !== oi) })}
                  className="shrink-0 text-[11px] text-[#141413]/35 hover:text-red-500"
                  aria-label="Quitar opción"
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                updateGroup(gi, {
                  options: [...g.options, { id: `op-${g.options.length + 1}`, name: "", priceDelta: 0 }],
                })
              }
              className="self-start text-[11px] font-semibold text-[#F28C38] hover:underline"
            >
              + Opción
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Quita grupos y opciones sin nombre antes de guardar. */
export function cleanOptionGroups(groups: MenuItemOptionGroup[]): MenuItemOptionGroup[] {
  return groups
    .map((g) => ({
      ...g,
      name: g.name.trim(),
      options: g.options.filter((o) => o.name.trim().length > 0).map((o) => ({ ...o, name: o.name.trim() })),
    }))
    .filter((g) => g.name.length > 0 && g.options.length >= 2);
}
