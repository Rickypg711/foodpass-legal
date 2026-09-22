// Candado: el dueño entra con su NÚMERO (SMS) — registro y entrada son el
// mismo paso, sin contraseña — y jamás dos cuentas para un número.
// Run: node --experimental-strip-types scripts/validate-phone-signup.mjs

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ownerPhoneToE164, phoneAuthErrorText } from "../lib/phoneOwnerSignInPure.ts";

// Normalización: 10 pelones = México; con "+" manda el país escrito.
assert.equal(ownerPhoneToE164("614 196 4086"), "+526141964086");
assert.equal(ownerPhoneToE164("6141964086"), "+526141964086");
assert.equal(ownerPhoneToE164("+52 614 196 4086"), "+526141964086");
assert.equal(ownerPhoneToE164("+1 809 952 4637"), "+18099524637", "RD con + conserva su país");
assert.equal(ownerPhoneToE164("+57 300 123 4567"), "+573001234567");
assert.equal(ownerPhoneToE164("614 196"), null, "menos de 10 dígitos no se manda");
assert.equal(ownerPhoneToE164(""), null);

// Errores en cristiano, nunca códigos de Firebase.
for (const code of ["auth/invalid-phone-number", "auth/too-many-requests", "auth/quota-exceeded", "auth/invalid-verification-code", "auth/code-expired", "auth/provider-already-linked", "auth/otra-cosa"]) {
  const t = phoneAuthErrorText({ code }, "confirm");
  assert.ok(t.length > 10 && !/auth\//.test(t), `texto humano para ${code}: ${t}`);
}

const lib = readFileSync("lib/phoneOwnerSignIn.ts", "utf8");
const pure = readFileSync("lib/phoneOwnerSignInPure.ts", "utf8");
assert.doesNotMatch(pure, /firebase/, "las piezas puras no tocan Firebase");
assert.match(lib, /isAnonymous[\s\S]*?linkWithPhoneNumber\(current/, "anónimo (dueño del demo) → LINK, conserva el uid");
assert.match(lib, /signInWithPhoneNumber\(auth/, "con otra sesión → sign-in");
assert.match(lib, /auth\/credential-already-in-use[\s\S]*?signInWithCredential/, "número ya con cuenta phone → entra a ESA cuenta");
assert.match(lib, /"phoneSignInPrecheck"/, "pre-check del servidor antes del SMS (jamás query a users desde el cliente)");

const modal = readFileSync("components/home/ActivarModal.tsx", "utf8");
assert.match(modal, /precheckOwnerPhone\(e164\)[\s\S]*?"social_account"/, "si el número es de una cuenta Google/correo, se le manda por ahí");
assert.match(modal, /new RecaptchaVerifier\([^)]*\{ size: "invisible" \}/, "reCAPTCHA invisible");
assert.match(modal, /confirmOwnerPhoneCode\([\s\S]*?linkVerifiedPhone\(/, "tras verificar se escribe users.linkedPhone (la verdad única del teléfono)");
const idxPhone = modal.indexOf("Continuar con mi número");
const idxGoogle = modal.indexOf("Continuar con Google");
const idxEmail = modal.indexOf('placeholder="Correo electrónico"');
assert.ok(idxPhone > 0 && idxPhone < idxGoogle && idxGoogle < idxEmail, "orden: número, Google, correo");
assert.match(modal, /useState\(demo\?\.whatsapp \?\? demo\?\.info\?\.phone \?\? ""\)/, "el número del demo llega pre-llenado");
assert.match(modal, /autoComplete="one-time-code"/, "el código se autollena desde el SMS");
assert.match(modal, /user\.phoneNumber\s*\?\s*formatPhoneForDisplay/, "una cuenta por teléfono se presenta con su número, no en blanco");
assert.doesNotMatch(modal, /\bliga\b/i, "jamás 'liga'");

console.log("✅ validate-phone-signup: el dueño entra con su número; sin contraseña; jamás dos cuentas para un número");
