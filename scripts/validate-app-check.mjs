#!/usr/bin/env node
// Candado 7-oct-2026: App Check en la web (reCAPTCHA Enterprise / Fraud Defense).
// Nació el día que le cambiaron la cuenta bancaria al sitio de sorteos de Kevin
// con un curl y la API key pública. Si alguien quita initializeAppCheck, cambia
// el proveedor, o lo arranca en el servidor, esto truena.
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
const rd = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");

const src = rd("lib/firebase.ts");

assert.ok(src.includes('from "firebase/app-check"'), "importa firebase/app-check");
assert.ok(src.includes("initializeAppCheck("), "arranca App Check");
assert.ok(src.includes("new ReCaptchaEnterpriseProvider("), "proveedor = reCAPTCHA Enterprise (Classic está obsoleto)");
assert.ok(!src.includes("ReCaptchaV3Provider"), "no reCAPTCHA Classic v3");
assert.match(src, /APP_CHECK_SITE_KEY = "6L[A-Za-z0-9_-]{38}"/, "la llave de sitio tiene forma de llave reCAPTCHA");
assert.ok(src.includes("isTokenAutoRefreshEnabled: true"), "el token se renueva solo (si no, a la hora el panel se queda sin token)");
assert.ok(src.includes('typeof window === "undefined"'), "solo en el navegador: el servidor de Next no tiene reCAPTCHA");
assert.ok(src.includes("FIREBASE_APPCHECK_DEBUG_TOKEN"), "localhost pide token de debug para poder desarrollar");

// Arranca desde getFirebaseApp(): toda ruta que use Firestore/Storage/Functions
// pasa por ahí, así que ninguna pantalla se queda sin token.
const getApp = src.slice(src.indexOf("export function getFirebaseApp"));
assert.ok(getApp.includes("startAppCheck(app)"), "getFirebaseApp arranca App Check");

console.log("validate-app-check: OK");
