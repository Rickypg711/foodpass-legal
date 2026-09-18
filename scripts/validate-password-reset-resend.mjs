/**
 * Candado: el "¿Olvidaste tu contraseña?" sale por Resend, en español, de
 * ricardo@comeleal.com (18-sep-2026), con plan B a Firebase.
 *
 * 1. Las dos pantallas que lo ofrecen (modal de entrar y Configuración) usan
 *    lib/passwordReset, no llaman a sendPasswordResetEmail por su cuenta.
 * 2. lib/passwordReset llama a la función `requestPasswordReset` y, si falla,
 *    cae a Firebase con idioma "es". Nunca revela si el correo existe.
 * 3. Jamás "liga".
 *
 * Run: node scripts/validate-password-reset-resend.mjs
 */
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const helper = read("lib/passwordReset.ts");
assert.ok(helper.includes('"requestPasswordReset"'), "lib/passwordReset llama a la función requestPasswordReset");
assert.ok(helper.includes("sendPasswordResetEmail"), "lib/passwordReset conserva el plan B de Firebase");
assert.ok(helper.includes('languageCode = "es"'), "el plan B va en español");
assert.ok(helper.includes('"functions/resource-exhausted"'), "el tope por hora se traduce a wait");
assert.ok(!/\bliga\b/i.test(helper), 'jamás "liga"');

for (const p of ["components/home/ActivarModal.tsx", "app/vendor/configuracion/page.tsx"]) {
  const src = read(p);
  assert.ok(src.includes('from "@/lib/passwordReset"'), `${p} usa lib/passwordReset`);
  assert.ok(!src.includes("sendPasswordResetEmail"), `${p} ya no llama a Firebase directo`);
  assert.ok(src.includes("espera una hora"), `${p} explica el tope por hora`);
}

console.log("✓ password reset por Resend: helper, dos pantallas, plan B en español");
