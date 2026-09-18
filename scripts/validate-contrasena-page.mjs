/**
 * Candado: comeleal.com/contrasena es la página de los links de correo de
 * Firebase (18-sep-2026). Todo el camino se llama Comeleal: correo de Ricardo
 * → esta página → el panel.
 *
 * 1. Valida y guarda con el SDK (verifyPasswordResetCode + confirmPasswordReset)
 *    y aplica los otros códigos (applyActionCode). El código jamás se manda a
 *    un endpoint nuestro.
 * 2. Un link caducado ofrece pedir otro con lib/passwordReset (Resend).
 * 3. noindex: es de un solo uso por link.
 * 4. Jamás "liga". Español de secundaria.
 *
 * Run: node scripts/validate-contrasena-page.mjs
 */
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const page = read("app/contrasena/page.tsx");
for (const fn of ["verifyPasswordResetCode", "confirmPasswordReset", "applyActionCode"]) {
  assert.ok(page.includes(fn), `la página usa ${fn}`);
}
assert.ok(!page.includes("fetch("), "el código del link no viaja a ningún endpoint nuestro");
assert.ok(page.includes('from "@/lib/passwordReset"'), "un link caducado deja pedir otro por Resend");
assert.ok(page.includes("ya caducó o ya se usó"), "explica el link caducado en español");
assert.ok(!/\bliga\b/i.test(page), 'jamás "liga"');
assert.ok(page.includes("Suspense"), "useSearchParams va dentro de Suspense");

const layout = read("app/contrasena/layout.tsx");
assert.ok(/index:\s*false/.test(layout), "/contrasena lleva noindex");

console.log("✓ /contrasena: SDK en el navegador, otro link por Resend, noindex, sin liga");
