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

// ── Tarjeta para tus pedidos: nombre, sticker y el resultado (8-oct-2026 tarde) ──
{
  const bc = await import("../lib/order/bagCard.ts");
  if (bc.BAG_PAGE_TITLE !== "Tarjeta para tus pedidos") throw new Error("bolsa: el nombre ya no dice 'bolsa' (cabe la caja y el vaso)");
  if (bc.PER_SHEET.tarjeta !== 8 || bc.PER_SHEET.sticker !== 12) throw new Error("bolsa: 8 tarjetas o 12 stickers por hoja");
  if (bc.bagStatsLine(0, 0) !== "0 personas escanearon tu tarjeta · 0 pidieron por ella en los últimos 30 días") throw new Error("bolsa: el cero se dice tal cual");
  if (bc.bagStatsLine(1, 1) !== "1 persona escaneó tu tarjeta · 1 pidió por ella en los últimos 30 días") throw new Error("bolsa: singular");
  const es = await import("../lib/order/entrySource.ts");
  if (es.entrySourceFromSearch("?utm_source=bolsa&utm_medium=impreso") !== "bolsa") throw new Error("entrada: el QR impreso cuenta");
  if (es.entrySourceFromSearch("?utm_source=bolsa") !== null) throw new Error("entrada: sin utm_medium=impreso no cuenta");
  if (es.entrySourceFromSearch("?utm_source=otra&utm_medium=impreso") !== null) throw new Error("entrada: solo fuentes conocidas");
  const now = 1_000_000_000_000;
  if (es.parseStoredEntry(es.storedEntryValue("bolsa", now), now + 13 * 864e5) !== "bolsa") throw new Error("entrada: dura 14 días");
  if (es.parseStoredEntry(es.storedEntryValue("bolsa", now), now + 15 * 864e5) !== null) throw new Error("entrada: a los 15 días se olvida");
  if (es.parseStoredEntry("basura", now) !== null) throw new Error("entrada: basura no truena");
  const fs = await import("node:fs");
  const rd = (p) => fs.readFileSync(new URL("../" + p, import.meta.url), "utf8");
  if (!rd("lib/order/createCustomerOrder.ts").includes("entrySource: readStoredEntrySource(")) throw new Error("entrada: el pedido la lleva");
  if (!rd("app/menu/[restaurantId]/MenuView.tsx").includes("captureEntrySource(restaurantId)")) throw new Error("entrada: el menú la captura");
  const lv = rd("app/api/landing-visit/route.ts");
  if (!lv.includes('"bolsa"]') || !lv.includes('source === "bolsa"')) throw new Error("entrada: el escaneo suma en linkVisits.bolsa y NO en el total del dueño");
  if (!rd("app/vendor/layout.tsx").includes('href: "/vendor/bolsa"')) throw new Error("bolsa: está en el menú de la izquierda");
  console.log("✅ tarjeta para tus pedidos: tarjeta o sticker, con su piel, y el dueño ve cuántos escanearon y pidieron");
}
