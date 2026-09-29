// Candado 29-sep-2026: señales del win-back por teléfono, espejo de la app
// (FOODPASS lib/loyalty/winback_signals.dart). Si esto cambia de un lado,
// el otro deja de atribuir regresos igual.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const rd = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");

const s = await import("../lib/loyalty/winbackSignals.ts");
const D = 86400000;
const now = new Date(2026, 8, 29, 20, 30); // martes local

// 1) platillos: recientes primero, sin repetir, tope 8
const names = s.itemNamesOfOrder([{ name: "Pepperoni", qty: 2 }, { name: " Refresco " }, { name: "Pepperoni" }, { qty: 1 }]);
assert.deepEqual(names, ["Pepperoni", "Refresco"]);
const merged = s.mergeRecentItems(["Hawaiana", "Pepperoni", "a", "b", "c", "d", "e", "f", "g"], names);
assert.deepEqual(merged.slice(0, 3), ["Pepperoni", "Refresco", "Hawaiana"]);
assert.equal(merged.length, 8);

// 2) visitLog: dow ISO (martes=2, domingo=7), hora local, tope 10
assert.equal(s.isoWeekday(new Date(2026, 8, 27)), 7, "domingo = 7");
assert.equal(s.isoWeekday(now), 2, "martes = 2");
const prev = Array.from({ length: 10 }, () => ({ dow: 1, hour: 9, total: 1, via: "pos" }));
const log = s.appendVisitLog(prev, { at: now, total: 123.456, via: "pos" });
assert.equal(log.length, 10);
assert.equal(log[9].dow, 2);
assert.equal(log[9].hour, 20);
assert.equal(log[9].total, 123.46);

// 3) regreso atribuido: primera visita después del mensaje, dentro de 30 días
const sent = new Date(now.getTime() - 5 * D);
assert.equal(s.winbackReturnDetected({ lastWinbackAt: sent, lastVisitAt: new Date(now.getTime() - 20 * D) }, now), true);
assert.equal(s.winbackReturnDetected({ lastWinbackAt: sent, lastVisitAt: new Date(now.getTime() - 2 * D) }, now), false, "ya había vuelto");
assert.equal(s.winbackReturnDetected({ lastWinbackAt: new Date(now.getTime() - 45 * D), lastVisitAt: new Date(now.getTime() - 60 * D) }, now), false, "mensaje viejo");
assert.equal(s.winbackReturnDetected({ lastVisitAt: sent }, now), false, "sin mensaje");

// 4) el set(merge) del crédito: marca el regreso en el historial y suma
const sent3 = new Date(now.getTime() - 3 * D);
const f = s.winbackFieldsForVisit({
  prev: {
    lastWinbackAt: sent3,
    lastVisitAt: new Date(now.getTime() - 30 * D),
    winbackReturns: 1,
    winbackHistory: [
      { sentAt: new Date(now.getTime() - 40 * D), hook: "points", returnedAt: new Date(now.getTime() - 35 * D) },
      { sentAt: sent3, hook: "usual_item" },
    ],
  },
  now, total: 250, via: "pos", orderItems: ["Pepperoni"],
});
assert.equal(f.winbackReturns, 2);
assert.ok(f.winbackReturnedAt);
assert.equal(f.winbackHistory[1].daysToReturn, 3);
assert.equal(f.winbackHistory[0].daysToReturn, undefined, "el viejo no se toca");
assert.deepEqual(f.recentItems, ["Pepperoni"]);
assert.deepEqual(Object.keys(s.winbackFieldsForVisit({ prev: {}, now, total: 10, via: "pos" })), ["visitLog"]);

// 5) la Caja web pasa por la función (no escribe estos campos a mano)
const pp = rd("lib/loyalty/phonePoints.ts");
assert.ok(pp.includes("winbackFieldsForVisit("), "phonePoints.ts usa winbackFieldsForVisit");
assert.ok(pp.includes("itemNamesOfOrder("), "phonePoints.ts saca los platillos del pedido");

console.log("validate-winback-signals: ok");
