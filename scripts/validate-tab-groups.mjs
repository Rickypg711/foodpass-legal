// Cuenta de mesa Etapa 1 — contrato del núcleo de agrupación y reparto.
//
// POR QUÉ EXISTE: el cierre de un grupo cobra UN total y lo reparte entre las
// rondas; los puntos de CADA teléfono salen de su parte. Si el reparto pierde
// un centavo, lo cobrado y lo registrado dejan de ser el mismo peso — el
// pecado exacto que el recálculo de descuentos ya pagó una vez (5.1.4).
//
// Run: node scripts/validate-tab-groups.mjs

import assert from "node:assert/strict";
import { groupOpenTabs, distributeGroupNet } from "../lib/pos/tabGroups.ts";

const ms = (n) => ({ toMillis: () => n });

// ── 1. Rondas con el mismo tabId = UNA fila; personas = comensales únicos ────
{
  const groups = groupOpenTabs([
    { id: "o2", tabId: "tab_x", customerId: "u2", total: 200, createdAt: ms(2000), tabName: "Mesa 5" },
    { id: "o1", tabId: "tab_x", customerId: "u1", total: 100, createdAt: ms(1000), tabName: "Mesa 5" },
    { id: "o3", tabId: "tab_x", customerId: "u1", total: 40, createdAt: ms(3000) },
  ]);
  assert.equal(groups.length, 1);
  const g = groups[0];
  assert.equal(g.key, "tab_x");
  assert.equal(g.anchor.id, "o1", "la más VIEJA funda y ancla");
  assert.equal(g.people, 2, "u1 pidió dos rondas pero es UNA persona");
  assert.equal(g.total, 340);
  assert.equal(g.label, "Mesa 5");
  assert.deepEqual(g.orders.map((o) => o.id), ["o1", "o2", "o3"]);
}

// ── 2. Cuenta legada sin tabId agrupa bajo SU id — la misma llave que la
//      callable reparte, así que las rondas nuevas se le cuelgan solas ───────
{
  const groups = groupOpenTabs([
    { id: "old1", customerId: "a", total: 100, createdAt: ms(1000), tabName: "Mesa 2" },
    { id: "new1", tabId: "old1", customerId: "b", total: 50, createdAt: ms(2000) },
  ]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].key, "old1");
  assert.equal(groups[0].people, 2);
}

// ── 3. Mesas distintas NO se mezclan; orden por actividad reciente ──────────
{
  const groups = groupOpenTabs([
    { id: "a", tabId: "t1", total: 10, createdAt: ms(1000), tabName: "Mesa 1" },
    { id: "b", tabId: "t2", total: 20, createdAt: ms(5000), tabName: "Mesa 2" },
  ]);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].label, "Mesa 2", "la de actividad más reciente primero");
}

// ── 4. Reparto proporcional en centavos exactos ─────────────────────────────
{
  // $100 + $50 con 15% de descuento → neto $127.50 → $85.00 + $42.50
  assert.deepEqual(distributeGroupNet([100, 50], 127.5), [85, 42.5]);
  // Sin descuento: cada quien lo suyo
  assert.deepEqual(distributeGroupNet([100, 50], 150), [100, 50]);
  // Tercios que no cierran: el residuo cae en la última y la suma ES el neto
  const parts = distributeGroupNet([10, 10, 10], 10);
  assert.equal(Math.round(parts.reduce((a, b) => a + b, 0) * 100), 1000);
  // Una sola ronda = todo para ella (el caso N=1 es el flujo clásico)
  assert.deepEqual(distributeGroupNet([80], 68), [68]);
}

// ── 5. La suma SIEMPRE es el neto, con brutos feos ──────────────────────────
{
  for (const [gross, net] of [
    [[33.33, 66.67, 12.01], 99.99],
    [[0.01, 0.01], 0.01],
    [[199.99, 0.5, 74.25], 260.0],
  ]) {
    const parts = distributeGroupNet(gross, net);
    const sum = Math.round(parts.reduce((a, b) => a + b, 0) * 100) / 100;
    assert.equal(sum, net, `suma ${sum} != neto ${net}`);
    assert.ok(parts.every((p) => p >= 0), "ninguna parte negativa");
  }
}

console.log("validate-tab-groups: OK");
