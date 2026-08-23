import type { SelectedOptionGroup } from "./types";

/**
 * Llave canónica de una línea del carrito.
 *
 * Antes el carrito se indexaba por `menuItemId`, así que unas alitas con
 * búfalo y unas con BBQ eran la MISMA línea y se pisaban. Ahora la llave
 * incluye lo que el cliente eligió.
 *
 * COMPATIBILIDAD: sin opciones devuelve el `menuItemId` tal cual. Así los
 * carritos ya guardados en sessionStorage y los platillos sin opciones se
 * comportan exactamente igual que antes.
 */
export function buildLineId(
  menuItemId: string,
  selectedOptions?: SelectedOptionGroup[] | null,
): string {
  if (!selectedOptions || selectedOptions.length === 0) return menuItemId;
  const parts = selectedOptions
    .map((g) => `${g.groupId}=${g.options.map((o) => o.id).sort().join("+")}`)
    .sort();
  if (parts.length === 0) return menuItemId;
  return `${menuItemId}|${parts.join("|")}`;
}

/** Sobreprecio total de lo elegido. */
export function optionsPriceDelta(selectedOptions?: SelectedOptionGroup[] | null): number {
  if (!selectedOptions) return 0;
  return selectedOptions.reduce(
    (sum, g) => sum + g.options.reduce((s, o) => s + (o.priceDelta || 0), 0),
    0,
  );
}

/** "Salsa: Búfalo · Aderezo: Ranch" — para el carrito, WhatsApp y la cocina. */
export function describeSelectedOptions(
  selectedOptions?: SelectedOptionGroup[] | null,
): string {
  if (!selectedOptions || selectedOptions.length === 0) return "";
  return selectedOptions
    .filter((g) => g.options.length > 0)
    .map((g) => `${g.groupName}: ${g.options.map((o) => o.name).join(", ")}`)
    .join(" · ");
}
