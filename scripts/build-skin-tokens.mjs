/**
 * Arma components/menu/skins/skinTokens.generated.css desde public/skins/{id}/skin.json (opción C, 9-oct-2026).
 * La piel vive UNA vez como datos; la web lee sus colores como variables CSS (--skin-*) y la app baja el mismo JSON.
 *
 * Run: npm run build:skin-tokens   (o: node --experimental-strip-types scripts/build-skin-tokens.mjs)
 * El candado scripts/validate-skin-json.mjs truena si el CSS no coincide con los JSON.
 */
import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { skinTokensCss } from "../lib/menu/skinTokens.ts";

const root = new URL("../public/skins/", import.meta.url);
const all = readdirSync(root, { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(new URL(`${d.name}/skin.json`, root)))
  .map((d) => JSON.parse(readFileSync(new URL(`${d.name}/skin.json`, root), "utf8")));

const out = new URL("../components/menu/skins/skinTokens.generated.css", import.meta.url);
writeFileSync(out, skinTokensCss(all));
console.log(`build-skin-tokens: ${all.length} pieles → components/menu/skins/skinTokens.generated.css`);
