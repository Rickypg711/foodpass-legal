/**
 * La piel como DATOS (opción C, 9-oct-2026).
 *
 * POR QUÉ EXISTE: cada local se ve como él mismo (sus colores, su portada, su logo, su forma de acomodar platillos)
 * y Comeleal es el marco (carrito, puntos, botón de pedir, "Hecho con Comeleal"). Para que la app y la web pinten
 * LA MISMA piel, la piel vive una sola vez como datos: `public/skins/{id}/skin.json`, servida en
 * https://www.comeleal.com/skins/{id}/skin.json junto a sus imágenes. La app la baja; la web la lee aquí.
 *
 * El vocabulario es cerrado y pequeño (lib/menu/skinVocabulary.json) para que los dos lados implementen TODAS las
 * opciones. Lo que una piel web hace y no cabe en el vocabulario va en `webOnlyExtras` y se sigue pintando en web.
 * Espejo en la app: FOODPASS lib/menu/skin/skin_tokens.dart (+ su copia del vocabulario, candado de paridad en
 * test/menu/skin_vocabulary_parity_test.dart y aquí en scripts/validate-skin-json.mjs).
 * Formato completo: FOODPASS docs/PIELES_COMO_DATOS.md.
 */
import vocabulary from "./skinVocabulary.json" with { type: "json" };

export const SKIN_VOCABULARY = vocabulary;
export const SKIN_SCHEMA_VERSION: number = vocabulary.schemaVersion;

export type FontRole = "display" | "accent" | "name" | "body";
export type TextCase = "none" | "upper" | "lower";

export type SkinFont = { family: string; weight: number; fallback: "serif" | "sans-serif" | "monospace" | "cursive" };

export type SkinTokens = {
  schemaVersion: number;
  id: string;
  name: string;
  paper: string;
  palette: Record<string, string>;
  typography: Partial<Record<FontRole, SkinFont>> & { display: SkinFont; name: SkinFont; body: SkinFont };
  hero: {
    variant: string;
    logo: string | null;
    logoShape: string;
    logoSize: number;
    cover: string | null;
    overlay: string;
    overlayColor?: string;
    /** Color del nombre en "wordmark" (sin él, heroInk). */
    nameColor?: string;
    align: string;
  };
  chips: { font: FontRole; size: number; weight: number; textCase: TextCase; tracking: number; borderWidth: number };
  section: {
    style: string;
    font: FontRole;
    size: number;
    weight: number;
    textCase: TextCase;
    tracking: number;
    italic: boolean;
    color: string;
    fill?: string;
    border?: string;
    align: string;
    surface: string;
    radius: number;
    dividers: string;
    dividerColor?: string;
  };
  sectionOverrides: {
    match: string[];
    color?: string;
    fill?: string;
    surface?: string;
    border?: string;
    borderStyle?: string;
    font?: FontRole;
    icon?: string;
    sticker?: string;
  }[];
  dish: {
    layout: string;
    photoShape: string;
    photoRadius: number;
    photoSize: number;
    photoBorder: string | null;
    nameFont: FontRole;
    nameSize: number;
    nameWeight: number;
    nameCase: TextCase;
    nameTracking: number;
    nameItalic: boolean;
    nameColor: string;
    descColor: string;
    descSize: number;
    leader: string;
    leaderColor?: string;
  };
  price: {
    style: string;
    font: FontRole;
    size: number;
    weight: number;
    italic: boolean;
    color: string;
    bg?: string;
    border?: string;
    smallCurrency: boolean;
  };
  ornaments: { role: string; asset: string; placement: string; opacity: number; size: number }[];
  footer: { ink: string; brandInk: string; linkInk: string; rule: string };
  webOnlyExtras: string[];
};

const COLOR_RE = /^#[0-9a-f]{6}([0-9a-f]{2})?$/;
const ASSET_RE = /^[a-z0-9][a-z0-9_.-]*\.(png|jpe?g|webp)$/;
const ID_RE = /^[a-z0-9][a-z0-9-]{1,31}$/;
const WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900];

