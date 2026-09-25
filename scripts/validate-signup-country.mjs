// Candado: el alta pregunta el PAÍS desde el primer paso (25-sep-2026).
// Antes se adivinaba por el número y tres locales de fuera (Honduras,
// Colombia, Argentina) nacieron cosidos a 52/MXN: menú en pesos, WhatsApp
// marcando a México, SMS de sus clientes que nunca llegó.
// Run: node --experimental-strip-types scripts/validate-signup-country.mjs

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  PHONE_COUNTRIES,
  entryFromTypedPhone,
  signupCountryEntry,
} from "../lib/phone/phoneCountry.ts";
import { ownerPhoneToE164 } from "../lib/phoneOwnerSignInPure.ts";

// El país elegido entra al E.164 del SMS; un "+" escrito a mano le gana.
assert.equal(ownerPhoneToE164("321 123 4567", "57"), "+573211234567", "Colombia elegida en el selector");
assert.equal(ownerPhoneToE164("809 952 4637", "1"), "+18099524637", "RD elegida en el selector");
assert.equal(ownerPhoneToE164("+52 614 196 4086", "57"), "+526141964086", "el + escrito le gana al selector");
assert.equal(ownerPhoneToE164("614 196 4086"), "+526141964086", "sin país sigue siendo México");

// El "+" escrito mueve el selector a su país (y desempata +1 por lada).
assert.equal(entryFromTypedPhone("+1 809 952 4637")?.iso, "DO");
assert.equal(entryFromTypedPhone("+1 915 123 4567")?.iso, "US");
assert.equal(entryFromTypedPhone("+57 321 123 4567")?.iso, "CO");
assert.equal(entryFromTypedPhone("614 196 4086"), null, "sin + no se adivina");

// Con qué país arranca el alta: lo del demo > el + del número > México.
assert.equal(signupCountryEntry(null).iso, "MX");
assert.equal(signupCountryEntry({ phone: "6141964086" }).iso, "MX");
assert.equal(signupCountryEntry({ phone: "+57 321 123 4567" }).iso, "CO");
assert.equal(signupCountryEntry({ phoneCountryCode: "1", currencyCode: "DOP" }).iso, "DO");
assert.equal(signupCountryEntry({ phoneCountryCode: "1", currencyCode: "USD" }).iso, "US");
assert.equal(signupCountryEntry({ phoneCountryCode: "1", currencyCode: "DOP", phone: "+57 321 123 4567" }).iso, "DO", "lo elegido en /demo manda sobre el +");
assert.equal(signupCountryEntry({ phoneCountryCode: "999" }).iso, "MX", "país que no soportamos cae a México");
for (const c of PHONE_COUNTRIES) assert.match(c.example.replace(/\D/g, ""), /^[0-9]{10}$/, `${c.label}: ejemplo de 10 dígitos`);

// El modal: selector ANTES del número en los dos pasos, y lo elegido se guarda.
const modal = readFileSync("components/home/ActivarModal.tsx", "utf8");
const smsSelect = modal.indexOf("<PhoneCountrySelect");
const smsInput = modal.indexOf('id="activar-phone"');
assert.ok(smsSelect > 0 && smsSelect < smsInput, "paso SMS: selector de país antes del número");
const formSelect = modal.indexOf("<PhoneCountrySelect", smsInput);
const formInput = modal.indexOf("data-claim-field={phone.trim()");
assert.ok(formSelect > 0 && formSelect < formInput, "formulario: selector de país antes del número");
assert.match(modal, /ownerPhoneToE164\(phoneInput, country\.code\)/, "el SMS sale al país elegido");
assert.match(modal, /phoneCountryCode: signupCountry\.code/, "se guarda el país elegido, no uno adivinado");
assert.match(modal, /currencyCode: signupCurrency/, "moneda del país elegido");
assert.match(modal, /country: signupCountry\.iso/, "el pin se busca en el país elegido");
assert.doesNotMatch(modal, /currencyForTypedPhone|isoFromTypedPhone/, "ya no se adivina país ni moneda por el número");
assert.doesNotMatch(modal, /ponlo con \+ y tu país/, "ya no se le pide al dueño que escriba el +");
assert.doesNotMatch(modal, /\bliga\b/i, "jamás 'liga'");

// /demo: mismo selector en el primer paso y viaja en el job.
const demo = readFileSync("app/demo/page.tsx", "utf8");
assert.match(demo, /<PhoneCountrySelect/, "/demo pregunta el país");
assert.match(demo, /createDemoJob\([\s\S]*?\{ phoneCountryCode: country\.code, currencyCode: country\.currency \}/, "el país viaja en el job");
const jobs = readFileSync("lib/demo/demoJobs.ts", "utf8");
assert.match(jobs, /payload\.phoneCountryCode = country\.phoneCountryCode/, "el job guarda el país");
const claim = readFileSync("app/demo/[jobId]/page.tsx", "utf8");
assert.match(claim, /phoneCountryCode: job\.phoneCountryCode \?\? null/, "el claim recibe el país del demo");

// Las reglas aceptan los dos campos (repo FOODPASS, hermano de este).
try {
  const rules = readFileSync("../../projects/FOODPASS/firestore.rules", "utf8");
  assert.match(rules, /'whatsapp', 'phoneCountryCode',\s*'currencyCode'/, "reglas del job: país y moneda permitidos");
} catch (e) {
  if (e?.code !== "ENOENT") throw e;
}

console.log("✅ validate-signup-country: el alta pregunta el país desde el primer paso; se guarda el elegido, no el adivinado");
