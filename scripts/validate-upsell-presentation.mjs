/**
 * Candado (9-oct-2026, FOODPASS docs/UPSELL_9_OCT.md): la sugerencia se enseña igual en la web y en la app.
 *  1. lib/order/upsellPresentation.ts pasa los casos de lib/order/upsellCases.json (copia idéntica de FOODPASS
 *     test/fixtures/upsell_cases.json, que corre la app en test/orders/upsell_honesty_test.dart).
 *  2. La tarjeta del carrito ya no pinta la frase de Gemini, mide mostrada/agregada/no gracias y no sugiere lo que
 *     está fuera de horario o pide opciones obligatorias.
 *  3. Frases idénticas a la app (lib/l10n/app_es.arb): la tarjeta, "Va bien con" y "Lo más pedido".
 *
 * Run: node --experimental-strip-types scripts/validate-upsell-presentation.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  upsellPresentation,
  upsellItemSuggestible,
  UPSELL_COPY,
  upsellAddLabel,
  upsellNewTotalLabel,
} from "../lib/order/upsellPresentation.ts";

let failed = 0;
const must = (cond, label) => {
  if (!cond) {
    console.error(`FAIL ${label}`);
    failed = 1;
  }
};
const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");

// 1. Casos.
const casesText = read("../lib/order/upsellCases.json");
for (const c of JSON.parse(casesText)) {
  const out = upsellPresentation(c.suggestion, c.cartTotal);
  if (c.expect === null) must(out === null, `${c.name}: no se enseña`);
  else {
    must(out && out.copy === c.expect.copy, `${c.name}: frase ${out?.copy}`);
    must(out && out.priceDelta === c.expect.priceDelta, `${c.name}: +$ ${out?.priceDelta}`);
    must(out && out.newTotal === c.expect.newTotal, `${c.name}: total ${out?.newTotal}`);
  }
}

// Qué se puede sugerir.
const windows = { menuCategoryWindows: { Desayunos: [{ from: "08:00", to: "12:00", days: [1, 2, 3, 4, 5, 6, 7] }] } };
must(upsellItemSuggestible({ category: "Bebidas" }, null), "disponible sin opciones: sí");
must(!upsellItemSuggestible({ category: "Bebidas", isAvailable: false }, null), "agotado: no");
must(
  !upsellItemSuggestible({ category: "Bebidas", optionGroups: [{ id: "s", name: "Sabor", required: true, max: 1, options: [{ id: "j", name: "Jamaica", priceDelta: 0 }] }] }, null),
  "opción obligatoria: no",
);
must(!upsellItemSuggestible({ category: "Desayunos" }, windows, new Date(2026, 9, 9, 21)), "desayuno de noche: no");
must(upsellItemSuggestible({ category: "Desayunos" }, windows, new Date(2026, 9, 9, 9)), "desayuno en la mañana: sí");

// 2. La tarjeta.
const card = read("../components/cart/UpsellCard.tsx");
must(!card.includes("suggestion.pitchTitle") && !card.includes("suggestion.pitchBody"), "UpsellCard no pinta la frase de Gemini");
must(card.includes("upsellPresentation("), "UpsellCard usa upsellPresentation");
for (const a of ['action: "shown"', 'action: "added"', 'action: "dismissed"']) must(card.includes(a), `UpsellCard mide ${a}`);
must(card.includes("upsellItemSuggestible("), "UpsellCard no sugiere fuera de horario ni con opciones obligatorias");
const sheet = read("../components/menu/MenuItemDetailSheet.tsx");
must(sheet.includes('surface: "sheet"') && sheet.includes('action: "added"'), "Va bien con se mide en la hoja");
must(read("../lib/analytics/orderEvents.ts").includes('"upsell_event"'), "evento upsell_event");

// 3. Frases idénticas a la app.
const foodpass = process.env.FOODPASS_DIR || join(homedir(), "projects", "FOODPASS");
const arbPath = join(foodpass, "lib", "l10n", "app_es.arb");
const fixture = join(foodpass, "test", "fixtures", "upsell_cases.json");
if (existsSync(arbPath) && JSON.parse(readFileSync(arbPath, "utf8")).carrito2UpsellPaired) {
  const es = JSON.parse(readFileSync(arbPath, "utf8"));
  must(es.carrito2UpsellPaired === UPSELL_COPY.pairedTogether, "frase co-compra = app");
  must(es.carrito2UpsellSizeUp === UPSELL_COPY.sizeUp, "frase agrandar = app");
  must(es.carrito2UpsellDrink === UPSELL_COPY.drink, "frase bebida = app");
  must(es.carrito2UpsellAddDelta.replace("{price}", "$9") === upsellAddLabel("$9"), "botón = app");
  must(es.carrito2UpsellNewTotal.replace("{total}", "$9") === upsellNewTotalLabel("$9"), "total nuevo = app");
  must(es.menuPairsTitle === "Va bien con" && sheet.includes(">Va bien con<"), "Va bien con = app");
  must(es.menuPairsAdd === "Agregar +" && sheet.includes('"Agregar +"'), "Agregar + = app");
  must(es.menuPairsHave === "Llevas {count} · +" && sheet.includes("`Llevas ${p.quantity} · +`"), "Llevas N = app");
  const picks = read("../components/menu/MenuTopPicks.tsx");
  must(picks.includes(`"${es.menuTopPicksSource}"`), "Lo más pedido dice de dónde sale = app");
  if (existsSync(fixture)) must(readFileSync(fixture, "utf8") === casesText, "casos idénticos a la app");
} else {
  console.log(`(aviso) la app en ${foodpass} todavía no trae las frases nuevas: se revisa solo el lado web`);
}

if (failed) process.exit(1);
console.log("validate-upsell-presentation: OK");
