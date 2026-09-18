// Candado: la señal a Meta se queda LIMPIA (17-sep-2026).
// 1. Cuentas internas (comeleal+…, Ricardo) nunca cuentan como conversión.
// 2. "Lead" significa UNA cosa: se creó un restaurante. El formulario de
//    contacto NO dispara Lead (sumaba 91 Leads contra 46 altas).
// 3. El servidor hashea correo/teléfono/uid antes de hablar con Meta.
// 4. El pixel no corre en el panel del dueño (/vendor/…), sí en el wizard.
// 5. /demo dispara SubmitApplication (el paso con volumen antes del alta).
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { isInternalEmail } from "../lib/meta/internal.ts";
import { normalizeEmailForMeta, normalizePhoneForMeta, hashedIdentity } from "../lib/meta/capi.ts";
import { pixelAllowedOnPath } from "../lib/meta/pixelPaths.ts";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

// 1. internas
assert.equal(isInternalEmail("comeleal+blooms@gmail.com"), true);
assert.equal(isInternalEmail("Comeleal@gmail.com"), true);
assert.equal(isInternalEmail("paredesricardog@gmail.com"), true);
assert.equal(isInternalEmail("cafedelatercera@gmail.com"), false);
assert.equal(isInternalEmail("twobakers26@gmail.com"), false);
assert.equal(isInternalEmail(""), false);
assert.equal(isInternalEmail(null), false);

// 2. Lead solo en el alta
const leadForm = read("components/vendor/VendorLeadForm.tsx");
assert.ok(!/event_name:\s*"Lead"/.test(leadForm), "VendorLeadForm no debe disparar Lead");
assert.ok(!/pixelLead/.test(leadForm), "VendorLeadForm no debe usar pixelLead");
const activar = read("components/home/ActivarModal.tsx");
assert.ok(/event_name:\s*"Lead"/.test(activar), "ActivarModal sigue disparando Lead al crear el restaurante");
assert.ok(/isInternalConversion\(user\.email\)/.test(activar), "ActivarModal filtra cuentas internas antes del Lead");
const done = read("app/vendor/setup/done/page.tsx");
assert.ok(/isInternalConversion\(who\.email\)/.test(done), "setup/done filtra cuentas internas antes de CompleteRegistration");

// 3. hash en el servidor, nunca PII cruda
assert.equal(normalizeEmailForMeta("  Omar@Gmail.com "), "omar@gmail.com");
assert.equal(normalizePhoneForMeta("614 123 4567", "52"), "526141234567");
assert.equal(normalizePhoneForMeta("18091234567", null), "18091234567");
assert.equal(normalizePhoneForMeta("6141234567", null), undefined, "10 dígitos sin país → no se inventa el 52");
const id = hashedIdentity({ email: "omar@gmail.com", phone: "6141234567", phoneCountry: "52", externalId: "uid1" });
assert.equal(id.em?.[0]?.length, 64);
assert.equal(id.ph?.[0]?.length, 64);
assert.equal(id.external_id?.[0]?.length, 64);
assert.ok(!JSON.stringify(id).includes("omar@"), "el correo nunca viaja crudo");
const route = read("app/api/meta/events/route.ts");
assert.ok(/isInternalEmail\(identityEmail\)/.test(route), "la ruta corta cuentas internas");
assert.ok(/hashedIdentity\(/.test(route), "la ruta hashea la identidad");
const capi = read("lib/meta/capi.ts");
assert.ok(!/^\s*"use client"/.test(capi), "capi.ts es solo servidor");
assert.ok(/node:crypto/.test(capi), "capi.ts hashea con node:crypto (servidor)");

// 4. pixel fuera del panel
assert.equal(pixelAllowedOnPath("/"), true);
assert.equal(pixelAllowedOnPath("/para-restaurantes"), true);
assert.equal(pixelAllowedOnPath("/demo"), true);
assert.equal(pixelAllowedOnPath("/vendor/setup/done"), true);
assert.equal(pixelAllowedOnPath("/vendor"), false);
assert.equal(pixelAllowedOnPath("/vendor/caja"), false);
assert.equal(pixelAllowedOnPath("/vendor/pedidos"), false);

// 5. demo → SubmitApplication
const demo = read("app/demo/page.tsx");
assert.ok(/event_name:\s*"SubmitApplication"/.test(demo), "/demo dispara SubmitApplication");
assert.ok(/isInternalConversion\(\)/.test(demo), "/demo respeta el navegador interno");
assert.ok(/"SubmitApplication"/.test(route), "la ruta acepta SubmitApplication");

console.log("meta-signal OK");
