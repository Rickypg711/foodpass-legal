/**
 * Candado (9-oct-2026, opción C "la piel como datos"): cada piel del menú vive UNA vez como datos en
 * public/skins/{id}/skin.json, y la app (FOODPASS lib/menu/skin/) y la web la pintan con el mismo vocabulario cerrado
 * (lib/menu/skinVocabulary.json). Este candado revisa:
 *  1. Toda piel viva (lib/menu/menuSkin.ts) y toda carpeta de public/skins tiene un skin.json válido, con sus imágenes.
 *  2. Las letras del JSON son las que la piel web de verdad carga (next/font/google en components/menu/skins/{id}.tsx).
 *  3. Ida y vuelta: JSON → texto → JSON igual; color → CSS → color igual; el CSS generado coincide con los JSON.
 *  4. La web lee los colores de los chips de las variables (no del hex suelto) en las pieles con skin.json.
 *  5. Espejo del vocabulario con la app: si el repo FOODPASS está a la mano, su copia es idéntica byte por byte.
 *
 * Run: node --experimental-strip-types scripts/validate-skin-json.mjs
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import {
  validateSkinTokens,
  skinTokensCss,
  skinColorToCss,
  skinCssToColor,
  skinCssVars,
  SKIN_WEB_ROOT_CLASS,
  SKIN_SCHEMA_VERSION,
} from "../lib/menu/skinTokens.ts";

let failed = 0;
function must(cond, label) {
  if (!cond) {
    console.error(`FAIL ${label}`);
    failed = 1;
  }
}

const skinsDir = new URL("../public/skins/", import.meta.url);
const menuSkinTs = readFileSync(new URL("../lib/menu/menuSkin.ts", import.meta.url), "utf8");
const known = JSON.parse(/const KNOWN: readonly string\[\] = (\[[^\]]*\])/.exec(menuSkinTs)?.[1] ?? "[]");
must(known.length >= 13, `lib/menu/menuSkin.ts KNOWN legible (${known.length})`);

const folders = readdirSync(skinsDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
const ids = [...new Set([...known, ...folders])].sort();

const all = [];
for (const id of ids) {
  const dir = new URL(`${id}/`, skinsDir);
  const file = new URL("skin.json", dir);
  if (!existsSync(file)) {
    must(false, `${id}: falta public/skins/${id}/skin.json`);
    continue;
  }
  const text = readFileSync(file, "utf8");
  let tokens;
  try {
    tokens = JSON.parse(text);
  } catch (e) {
    must(false, `${id}: skin.json no es JSON (${e.message})`);
    continue;
  }
  const errors = validateSkinTokens(tokens, { id, assetExists: (f) => existsSync(new URL(f, dir)) });
  for (const e of errors) must(false, `${id}: ${e}`);
  all.push(tokens);

  // 2. Las letras del JSON las carga la piel web.
  const tsxUrl = new URL(`../components/menu/skins/${id}.tsx`, import.meta.url);
  if (existsSync(tsxUrl)) {
    const tsx = readFileSync(tsxUrl, "utf8");
    const imported = /import\s*\{([^}]*)\}\s*from\s*"next\/font\/google"/.exec(tsx)?.[1] ?? "";
    for (const [role, f] of Object.entries(tokens.typography ?? {})) {
      const nextName = String(f.family).replace(/ /g, "_");
      must(new RegExp(`\\b${nextName}\\b`).test(imported), `${id}: typography.${role} "${f.family}" no la carga ${id}.tsx (next/font/google)`);
    }
    must(tsx.includes('import "./skinTokens.generated.css"'), `${id}.tsx importa skinTokens.generated.css`);
  }
  must(known.includes(id) ? Boolean(SKIN_WEB_ROOT_CLASS[id]) : true, `${id}: falta su clase raíz en SKIN_WEB_ROOT_CLASS`);

  // 3. Ida y vuelta.
  must(isDeepStrictEqual(JSON.parse(JSON.stringify(tokens)), tokens), `${id}: JSON → texto → JSON`);
  for (const [k, hex] of Object.entries(tokens.palette ?? {})) {
    must(skinCssToColor(skinColorToCss(hex)) === hex, `${id}: palette.${k} ${hex} no regresa igual por CSS (${skinColorToCss(hex)})`);
  }
}
must(all.length === ids.length, "todas las pieles leídas");

// 3b. El CSS generado coincide con los JSON (y se puede leer de regreso a la paleta).
const cssUrl = new URL("../components/menu/skins/skinTokens.generated.css", import.meta.url);
const css = existsSync(cssUrl) ? readFileSync(cssUrl, "utf8") : "";
must(css === skinTokensCss(all), "skinTokens.generated.css al día (corre `npm run build:skin-tokens`)");
for (const t of all) {
  const cls = SKIN_WEB_ROOT_CLASS[t.id];
  if (!cls) continue;
  const block = new RegExp(`\\.${cls} \\{\\n([\\s\\S]*?)\\n\\}`).exec(css)?.[1] ?? "";
  const back = {};
  for (const m of block.matchAll(/ {2}(--skin-[a-z-]+): ([^;]+);/g)) back[m[1]] = m[2];
  must(isDeepStrictEqual(back, skinCssVars(t)), `${t.id}: variables CSS = paleta del JSON`);
}

// 4. Los chips de las pieles leen las variables.
const chips = readFileSync(new URL("../components/menu/MenuCategoryChips.tsx", import.meta.url), "utf8");
for (const v of ["--skin-chip-bar", "--skin-chip-active-bg", "--skin-chip-active-ink", "--skin-chip-active-border", "--skin-chip-inactive-ink", "--skin-chip-inactive-border"]) {
  must(chips.includes(`var(${v})`), `MenuCategoryChips lee ${v}`);
}

// 4b. El fondo de la página sale de --skin-bg (con el mismo hex de respaldo que el JSON).
for (const t of all) {
  const cssFile = new URL(`../components/menu/skins/${t.id}.css`, import.meta.url);
  const tsxFile = new URL(`../components/menu/skins/${t.id}.tsx`, import.meta.url);
  const src = (existsSync(cssFile) ? readFileSync(cssFile, "utf8") : "") + (existsSync(tsxFile) ? readFileSync(tsxFile, "utf8") : "");
  const bg = t.palette.bg;
  must(src.includes(`var(--skin-bg, ${bg})`) || src.includes(`var(--skin-bg,${bg})`), `${t.id}: el fondo lee var(--skin-bg, ${bg})`);
}

// 5. Espejo del vocabulario con la app.
const vocab = readFileSync(new URL("../lib/menu/skinVocabulary.json", import.meta.url), "utf8");
must(JSON.parse(vocab).schemaVersion === SKIN_SCHEMA_VERSION, "schemaVersion del vocabulario");
const foodpass = process.env.FOODPASS_DIR || join(homedir(), "projects", "FOODPASS");
const mirror = join(foodpass, "lib", "menu", "skin", "skin_vocabulary.json");
if (existsSync(mirror)) {
  must(readFileSync(mirror, "utf8") === vocab, `vocabulario idéntico en la app (${mirror})`);
} else {
  console.log(`(aviso) sin espejo de la app en ${mirror}: se revisa solo el lado web`);
}

// Una piel inventada truena (el candado sí muerde).
const bad = JSON.parse(JSON.stringify(all[0] ?? {}));
if (bad.dish) bad.dish.layout = "carrusel-3d";
if (bad.palette) bad.palette.bg = "rojo";
const badErrors = validateSkinTokens(bad, { id: bad.id });
must(badErrors.some((e) => e.includes("dish.layout")) && badErrors.some((e) => e.includes("palette.bg")), "el validador rechaza valores fuera del vocabulario");

if (failed) process.exit(1);
console.log(`validate-skin-json: OK (${all.length} pieles, vocabulario v${SKIN_SCHEMA_VERSION})`);
