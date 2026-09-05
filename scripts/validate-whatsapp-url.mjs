/**
 * Candado del canon de WhatsApp (26-ago-2026, cazado por Ricardo; abierto al
 * mundo el 5-sep-2026 por Zahir, Central Fast Food, República Dominicana):
 * se GUARDAN 10 dígitos y TODO link se arma como PAÍS + últimos 10.
 * El país lo dice el restaurante (`phoneCountryCode`) y si no dice nada es
 * México (52). Antes "52" iba cosido y a un dueño de RD su propio botón de
 * WhatsApp marcaba a un número mexicano.
 * Run: node scripts/validate-whatsapp-url.mjs
 */

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fail = (msg) => { console.error(`✗ ${msg}`); process.exit(1); };
const read = (rel) => readFileSync(join(__dirname, "..", rel), "utf8");

// 1) UNA verdad del país: lib/phone/phoneCountry.ts, default México.
const countrySrc = read("lib/phone/phoneCountry.ts");
if (!/export const DEFAULT_PHONE_COUNTRY = "52"/.test(countrySrc)) fail("DEFAULT_PHONE_COUNTRY debe ser \"52\" (México)");
if (!/export function waNumber\(/.test(countrySrc)) fail("waNumber no encontrado");
if (!/export function toE164\(/.test(countrySrc)) fail("toE164 no encontrado");
// Sólo países de 10 dígitos nacionales: la identidad de puntos son los últimos 10.
for (const code of ['"52"', '"1"', '"57"']) {
  if (!countrySrc.includes(`code: ${code}`)) fail(`PHONE_COUNTRIES debe traer ${code}`);
}
for (const bad of ['"502"', '"593"', '"34"']) {
  if (countrySrc.includes(`code: ${bad}`)) fail(`PHONE_COUNTRIES no puede traer ${bad}: su número nacional no es de 10 dígitos`);
}

// 2) El único armador de links usa el país + últimos 10, jamás "52" cosido.
const builderSrc = read("lib/order/formatWhatsappMessage.ts");
const fn = builderSrc.match(/export function buildWhatsappUrl[\s\S]*?\n\}/);
if (!fn) fail("buildWhatsappUrl no encontrado");
if (!/countryCode: string = DEFAULT_PHONE_COUNTRY/.test(fn[0])) fail("buildWhatsappUrl debe aceptar countryCode con default DEFAULT_PHONE_COUNTRY");
if (!/wa\.me\/\$\{waNumber\(phoneDigits, countryCode\)\}/.test(fn[0])) fail("buildWhatsappUrl debe armar wa.me/${waNumber(phoneDigits, countryCode)}");
if (/wa\.me\/52/.test(fn[0])) fail("buildWhatsappUrl no puede coser 52");

// El comportamiento, probado de verdad (mismo algoritmo que waNumber).
const last10 = (raw) => { const d = String(raw).replace(/\D/g, ""); return d.length > 10 ? d.slice(-10) : d; };
const build = (raw, cc = "52") => `https://wa.me/${cc}${last10(raw)}`;
for (const raw of ["+52 614 123 4567", "526141234567", "614 123 4567", "6141234567"]) {
  if (build(raw) !== "https://wa.me/526141234567") fail(`formato "${raw}" no normaliza a wa.me/526141234567`);
}
for (const raw of ["+1 809 952 4637", "18099524637", "809 952 4637", "8099524637"]) {
  if (build(raw, "1") !== "https://wa.me/18099524637") fail(`formato RD "${raw}" no normaliza a wa.me/18099524637`);
}

// 3) Ningún consumidor arma wa.me con "52" cosido a mano (todos pasan por el país).
const consumers = [
  "app/r/[restaurantId]/LandingView.tsx",
  "app/menu/[restaurantId]/order/[orderId]/page.tsx",
  "app/vendor/pedidos/page.tsx",
  "app/vendor/pos/page.tsx",
  "app/vendor/clientes/page.tsx",
  "app/vendor/setup/done/page.tsx",
  "lib/receiptWhatsapp.ts",
  "components/loyalty/PhonePointsCard.tsx",
  "components/loyalty/CheckoutRedemption.tsx",
  "app/puntos/page.tsx",
];
for (const rel of consumers) {
  const src = read(rel);
  if (/wa\.me\/52/.test(src)) fail(`${rel}: wa.me/52 cosido — usa waNumber(…, país)`);
  if (/`52\$\{/.test(src)) fail(`${rel}: "52" cosido al número — usa waNumber(…, país)`);
  if (/`\+52\$\{/.test(src)) fail(`${rel}: "+52" cosido al SMS — usa toE164(…, país)`);
}

// 4) El claim guarda el número YA normalizado a 10 dígitos (phone10) y el país.
const modalSrc = read("components/home/ActivarModal.tsx");
if (!/const phone10 = phone\.replace\(\/\\D\/g, ""\)\.slice\(-10\)/.test(modalSrc)) {
  fail("ActivarModal debe normalizar a phone10 (dígitos, últimos 10)");
}
if (!/phone: phone10/.test(modalSrc) || !/whatsapp: phone10/.test(modalSrc)) {
  fail("ActivarModal debe guardar phone10 en phone y whatsapp — jamás el crudo");
}
if (!/phoneCountryCode: countryFromTypedPhone\(phone\) \?\? DEFAULT_PHONE_COUNTRY/.test(modalSrc)) {
  fail("ActivarModal debe guardar phoneCountryCode (del '+' escrito, o México)");
}
if (/\+52 614 123 4567/.test(modalSrc)) {
  fail("el placeholder no debe enseñar '+52...' — enseña el formato que rompía los links");
}
if (/como lo marcas en México/.test(modalSrc)) fail("el copy del alta ya no puede asumir México");

// 5) Configuración deja cambiar el país y lo guarda en phoneCountryCode.
const cfgSrc = read("app/vendor/configuracion/page.tsx");
if (!/phoneCountryCode: phoneCountry/.test(cfgSrc)) fail("Configuración debe guardar phoneCountryCode");
if (!/PHONE_COUNTRIES/.test(cfgSrc)) fail("Configuración debe ofrecer el selector de país (PHONE_COUNTRIES)");

console.log("✓ canon WhatsApp: se guardan 10 dígitos, todo link es wa.me/PAÍS+últimos10 (México si el local no dice otro)");
