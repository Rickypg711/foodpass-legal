/**
 * Robot de botones de las páginas públicas (/r y /menu) de un local. 8-oct-2026.
 *
 * Nació revisando el sitio de Rebellion Pizza botón por botón: el de delivery de una
 * sucursal mandaba a la otra, el de TikTok daba 404, una página pedía llenar una forma que
 * no existía. Nadie lo había visto porque nadie le pica a todo. Esto le pica a todo:
 *
 *   - cada link interno responde 200
 *   - cada link externo responde (403/429 de sitios que bloquean robots se marcan aparte)
 *   - cada link de WhatsApp va por api.whatsapp.com/send con número (el canon)
 *   - cada tel: trae dígitos
 *   - ningún botón visible está tapado por otro elemento (no se puede picar)
 *   - cero errores en la consola
 *
 * SOLO LEE: no agrega al carrito, no manda formas, no crea pedidos. No es parte de npm test
 * (necesita red y un navegador). Correrlo contra el local de pruebas de Ricardo (Luzz Pizza)
 * o contra el que se acaba de montar, antes de entregarlo.
 *
 *   npx playwright install chromium   (una vez; o usa --chrome para el Chrome instalado)
 *   node scripts/check-public-pages.mjs <handle o id> [--base=http://localhost:3000] [--chrome]
 */
import { chromium, devices } from "playwright";

const args = process.argv.slice(2);
const handle = args.find((a) => !a.startsWith("--"));
const base = (args.find((a) => a.startsWith("--base="))?.slice(7) ?? "https://www.comeleal.com").replace(/\/+$/, "");
if (!handle) {
  console.error("Uso: node scripts/check-public-pages.mjs <handle o id> [--base=URL] [--chrome]");
  process.exit(2);
}

const browser = await chromium.launch(args.includes("--chrome") ? { channel: "chrome" } : {});
const problems = [];
let checked = 0;
const extSeen = new Map();
const warnings = new Set();

async function checkPage(path, vpName, opts) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  // "Failed to load resource" (401/403) sale de App Check y analytics bloqueando al
  // navegador automático, no de la página: va como aviso, no como problema.
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    if (/Failed to load resource/i.test(m.text())) warnings.add(m.text());
    else errors.push(m.text());
  });
  const res = await page.goto(base + path, { waitUntil: "load", timeout: 45000 }).catch((e) => ({ status: () => "ERR " + e.message }));
  // "load" y no "networkidle": Firestore deja la conexión abierta y nunca queda quieta.
  await page.waitForTimeout(2500);
  const status = typeof res?.status === "function" ? res.status() : "?";
  if (status !== 200) problems.push(`${vpName} ${path}: la página respondió ${status}`);
  const finalPath = new URL(page.url()).pathname;

  const items = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll("a[href], button").forEach((el) => {
      const r = el.getBoundingClientRect();
      const st = getComputedStyle(el);
      const visible = r.width > 0 && r.height > 0 && st.visibility !== "hidden" && st.display !== "none";
      let covered = null;
      if (visible) {
        el.scrollIntoView({ block: "center" });
        const rr = el.getBoundingClientRect();
        const hit = document.elementFromPoint(rr.x + rr.width / 2, rr.y + rr.height / 2);
        if (hit && hit !== el && !el.contains(hit) && !hit.contains(el)) covered = `${hit.tagName.toLowerCase()}.${String(hit.className).slice(0, 40)}`;
      }
      out.push({ tag: el.tagName.toLowerCase(), href: el.getAttribute("href"), text: (el.innerText || el.getAttribute("aria-label") || "").trim().replace(/\s+/g, " ").slice(0, 40), visible, covered });
    });
    return out;
  });

  for (const it of items) {
    checked++;
    const label = `${vpName} ${finalPath} ${it.tag} "${it.text}"`;
    if (it.visible && it.covered) problems.push(`${label}: tapado por ${it.covered}`);
    const h = it.href;
    if (!h) continue;
    if (h.startsWith("tel:")) {
      if (!/\d{7,}/.test(h.replace(/\D/g, ""))) problems.push(`${label}: tel sin número (${h})`);
    } else if (/whatsapp|wa\.me/i.test(h)) {
      if (/wa\.me/i.test(h)) problems.push(`${label}: wa.me rompe los emojis, va por api.whatsapp.com/send`);
      else if (!/api\.whatsapp\.com\/send\/?\?phone=\d{10,}/.test(h)) problems.push(`${label}: WhatsApp sin número válido (${h.slice(0, 80)})`);
    } else if (h.startsWith("/") ) {
      const u = new URL(h, base);
      const r = await fetch(u, { redirect: "follow" }).catch(() => null);
      if (!r || r.status >= 400) problems.push(`${label}: link interno ${u.pathname} respondió ${r ? r.status : "sin respuesta"}`);
    } else if (/^https?:/.test(h)) {
      if (!extSeen.has(h)) extSeen.set(h, label);
    }
  }
  if (errors.length) problems.push(`${vpName} ${path}: errores en consola: ${[...new Set(errors)].join(" | ").slice(0, 300)}`);
  await ctx.close();
  return finalPath;
}

const phone = { ...devices["iPhone 13"] };
const desk = { viewport: { width: 1366, height: 900 } };
await checkPage(`/r/${encodeURIComponent(handle)}`, "celular", phone);
await checkPage(`/r/${encodeURIComponent(handle)}`, "compu", desk);
// /menu va por ID: si nos dieron un slug, la portada lo resuelve y el botón del menú trae el ID.
const ctx = await browser.newContext(desk);
const p = await ctx.newPage();
await p.goto(`${base}/r/${encodeURIComponent(handle)}`, { waitUntil: "domcontentloaded" });
const menuHref = await p.evaluate(() => [...document.querySelectorAll('a[href^="/menu/"]')].map((a) => a.getAttribute("href")).find((h) => /^\/menu\/[^/?#]+$/.test(h)));
await ctx.close();
if (menuHref) {
  await checkPage(menuHref, "celular", phone);
  await checkPage(menuHref, "compu", desk);
} else {
  problems.push(`/r/${handle}: no encontré el botón al menú`);
}

const blocked = [];
for (const [u, label] of extSeen) {
  checked++;
  const r = await fetch(u, { redirect: "follow", headers: { "user-agent": "Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/141 Safari/537.36" } }).catch(() => null);
  if (!r) problems.push(`${label}: ${u} no responde`);
  else if (r.status === 403 || r.status === 429 || r.status === 400) blocked.push(`${r.status} ${u}`);
  else if (r.status >= 400) problems.push(`${label}: ${u} respondió ${r.status}`);
}
await browser.close();

console.log(`\nRevisados: ${checked} botones y links en /r y /menu, celular y compu.`);
if (warnings.size) console.log(`\nAvisos del navegador automático (no son de la página):\n  ${[...warnings].join("\n  ")}`);
if (blocked.length) console.log(`\nNo dejan entrar a robots (revisar a mano):\n  ${blocked.join("\n  ")}`);
if (problems.length) {
  console.log(`\n❌ ${problems.length} problemas:\n  ${problems.join("\n  ")}`);
  process.exit(1);
}
console.log("\n✅ Todo responde y nada está tapado.");
