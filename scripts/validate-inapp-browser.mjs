// Candado: dentro del navegador de Facebook/Instagram NO se ofrece Google
// (Google lo bloquea: 403 disallowed_useragent) y el correo va primero.
// Run: node --experimental-strip-types scripts/validate-inapp-browser.mjs

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { detectInAppBrowser, chromeIntentUrl } from "../lib/inAppBrowser.ts";

const FB_ANDROID =
  "Mozilla/5.0 (Linux; Android 14; SM-A546E Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/128.0.6613.127 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/480.0.0.44.72;]";
const FB_IOS =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/21F90 [FBAN/FBIOS;FBAV/470.0.0.31.104;FBBV/;FBDV/iPhone15,3;FBMD/iPhone;FBSN/iOS;FBSV/17.5;FBSS/3;FBID/phone;FBLC/es_MX;FBOP/5]";
const IG_IOS =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/21F90 Instagram 340.0.0.22.96 (iPhone15,3; iOS 17_5; es_MX; es; scale=3.00; 1179x2556; 620848345)";
const MESSENGER_ANDROID =
  "Mozilla/5.0 (Linux; Android 13; Pixel 7 Build/TQ3A.230805.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/116.0.0.0 Mobile Safari/537.36 [FB_IAB/MESSENGER;FBAV/425.0.0.19.113;]";
const CHROME_ANDROID =
  "Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.6613.127 Mobile Safari/537.36";
const SAFARI_IOS =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const CHROME_MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

assert.deepEqual(detectInAppBrowser(FB_ANDROID), { app: "Facebook", os: "android" });
assert.deepEqual(detectInAppBrowser(FB_IOS), { app: "Facebook", os: "ios" });
assert.deepEqual(detectInAppBrowser(IG_IOS), { app: "Instagram", os: "ios" });
assert.deepEqual(detectInAppBrowser(MESSENGER_ANDROID), { app: "Messenger", os: "android" });
assert.equal(detectInAppBrowser(CHROME_ANDROID), null, "Chrome de verdad NO es embebido");
assert.equal(detectInAppBrowser(SAFARI_IOS), null, "Safari de verdad NO es embebido");
assert.equal(detectInAppBrowser(CHROME_MAC), null);
assert.equal(detectInAppBrowser(""), null);
assert.equal(detectInAppBrowser(undefined), null);

const intent = chromeIntentUrl("https://www.comeleal.com/demo/abc?x=1", "android");
assert.ok(intent && intent.startsWith("intent://www.comeleal.com/demo/abc?x=1#Intent;scheme=https;package=com.android.chrome;"), intent);
assert.ok(intent.includes("S.browser_fallback_url=https%3A%2F%2Fwww.comeleal.com%2Fdemo%2Fabc%3Fx%3D1"), "fallback a la misma URL");
assert.equal(chromeIntentUrl("https://www.comeleal.com/", "ios"), null, "en iPhone no hay intent");
assert.equal(chromeIntentUrl("http://inseguro.com/", "android"), null, "solo https");
assert.equal(chromeIntentUrl("no es url", "android"), null);

const modal = readFileSync("components/home/ActivarModal.tsx", "utf8");
assert.match(modal, /detectInAppBrowser\(/, "ActivarModal debe detectar el navegador embebido");
assert.match(
  modal,
  /\{!inApp && \(\s*<button[\s\S]*?Continuar con Google/,
  "el botón de Google solo sale FUERA del navegador embebido (Google lo bloquea adentro)",
);
assert.match(modal, /chromeIntentUrl\(/, "en Android se ofrece abrir en Chrome");
assert.match(modal, /Abrir en Safari/, "en iPhone se da la instrucción de Safari");
assert.doesNotMatch(modal, /\bliga\b/i, "jamás 'liga'; es 'link'");

console.log("✅ validate-inapp-browser: dentro de Facebook/Instagram no se ofrece Google; correo primero");