/** La misma llave que usan las pieles web (`keyOf`) y la app (`skinKeyOf`): sin acentos, minúsculas, solo letras y números. */
export function skinKeyOf(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9ñ]+/g, " ")
    .trim();
}

/**
 * La excepción de una sección (sectionOverrides): la primera cuya llave sea exacta o el inicio de la llave de la
 * categoría seguido de espacio ("happy hour" atrapa "happy hour 3 a 4 pm"). Espejo: SkinTokens.overrideFor en la app.
 */
export function skinOverrideFor(tokens: Pick<SkinTokens, "sectionOverrides">, category: string): SkinTokens["sectionOverrides"][number] | null {
  const key = skinKeyOf(category);
  return tokens.sectionOverrides.find((o) => o.match.some((m) => key === m || key.startsWith(m + " "))) ?? null;
}

/** "#rrggbb" o "#rrggbbaa" → valor CSS. Con alfa: rgb(r g b / a) con 2 decimales (las pieles web usan /94, /35…). */
export function skinColorToCss(hex: string): string {
  const h = hex.toLowerCase();
  if (h.length === 7) return h;
  const r = parseInt(h.slice(1, 3), 16);
  const g = parseInt(h.slice(3, 5), 16);
  const b = parseInt(h.slice(5, 7), 16);
  const a = Math.round((parseInt(h.slice(7, 9), 16) / 255) * 100) / 100;
  return `rgb(${r} ${g} ${b} / ${a})`;
}

function kebab(s: string): string {
  return s.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase());
}

/** Variables CSS de la paleta: `--skin-bg`, `--skin-chip-active-bg`… (las lee la web; ver skinTokens.generated.css). */
export function skinCssVars(tokens: Pick<SkinTokens, "palette">): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of Object.keys(tokens.palette).sort()) {
    out[`--skin-${kebab(key)}`] = skinColorToCss(tokens.palette[key]!);
  }
  return out;
}

type Ctx = { errors: string[]; assetExists?: (file: string) => boolean };

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function oneOf(ctx: Ctx, path: string, v: unknown, allowed: readonly string[]) {
  if (typeof v !== "string" || !allowed.includes(v)) ctx.errors.push(`${path}: "${String(v)}" no está en [${allowed.join(", ")}]`);
}
function color(ctx: Ctx, path: string, v: unknown, optional = false) {
  if (v === undefined && optional) return;
  if (typeof v !== "string" || !COLOR_RE.test(v)) ctx.errors.push(`${path}: color inválido "${String(v)}" (usa #rrggbb o #rrggbbaa en minúsculas)`);
}
function num(ctx: Ctx, path: string, v: unknown, min: number, max: number) {
  if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max) ctx.errors.push(`${path}: número fuera de rango [${min}, ${max}]: ${String(v)}`);
}
function weight(ctx: Ctx, path: string, v: unknown) {
  if (typeof v !== "number" || !WEIGHTS.includes(v)) ctx.errors.push(`${path}: peso inválido ${String(v)}`);
}
function bool(ctx: Ctx, path: string, v: unknown) {
  if (typeof v !== "boolean") ctx.errors.push(`${path}: debe ser true/false`);
}
function asset(ctx: Ctx, path: string, v: unknown, nullable = false) {
  if (v === null && nullable) return;
  if (typeof v !== "string" || !ASSET_RE.test(v)) {
    ctx.errors.push(`${path}: imagen inválida "${String(v)}" (nombre de archivo png/jpg/webp en la carpeta de la piel)`);
    return;
  }
  if (ctx.assetExists && !ctx.assetExists(v)) ctx.errors.push(`${path}: falta el archivo public/skins/<id>/${v}`);
}
function role(ctx: Ctx, path: string, v: unknown, typography: Record<string, unknown>) {
  oneOf(ctx, path, v, vocabulary.fontRoles);
  if (typeof v === "string" && !isObj(typography[v])) ctx.errors.push(`${path}: usa el papel "${v}" pero typography.${v} no existe`);
}
function noExtraKeys(ctx: Ctx, path: string, o: Record<string, unknown>, allowed: string[]) {
  for (const k of Object.keys(o)) if (!allowed.includes(k)) ctx.errors.push(`${path}: campo desconocido "${k}" (fuera del vocabulario)`);
}

