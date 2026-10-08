/**
 * Patrones de venta (7-oct-2026) — contrato web ↔ app.
 *
 * Lo que este candado afirma:
 *   1. salesPatterns() da EXACTO lo esperado en los dos casos compartidos
 *      (taquería que cobra en vivo / bar que captura al cierre).
 *   2. Las piezas que el Dart repite (redondeo, horas, mesas, teléfono).
 *   3. El caso de la app es IDÉNTICO byte por byte (si la app está aquí).
 *   4. Reportes pinta cada sección y la parte Pro pasa por la pared.
 *
 * Run: node scripts/validate-sales-patterns.mjs
 */

import { readFileSync, existsSync } from "node:fs";
import {
  salesPatterns,
  patternsCopy,
  choiceHeadline,
  money0,
  signedPct,
  roundHalfUp,
  changePct,
  pctOf,
  hourRange,
  hourShort,
  tableTag,
  normPhone,
  payLabel,
  weekdayName,
  weekdayPlural,
  TABLE_NAME_RE,
  TYPED_DISCOUNT_RE,
} from "../lib/reports/salesPatterns.ts";

let failed = 0;
function check(label, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    console.error(`FAIL ${label}\n  esperado: ${e}\n  recibido: ${a}`);
    failed = 1;
  }
}
const round = (_k, v) => (typeof v === "number" ? Math.round(v * 100) / 100 : v);

// ── 1. Los dos casos compartidos ─────────────────────────────────────────────
const FIXTURE = new URL("./fixtures/sales-patterns.json", import.meta.url);
const fixtureText = readFileSync(FIXTURE, "utf8");
const fixture = JSON.parse(fixtureText);
check("dos casos", fixture.cases.map((c) => c.name), ["taqueria_en_vivo", "bar_al_cierre"]);
for (const c of fixture.cases) {
  const got = JSON.parse(JSON.stringify(salesPatterns(c.input), round));
  for (const k of Object.keys(c.expected)) check(`${c.name}.${k}`, got[k], c.expected[k]);
  const copy = patternsCopy(salesPatterns(c.input));
  for (const k of Object.keys(c.copy)) check(`${c.name}.copy.${k}`, copy[k], c.copy[k]);
}
const [taq, bar] = fixture.cases.map((c) => c.expected);
// Lo que el caso tiene que demostrar (si se regenera mal, aquí se ve).
check("taquería: hora pico visible", taq.peakHour != null, true);
check("taquería: sin aviso de cierre", taq.hints.bulkCapture, false);
check("taquería: el teléfono de la casa no es cliente", taq.regulars != null, true);
check("taquería: sin mes anterior no hay comparación", taq.monthCompare, null);
check("taquería: platillos del menú sin venta", taq.menuMix.idle, ["Nopales", "Toreados"]);
check("taquería: lo que eligen (carne)", taq.choices[0].group, "Carne");
check("taquería: dos carnes en una orden cuentan las dos", taq.choices[0].rows.length >= 3, true);
check("bar: lo que eligen (picante)", bar.choices[0].group, "Nivel de picante");
check("frase de lo que eligen", choiceHeadline({ group: "Carne", total: 46, rows: [{ choice: "Suadero", units: 22, pct: 48 }, { choice: "Bistec", units: 12, pct: 26 }] }), "Suadero es lo que más piden en carne (48 %).");
check("bar: hora pico escondida (captura al cierre)", bar.peakHour, null);
check("bar: aviso de cierre", bar.hints.bulkCapture, true);
check("bar: sin teléfonos no hay regulares", bar.regulars, null);
check("bar: dejó de venderse", bar.monthCompare.stopped.map((s) => s.name), ["CARAJILLO"]);
check("bar: descuento tecleado", bar.hints.typedDiscounts, { count: 1, example: "LEVI -15%" });
check("bar: mesas por nombre", bar.hints.tableNames != null, true);
check("bar: 'M 1' y 'M1' son la misma mesa", bar.tables.rows.some((r) => r.name === "M 1"), false);

