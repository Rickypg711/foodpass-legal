// El tipo de restaurante NO se pregunta si ya se puede leer (§6.9). La
// fuente de verdad es Gemini clasificando el menú completo en el servidor
// (extractRestaurantInfo → info.category, functions/menu_demo_ai.js) — este
// módulo es el FALLBACK de palabras clave para jobs creados antes de esa
// versión o cuando la IA no dominó. Empata la lista EXACTA del claim.

export const RESTAURANT_CATEGORIES = [
  "Tacos", "Café", "Hamburguesas", "Pizza", "Sushi",
  "Mariscos", "Antojitos", "Carnes", "Postres", "Otro",
] as const;

export type RestaurantCategory = (typeof RESTAURANT_CATEGORIES)[number];

// "Otro" jamás se adivina: si ninguna categoría domina, null y el dueño elige.
const KEYWORDS: Array<[Exclude<RestaurantCategory, "Otro">, RegExp]> = [
  ["Pizza", /pizz/i],
  ["Tacos", /\btacos?\b|\bpastor\b|\bbirria\b|taquer/i],
  ["Sushi", /sushi|\broll\b|maki|nigiri|teriyaki/i],
  ["Hamburguesas", /hamburgues|\bburgers?\b/i],
  ["Mariscos", /marisc|camar[oó]n|cevich|aguachile|pescado|pulpo/i],
  ["Café", /\bcaf[eé]\b|latte|capuchino|cappuccino|espresso|frapp/i],
  ["Antojitos", /antojit|gordita|quesadilla|\bsopes?\b|tostada|elote|tamal/i],
  ["Carnes", /\bcortes?\b|arrachera|rib\s?eye|asador|parrilla|steak/i],
  ["Postres", /postre|pastel|helado|crepa|reposter|nieve/i],
];

function scoreCategories(
  restaurantName: string | null | undefined,
  items: Array<{ name?: string; category?: string }> | null | undefined,
): Map<string, number> {
  const scores = new Map<string, number>();
  const bump = (cat: string, pts: number) =>
    scores.set(cat, (scores.get(cat) ?? 0) + pts);

  const name = (restaurantName ?? "").trim();
  for (const [cat, re] of KEYWORDS) {
    if (name && re.test(name)) bump(cat, 4);
    for (const it of items ?? []) {
      if (it?.name && re.test(it.name)) bump(cat, 1);
      if (it?.category && re.test(it.category)) bump(cat, 1);
    }
  }
  return scores;
}

/**
 * Deduce el tipo de restaurante de lo que el demo ya leyó. El NOMBRE pesa
 * doble ("LUZZ PIZZA" ya lo dice todo); luego platillos y sus categorías.
 * Devuelve null si ninguna domina — deducir mal es peor que preguntar.
 */
export function inferCategoryFromDemo(
  restaurantName: string | null | undefined,
  items: Array<{ name?: string; category?: string }> | null | undefined,
): RestaurantCategory | null {
  const scores = scoreCategories(restaurantName, items);
  if (scores.size === 0) return null;
  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  const [top, topScore] = ranked[0];
  const second = ranked[1]?.[1] ?? 0;
  // Dominancia real: al menos 2 puntos y clara ventaja sobre el segundo.
  if (topScore < 2 || topScore < second * 2) return null;
  return top as RestaurantCategory;
}

/**
 * El muro de "Cambiar", ordenado por lo que la IA vio en ESTE menú: lo que
 * puntuó primero (desc), luego el resto en su orden de siempre, y "Otro"
 * al final — el muro también sabe de dónde vienes.
 */
export function rankCategoriesForDemo(
  restaurantName: string | null | undefined,
  items: Array<{ name?: string; category?: string }> | null | undefined,
): RestaurantCategory[] {
  const scores = scoreCategories(restaurantName, items);
  const base = RESTAURANT_CATEGORIES.filter((c) => c !== "Otro");
  const ordered = [...base].sort((a, b) => {
    const diff = (scores.get(b) ?? 0) - (scores.get(a) ?? 0);
    return diff !== 0 ? diff : base.indexOf(a) - base.indexOf(b);
  });
  return [...ordered, "Otro"];
}
