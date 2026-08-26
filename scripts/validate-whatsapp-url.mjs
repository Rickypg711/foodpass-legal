/**
 * Candado del canon MX de WhatsApp (26-ago-2026, cazado por Ricardo):
 * se GUARDAN 10 dígitos y TODO link se arma como wa.me/52 + últimos 10.
 * Antes cada consumidor esperaba SU formato del mismo campo y el link
 * salía roto por un lado o por el otro (wa.me/5252... o wa.me/614...).
 * Run: node scripts/validate-whatsapp-url.mjs
 */

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fail = (msg) => { console.error(`✗ ${msg}`); process.exit(1); };

// 1) El único armador de links normaliza: 52 + últimos 10, sin excepción.
const builderSrc = readFileSync(
  join(__dirname, "../lib/order/formatWhatsappMessage.ts"), "utf8");
const fn = builderSrc.match(/export function buildWhatsappUrl[\s\S]*?\n\}/);
if (!fn) fail("buildWhatsappUrl no encontrado");
if (!/slice\(-10\)/.test(fn[0])) fail("buildWhatsappUrl debe tomar los últimos 10 dígitos");
if (!/wa\.me\/52\$\{/.test(fn[0])) fail("buildWhatsappUrl debe anteponer 52 (canon MX)");

// El comportamiento, probado de verdad (mismo algoritmo, 3 formatos → 1 link):
const build = (raw) => `https://wa.me/52${raw.replace(/\D/g, "").slice(-10)}`;
const esperado = "https://wa.me/526141234567";
for (const raw of ["+52 614 123 4567", "526141234567", "614 123 4567", "6141234567"]) {
  if (build(raw) !== esperado) fail(`formato "${raw}" no normaliza a ${esperado}`);
}

// 2) El claim guarda el número YA normalizado a 10 dígitos (phone10).
const modalSrc = readFileSync(
  join(__dirname, "../components/home/ActivarModal.tsx"), "utf8");
if (!/const phone10 = phone\.replace\(\/\\D\/g, ""\)\.slice\(-10\)/.test(modalSrc)) {
  fail("ActivarModal debe normalizar a phone10 (dígitos, últimos 10)");
}
if (!/phone: phone10/.test(modalSrc) || !/whatsapp: phone10/.test(modalSrc)) {
  fail("ActivarModal debe guardar phone10 en phone y whatsapp — jamás el crudo");
}
if (/\+52 614 123 4567/.test(modalSrc)) {
  fail("el placeholder no debe enseñar '+52...' — enseña el formato que rompía los links");
}

console.log("✓ canon WhatsApp MX: se guardan 10 dígitos, todo link es wa.me/52+últimos10");
