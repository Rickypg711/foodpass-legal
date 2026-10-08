/**
 * Lazos cerrados de los patrones (7-oct-2026) — contrato web ↔ app ↔ cerebro.
 *
 *   1. parsePatternLoops lee lo que deja el cerebro y descarta lo que no sirve.
 *   2. Las frases son las mismas que la app (LoopCopy en
 *      FOODPASS lib/reports/pattern_loops_insight.dart).
 *   3. El Panel pinta el toque y la Caja ofrece la cuenta de mesa.
 *   4. El cerebro (functions/pattern_loops.js) usa los mismos actionCode.
 *
 * Run: node scripts/validate-pattern-loops.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import {
  parsePatternLoops,
  loopReady,
  loopCtaLabel,
  promoResultLine,
  parsePrice,
  comboMenuDoc,
  isPatternLoopCode,
  LOOP_COPY,
  PATTERN_LOOP_CODES,
} from "../lib/vendor/patternLoops.ts";
import { looksLikeTable, tableTabPrompt, TABLE_TAB_PROMPT_SUB } from "../lib/pos/tableNameHint.ts";

let failed = 0;
function check(label, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    console.error(`FAIL ${label}\n  esperado: ${e}\n  recibido: ${a}`);
    failed = 1;
  }
}

const raw = {
  weakNight: { weekday: 3, weekdayName: "miércoles", perNight: 463, avgPerNight: 1512, daysUntil: 1, targetDayKey: "2026-10-14", active: true, alreadySent: false, message: "Mañana miércoles te esperamos. ¿Le caes? 🙌" },
  combo: { a: "Orden de 4 tacos", b: "Torito", aId: "a1", bId: "b1", count: 14, fullPrice: 165, price: 145, name: "Orden de 4 tacos + Torito", category: "Combos" },
  staleDish: { id: "m3", name: "CARAJILLO", prev: 43 },
  promoResults: { sent: 2, measured: 1, wins: 1, avgLiftPct: 34, last: { dayKey: "2026-10-07", weekdayName: "miércoles", revenue: 1820, baseline: 1354, liftPct: 34 } },
};

// ── 1 ──
const l = parsePatternLoops(raw);
check("parse targetDayKey", l.weakNight.targetDayKey, "2026-10-14");
check("parse combo price", l.combo.price, 145);
check("ready", ["promo_weak_night", "publish_combo", "hide_stale_dish", "send_winback"].map((c) => loopReady(c, l)), [true, true, true, false]);
check("null", parsePatternLoops(null), null);
check("sin mensaje no hay toque", parsePatternLoops({ weakNight: { message: "" } }).weakNight, null);
check("códigos", [...PATTERN_LOOP_CODES], ["promo_weak_night", "publish_combo", "hide_stale_dish"]);
check("isPatternLoopCode", [isPatternLoopCode("publish_combo"), isPatternLoopCode("send_winback")], [true, false]);
check("resultado", promoResultLine(l.promoResults), "El miércoles que mandaste el mensaje vendiste $1,820 (tu promedio es $1,354).");
check("cta", ["promo_weak_night", "publish_combo", "hide_stale_dish", "x"].map(loopCtaLabel), ["Mandar por WhatsApp", "Publicar combo", "Esconderlo del menú", null]);
check("precio", [parsePrice("$145"), parsePrice("abc"), parsePrice("0")], [145, null, null]);
const d = comboMenuDoc(l.combo, "  ", 140);
check("combo doc", [d.name, d.price, d.isAvailable, d.category, d.comboFromBrain.a], ["Orden de 4 tacos + Torito", 140, true, "Combos", "Orden de 4 tacos"]);
check("mesa sí", ["T1", "l2", "Mesa 4", "BARRA", "TV", "M 1"].every(looksLikeTable), true);
check("mesa no", ["Juan", "Ana", "", "LEVI -15%"].some(looksLikeTable), false);
check("prompt", tableTabPrompt(" t1 "), "¿Abrir cuenta de mesa T1?");

// ── 2: frases = la app ──
const APP = "/Users/ricardoparedes/projects/FOODPASS";
if (existsSync(`${APP}/pubspec.yaml`)) {
  const dart = readFileSync(`${APP}/lib/reports/pattern_loops_insight.dart`, "utf8");
  for (const [k, v] of Object.entries(LOOP_COPY)) {
    check(`app LoopCopy.${k}`, dart.includes(`static const ${k} = '${v}';`) || dart.includes(`static const ${k} =\n      '${v}';`), true);
  }
  const hint = readFileSync(`${APP}/lib/pos/table_name_hint.dart`, "utf8");
  check("app sub de la mesa", hint.includes(`'${TABLE_TAB_PROMPT_SUB}'`), true);
  const brain = readFileSync(`${APP}/functions/pattern_loops.js`, "utf8");
  for (const c of [...PATTERN_LOOP_CODES, "table_tab_suggest"]) check(`cerebro conoce ${c}`, brain.includes(`'${c}'`), true);
  const alert = readFileSync(`${APP}/functions/vendor_morning_alert_ai.js`, "utf8");
  check("push de la mañana con la noche floja", alert.includes("'promo_weak_night'"), true);
}

// ── 3: el Panel y la Caja ──
const page = readFileSync(new URL("../app/vendor/page.tsx", import.meta.url), "utf8");
check("panel lee patternLoops", page.includes("patternLoops: nbaOverridden ? null : parsePatternLoops(ins?.patternLoops),"), true);
check("panel pinta el toque", page.includes("<PatternLoopAction key={actionCode}"), true);
check("pendiente sube en vez de navegar", page.includes("setFocus(item.actionCode)"), true);
const action = readFileSync(new URL("../app/vendor/_components/PatternLoopAction.tsx", import.meta.url), "utf8");
check("la noche que mandó, para medirla", action.includes('actionCode: "promo_weak_night", target: w.targetDayKey'), true);
check("esconder = isAvailable false", action.includes("isAvailable: false"), true);
check("combo marcado para el cerebro", action.includes("comboFromBrain"), true);
check("nada se manda solo", action.includes("buildWhatsappShareUrl(w.message)"), true);
const pos = readFileSync(new URL("../app/vendor/pos/page.tsx", import.meta.url), "utf8");
check("Caja ofrece la cuenta", pos.includes('mode === "now" && !isRedeemOnly && looksLikeTable(name)'), true);
check("Caja lo registra", pos.includes('actionCode: "table_tab_suggest"'), true);

if (failed) process.exit(1);
console.log("validate-pattern-loops: OK");
