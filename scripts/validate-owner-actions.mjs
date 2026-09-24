// Candado: lo que el dueño TOCA deja rastro y el push llega al navegador
// (24-sep-2026).
//
// POR QUÉ EXISTE: el 24-sep se midió y nadie sabía si un dueño tocaba el
// consejo del panel o "Enviar" a un cliente: cero eventos, cero docs. Y solo
// 8 de 76 dueños podían recibir un push (los demás son de web). Este candado
// cuida las tres piezas:
//   1. restaurants/{rid}/ownerActions se escribe desde el consejo (nba_tap)
//      y desde el WhatsApp a un cliente (winback_send), solo crear.
//   2. El panel pide permiso de push UNA vez, desde un clic, y guarda
//      users.fcmWebToken; existe el service worker.
//   3. Nunca se guarda el teléfono completo del cliente en el rastro.
//
// Run: node --experimental-strip-types scripts/validate-owner-actions.mjs
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const page = readFileSync("app/vendor/page.tsx", "utf8");
const clientes = readFileSync("app/vendor/clientes/page.tsx", "utf8");
const lib = readFileSync("lib/ownerActions.ts", "utf8");
const push = readFileSync("lib/webPush.ts", "utf8");
const card = readFileSync("components/vendor/OwnerPushCard.tsx", "utf8");

// ── 1. El rastro ──────────────────────────────────────────────────────────
assert.match(lib, /export type OwnerActionType = "nba_tap" \| "winback_send"/, "dos toques, ni uno más sin pasar por aquí");
assert.match(lib, /collection\(getFirebaseDb\(\), "restaurants", restaurantId, "ownerActions"\)/, "vive en restaurants/{rid}/ownerActions");
assert.match(lib, /platform: "web"/, "la web se firma como web (la app como app)");
assert.match(lib, /\.catch\(\(\) => \{\}\)/, "jamás rompe el clic del dueño");
assert.match(lib, /digits\.slice\(-4\)/, "solo últimos 4 del teléfono");
assert.doesNotMatch(lib, /phone:\s*phone|target: phone10\b/, "nunca el teléfono completo");

const cta = page.slice(page.indexOf("<a href={ctaHref}"), page.indexOf("Abrir Comeleal AI"));
assert.match(cta, /logOwnerAction\(restaurantId, "nba_tap", \{ actionCode \}\)/, "el botón del consejo deja rastro con su actionCode");
assert.match(clientes, /logOwnerAction\(restaurantId, "winback_send", \{ target: shortTarget\(phone10\) \}\)/, "el WhatsApp a un cliente deja rastro");
assert.ok(clientes.indexOf('logOwnerAction(restaurantId, "winback_send"') < clientes.indexOf("if (msg) {"), "se anota ANTES de abrir WhatsApp, en todos los caminos");

// ── 2. Push web ────────────────────────────────────────────────────────────
assert.ok(existsSync("public/firebase-messaging-sw.js"), "existe el service worker");
assert.match(push, /fcmWebToken: token/, "guarda users.fcmWebToken");
assert.match(push, /fcmWebTokenUpdatedAt: serverTimestamp\(\)/, "con fecha");
assert.match(push, /if \(permission === "default" && ask\)/, "el permiso solo se pide con ask=true (un clic)");
assert.match(push, /if \(!WEB_PUSH_VAPID_KEY\) return false;/, "sin llave VAPID no hay push web, y no truena");
assert.match(card, /saveWebPushToken\(u\.uid, false\)/, "si ya dijo sí, refresca en silencio");
assert.match(card, /saveWebPushToken\(uid, true\)/, "pide permiso solo desde el botón");
assert.match(card, /localStorage\.setItem\(LATER_KEY/, "'Luego' esconde 7 días");
assert.match(card, /try \{ localStorage/, "localStorage siempre en try/catch");
assert.doesNotMatch(card, /\bliga\b|autom[aá]tic|\bbot\b/i, "sin 'liga', sin 'automático', sin 'bot'");

const main = page.slice(page.indexOf("<main className="), page.indexOf("</main>"));
const i = main.indexOf("<OwnerPushCard />");
assert.ok(i > 0, "el panel pinta <OwnerPushCard />");
assert.ok(main.indexOf("<OwnerEmailCard />") < i && i < main.indexOf("<TodayCard"), "va junto a la tarjeta de correo, antes de Hoy");
assert.equal(main.split("<OwnerPushCard />").length - 1, 1, "una sola vez");

// ── 3. Reglas (repo hermano) ──────────────────────────────────────────────
const rulesPath = "/Users/ricardoparedes/projects/FOODPASS/firestore.rules";
if (existsSync(rulesPath)) {
  const rules = readFileSync(rulesPath, "utf8");
  assert.match(rules, /match \/ownerActions\/\{actionId\}/, "las reglas conocen ownerActions");
  assert.match(rules, /'fcmWebToken',\s*\n\s*'fcmWebTokenUpdatedAt',/, "el dueño puede guardar su token web");
  const block = rules.slice(rules.indexOf("match /ownerActions/{actionId}"));
  assert.match(block.slice(0, 1200), /allow update, delete: if false;/, "el rastro solo se crea, nunca se edita ni borra");
}

console.log("✅ validate-owner-actions: los toques del dueño dejan rastro y el push llega al navegador");
