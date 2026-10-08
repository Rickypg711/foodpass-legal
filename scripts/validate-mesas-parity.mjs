/**
 * Candado (30-sep-2026): /vendor/mesas es la fuente que copia la app
 * (FOODPASS lib/pages/mesas/mesas_qr_page.dart, candado
 * test/negocio/mesas_boton_por_boton_test.dart). La pantalla del dueño va en
 * Opción A; la TARJETA impresa no cambia y promete puntos solo si el local
 * los promete.
 *
 * Run: node scripts/validate-mesas-parity.mjs
 */
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../app/vendor/mesas/page.tsx", import.meta.url), "utf8");
const ts = readFileSync(new URL("../lib/order/tableSession.ts", import.meta.url), "utf8");

let failed = 0;
function must(cond, label) {
  if (!cond) {
    console.error(`FAIL ${label}`);
    failed = 1;
  }
}

for (const s of [
  "Mesas y códigos QR",
  "Un QR para cada mesa",
  "¿Cuántas mesas tienes?",
  "¿O tienen nombre?",
  "Escribe uno por línea: Barra, Terraza 1, T3… Si lo dejas vacío usamos números.",
  "Escribe al menos un nombre válido.",
  "con nombre. Máx ${TABLE_MAX_LENGTH} caracteres cada una; se ignoran repetidas.",
  'Imprimir {mesas.length} {mesas.length === 1 ? "código" : "códigos"}',
  "Salen 2 por hoja. Recorta por la línea punteada.",
  "Escanea y ordena",
  '{loyaltyLive ? "Pide desde tu teléfono y acumula puntos ⭐" : "Pide desde tu teléfono"}',
  "restaurantPromisesPoints(snap.data())",
  "tableMenuUrl(SITE_URL, restaurantId, mesa)",
]) {
  must(page.includes(s), `ausente en /vendor/mesas: ${s}`);
}
must(/const MAX_MESAS = 60;/.test(page), "MAX_MESAS = 60 (kMaxMesas en la app)");
must(/export const TABLE_MAX_LENGTH = 12;/.test(ts), "TABLE_MAX_LENGTH = 12 (kTableMaxLength en la app)");
// Lo que ve el dueño (fuera de la tarjeta impresa) ya no trae emoji ni degradado.
const owner = page.slice(0, page.indexOf("print-sheet mx-auto"));
must(!/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(owner), "sin emoji en la pantalla del dueño");
must(!owner.includes("linear-gradient"), "sin degradado en el botón");
must(!owner.includes("uppercase tracking-widest"), "sin pastilla en versalitas");

if (failed) process.exit(1);
console.log("validate-mesas-parity: OK");

// ── Tarjeta para la bolsa de Rappi/DiDi (8-oct-2026) ───────────────────────
{
  const { bagCardUrl, bagCardLines } = await import("../lib/order/bagCard.ts");
  const u = bagCardUrl("https://www.comeleal.com/", "abc 1");
  if (u !== "https://www.comeleal.com/menu/abc%201?utm_source=bolsa&utm_medium=impreso") throw new Error("bolsa: QR a /menu por ID con utm_source=bolsa: " + u);
  if (bagCardLines(false).cta.includes("puntos")) throw new Error("bolsa: sin premios no promete puntos");
  if (!bagCardLines(true).cta.includes("puntos")) throw new Error("bolsa: con premios sí los dice");
  const page = (await import("node:fs")).readFileSync(new URL("../app/vendor/bolsa/page.tsx", import.meta.url), "utf8");
  if (!page.includes("bagCardUrl(SITE_URL") || page.includes("window.location.origin")) throw new Error("bolsa: el QR impreso usa SITE_URL, nunca el origin del navegador");
  console.log("✅ tarjeta para la bolsa: QR a su menú con SITE_URL, sin promesas de puntos apagados");
}
