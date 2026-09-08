/**
 * El color de marca del local (8-sep-2026).
 *
 * POR QUÉ EXISTE: dos restaurantes lado a lado se veían como el mismo
 * restaurante — todos con el gris #141414 de Comeleal en el encabezado
 * (SETUP_DE_PAGA_NO_GENERICO.md: 0/40 en portada). El demo ya recorta el
 * logo de la foto del menú y el fondo de ese recorte ES el color del menú de
 * papel (naranja Pesados, guinda Birria Lalo). Se guarda como
 * `restaurants/{id}.brandColor` y aquí se decide cómo pintarlo.
 *
 * Espejo exacto de `lib/utils/brand_color.dart` (app) y de `toBrandHex` en
 * `functions/menu_logo_ai.js`: un solo formato "#rrggbb", y la tinta del
 * texto se decide por luminancia. Si cambias un umbral, cámbialo en los tres.
 */

/** El gris de siempre — cuando el local no tiene color propio. */
export const BRAND_DEFAULT_BG = "#141414";
/** Tinta clara y oscura del sistema. */
export const INK_LIGHT = "#FFFFFF";
export const INK_DARK = "#1C2526";
/**
 * Luminancia relativa (WCAG) a partir de la cual el fondo se considera
 * claro y el texto va en tinta oscura. 0.45 deja el naranja Pesados
 * (#f0a61f, ≈0.46) en tinta oscura y el guinda (#3d0210, ≈0.02) en blanca.
 */
export const LIGHT_BG_LUMINANCE = 0.45;

const HEX6 = /^#?([0-9a-f]{6})$/i;
const HEX3 = /^#?([0-9a-f]{3})$/i;

/** "#F0A61F" | "f0a61f" | "#fa1" → "#f0a61f"; cualquier otra cosa → null. */
export function normalizeBrandColor(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  const m6 = HEX6.exec(t);
  if (m6) return `#${m6[1]!.toLowerCase()}`;
  const m3 = HEX3.exec(t);
  if (m3) {
    const [a, b, c] = m3[1]!.toLowerCase();
    return `#${a}${a}${b}${b}${c}${c}`;
  }
  return null;
}

/** Luminancia relativa WCAG 2.x de un "#rrggbb" normalizado. */
export function relativeLuminance(hex: string): number {
  const n = normalizeBrandColor(hex);
  if (!n) return 0;
  const ch = (i: number) => {
    const c = parseInt(n.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * ch(1) + 0.7152 * ch(3) + 0.0722 * ch(5);
}

/** Tinta del texto sobre el color de marca: blanca sobre oscuro, oscura sobre claro. */
export function onBrandColor(hex: string): string {
  return relativeLuminance(hex) > LIGHT_BG_LUMINANCE ? INK_DARK : INK_LIGHT;
}

export type BrandTheme = {
  /** Fondo del encabezado. */
  bg: string;
  /** Tinta del texto sobre `bg`. */
  ink: string;
  /** true cuando el local trae color propio (no el gris de Comeleal). */
  custom: boolean;
};

/** Lee `brandColor` del doc del restaurante y arma el tema del encabezado. */
export function brandThemeFromRestaurant(
  data: Record<string, unknown> | null | undefined,
): BrandTheme {
  const bg = normalizeBrandColor(data?.brandColor);
  if (!bg) return { bg: BRAND_DEFAULT_BG, ink: INK_LIGHT, custom: false };
  return { bg, ink: onBrandColor(bg), custom: true };
}

/**
 * El lema impreso del menú ("Desde 1960"). Solo se pinta si es una frase
 * corta; el saneado fuerte ya lo hizo la función al leerlo.
 */
export function taglineFromRestaurant(
  data: Record<string, unknown> | null | undefined,
): string | null {
  const t = data?.tagline;
  if (typeof t !== "string") return null;
  const s = t.replace(/\s+/g, " ").trim();
  return s.length >= 3 && s.length <= 60 ? s : null;
}

/** Tinta con opacidad, para subtítulos sobre el color de marca. */
export function inkAlpha(ink: string, alpha: number): string {
  const n = normalizeBrandColor(ink) ?? INK_LIGHT;
  const r = parseInt(n.slice(1, 3), 16);
  const g = parseInt(n.slice(3, 5), 16);
  const b = parseInt(n.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
