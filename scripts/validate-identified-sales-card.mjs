#!/usr/bin/env node
// Candado (9-sep-2026): el dueño ve SU marcador en el panel — "Ventas con
// teléfono" de la semana de negocio, con la MISMA regla que
// scripts/ventasIdentificadasReadOnly.js (FOODPASS) y que la tarjeta de la app:
// pagada + customerPhone de 10 dígitos, últimas 7 jornadas (corte 4 AM).
// Métrica dominante desde el 8-sep: docs/METRICA_DOMINANTE.md (FOODPASS).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const panel = readFileSync(new URL("../app/vendor/page.tsx", import.meta.url), "utf8");

assert.ok(panel.includes('>Ventas con teléfono</span>'), "panel: tarjeta 'Ventas con teléfono'");
assert.ok(panel.includes("businessDayStartDaysAgo(6)"), "panel: ventana = 7 jornadas de negocio (corte 4 AM)");
assert.ok(panel.includes('if (o.paymentStatus !== "paid") return;'), "panel: solo ventas pagadas");
assert.ok(panel.includes("if (ph.length >= 10) weekIdentifiedSales++;"), "panel: identificada = teléfono de 10 dígitos");
assert.ok(panel.includes("esta semana · ${data.weekIdentifiedSales} de ${data.weekPaidSales}"), "panel: copy 'esta semana · M de N'");
assert.ok(panel.includes("Aún ninguna esta semana · pídelo al cobrar"), "panel: estado cero honesto");
assert.ok(!panel.includes("Clientes Comeleal hoy"), "panel: la tarjeta vieja 'Clientes Comeleal hoy' se fue (el marcador la reemplaza)");

console.log("validate-identified-sales-card: OK");
