// Candado 29-sep-2026: cambio en efectivo en la Caja web (paridad con la app).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const { cashChange, cashChangeLabel } = await import("../lib/pos/cashChange.ts");
assert.equal(cashChange(100, 150), 50);
assert.equal(cashChange(100, 100), 0);
assert.equal(cashChange(100, 80), null, "no alcanza → null");
assert.equal(cashChange(100, ""), null);
assert.equal(cashChange(33.3, 50), 16.7);
assert.equal(cashChangeLabel(100, 150), "Cambio $50.00");
assert.equal(cashChangeLabel(100, 100), "Exacto");
assert.equal(cashChangeLabel(100, 80), "Faltan $20.00");
assert.equal(cashChangeLabel(100, ""), null);
const pos = readFileSync(new URL("../app/vendor/pos/page.tsx", import.meta.url), "utf8");
assert.ok(pos.includes("cashChangeLabel("), "la Caja pinta el cambio con la función");
assert.ok(pos.includes('method === "cash"'), "solo con Efectivo");
console.log("validate-cash-change: OK");
