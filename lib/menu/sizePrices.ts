import type { MenuItemOptionGroup } from "./optionGroups.ts";
import { formatPrice } from "../priceFormat.ts";

// Los tamaños con su precio en la CARA de la tarjeta (8-oct-2026). Un platillo
// con "Chico / Grande" enseñaba solo el precio base y el cliente tenía que
// abrirlo para saber cuánto cuesta el grande. El sitio de Rebellion Pizza lo
// resolvió con "12" $19 · 16" $28" en la tarjeta; aquí lo mismo.
//
// Regla: solo el PRIMER grupo obligatorio de "elige uno" cuyas opciones
// cambian el precio (tamaño, porción, presentación). Salsas y términos sin
// costo no cuentan. Opciones agotadas no se enseñan. Nunca se inventa precio:
// cada número es base + el sobreprecio que el dueño guardó.

const MAX_LISTED = 3;
const MAX_NAME = 14;

export function sizePriceLine(
  basePrice: number,
  groups: readonly MenuItemOptionGroup[] | null | undefined,
): string | null {
  if (!groups || !Number.isFinite(basePrice)) return null;
  for (const g of groups) {
    if (!g.required || g.max !== 1) continue;
    const opts = g.options.filter((o) => o.available !== false && o.name.trim());
    if (opts.length < 2) continue;
    if (!opts.some((o) => o.priceDelta !== 0)) continue;
    const rows = opts
      .map((o) => ({ name: o.name.trim(), price: basePrice + (Number.isFinite(o.priceDelta) ? o.priceDelta : 0) }))
      .filter((r) => r.price > 0)
      .sort((a, b) => a.price - b.price);
    if (rows.length < 2) continue;
    if (rows.length > MAX_LISTED) return `Desde ${formatPrice(rows[0].price)}`;
    return rows
      .map((r) => `${r.name.length > MAX_NAME ? r.name.slice(0, MAX_NAME - 1) + "…" : r.name} ${formatPrice(r.price)}`)
      .join(" · ");
  }
  return null;
}
