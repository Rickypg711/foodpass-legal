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
    // Opción A (23-sep-2026): caja tostada sin borde, campos de 44/16px, un
    // botón secundario para agrupar, links de texto para quitar.
    <div className="rounded-xl bg-[#F0EBE1] p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[13px] font-semibold text-[#1C2526]">Opciones que elige el cliente</p>
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
          className="flex h-9 items-center rounded-xl border border-[#1C2526] bg-white px-3 text-[13px] font-semibold text-[#1C2526]"
        >
          Agregar grupo
        </button>
      </div>

      {groups.length === 0 && (
        <p className="text-[13px] leading-[18px] text-[#3F4A4D]">
          {detectedHint
            ? detectedHint
            : "Si este platillo se pide de varias formas (salsa, término, extras), agrega un grupo. Tu cliente lo va a elegir al ordenar y llega en el pedido."}
        </p>
      )}

      {groups.map((g, gi) => (
        <div key={g.id} className="mb-2 rounded-xl border border-[#D9D2C5] bg-white p-3">
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Nombre del grupo (ej. Salsa)"
              value={g.name}
              // OJO: aqui NO se toca g.id. El div del grupo usa key={g.id}, asi
              // que re-slugear el id en cada tecla cambiaba la key, React
              // destruia y recreaba el bloque, y el input perdia el foco a la
              // PRIMERA letra. El dueño no podia escribir "Salsa": escribia
              // "S" y tenia que volver a hacer clic. El id se genera una vez
              // al crear el grupo y se queda quieto.
              onChange={(e) => updateGroup(gi, { name: e.target.value })}
              className="h-11 min-w-0 flex-1 rounded-xl border border-[#D9D2C5] px-3 text-[16px] text-[#1C2526] placeholder:text-[#5B6366] focus:border-[#1C2526] focus:outline-none"
            />
            <button
              type="button"
              onClick={() => onChange(groups.filter((_, i) => i !== gi))}
              className="flex h-11 shrink-0 items-center text-[13px] font-semibold text-[#B91C1C] hover:underline"
            >
              Quitar
            </button>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-3">
            <label className="flex h-9 items-center gap-2 text-[13px] text-[#3F4A4D]">
              <input
                type="checkbox"
                checked={g.required}
                onChange={(e) =>
                  updateGroup(gi, { required: e.target.checked, min: e.target.checked ? 1 : 0 })
                }
              />
              Obligatorio
            </label>
            <label className="flex h-9 items-center gap-2 text-[13px] text-[#3F4A4D]">
              Puede elegir hasta
              <input
                type="number"
                min={1}
                max={10}
                value={g.max}
                onChange={(e) => updateGroup(gi, { max: Math.max(1, parseInt(e.target.value) || 1) })}
                className="h-9 w-16 rounded-lg border border-[#D9D2C5] px-2 text-[16px] tabular-nums text-[#1C2526] focus:border-[#1C2526] focus:outline-none"
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
                  className="h-11 min-w-0 flex-1 rounded-xl border border-[#D9D2C5] px-3 text-[16px] text-[#1C2526] placeholder:text-[#5B6366] focus:border-[#1C2526] focus:outline-none"
                />
                <div className="flex shrink-0 items-center gap-1">
                  <span className="text-[13px] text-[#5B6366]">+$</span>
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
                    className="h-11 w-20 rounded-xl border border-[#D9D2C5] px-2 text-[16px] tabular-nums text-[#1C2526] focus:border-[#1C2526] focus:outline-none"
                  />
                </div>
                <label
                  className="flex h-11 shrink-0 items-center gap-1.5 text-[13px] text-[#3F4A4D]"
                  title="Se ve tachada y no se puede elegir. Al guardar, cambia en todos los platillos que llevan esta opción. También se prende y apaga desde la Caja."
                >
                  <input
                    type="checkbox"
                    checked={o.available === false}
                    onChange={(e) => {
                      const opts = [...g.options];
                      if (e.target.checked) {
                        opts[oi] = { ...o, available: false };
                      } else {
                        const { available: _omit, ...rest } = o;
                        void _omit;
                        opts[oi] = rest;
                      }
                      updateGroup(gi, { options: opts });
                    }}
                  />
                  Agotado
                </label>
                <button
                  type="button"
                  onClick={() => updateGroup(gi, { options: g.options.filter((_, i) => i !== oi) })}
                  className="flex h-11 w-9 shrink-0 items-center justify-center text-[#5B6366] hover:text-[#B91C1C]"
                  aria-label="Quitar opción"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>
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
              className="flex h-9 items-center self-start text-[13px] font-semibold text-[#8A4B12] hover:underline"
            >
              Agregar opción
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
