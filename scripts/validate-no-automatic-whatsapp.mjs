/**
 * El win-back por WhatsApp es MANUAL y GRATIS — candado 5-sep-2026.
 *
 * No existe API de WhatsApp conectada: Comeleal detecta quién dejó de venir
 * y arma el mensaje; el DUEÑO lo manda por wa.me con un toque. Y va en el
 * plan gratis. La página de plan, /precios, Configuración y el marketing
 * por vertical lo vendían como "Recuperación automática por WhatsApp" y
 * como Pro — la promesa que no existe (Ricardo, 5-sep: "we do not have the
 * API, please remember this"). Lo único automático es el PUSH a usuarios
 * de la app.
 *
 * Run: node scripts/validate-no-automatic-whatsapp.mjs
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const FORBIDDEN = [
  /Recuperaci[oó]n autom[aá]tica (por|del|de) WhatsApp/i,
  /autom[aá]tic\w* por WhatsApp/i,
  /le llega un mensaje para que regrese/i,
];
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next" || name.startsWith(".")) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx?|mdx?|json)$/.test(name)) out.push(p);
  }
  return out;
}
const files = [...walk(join(root, "app")), ...walk(join(root, "components")), ...walk(join(root, "lib"))];
const hits = [];
for (const f of files) {
  const src = readFileSync(f, "utf8");
  for (const re of FORBIDDEN) if (re.test(src)) hits.push(`${f.replace(root + "/", "")} :: ${re}`);
}
assert.deepEqual(hits, [], "copy que vende WhatsApp automático:\n" + hits.join("\n"));

// Y lo honesto SÍ está en la lista gratis de las dos páginas de precio.
for (const f of ["app/vendor/plan/page.tsx", "app/precios/page.tsx"]) {
  const src = readFileSync(join(root, f), "utf8");
  assert.ok(src.includes("te arma el WhatsApp — tú lo mandas"), `${f}: el win-back a mano debe estar en la lista gratis`);
}
console.log("validate-no-automatic-whatsapp: OK");
