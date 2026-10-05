// 📍 parseLocationLink — el pin desde un link pegado (caso Null Island,
// 27-ago): la vía del puesto sin ficha de Google. Un link mal parseado =
// pin equivocado = PEOR que sin pin, por eso cada formato tiene su caso.
// Run: node scripts/validate-location-link.mjs

import assert from "node:assert/strict";
import { parseLocationLink, firstMapsUrlIn, isGoogleMapsHost, placeTextFromMapsUrl, PIN_FROM_TEXT_PRECISIONS } from "../lib/geocodeRestaurant.ts";

const close = (a, b) => Math.abs(a - b) < 1e-6;

// WhatsApp "Enviar mi ubicación" → maps.google.com/?q=lat,lng
{
  const r = parseLocationLink("https://maps.google.com/?q=28.735911,-106.1221292");
  assert.ok(r && close(r.lat, 28.735911) && close(r.lng, -106.1221292), "formato q= de WhatsApp");
}

// Link largo de Google Maps: el !3d!4d es EL PIN y le gana al @ (cámara).
{
  const r = parseLocationLink(
    "https://www.google.com/maps/place/Tacos/@28.70,-106.20,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d28.6353!4d-106.0889",
  );
  assert.ok(r && close(r.lat, 28.6353) && close(r.lng, -106.0889), "!3d!4d (pin) le gana al @ (cámara)");
}

// Solo @ (centro del mapa): aceptable.
{
  const r = parseLocationLink("https://www.google.com/maps/@21.1376113,-86.8320488,15z");
  assert.ok(r && close(r.lat, 21.1376113), "formato @ centro del mapa");
}

// Coordenadas peladas (coordsInAddress).
{
  const r = parseLocationLink("18.9849690, -98.2506580");
  assert.ok(r && close(r.lng, -98.250658), "lat,lng pelado");
}

// Basura y peligros → null, JAMÁS adivinar.
assert.equal(parseLocationLink("mi casa por el centro"), null, "texto sin coordenadas");
assert.equal(parseLocationLink("https://maps.google.com/?q=0.0001,0.0001"), null, "Null Island rechazado");
assert.equal(parseLocationLink("https://maps.google.com/?q=999.0,-106.1"), null, "fuera de rango rechazado");
assert.equal(parseLocationLink(""), null, "vacío");
// Un link acortado (maps.app.goo.gl) NO trae coordenadas en el texto — debe
// dar null aquí, nunca inventar. Lo resuelve el servidor (/api/resolve-map-link).
assert.equal(parseLocationLink("https://maps.app.goo.gl/AbC123xyz"), null, "link acortado sin coords → null");

// ── Link corto de Google Maps (5-oct-2026, Kame House) ──
// El botón Compartir de Maps da ESTE link: el panel tiene que reconocerlo para mandarlo al servidor.
assert.equal(
  firstMapsUrlIn("https://maps.app.goo.gl/jybZVdHvotTu8LAz8?g_st=ac"),
  "https://maps.app.goo.gl/jybZVdHvotTu8LAz8?g_st=ac",
  "link corto del botón Compartir",
);
// El dueño pega el mensaje entero de WhatsApp.
assert.equal(
  firstMapsUrlIn("Kame House Cevichería\nhttps://maps.app.goo.gl/AbC123xyz."),
  "https://maps.app.goo.gl/AbC123xyz",
  "link dentro de un mensaje, sin el punto final",
);
assert.ok(firstMapsUrlIn("https://www.google.com/maps/place/Tacos/data=!4m2"), "link largo de un lugar");
assert.equal(firstMapsUrlIn("https://evil.example/maps.app.goo.gl/x"), null, "otro host jamás");
assert.equal(firstMapsUrlIn("https://www.google.com/search?q=tacos"), null, "Google pero no Maps");
assert.equal(firstMapsUrlIn("mi casa por el centro"), null, "texto sin link");
// El servidor SOLO sigue redirecciones entre estos hosts (el link lo pega un usuario).
assert.ok(isGoogleMapsHost("maps.app.goo.gl") && isGoogleMapsHost("www.google.com") && isGoogleMapsHost("www.google.com.mx"));
assert.ok(!isGoogleMapsHost("google.com.evil.io") && !isGoogleMapsHost("169.254.169.254") && !isGoogleMapsHost("localhost"));
// A dónde redirige el link de Kame House: un lugar SIN coordenadas → el texto del lugar se geocodifica.
{
  const long =
    "https://www.google.com/maps/place/Cevicheria+Kame+House,+Rey+Ramses+II+714,+31180+Chihuahua,+Chih./data=!4m2!3m1!1s0x86ea41d2afb8aaa5:0xbb3e32dfd5edfee!18m1!1e1?utm_source=mstt_1";
  assert.equal(parseLocationLink(long), null, "el link largo de Kame no trae coordenadas");
  assert.equal(placeTextFromMapsUrl(long), "Cevicheria Kame House, Rey Ramses II 714, 31180 Chihuahua, Chih.", "texto del lugar");
}
assert.equal(placeTextFromMapsUrl("https://www.google.com/maps/@28.7,-106.1,15z"), null, "sin /place/ no hay texto");
assert.equal(placeTextFromMapsUrl("https://evil.example/maps/place/Calle+Falsa+123,+Ciudad"), null, "otro host jamás");
// Desde el texto de un link solo vale precisión de puerta: el centro de una calle no es el local.
assert.ok(PIN_FROM_TEXT_PRECISIONS.has("ROOFTOP") && !PIN_FROM_TEXT_PRECISIONS.has("GEOMETRIC_CENTER") && !PIN_FROM_TEXT_PRECISIONS.has("APPROXIMATE"));

console.log("validate-location-link: OK");
