/**
 * Señales del menú (8-oct-2026) — candado de las cuatro piezas:
 *   #2 "Lo más pedido" arriba del menú de siempre (menuSignals.topItemIds)
 *   #3 "Va bien con" en la hoja del platillo (menuSignals.pairs)
 *   #8 Fotos de /r abren /menu/{id}?platillo={itemId} con la hoja abierta
 *   #9 Panel: "te habría costado en una app de reparto" (vendorInsights)
 * Todo se apaga en silencio si el dato no existe. Nada se inventa.
 *
 * Run: node scripts/validate-menu-signals.mjs
 */

import { readFileSync, existsSync } from "node:fs";

const {
  parseMenuSignals,
  topItemsFromSignals,
  pairItemsFor,
  dishMenuHref,
  findLinkedDish,
  deliveryAppSavingsLine,
  DISH_PARAM,
} = await import("../components/menu/menuSignals.ts");
const { menuSalesMoney } = await import("../lib/order/menuSales.ts");

let fails = 0;
function chk(actual, expected, label) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    fails++;
    console.error(`❌ ${label}\n   esperado ${e}\n   salió    ${a}`);
  }
}
function has(src, needle, label) {
  if (!src.includes(needle)) {
    fails++;
    console.error(`❌ ${label}: falta ${JSON.stringify(needle)}`);
  }
}

const items = [
  { id: "a", name: "Tacos al pastor", price: 90 },
  { id: "b", name: "Quesadilla", price: 45 },
  { id: "c", name: "Agua de horchata", price: 30 },
];
const ids = (xs) => xs.map((x) => x.id).join(",");

// ── parse: sin dato o raro → null ────────────────────────────────────────────
chk(parseMenuSignals(null), null, "sin doc no hay señales");
chk(parseMenuSignals({}), null, "sin menuSignals no hay señales");
chk(parseMenuSignals({ menuSignals: "x" }), null, "menuSignals raro no truena");
chk(parseMenuSignals({ menuSignals: { topItemIds: [], pairs: {} } }), null, "vacío = null");
const sig = parseMenuSignals({
  menuSignals: {
    topItemIds: ["zz", "b", "a", "b", 5, "c", "d", "e", "f", "g"],
    pairs: { a: ["c", "b", "x"], b: ["b"], c: "nope" },
    orders: 40,
    windowDays: 30,
  },
});
chk(sig.topItemIds.length, 6, "máximo 6 en topItemIds");
chk(sig.pairs.a, ["c", "b"], "máximo 2 por platillo");
chk(sig.pairs.b, undefined, "un platillo no va bien consigo mismo");

// ── #2 Lo más pedido: solo los que siguen en el menú ─────────────────────────
chk(ids(topItemsFromSignals(sig, items)), "b,a,c", "filtra ids que ya no están y respeta el orden");
chk(topItemsFromSignals(null, items), [], "sin señales no hay fila");

// ── #3 Va bien con ──────────────────────────────────────────────────────────
chk(ids(pairItemsFor(sig, "a", items)), "c,b", "pares del platillo");
chk(pairItemsFor(sig, "c", items), [], "sin pares no se pinta");
chk(pairItemsFor(null, "a", items), [], "sin señales no se pinta");
chk(ids(pairItemsFor(sig, "a", items.filter((i) => i.id !== "c"))), "b", "par borrado del menú no sale");

// ── #8 link directo ─────────────────────────────────────────────────────────
chk(DISH_PARAM, "platillo", "el parámetro se llama platillo");
chk(dishMenuHref("r1", { id: "a", name: "Tacos" }), "/menu/r1?platillo=a", "con id va el id");
chk(dishMenuHref("r1", { name: "Tacos al pastor" }), "/menu/r1?platillo=Tacos%20al%20pastor", "sin id va el nombre");
chk(dishMenuHref("r1", {}), "/menu/r1", "sin nada, el link de siempre");
chk(findLinkedDish(items, "b")?.id, "b", "encuentra por id");
chk(findLinkedDish(items, "tacos al pastor")?.id, "a", "encuentra por nombre");
chk(findLinkedDish(items, "nada"), null, "si no está, no abre nada");
chk(findLinkedDish(items, null), null, "sin parámetro, no abre nada");

