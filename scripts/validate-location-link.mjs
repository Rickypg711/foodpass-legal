// 📍 parseLocationLink — el pin desde un link pegado (caso Null Island,
// 27-ago): la vía del puesto sin ficha de Google. Un link mal parseado =
// pin equivocado = PEOR que sin pin, por eso cada formato tiene su caso.
// Run: node scripts/validate-location-link.mjs

import assert from "node:assert/strict";
import { parseLocationLink } from "../lib/geocodeRestaurant.ts";

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
// dar null (el UI le pide al dueño el link completo), nunca inventar.
assert.equal(parseLocationLink("https://maps.app.goo.gl/AbC123xyz"), null, "link acortado sin coords → null");

console.log("validate-location-link: OK");
