/**
 * SEO de /r y del directorio: ni "Otro" en el title, ni colonia como ciudad.
 *
 * POR QUÉ EXISTE (5-sep-2026, salió de comparar con Fluxsales):
 *  - "CURANDERO | Otro — menú, pedidos y horario": "Otro" es el comodín del
 *    selector de giro, no una frase que alguien busque.
 *  - La ciudad se adivinaba del texto de la dirección. Los dueños escriben
 *    "Carpinteros de paracho 894, Vasco de Quiroga", "el centro", "Villareal":
 *    sin ciudad. El único dato 100% correcto es el que da Google con el pin
 *    (address_components → city/state/countryCode), guardado en el doc.
 *
 * Contrato:
 *  1. seoCategories filtra comodines; el dato del dueño NO se toca.
 *  2. cityForRestaurant: PRIMERO data.city (estructurada), luego heurística.
 *  3. La heurística nunca devuelve una colonia ("Col. X", "Centro").
 *  4. El geocode devuelve city/state/countryCode con el pin (paridad con
 *     functions/geo/locality.js) y los escritores web los guardan.
 *  5. El JSON-LD ya no dice "Chihuahua" a fuerza: región y país salen del doc.
 *
 * Run: node scripts/validate-landing-seo.mjs
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  seoCategories,
  isPlaceholderCategory,
  cityForRestaurant,
  cityFromAddress,
  buildLandingTitle,
  buildSeoParagraph,
  buildFaq,
} from "../lib/landingContent.ts";
import { localityFromComponents, localityFromReverseResults, evaluateGeocodeResult } from "../lib/geocodeRestaurant.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");

// 1. "Otro" no es una categoría para Google
assert.deepEqual(seoCategories(["Otro"]), []);
assert.deepEqual(seoCategories(["Postres", "Otro"]), ["Postres"]);
assert.deepEqual(seoCategories([" Tacos ", "otros", "Sin categoría"]), ["Tacos"]);
assert.equal(isPlaceholderCategory("OTRO"), true);
assert.equal(isPlaceholderCategory("Pizza"), false);
assert.equal(
  buildLandingTitle("CURANDERO", ["Otro"], "Carpinteros de paracho 894, Vasco de Quiroga"),
  "CURANDERO — Menú, horario y ubicación",
  "con solo 'Otro' cae al title sin categoría",
);
assert.ok(!buildSeoParagraph("CURANDERO", ["Otro"], null).includes(" otro"), "el párrafo SEO no dice 'Pide otro'");
const faq = buildFaq({ name: "X", categories: ["Otro"], address: null, hoursText: null, topItems: ["Caldo"], firstVisitReward: null });
assert.ok(!faq[0].a.includes("sirve otro"), "la FAQ no dice 'sirve otro'");

// 2. La ciudad estructurada manda sobre la heurística
assert.equal(cityForRestaurant({ city: "Chihuahua", address: "el centro" }), "Chihuahua");
assert.equal(cityForRestaurant({ address: "Alejandro Cárdenas Peralta, Brisas de Zicatela, 70934 Puerto Escondido, Oax." }), "Puerto Escondido");
assert.equal(cityForRestaurant({ address: "el centro" }), null);
assert.equal(
  buildLandingTitle("Luzz Pizza", ["Pizza"], "Calle Monte Encino 15523, Colonia Atenas, 31100 Chihuahua, Chih", "Chihuahua"),
  "Luzz Pizza | Pizza en Chihuahua — menú, pedidos y horario",
);
assert.equal(
  buildLandingTitle("Lindo Michoacán", ["Postres", "Otro"], "Mineral Palmillas, 5328, Col. Minerales"),
  "Lindo Michoacán | Postres — menú, pedidos y horario",
  "sin ciudad estructurada y con colonia en el texto: título SIN ciudad, jamás 'en Col. Minerales'",
);

// 3. La heurística nunca regala una colonia como ciudad
assert.equal(cityFromAddress("Mineral Palmillas, 5328, Col. Minerales"), null);
assert.equal(cityFromAddress("Calle X 12, Colonia Atenas, Chihuahua"), null, "penúltimo 'Colonia Atenas' no es ciudad");
assert.equal(cityFromAddress("Av. Juárez 10, Centro, Chihuahua"), null);
assert.equal(cityFromAddress("Cl. 19 #17-82, Concepción, Antioquia"), "Concepción");

// 4. El geocode trae la ciudad con el pin
const comps = [
  { types: ["sublocality", "political"], long_name: "Atenas", short_name: "Atenas" },
  { types: ["locality", "political"], long_name: "Chihuahua", short_name: "Chihuahua" },
  { types: ["administrative_area_level_1", "political"], long_name: "Chihuahua", short_name: "Chih." },
  { types: ["country", "political"], long_name: "México", short_name: "MX" },
];
assert.deepEqual(localityFromComponents(comps), { city: "Chihuahua", state: "Chihuahua", countryCode: "MX" });
assert.deepEqual(localityFromComponents([
  { types: ["administrative_area_level_2", "political"], long_name: "Navolato" },
  { types: ["administrative_area_level_1", "political"], long_name: "Sinaloa" },
  { types: ["country"], short_name: "MX" },
]), { city: "Navolato", state: "Sinaloa", countryCode: "MX" }, "sin locality cae al municipio");
assert.equal(localityFromReverseResults([{ address_components: [{ types: ["plus_code"], long_name: "X" }] }, { address_components: comps }]).city, "Chihuahua");
assert.equal(localityFromReverseResults([
  { types: ["street_address"], address_components: [{ types: ["locality"], long_name: "Del Real" }, { types: ["country"], short_name: "MX" }] },
  { types: ["locality", "political"], address_components: [{ types: ["locality"], long_name: "Chihuahua" }, { types: ["country"], short_name: "MX" }] },
]).city, "Chihuahua", "la colonia etiquetada como locality en la calle NO gana al resultado que es la ciudad");
const verdict = evaluateGeocodeResult(
  { status: "OK", results: [{ geometry: { location: { lat: 28.6, lng: -106.0 }, location_type: "ROOFTOP" }, formatted_address: "Calle Monte Encino 15523, Atenas, 31100 Chihuahua, Chih., México", address_components: comps }] },
  "MX",
  "Calle Monte Encino 15523, Colonia Atenas, 31100 Chihuahua, Chih",
);
assert.ok(verdict.ok && verdict.city === "Chihuahua" && verdict.state === "Chihuahua" && verdict.countryCode === "MX", "el veredicto OK carga la ciudad");

// 4b. Los escritores guardan la ciudad junto con el pin; el route sabe reverse
for (const f of ["components/home/ActivarModal.tsx", "app/vendor/configuracion/page.tsx"]) {
  const src = read(f);
  assert.ok(src.includes("cityFieldsFromVerdict("), `${f}: al guardar el pin se guarda city/state/countryCode`);
}
const cfg = read("app/vendor/configuracion/page.tsx");
assert.ok(/reverse|lat:\s*coords\.lat,\s*lng:\s*coords\.lng\s*\}\)/.test(cfg) && cfg.includes("/api/geocode"), "el pin confirmado a mano también pregunta la ciudad (reverse)");
const route = read("app/api/geocode/route.ts");
assert.ok(route.includes("latlng="), "el route soporta reverse geocode por lat/lng");

// 5. Lectores: title/FAQ/JSON-LD/directorio usan la ciudad estructurada y filtran comodines
const layout = read("app/r/[restaurantId]/layout.tsx");
assert.ok(layout.includes("cityForRestaurant(data)"), "el layout usa la ciudad estructurada");
assert.ok(layout.includes("seoCategories("), "el layout filtra comodines (title + servesCuisine)");
assert.ok(!layout.includes('addressRegion: "Chihuahua"'), "el JSON-LD ya no dice Chihuahua a fuerza (hay locales en Oaxaca, Colombia, RD)");
assert.ok(layout.includes("addressLocality"), "el JSON-LD lleva addressLocality cuando hay ciudad");
const view = read("app/r/[restaurantId]/LandingView.tsx");
assert.ok(view.includes("seoCategories("), "la vista filtra comodines en chips/FAQ/párrafo");
const dir = read("lib/server/restaurantDirectory.ts");
assert.ok(dir.includes("seoCategories(") && dir.includes("cityForRestaurant("), "el directorio filtra comodines y expone la ciudad");

// ── Copy de marketing honesto (12-sep-2026) ─────────────────────────────────
// Las páginas SEO de julio prometían "sin mensualidad" (hay Pro), "recordatorios automáticos" a todos (solo le llegan
// a quien tiene la app; el WhatsApp lo manda el dueño), "te visitamos" gratis (la visita es de paga) y cuentas por
// mesa gratis (son Pro). Regla: "gratis para empezar".
const MARKETING = [
  "app/lealtad-restaurantes-chihuahua/page.tsx", "app/programa-de-lealtad-para-restaurantes/page.tsx",
  "app/tarjeta-de-lealtad-digital/page.tsx", "app/clientes-que-regresan/page.tsx",
  "app/como-vender-mas-en-mi-restaurante/page.tsx", "app/inteligencia-artificial-para-restaurantes/page.tsx",
  "app/menu-qr-gratis-restaurantes/page.tsx", "app/pedidos-en-linea-restaurantes/page.tsx",
  "app/pedidos-whatsapp-restaurantes/page.tsx", "app/punto-de-venta-gratis-restaurantes/page.tsx",
  "app/software-para-restaurantes/page.tsx", "lib/marketing/verticals.ts", "app/llms.txt/route.ts",
];
for (const f of MARKETING) {
  const src = read(f).replace(/^\s*\/\/.*$/gm, "");
  assert.ok(!/sin mensualidad/i.test(src), `${f}: no dice "sin mensualidad" (hay Pro) — usar "gratis para empezar"`);
  assert.ok(!/recordatorios? automátic/i.test(src.replace(/recordatorios automáticos a usuarios de la app/gi, "")), `${f}: "recordatorios automáticos" solo si dice que es a quien tiene la app`);
  assert.ok(!/te visitamos|visitamos (tu|negocios)/i.test(src), `${f}: la visita es de paga, no se promete gratis`);
  assert.ok(!/\bliga\b/i.test(src), `${f}: "link", jamás "liga"`);
}
const pos = read("app/punto-de-venta-gratis-restaurantes/page.tsx");
assert.ok(pos.includes("con Pro"), "punto de venta: las cuentas por mesa dicen que son de Pro");
const llms = read("app/llms.txt/route.ts");
assert.ok(llms.includes("${PRO_PRICE_LABEL}") && llms.includes("Comeleal no manda WhatsApp por su cuenta"), "llms.txt: precio de la constante y sin WhatsApp automático");

console.log("✅ validate-landing-seo: sin 'Otro' en el title y la ciudad la dice Google, no la colonia");