/**
 * Valida un skin.json contra el vocabulario. Devuelve la lista de errores (vacía = válido).
 * `assetExists` (opcional) revisa que cada imagen exista en la carpeta de la piel.
 */
export function validateSkinTokens(raw: unknown, opts: { id?: string; assetExists?: (file: string) => boolean } = {}): string[] {
  const ctx: Ctx = { errors: [], assetExists: opts.assetExists };
  if (!isObj(raw)) return ["skin.json: no es un objeto"];
  noExtraKeys(ctx, "skin", raw, [
    "$schema", "schemaVersion", "id", "name", "paper", "palette", "typography", "hero", "chips", "section",
    "sectionOverrides", "dish", "price", "ornaments", "footer", "webOnlyExtras",
  ]);
  if (raw.schemaVersion !== SKIN_SCHEMA_VERSION) ctx.errors.push(`schemaVersion: se espera ${SKIN_SCHEMA_VERSION}, viene ${String(raw.schemaVersion)}`);
  if (typeof raw.id !== "string" || !ID_RE.test(raw.id)) ctx.errors.push(`id inválido "${String(raw.id)}"`);
  if (opts.id && raw.id !== opts.id) ctx.errors.push(`id "${String(raw.id)}" no es el nombre de la carpeta "${opts.id}"`);
  if (typeof raw.name !== "string" || !raw.name.trim()) ctx.errors.push("name vacío");
  if (typeof raw.paper !== "string" || !raw.paper.trim()) ctx.errors.push("paper vacío (de dónde sale el look)");

  // Paleta
  const palette = raw.palette;
  if (!isObj(palette)) ctx.errors.push("palette falta");
  else {
    noExtraKeys(ctx, "palette", palette, [...vocabulary.paletteRequired, ...vocabulary.paletteOptional]);
    for (const k of vocabulary.paletteRequired) color(ctx, `palette.${k}`, palette[k]);
    for (const k of vocabulary.paletteOptional) color(ctx, `palette.${k}`, palette[k], true);
    if ((palette.surfaceAlt === undefined) !== (palette.inkAlt === undefined)) ctx.errors.push("palette.surfaceAlt e inkAlt van juntos");
  }

  // Tipografía
  const typography = isObj(raw.typography) ? raw.typography : {};
  if (!isObj(raw.typography)) ctx.errors.push("typography falta");
  noExtraKeys(ctx, "typography", typography, vocabulary.fontRoles);
  for (const r of vocabulary.fontRoles) {
    const f = typography[r];
    if (f === undefined && r === "accent") continue;
    if (!isObj(f)) {
      ctx.errors.push(`typography.${r} falta`);
      continue;
    }
    noExtraKeys(ctx, `typography.${r}`, f, ["family", "weight", "fallback"]);
    if (typeof f.family !== "string" || !/^[A-Z][A-Za-z0-9 ]+$/.test(f.family)) ctx.errors.push(`typography.${r}.family inválida (nombre de Google Fonts)`);
    weight(ctx, `typography.${r}.weight`, f.weight);
    oneOf(ctx, `typography.${r}.fallback`, f.fallback, vocabulary.fontFallbacks);
  }

  // Portada
  const hero = raw.hero;
  if (!isObj(hero)) ctx.errors.push("hero falta");
  else {
    noExtraKeys(ctx, "hero", hero, ["variant", "logo", "logoShape", "logoSize", "cover", "overlay", "overlayColor", "nameColor", "align"]);
    color(ctx, "hero.nameColor", hero.nameColor, true);
    oneOf(ctx, "hero.variant", hero.variant, vocabulary.heroVariants);
    asset(ctx, "hero.logo", hero.logo, true);
    oneOf(ctx, "hero.logoShape", hero.logoShape, vocabulary.logoShapes);
    num(ctx, "hero.logoSize", hero.logoSize, 0, 320);
    if (hero.cover !== null && hero.cover !== "restaurant") asset(ctx, "hero.cover", hero.cover);
    oneOf(ctx, "hero.overlay", hero.overlay, vocabulary.overlays);
    if (hero.overlay !== "none") color(ctx, "hero.overlayColor", hero.overlayColor);
    else color(ctx, "hero.overlayColor", hero.overlayColor, true);
    oneOf(ctx, "hero.align", hero.align, vocabulary.aligns);
    if ((hero.variant === "logo-center" || hero.variant === "logo-board") && !hero.logo) ctx.errors.push(`hero.variant "${String(hero.variant)}" necesita hero.logo`);
    if (hero.variant === "cover" && !hero.cover) ctx.errors.push('hero.variant "cover" necesita hero.cover');
  }

  // Chips
  const chips = raw.chips;
  if (!isObj(chips)) ctx.errors.push("chips falta");
  else {
    noExtraKeys(ctx, "chips", chips, ["font", "size", "weight", "textCase", "tracking", "borderWidth"]);
    role(ctx, "chips.font", chips.font, typography);
    num(ctx, "chips.size", chips.size, 10, 18);
    weight(ctx, "chips.weight", chips.weight);
    oneOf(ctx, "chips.textCase", chips.textCase, vocabulary.textCases);
    num(ctx, "chips.tracking", chips.tracking, -0.1, 0.5);
    num(ctx, "chips.borderWidth", chips.borderWidth, 0, 4);
  }

  // Encabezado de sección
  const section = raw.section;
  if (!isObj(section)) ctx.errors.push("section falta");
  else {
    noExtraKeys(ctx, "section", section, [
      "style", "font", "size", "weight", "textCase", "tracking", "italic", "color", "fill", "border", "align", "surface",
      "radius", "dividers", "dividerColor",
    ]);
    oneOf(ctx, "section.style", section.style, vocabulary.sectionStyles);
    role(ctx, "section.font", section.font, typography);
    num(ctx, "section.size", section.size, 14, 64);
    weight(ctx, "section.weight", section.weight);
    oneOf(ctx, "section.textCase", section.textCase, vocabulary.textCases);
    num(ctx, "section.tracking", section.tracking, -0.1, 0.5);
    bool(ctx, "section.italic", section.italic);
    color(ctx, "section.color", section.color);
    const needsFill = section.style === "sign" || section.style === "pill" || section.style === "oval";
    color(ctx, "section.fill", section.fill, !needsFill);
    color(ctx, "section.border", section.border, !needsFill);
    oneOf(ctx, "section.align", section.align, vocabulary.aligns);
    oneOf(ctx, "section.surface", section.surface, vocabulary.sectionSurfaces);
    num(ctx, "section.radius", section.radius, 0, 48);
    oneOf(ctx, "section.dividers", section.dividers, vocabulary.dividers);
    if (section.dividers !== "none") color(ctx, "section.dividerColor", section.dividerColor);
    if (section.surface === "alternate" && isObj(palette) && (!palette.surfaceAlt || !palette.inkAlt)) {
      ctx.errors.push('section.surface "alternate" necesita palette.surfaceAlt e inkAlt');
    }
  }

  // Excepciones por sección
  if (!Array.isArray(raw.sectionOverrides)) ctx.errors.push("sectionOverrides debe ser una lista (puede ir vacía)");
  else {
    raw.sectionOverrides.forEach((o, i) => {
      const p = `sectionOverrides[${i}]`;
      if (!isObj(o)) {
        ctx.errors.push(`${p}: no es objeto`);
        return;
      }
      noExtraKeys(ctx, p, o, ["match", "color", "fill", "surface", "border", "borderStyle", "font", "icon", "sticker"]);
      if (!Array.isArray(o.match) || !o.match.length || o.match.some((m) => typeof m !== "string" || skinKeyOf(m) !== m)) {
        ctx.errors.push(`${p}.match: lista de llaves ya normalizadas (skinKeyOf)`);
      }
      for (const k of ["color", "fill", "surface", "border"] as const) color(ctx, `${p}.${k}`, o[k], true);
      if (o.borderStyle !== undefined) oneOf(ctx, `${p}.borderStyle`, o.borderStyle, vocabulary.borderStyles);
      if (o.font !== undefined) role(ctx, `${p}.font`, o.font, typography);
      if (o.icon !== undefined) asset(ctx, `${p}.icon`, o.icon);
      if (o.sticker !== undefined) asset(ctx, `${p}.sticker`, o.sticker);
    });
  }

  // Platillo
  const dish = raw.dish;
  if (!isObj(dish)) ctx.errors.push("dish falta");
  else {
    noExtraKeys(ctx, "dish", dish, [
      "layout", "photoShape", "photoRadius", "photoSize", "photoBorder", "nameFont", "nameSize", "nameWeight", "nameCase",
      "nameTracking", "nameItalic", "nameColor", "descColor", "descSize", "leader", "leaderColor",
    ]);
    oneOf(ctx, "dish.layout", dish.layout, vocabulary.dishLayouts);
    oneOf(ctx, "dish.photoShape", dish.photoShape, vocabulary.photoShapes);
    num(ctx, "dish.photoRadius", dish.photoRadius, 0, 40);
    num(ctx, "dish.photoSize", dish.photoSize, 48, 160);
    if (dish.photoBorder !== null) color(ctx, "dish.photoBorder", dish.photoBorder);
    role(ctx, "dish.nameFont", dish.nameFont, typography);
    num(ctx, "dish.nameSize", dish.nameSize, 12, 36);
    weight(ctx, "dish.nameWeight", dish.nameWeight);
    oneOf(ctx, "dish.nameCase", dish.nameCase, vocabulary.textCases);
    num(ctx, "dish.nameTracking", dish.nameTracking, -0.1, 0.5);
    bool(ctx, "dish.nameItalic", dish.nameItalic);
    color(ctx, "dish.nameColor", dish.nameColor);
    color(ctx, "dish.descColor", dish.descColor);
    num(ctx, "dish.descSize", dish.descSize, 11, 18);
    oneOf(ctx, "dish.leader", dish.leader, vocabulary.leaders);
    if (dish.leader === "dots") color(ctx, "dish.leaderColor", dish.leaderColor);
  }

  // Precio
  const price = raw.price;
  if (!isObj(price)) ctx.errors.push("price falta");
  else {
    noExtraKeys(ctx, "price", price, ["style", "font", "size", "weight", "italic", "color", "bg", "border", "smallCurrency"]);
    oneOf(ctx, "price.style", price.style, vocabulary.priceStyles);
    role(ctx, "price.font", price.font, typography);
    num(ctx, "price.size", price.size, 11, 30);
    weight(ctx, "price.weight", price.weight);
    bool(ctx, "price.italic", price.italic);
    color(ctx, "price.color", price.color);
    color(ctx, "price.bg", price.bg, price.style === "plain");
    color(ctx, "price.border", price.border, price.style !== "pill");
    bool(ctx, "price.smallCurrency", price.smallCurrency);
  }

  // Adornos
  if (!Array.isArray(raw.ornaments)) ctx.errors.push("ornaments debe ser una lista (puede ir vacía)");
  else {
    raw.ornaments.forEach((o, i) => {
      const p = `ornaments[${i}]`;
      if (!isObj(o)) {
        ctx.errors.push(`${p}: no es objeto`);
        return;
      }
      noExtraKeys(ctx, p, o, ["role", "asset", "placement", "opacity", "size"]);
      oneOf(ctx, `${p}.role`, o.role, vocabulary.ornamentRoles);
      asset(ctx, `${p}.asset`, o.asset);
      oneOf(ctx, `${p}.placement`, o.placement, vocabulary.ornamentPlacements);
      num(ctx, `${p}.opacity`, o.opacity, 0.02, 1);
      num(ctx, `${p}.size`, o.size, 8, 400);
      if (o.role === "pattern" && o.placement !== "page") ctx.errors.push(`${p}: un patrón solo va en "page"`);
    });
  }

  // Pie
  const footer = raw.footer;
  if (!isObj(footer)) ctx.errors.push("footer falta");
  else {
    noExtraKeys(ctx, "footer", footer, ["ink", "brandInk", "linkInk", "rule"]);
    for (const k of ["ink", "brandInk", "linkInk", "rule"]) color(ctx, `footer.${k}`, footer[k]);
  }

  if (!Array.isArray(raw.webOnlyExtras) || raw.webOnlyExtras.some((s) => typeof s !== "string" || !s.trim())) {
    ctx.errors.push("webOnlyExtras: lista de textos (puede ir vacía)");
  }
  return ctx.errors;
}

