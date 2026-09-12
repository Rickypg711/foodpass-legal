// 🌎 El país del pin — candado del 12-sep-2026 (CENTRAL FAST FOOD, RD).
//
// Zahir eligió "🇩🇴 República Dominicana" en Configuración el 5-sep. Del 5 al
// 12 guardó su dirección REAL de Las Matas de Farfán y el pin se quedó en 0,0
// todas las veces: la guarda de país le preguntaba al TELÉFONO, y 10 dígitos
// pelones se daban por mexicanos. Google decía DO, no coincidía, rechazo.
// El motivo guardado — "pais_no_coincide (tel MX, Google DO)" — hablaba de un
// teléfono mexicano que él nunca tuvo.
//
// Tres reglas que no se pueden volver a romper:
//   1. El país que el dueño ELIGIÓ le gana al que adivina su número.
//   2. Una lada dominicana NO es México, ni con "+" ni sin él.
//   3. Guardar con el pin sin resolver REINTENTA, aunque el texto no cambie
//      (si no, el aviso amarillo le pide algo que no sirve de nada).
// Run: node --experimental-strip-types scripts/validate-geocode-country.mjs

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  expectedCountryFor,
  expectedCountryFromPhone,
} from "../lib/geocodeRestaurant.ts";
import { isoCountryOf, isoFromTypedPhone } from "../lib/phone/phoneCountry.ts";

// 1. El país elegido manda.
assert.equal(
  expectedCountryFor({ country: "DO", phone: "8099524637" }),
  "DO",
  "el país elegido por el dueño debe ganarle al teléfono",
);
assert.equal(
  isoCountryOf({ phoneCountryCode: "1", currencyCode: "DOP" }),
  "DO",
  "phoneCountryCode 1 + DOP = República Dominicana",
);
assert.equal(
  isoCountryOf({ phoneCountryCode: "1", currencyCode: "USD" }),
  "US",
  "phoneCountryCode 1 + USD = Estados Unidos",
);
assert.equal(isoCountryOf({}), "MX", "sin nada elegido, México (el default de siempre)");

// Basura no se cree: se cae al teléfono.
assert.equal(
  expectedCountryFor({ country: "República Dominicana", phone: "6143273001" }),
  "MX",
  "un país que no es ISO de 2 letras no debe creerse",
);

// 2. Las ladas dominicanas.
for (const tel of ["8099524637", "8292635777", "8496313774"]) {
  assert.equal(
    expectedCountryFromPhone(tel),
    null,
    `${tel} es lada dominicana: no puede darse por mexicano`,
  );
}
assert.equal(expectedCountryFromPhone("+1 809 952 4637"), "DO", "+1 809 es RD, no US");
assert.equal(expectedCountryFromPhone("+1 915 123 4567"), "US", "+1 915 sí es US");
assert.equal(isoFromTypedPhone("+1 829 263 5777"), "DO", "isoFromTypedPhone respeta la lada");
assert.equal(isoFromTypedPhone("8099524637"), null, "sin + no se adivina");

// Lo de siempre sigue igual: un número mexicano sigue siendo México.
assert.equal(expectedCountryFromPhone("6143273001"), "MX", "México no puede romperse");
assert.equal(expectedCountryFromPhone("+502 50643837"), "GT", "Guatemala no puede romperse");

// 3. Las llamadas mandan el país, y se reintenta con el pin sin resolver.
const conf = readFileSync("app/vendor/configuracion/page.tsx", "utf8");
assert.match(
  conf,
  /country:\s*isoCountryOf\(/,
  "Configuración debe mandarle a /api/geocode el país que eligió el dueño",
);
assert.match(
  conf,
  /if\s*\(addressChanged\s*\|\|\s*locationUnresolved\)/,
  "guardar con el pin sin resolver tiene que reintentar aunque la dirección no cambie",
);

const ruta = readFileSync("app/api/geocode/route.ts", "utf8");
assert.match(
  ruta,
  /expectedCountryFor\(\{\s*country:/,
  "/api/geocode debe usar expectedCountryFor, no la corazonada del teléfono a secas",
);

const activar = readFileSync("components/home/ActivarModal.tsx", "utf8");
assert.match(
  activar,
  /country:\s*isoFromTypedPhone\(/,
  "el alta debe mandar el país cuando el dueño escribió su número con +",
);

console.log("✅ validate-geocode-country: el país del pin es el que eligió el dueño");
