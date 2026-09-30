/**
 * Candado (30-sep-2026): /vendor/reportes es la fuente que la app copia
 * (FOODPASS lib/pages/reportes/reportes_screen.dart, candado
 * test/pages/reportes_parity_test.dart). Si aquí cambia un título, una
 * etiqueta o un rango, este script y el de la app se ponen rojos juntos.
 *
 * Run: node scripts/validate-reportes-parity.mjs
 */
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../app/vendor/reportes/page.tsx", import.meta.url), "utf8");
const ent = readFileSync(new URL("../lib/subscription/entitlement.ts", import.meta.url), "utf8");
const atRisk = readFileSync(new URL("../lib/vendor/atRisk.ts", import.meta.url), "utf8");

let failed = 0;
function must(cond, label) {
  if (!cond) {
    console.error(`FAIL ${label}`);
    failed = 1;
  }
}

// Secciones en orden (la app las pinta en el mismo).
let cursor = -1;
for (const s of [
  ">Resultados de hoy<",
  ">Últimos 7 días<",
  ">Historial de ventas<",
  ">Descuentos especiales<",
  ">Ventas por empleado<",
  ">Propinas<",
  ">Platillos más vendidos<",
  ">Lealtad<",
]) {
  const i = page.indexOf(s);
  must(i > cursor, `sección fuera de orden o ausente: ${s}`);
  cursor = i;
}

// Etiquetas y copy que la app repite palabra por palabra.
for (const s of [
  '"con app o con número"',
  '"de la meta del día"',
  '"meta del día"',
  "Con app o con número. Son los que puedes traer de vuelta.",
  "Sin ventas cobradas en este rango.",
  "Todo tu historial es Pro.",
  "a equipo, familia y amigos. Los puntos siempre se calculan sobre lo pagado.",
  "Aparte de tus ventas. No suman puntos ni comisión.",
  '"en efectivo"',
  '"ya la tiene el equipo"',
  '"la cobró el negocio"',
  '"visitas Comeleal"',
  '"premios canjeados"',
  '"clientes distintos"',
  '"clientes en riesgo"',
  "Todavía estamos sumando tus números del mes. Vuelve mañana.",
  "No pudimos cargar tus reportes",
  "Volver a intentar",
]) {
  must(page.includes(s), `copy ausente: ${s}`);
}

// Rangos del historial y la ventana gratis.
must(page.includes('{ days: 30, label: "30 días" }'), "rango 30 días");
must(page.includes('{ days: 90, label: "90 días" }'), "rango 90 días");
must(page.includes('{ days: null, label: "Todo" }'), "rango Todo");
must(/export const HISTORY_DAYS_FREE = 30;/.test(ent), "HISTORY_DAYS_FREE = 30 (kHistoryDaysFree en la app)");

// Lealtad: se lee de insights.metrics y el riesgo pasa por atRiskShown.
must(page.includes("insightsData?.metrics"), "la web lee metrics del cerebro");
must(page.includes("atRiskShown(m as AtRiskMetrics)"), "riesgo por atRiskShown");
must(atRisk.includes('typeof m.atRiskTotalCount === "number"'), "atRiskShown: total del cerebro nuevo");

if (failed) process.exit(1);
console.log("validate-reportes-parity: OK");