/**
 * Clase raíz de cada piel web (la pone MenuView con pageClassFor). Las variables `--skin-*` se declaran ahí, así que
 * todo lo que vive dentro de la página (chips, hoja, pie) las hereda. Piel nueva = su clase aquí.
 */
export const SKIN_WEB_ROOT_CLASS: Record<string, string> = {
  tercera: "tercera-skin",
  pecado: "pecado-skin",
  negroblanco: "nb-skin",
  blooms: "bl-skin",
  mixteco: "mx-skin",
  laspic: "lp-skin",
  tortasperras: "tp-skin",
  igo: "igo-skin",
  omu: "omu-skin",
  fresheria: "fr-skin",
  kame: "kame-skin",
  suadero: "sd-skin",
  manantial: "mn-skin",
};

/** El CSS generado (components/menu/skins/skinTokens.generated.css): una regla por piel con sus variables. */
export function skinTokensCss(all: Pick<SkinTokens, "id" | "palette">[]): string {
  const lines = [
    "/* GENERADO por scripts/build-skin-tokens.mjs desde public/skins/{id}/skin.json. NO EDITAR A MANO:",
    "   cambia el skin.json y corre `npm run build:skin-tokens`. El candado (scripts/validate-skin-json.mjs) truena",
    "   si este archivo no coincide con los skin.json. */",
  ];
  for (const t of [...all].sort((a, b) => a.id.localeCompare(b.id))) {
    const cls = SKIN_WEB_ROOT_CLASS[t.id];
    if (!cls) continue;
    lines.push(`.${cls} {`);
    for (const [k, v] of Object.entries(skinCssVars(t))) lines.push(`  ${k}: ${v};`);
    lines.push("}");
  }
  return lines.join("\n") + "\n";
}

/** Inverso de skinColorToCss (para el candado de ida y vuelta). */
export function skinCssToColor(css: string): string {
  const v = css.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(v)) return v;
  const m = /^rgb\((\d{1,3}) (\d{1,3}) (\d{1,3}) \/ ([0-9.]+)\)$/.exec(v);
  if (!m) throw new Error(`color CSS inesperado: ${css}`);
  const hex = (n: number) => n.toString(16).padStart(2, "0");
  return `#${hex(+m[1]!)}${hex(+m[2]!)}${hex(+m[3]!)}${hex(Math.round(parseFloat(m[4]!) * 255))}`;
}
