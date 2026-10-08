/**
 * Candado sin robot para TODO el copy de la web (8-oct-2026). Skill:
 * .claude/skills/comeleal-copy-sin-robot (la misma de FOODPASS).
 *
 * ESPEJO de FOODPASS/scripts/video/anti_robot.py (formas de alta confianza; sin
 * la de tríadas, que da falsos positivos con listas de cosas). Si cambias una
 * forma allá, cámbiala aquí.
 *
 * Trinquete: lo que ya existía y se revisó vive en
 * scripts/copy-sin-robot-baseline.json (títulos "Nombre — descripción", texto
 * del local en las pieles, nombres de producto). Un texto NUEVO con forma de
 * robot truena: se arregla el texto. Solo si es falso positivo de verdad:
 *   node scripts/validate-copy-sin-robot.mjs --update-baseline
 * y se dice por qué en el commit.
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASELINE = join(ROOT, "scripts", "copy-sin-robot-baseline.json");

const FORMAS = [
  [/\bno es (solo|sólo|nada más)\b[^.]*,\s*es\b/i, "«no es solo X, es Y»"],
  [/\bno es\b[^.]*,\s*sino\b/i, "«no es X, sino Y»"],
  [/\b(y lo mejor|lo bueno|lo mejor de todo|la clave|el secreto)\s*:/i, "dos puntos de revelación"],
  [/(^|\n)\s*(es tu momento|vuelve pronto|así de fácil|así de simple)\.?\s*($|\n)/i, "cierre de una línea"],
  [/(?<![\wáéíóúñ])(exclusiv\w*|increíble\w*|experiencia\w*|aprovech\w*|disfrut\w*|oportunidad\w*|especial\w*|no te lo pierdas|potenci\w*|impuls\w*|optimiz\w*|sin duda|espero que te sirva)(?![\wáéíóúñ])/i, "palabra de oficina/robot"],
  [/(?<![\wáéíóúñ])liga(?![\wáéíóúñ])/i, "«liga» (se dice link)"],
  [/\bno es\b[^.\n]{0,60}\.\s*es (que )?\b/i, "«No es X. Es Y» (en dos frases)"],
  [/,\s*no \w+\.(\s|$)/i, "cierre «X, no Y.» que repite lo dicho"],
  [/—/, "raya — (muletilla de IA; usa coma o punto)"],
  [/\bsab(es|er|emos|rás) quién (te compr|fue)/i, "suena a vigilancia"],
];

function revisar(t) {
  const out = FORMAS.filter(([re]) => re.test(t)).map(([, name]) => name);
  if ((t.match(/!/g) || []).length > 1) out.push("más de un signo de exclamación");
  return out;
}

const SPANISH = /[a-záéíóúñ]{3,} [a-záéíóúñ]{2,}/i;
const STR = /"((?:[^"\\\n]|\\.){8,})"|'((?:[^'\\\n]|\\.){8,})'|`([^`]{8,})`|>\s*([^<>{}\n]{8,}?)\s*</g;
const SKIP_LINE = /^\s*(\/\/|\*|\/\*|\{\/\*|import |export \* )/;
const LOG_LINE = /\b(console\.\w+|throw new|new Error)\s*\(/;
const CODE_ISH = /(px|rem)\b|text-\[|bg-|font-|rounded|tracking-|https?:\/\/|^[\w./@-]+$/;

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (/\.(tsx?|mjs)$/.test(name) && !/\.test\./.test(name)) yield p;
  }
}

function hits() {
  const out = new Set();
  for (const base of ["app", "components", "lib"]) {
    for (const f of walk(join(ROOT, base))) {
      const rel = relative(ROOT, f);
      for (const line of readFileSync(f, "utf8").split("\n")) {
        if (SKIP_LINE.test(line) || LOG_LINE.test(line)) continue;
        const code = line.split(/\s\/\/\s/)[0];
        for (const m of code.matchAll(STR)) {
          const t = (m[1] ?? m[2] ?? m[3] ?? m[4] ?? "").trim();
          if (!SPANISH.test(t) || CODE_ISH.test(t)) continue;
          for (const a of revisar(t)) out.add(`${rel} | ${a} | ${t.slice(0, 160)}`);
        }
      }
    }
  }
  return out;
}

const found = hits();
if (process.argv.includes("--update-baseline")) {
  writeFileSync(BASELINE, JSON.stringify([...found].sort(), null, 1) + "\n");
  console.log(`baseline: ${found.size} entradas`);
  process.exit(0);
}
const base = new Set(existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, "utf8")) : []);
const nuevos = [...found].filter((h) => !base.has(h)).sort();
if (nuevos.length) {
  console.error("Copy con forma de robot (skill comeleal-copy-sin-robot). Arréglalo:");
  for (const n of nuevos) console.error("  " + n);
  process.exit(1);
}
console.log(`✅ validate-copy-sin-robot: 0 nuevos (${found.size} conocidos en la lista)`);
