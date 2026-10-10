/**
 * Cómo se ENSEÑA una sugerencia del carrito (9-oct-2026, FOODPASS docs/UPSELL_9_OCT.md reglas 1, 5, 6, 7 y 9).
 * Espejo exacto de FOODPASS lib/orders/upsell_presentation.dart: los dos corren los mismos casos
 * (lib/order/upsellCases.json, copia idéntica de FOODPASS test/fixtures/upsell_cases.json) en
 * scripts/validate-upsell-presentation.mjs.
 *
 *  - El texto NO inventa: la frase de Gemini (pitchTitle/pitchBody) ya no se pinta; prometía "bien fría",
 *    "combina perfecto" y "la gente lo pide junto" sin dato. Se dice solo lo que es un hecho.
 *  - "La gente lo pide junto" solo con evidencia del local: 3+ pedidos cobrados juntos Y lift > 1. Sin esa
 *    evidencia, una co-compra no se enseña.
 *  - Precio honesto antes del toque: "+$X" en el botón y el total nuevo. Nunca premarcado. El "+$X" es el precio
 *    COMPLETO de lo que entra al carrito (se agrega como otra línea): "agrandar" decía "+$80" y metía una pizza
 *    grande de $260 además de la chica. Hasta que el servidor diga qué línea cambia (`replacesMenuItemId`) y el
 *    carrito la cambie, "agrandar" no se enseña.
 *
 * Contrato que falta del servidor (functions/upsell_recommendation_ai.js): `evidence: { pairOrders, lift }` en las
 * sugerencias `copurchase`, de pedidos COBRADOS del local; y `replacesMenuItemId` en `sizeup`.
 */
import { formatPrice } from "../priceFormat.ts";
import { resolveOptionGroups, type MenuItemOptionGroup } from "../menu/optionGroups.ts";
import { categoryAvailability, categoryWindowsFromRestaurant } from "../menu/categoryWindows.ts";

export const UPSELL_MIN_PAIR_ORDERS = 3;
export const UPSELL_MIN_LIFT = 1;

export type UpsellCopy = "pairedTogether" | "sizeUp" | "drink";

/** Las frases (las mismas claves de l10n en la app: carrito2UpsellPaired / SizeUp / Drink / NewTotal). */
export const UPSELL_COPY: Record<UpsellCopy, string> = {
  pairedTogether: "La gente lo pide junto",
  sizeUp: "¿La quieres más grande?",
  drink: "¿Algo de tomar?",
};
export const upsellAddLabel = (priceDelta: string) => `Agregar · +${priceDelta}`;
export const upsellNewTotalLabel = (total: string) => `Tu total queda en ${total}`;

export type UpsellPresentation = {
  copy: UpsellCopy;
  name: string;
  priceDelta: number;
  newTotal: number;
};

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** null = no se enseña nada. */
export function upsellPresentation(
  suggestion: Record<string, unknown> | null | undefined,
  cartTotal: number,
): UpsellPresentation | null {
  if (!suggestion) return null;
  const name = String(suggestion.name ?? "").trim();
  const id = String(suggestion.menuItemId ?? "").trim();
  if (!name || !id) return null;
  // Lo que se cobra de más es el precio del platillo que entra (no priceDelta).
  const delta = num(suggestion.price);
  if (delta == null || delta <= 0) return null;

  let copy: UpsellCopy | null = null;
  if (suggestion.type === "copurchase") {
    const ev = suggestion.evidence as Record<string, unknown> | undefined;
    const orders = num(ev?.pairOrders);
    const lift = num(ev?.lift);
    if (orders != null && lift != null && orders >= UPSELL_MIN_PAIR_ORDERS && lift > UPSELL_MIN_LIFT) copy = "pairedTogether";
  } else if (suggestion.type === "sizeup") {
    // Sin cambio de línea en el carrito, "agrandar" cobraría las dos pizzas.
    copy = null;
  } else if (suggestion.type === "complement") {
    copy = "drink";
  }
  if (!copy) return null;
  return { copy, name, priceDelta: delta, newTotal: Math.round((cartTotal + delta) * 100) / 100 };
}

export const formatUpsellPrice = formatPrice;

/**
 * UPSELL regla 9: se sugiere solo si está disponible, su categoría está a tiempo AHORA y no pide opciones
 * obligatorias (agregarlo de un toque lo mandaría a la cocina sin la salsa). Espejo de `upsellItemSuggestible` (app).
 */
export function upsellItemSuggestible(
  item: { isAvailable?: unknown; category?: unknown; optionGroups?: MenuItemOptionGroup[] | null; description?: string | null },
  restaurant: Record<string, unknown> | null | undefined,
  now: Date = new Date(),
): boolean {
  if (item.isAvailable === false) return false;
  if (resolveOptionGroups(item).some((g) => g.required)) return false;
  const category = typeof item.category === "string" ? item.category : "";
  const a = categoryAvailability(category, categoryWindowsFromRestaurant(restaurant), now);
  return a.always || a.openNow;
}