// ── #9 línea del panel ──────────────────────────────────────────────────────
chk(
  deliveryAppSavingsLine(12, 4500),
  "Tus 12 pedidos en línea de 30 días suman $4,500. En una app de reparto que cobra hasta 30 %, te habrían costado hasta $1,350 de comisión.",
  "línea con varios pedidos",
);
chk(
  deliveryAppSavingsLine(1, 450),
  "Tu pedido en línea de 30 días suma $450. En una app de reparto que cobra hasta 30 %, te habría costado hasta $135 de comisión.",
  "línea con un pedido",
);
chk(deliveryAppSavingsLine(0, 4500), null, "con 0 pedidos no se pinta");
chk(deliveryAppSavingsLine(undefined, undefined), null, "sin dato no se pinta");
chk(deliveryAppSavingsLine(3, 0), null, "sin monto no se pinta");
chk(deliveryAppSavingsLine(NaN, 10), null, "dato raro no truena");
chk(deliveryAppSavingsLine(2, 1234567).includes(menuSalesMoney(1234567)), true, "mismo formato de dinero que menuSalesMoney");
for (const line of [deliveryAppSavingsLine(2, 900), deliveryAppSavingsLine(1, 90)]) {
  if (/[—–]/.test(line)) { fails++; console.error("❌ la línea trae raya"); }
}

// ── el código las pinta donde toca ──────────────────────────────────────────
const view = readFileSync("app/menu/[restaurantId]/MenuView.tsx", "utf8");
has(view, "parseMenuSignals(rdata)", "MenuView lee menuSignals del doc");
has(view, "!skin && topPicks.length > 0", "Lo más pedido solo en el menú sin piel");
has(view, "<MenuTopPicks", "MenuView pinta la fila");
has(view, "pairItemsFor(menuSignals, detailItem?.id, items)", "la hoja recibe sus pares");
has(view, "handleAddItem(p)", "Va bien con agrega por el mismo camino del +");
has(view, "useDishDeepLink(items, loading, setDetailItem)", "el link ?platillo= abre la hoja");
has(view, "get(DISH_PARAM)", "MenuView lee ?platillo=");

const top = readFileSync("components/menu/MenuTopPicks.tsx", "utf8");
has(top, "Lo más pedido", "título de la fila");
has(top, "if (!items.length) return null;", "sin platillos no hay fila");

const sheet = readFileSync("components/menu/MenuItemDetailSheet.tsx", "utf8");
has(sheet, "Va bien con", "la hoja dice Va bien con");
has(sheet, "pairs.length > 0 ?", "sin pares no se pinta");
has(sheet, "onAddPair(p.id)", "el botón agrega el par");

const landing = readFileSync("app/r/[restaurantId]/LandingView.tsx", "utf8");
has(landing, "href={dishMenuHref(restaurantId, item)}", "las fotos de /r abren su platillo");

const vendor = readFileSync("app/vendor/page.tsx", "utf8");
has(vendor, "deliveryAppSavingsLine(insMetrics.webOrdersPaid30d, insMetrics.webOrdersPaidAmount30d)", "el panel lee vendorInsights");
has(vendor, "{deliveryAppSavings ? (", "el panel no pinta la línea sin dato");

// Las pieles no se tocan: su archivo no sabe de señales.
for (const f of ["kame", "omu", "suadero", "fresheria"]) {
  const p = `components/menu/skins/${f}.tsx`;
  if (existsSync(p) && readFileSync(p, "utf8").includes("menuSignals")) {
    fails++;
    console.error(`❌ la piel ${f} no debe leer menuSignals`);
  }
}

// Paridad app: la misma línea en el panel de Flutter (si el repo está al lado).
const dartAlt = "/Users/ricardoparedes/projects/FOODPASS/lib/bottom_nav_pages/restarantowner/dashboard/widgets/delivery_app_savings_line.dart";
const dartPath = existsSync(dartAlt) ? dartAlt : null;
if (dartPath) {
  const d = readFileSync(dartPath, "utf8");
  has(d, "te habrían costado hasta $fee de comisión.", "la app dice lo mismo");
  has(d, "m['webOrdersPaid30d']", "la app lee el mismo campo");
}

if (fails) {
  console.error(`\n${fails} falla(s) en señales del menú`);
  process.exit(1);
}
console.log("✅ Señales del menú: Lo más pedido, Va bien con, link ?platillo= y la línea del panel (se apagan sin dato)");
