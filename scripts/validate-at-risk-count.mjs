// Candado 25-sep-2026: "clientes en riesgo" = app + teléfono, en TODAS las pantallas.
// Suadero: el consejo decía "10 clientes con WhatsApp que no han vuelto" y Reportes
// decía "0 en riesgo" porque leía solo a los usuarios de la app.
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
const rd = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");

// 1) La función: total si existe, si no app + teléfono.
const { atRiskShown } = await import("../lib/vendor/atRisk.ts");
assert.equal(atRiskShown({ atRiskCount: 0, atRiskReachableCount: 10, atRiskTotalCount: 10 }), 10, "Suadero: 10");
assert.equal(atRiskShown({ atRiskCount: 0, atRiskReachableCount: 10, atRiskTotalCount: null }), 10, "cerebro viejo sin total: suma");
assert.equal(atRiskShown({ atRiskCount: 3, atRiskReachableCount: 4 }), 7, "app + teléfono");
assert.equal(atRiskShown({ atRiskCount: 2 }), 2, "solo app");
assert.equal(atRiskShown(null), 0, "sin métricas: 0");

// 2) Panel y Reportes pasan por la función, nunca por el campo de la app a secas.
const panel = rd("app/vendor/page.tsx");
const reportes = rd("app/vendor/reportes/page.tsx");
assert.ok(panel.includes('from "@/lib/vendor/atRisk"'), "Panel importa atRiskShown");
assert.ok(reportes.includes('from "@/lib/vendor/atRisk"'), "Reportes importa atRiskShown");
assert.ok(reportes.includes("atRiskCount: atRiskShown("), "Reportes: la cifra de Lealtad sale de atRiskShown");
assert.ok(panel.includes("atRiskCount: atRiskShown("), "Panel: la línea 'sin regresar en 14 días' sale de atRiskShown");
assert.ok(panel.includes("getNbaCtaLabel(actionCode, atRiskShown(metrics))"), "Panel: el botón del consejo cuenta app + teléfono");
assert.ok(!/atRiskCount: \(m\.atRiskCount as number\)/.test(reportes), "Reportes ya no lee m.atRiskCount pelón");
assert.ok(!/atRiskCount: \(insMetrics\.atRiskCount as number \| undefined\) \?\?/.test(panel), "Panel ya no lee insMetrics.atRiskCount pelón para la línea de 14 días");

// 3) Clientes: la recencia manda sobre "Nuevo" y "VIP", con la ventana del cerebro
//    (14 a 29 días en riesgo, 30+ perdido). Si no, "0 en riesgo" al lado de "10 que no han vuelto".
{
  const clientes = rd("app/vendor/clientes/page.tsx");
  const fnStart = clientes.indexOf("function computeSegment(");
  const fn = clientes.slice(fnStart, clientes.indexOf("\n}\n", fnStart) + 2);
  const orden = ["daysSince >= 30", "daysSince >= 14", "visits >= 5", "visits === 1"];
  let pos = -1;
  for (const k of orden) {
    const i = fn.indexOf(k);
    assert.ok(i > pos, `Clientes: '${k}' va en ese orden (recencia primero, luego visitas)`);
    pos = i;
  }
  assert.ok(!/daysSince > 14/.test(fn) && !/daysSince > 30/.test(fn), "Clientes: 14+ y 30+ son >=, como el cerebro");
  // Y la app es espejo exacto.
  const app = readFileSync("/Users/ricardoparedes/projects/FOODPASS/lib/pages/clientes/clientes_screen.dart", "utf8");
  const dStart = app.indexOf("ClienteSegment computeClienteSegment(");
  const dfn = app.slice(dStart, app.indexOf("\n}\n", dStart) + 2);
  let dpos = -1;
  for (const k of ["daysSince >= 30", "daysSince >= 14", "visits >= 5", "visits == 1"]) {
    const i = dfn.indexOf(k);
    assert.ok(i > dpos, `App: '${k}' en el mismo orden que la web`);
    dpos = i;
  }
}

console.log("✅ validate-at-risk-count: 'en riesgo' cuenta app + teléfono en Panel, Reportes y el consejo");
