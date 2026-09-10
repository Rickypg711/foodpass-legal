/**
 * El color de marca y el lema impreso (8-sep-2026).
 *
 * POR QUÉ EXISTE: dos restaurantes lado a lado se veían como el mismo (todos
 * con el gris #141414). El demo recorta el logo de la foto y el fondo de ese
 * recorte es el color del menú de papel; se guarda como `brandColor` y el
 * encabezado del menú, la portada /r, el aparador del demo y la tarjeta QR lo
 * pintan. La tinta se decide por luminancia.
 *
 * Contrato (lib/brand/brandColor.ts, espejo de lib/utils/brand_color.dart en
 * la app y toBrandHex en functions/menu_logo_ai.js):
 *  1. Un solo formato: "#rrggbb" minúsculas. Cualquier otra cosa → null.
 *  2. Sin brandColor → gris de siempre (#141414), tinta blanca, custom=false.
 *     Y CON brandColor también, mientras PAINT_BRAND_COLOR sea false
 *     (Ricardo, 8-sep noche: pintado se veía feo; el dato se guarda).
 *  3. Fondo claro (luminancia > 0.45) → tinta oscura; oscuro → blanca.
 *     Naranja Pesados #f0a61f → oscura. Guinda Birria Lalo #3d0210 → blanca.
 *  4. El lema solo se pinta si es frase corta (3–60); nunca se redacta aquí.
 *
 * Run: node scripts/validate-brand-color.mjs   (Node ≥ 22.6 con strip-types)
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const mod = await import(join(root, "lib/brand/brandColor.ts"));
const {
  normalizeBrandColor, onBrandColor, relativeLuminance,
  brandThemeFromRestaurant, taglineFromRestaurant, inkAlpha,
  normalizeTaglineInput, TAGLINE_MAX,
  BRAND_DEFAULT_BG, INK_LIGHT, INK_DARK, LIGHT_BG_LUMINANCE, PAINT_BRAND_COLOR,
} = mod;

// 1. Formato
assert.equal(normalizeBrandColor("#F0A61F"), "#f0a61f");
assert.equal(normalizeBrandColor("f0a61f"), "#f0a61f");
assert.equal(normalizeBrandColor("#fa1"), "#ffaa11");
assert.equal(normalizeBrandColor(" #3D0210 "), "#3d0210");
assert.equal(normalizeBrandColor("#f0a61f80"), null);
assert.equal(normalizeBrandColor("orange"), null);
assert.equal(normalizeBrandColor(""), null);
assert.equal(normalizeBrandColor(123), null);
assert.equal(normalizeBrandColor(undefined), null);

// 2. Sin color → lo de siempre
const plain = brandThemeFromRestaurant({ name: "X" });
assert.deepEqual(plain, { bg: BRAND_DEFAULT_BG, ink: INK_LIGHT, custom: false });
assert.equal(brandThemeFromRestaurant(null).custom, false);

// 3. Los dos casos reales
assert.ok(relativeLuminance("#f0a61f") > LIGHT_BG_LUMINANCE, "naranja Pesados es claro");
assert.equal(onBrandColor("#f0a61f"), INK_DARK);
assert.ok(relativeLuminance("#3d0210") < 0.05, "guinda es oscuro");
assert.equal(onBrandColor("#3d0210"), INK_LIGHT);
assert.equal(onBrandColor("#ffffff"), INK_DARK);
assert.equal(onBrandColor("#000000"), INK_LIGHT);
// Decisión de Ricardo (8-sep noche): el color se GUARDA pero NO se pinta —
// el encabezado es el gris de siempre aunque el doc traiga brandColor.
assert.equal(PAINT_BRAND_COLOR, false, "el color de marca no se pinta (Ricardo, 8-sep)");
assert.deepEqual(brandThemeFromRestaurant({ brandColor: "#3D0210" }), { bg: BRAND_DEFAULT_BG, ink: INK_LIGHT, custom: false });

// 4. Lema
assert.equal(taglineFromRestaurant({ tagline: " Desde   1960 " }), "Desde 1960");
assert.equal(taglineFromRestaurant({ tagline: "" }), null);
assert.equal(taglineFromRestaurant({ tagline: "a".repeat(61) }), null);
assert.equal(taglineFromRestaurant({ tagline: 7 }), null);
assert.equal(taglineFromRestaurant(null), null);

// inkAlpha
assert.equal(inkAlpha("#1C2526", 0.6), "rgba(28,37,38,0.6)");
assert.equal(inkAlpha("#FFFFFF", 0.5), "rgba(255,255,255,0.5)");

// 5. Las cuatro superficies leen el color (candado de fuente)
const must = [
  ["app/menu/[restaurantId]/MenuView.tsx", "brandThemeFromRestaurant"],
  ["app/r/[restaurantId]/LandingView.tsx", "brandThemeFromRestaurant"],
  ["app/demo/[jobId]/page.tsx", "info?.brandColor"],
  ["app/vendor/_components/MenuShareModal.tsx", "normalizeBrandColor(d.brandColor)"],
  ["components/home/ActivarModal.tsx", "brandColor: demo.info.brandColor"],
];
for (const [file, needle] of must) {
  const src = readFileSync(join(root, file), "utf8");
  assert.ok(src.includes(needle), `${file} debe leer el color de marca (${needle})`);
}
// 6. El lema que escribe el dueño (10-sep-2026): se limpia, no se redacta
assert.equal(TAGLINE_MAX, 60);
assert.equal(normalizeTaglineInput("  Desde   1998, el mismo sazón. "), "Desde 1998, el mismo sazón");
assert.equal(normalizeTaglineInput("«Los tacos de siempre»"), "Los tacos de siempre");
assert.equal(normalizeTaglineInput("ok"), "", "menos de 3 letras → vacío (borra el campo)");
assert.equal(normalizeTaglineInput(""), "");
assert.equal(normalizeTaglineInput(null), "");
assert.equal(normalizeTaglineInput("x".repeat(80)).length, TAGLINE_MAX, "se recorta al tope");
// Lo que guarda el dueño lo pinta la portada y el menú (mismo lector)
assert.equal(taglineFromRestaurant({ tagline: normalizeTaglineInput(" Ricos tacos ") }), "Ricos tacos");
// Candado de fuente: Configuración guarda por el normalizador y carga con el lector
const cfg = readFileSync(join(root, "app/vendor/configuracion/page.tsx"), "utf8");
assert.ok(cfg.includes("tagline: normalizeTaglineInput(tagline) || deleteField()"), "configuracion guarda el lema limpio o lo borra");
assert.ok(cfg.includes("setTagline(taglineFromRestaurant(data) ?? \"\")"), "configuracion carga el lema con el mismo lector que la portada");
console.log("✅ brand color: contrato OK");