// ── 2. Piezas ───────────────────────────────────────────────────────────────
check("money0", [money0(1352.5), money0(0), money0(1234567.4), money0(-80)], ["$1,353", "$0", "$1,234,567", "-$80"]);
check("signedPct", [signedPct(34), signedPct(-41), signedPct(0)], ["+34 %", "-41 %", "0 %"]);
check("roundHalfUp(2.5)", roundHalfUp(2.5), 3);
check("roundHalfUp(-2.5) = Dart (x+0.5).floor()", roundHalfUp(-2.5), -2);
check("changePct baja simétrica", changePct(55, 100), -45);
check("changePct -44.5 → -45 (lejos de cero, como sube)", changePct(55.5, 100), -45);
check("changePct sin base", changePct(10, 0), 0);
check("pctOf", pctOf(1, 3), 33);
check("hourRange 20", hourRange(20), "8 a 9 PM");
check("hourRange 11", hourRange(11), "11 AM a 12 PM");
check("hourRange 23", hourRange(23), "11 PM a 12 AM");
check("hourRange 0", hourRange(0), "12 a 1 AM");
check("hourShort 19", hourShort(19), "7 PM");
check("hourShort 0", hourShort(0), "12 AM");
check("tableTag tab manda", tableTag({ tab: "Pedro", name: "T1" }), "PEDRO");
check("tableTag nombre de mesa", tableTag({ tab: "", name: "m 2" }), "M2");
check("tableTag persona no es mesa", tableTag({ tab: "", name: "Juan" }), "");
check("mesas que sí", ["T1", "L2", "Mesa 4", "BARRA", "TV", "M 1"].every((n) => TABLE_NAME_RE.test(n)), true);
check("nombres que no", ["Juan", "Ana", "Cuenta", "LEVI -15%"].some((n) => TABLE_NAME_RE.test(n)), false);
check("descuento tecleado", ["LEVI -15%", "juan 10 %"].every((n) => TYPED_DISCOUNT_RE.test(n)), true);
check("normPhone", [normPhone("+52 (614) 606-6023"), normPhone("123")], ["6146066023", ""]);
check("payLabel", ["cash", "card", "transfer", "other", "x"].map(payLabel), ["Efectivo", "Tarjeta", "Transferencia", "Otro", "Otro"]);
check("weekday", [weekdayName(3), weekdayPlural(6), weekdayPlural(1)], ["miércoles", "sábados", "lunes"]);

// ── 3. El espejo de la app ──────────────────────────────────────────────────
const APP = "/Users/ricardoparedes/projects/FOODPASS";
if (existsSync(`${APP}/pubspec.yaml`)) {
  const dart = `${APP}/lib/reports/sales_patterns.dart`;
  const appFixture = `${APP}/test/fixtures/sales_patterns.json`;
  check("la app tiene lib/reports/sales_patterns.dart", existsSync(dart), true);
  check("la app tiene el mismo caso", existsSync(appFixture), true);
  if (existsSync(appFixture)) {
    check("caso idéntico web ↔ app", readFileSync(appFixture, "utf8") === fixtureText, true);
  }
  if (existsSync(dart)) {
    const d = readFileSync(dart, "utf8");
    for (const k of [
      "kLiveMinSpan = Duration(minutes: 45)",
      "kLiveMinMedianGap = Duration(minutes: 4)",
      "kRegularsMinCustomers = 10",
      "kTrendMinPrevUnits = 5",
      "kHourEdgeMinShare = 0.02",
      "kTablesMinTagged = 10",
    ]) {
      check(`Dart: ${k}`, d.includes(k), true);
    }
  }
}

// ── 4. La página ────────────────────────────────────────────────────────────
const page = readFileSync(new URL("../app/vendor/reportes/page.tsx", import.meta.url), "utf8");
for (const s of [
  "salesPatterns(",
  ">Tus noches<",
  ">Tu hora pico<",
  ">Clientes que regresan<",
  ">Lo que eligen<",
  ">Se piden juntos<",
  ">Lo que deja el dinero<",
  ">Cómo te pagan<",
  ">Este mes contra el anterior<",
  ">Ventas por mesa<",
  ">Para que tus números salgan bien<",
]) {
  check(`página: ${s}`, page.includes(s), true);
}
check("lo Pro se ve solo con historial completo", page.includes("const patternsPro = ents.historyDays == null;"), true);
check("lo Pro abre la pared del historial", page.includes('openPatternsWall()'), true);
check("los teléfonos de la casa no son clientes", page.includes("housePhones:"), true);

if (failed) process.exit(1);
console.log("validate-sales-patterns: OK");
