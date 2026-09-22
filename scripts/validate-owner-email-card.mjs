// Candado: al dueño que entró solo con su número se le pide el correo en el
// panel, UNA vez, sin bloquear, y solo se escribe users.email.
// Run: node scripts/validate-owner-email-card.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const card = readFileSync("components/vendor/OwnerEmailCard.tsx", "utf8");
assert.match(card, /if \(!u \|\| u\.isAnonymous \|\| u\.email\) return;/, "con correo en la cuenta no se pide nada");
assert.match(card, /snap\?\.data\(\)\?\.email\) return;/, "si users.email ya existe no se pide");
assert.match(card, /updateDoc\(doc\(getFirebaseDb\(\), "users", uid\), \{ email: clean \}\)/, "solo se escribe users.email (campo auto-editable por las reglas)");
assert.doesNotMatch(card, /updateEmail|verifyBeforeUpdateEmail|linkWithCredential/, "es un dato de contacto, NO un cambio de login");
assert.match(card, /localStorage\.setItem\(LATER_KEY/, "'Luego' esconde 7 días, por navegador");
assert.match(card, /try \{ localStorage/, "localStorage siempre en try/catch");
assert.match(card, /Luego/, "siempre hay salida sin bloquear");
assert.doesNotMatch(card, /\bliga\b/i, "jamás 'liga'");

const page = readFileSync("app/vendor/page.tsx", "utf8");
const main = page.slice(page.indexOf("<main className="), page.indexOf("</main>"));
const i = main.indexOf("<OwnerEmailCard />");
assert.ok(i > 0, "el panel pinta <OwnerEmailCard />");
assert.ok(main.indexOf("<SetupBanner ") < i && i < main.indexOf("<TodayCard"), "va después de la brújula del setup y antes de Hoy");
assert.equal(main.split("<OwnerEmailCard />").length - 1, 1, "una sola vez");
assert.ok(!main.slice(Math.max(0, i - 40), i).includes("firstDay"), "no se esconde el primer día: es justo cuando más falta");

console.log("✅ validate-owner-email-card: al dueño por número se le pide correo una vez, sin bloquear, solo users.email");
