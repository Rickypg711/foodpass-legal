/**
 * Orden de las categorías del menú público (10-sep-2026).
 *
 * POR QUÉ EXISTE: el menú se ordenaba alfabético. En 15 de 40 locales activos
 * lo primero que veía el comensal era "Bebidas", y "Extras" salía antes que
 * los tacos. Nadie lee un menú así. El menú de papel ya trae el orden que el
 * dueño decidió; aquí se respeta o, si no lo tenemos, se imita.
 *
 * Tres capas, de la más fiel a la más genérica:
 *  1. `restaurants/{id}.menuCategoryOrder` (string[]): el orden del papel,
 *     guardado al reclamar el demo (ActivarModal) — o puesto a mano. Manda.
 *  2. Categorías que no están en esa lista (o sin lista): regla fija "como se
 *     lee un menú": entradas → desayunos → ensaladas/sopas → lo fuerte (lo
 *     que no reconozcamos va aquí, alfabético) → combos/especiales → postres
 *     → bebidas → extras/adicionales al final.
 *  3. Dentro de cada categoría, por nombre.
 *
 * Espejo EXACTO de `lib/utils/menu_category_order.dart` (app). Si cambias una
 * palabra de la regla, cámbiala en los dos lados. Candado:
 * scripts/validate-menu-category-order.mjs
 */

export const MENU_CATEGORY_ORDER_FIELD = "menuCategoryOrder";

/** Escalones de la regla fija. Lo desconocido cae en MAINS. */
export const RANK_STARTERS = 0;
export const RANK_BREAKFAST = 1;
export const RANK_SALADS = 2;
export const RANK_MAINS = 3;
export const RANK_COMBOS = 4;
export const RANK_DESSERTS = 5;
export const RANK_DRINKS = 6;
export const RANK_EXTRAS = 7;

/** "Pa' Papear " → "pa papear"; "Con Café" → "con cafe". Comparación sin acentos ni mayúsculas. */
export function normalizeCategoryKey(v: unknown): string {
  if (typeof v !== "string") return "";
  return v
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9ñ]+/g, " ")
    .trim();
}

// Cada regla es [palabras que la disparan, escalón]. Se evalúan en orden y
// gana la primera que pega: "extras de bebida" es EXTRAS aunque diga bebida.
const RULES: [RegExp, number][] = [
  [/\b(extra|extras|adicional|adicionales|agregados?|complementos?|otros?)\b/, RANK_EXTRAS],
  [/\b(postres?|dulces?|pasteles?|helados?|reposteria|panaderia)\b/, RANK_DESSERTS],
  [
    /\b(bebidas?|drinks?|con cafe|sin cafe|cafes?|coffee|lattes?|matcha|te|tes|tisanas?|mocktails?|cocteles?|cocktails?|micheladas?|cervezas?|vinos?|licores?|jugos?|smoothies?|malteadas?|frappes?|refrescos?|sodas?|aguas?|limonadas?|de temporada|temporada)\b/,
    RANK_DRINKS,
  ],
  [/\b(combos?|paquetes?|especiales?|promos?|promociones?|familiares?)\b/, RANK_COMBOS],
  [/\b(entradas?|botanas?|snacks?|aperitivos?|para compartir|pa papear|papas|dips?)\b/, RANK_STARTERS],
  [/\b(desayunos?|breakfast|brunch|con pan|panes?|toasts?|bagels?|omelettes?|huevos)\b/, RANK_BREAKFAST],
  [/\b(ensaladas?|sopas?|caldos?|cremas?)\b/, RANK_SALADS],
];

/** Escalón de la regla fija para una categoría (capa 2). */
export function categoryRank(category: unknown): number {
  const key = normalizeCategoryKey(category);
  if (!key) return RANK_EXTRAS; // sin categoría, al final
  for (const [re, rank] of RULES) if (re.test(key)) return rank;
  return RANK_MAINS;
}

/** El orden guardado en el doc, limpio; [] si no hay o viene mal. */
export function savedCategoryOrder(raw: Record<string, unknown> | null | undefined): string[] {
  const v = raw?.[MENU_CATEGORY_ORDER_FIELD];
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const x of v) {
    const k = normalizeCategoryKey(x);
    if (k && !seen.has(k)) {
      seen.add(k);
      out.push(k);
    }
  }
  return out;
}

/** Comparador de categorías: lista guardada → regla fija → alfabético (es). */
export function compareMenuCategories(a: string, b: string, saved: string[] = []): number {
  const ka = normalizeCategoryKey(a);
  const kb = normalizeCategoryKey(b);
  if (ka === kb) return 0;
  const ia = saved.indexOf(ka);
  const ib = saved.indexOf(kb);
  if (ia !== -1 || ib !== -1) {
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  }
  const ra = categoryRank(ka);
  const rb = categoryRank(kb);
  if (ra !== rb) return ra - rb;
  return ka.localeCompare(kb, "es");
}

/** Categorías únicas en el orden en que deben pintarse. */
export function orderMenuCategories(
  categories: Iterable<string>,
  raw?: Record<string, unknown> | null,
): string[] {
  const saved = savedCategoryOrder(raw);
  const uniq: string[] = [];
  const seen = new Set<string>();
  for (const c of categories) {
    const k = normalizeCategoryKey(c);
    if (seen.has(k)) continue;
    seen.add(k);
    uniq.push(c);
  }
  return uniq.sort((a, b) => compareMenuCategories(a, b, saved));
}

/** Platillos ordenados por categoría (las tres capas) y luego por nombre. */
export function sortMenuRows<T extends { category: string; name: string }>(
  rows: T[],
  raw?: Record<string, unknown> | null,
): T[] {
  const saved = savedCategoryOrder(raw);
  return [...rows].sort((a, b) => {
    const c = compareMenuCategories(a.category, b.category, saved);
    return c !== 0 ? c : a.name.localeCompare(b.name, "es");
  });
}

/**
 * El orden del papel, para guardarlo al reclamar el demo: categorías únicas en
 * el orden en que la IA las leyó de la foto (que es el orden impreso).
 */
export function paperCategoryOrder(items: { category?: string | null }[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const it of items) {
    const c = typeof it.category === "string" ? it.category.trim() : "";
    const k = normalizeCategoryKey(c);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(c);
  }
  return out;
}
