/**
 * Candado (30-sep-2026): la tarjeta "Tu plan" de /vendor/configuracion es la
 * fuente de lo que Pro vende, y la app (SubscriptionTiersPage + app_es.arb)
 * la copia renglón por renglón (FOODPASS test/negocio/
 * configuracion_boton_por_boton_test.dart). Si alguien cambia un renglón
 * aquí, este script y el de la app se ponen rojos juntos.
 *
 * Run: node scripts/validate-plan-card.mjs
 */
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../app/vendor/configuracion/page.tsx", import.meta.url), "utf8");
const pricing = readFileSync(new URL("../lib/subscription/pricing.ts", import.meta.url), "utf8");

let failed = 0;
function must(cond, label) {
  if (!cond) {
    console.error(`FAIL ${label}`);
    failed = 1;
  }
}

const PRO_LINES = [
  "Todo tu historial de ventas (más de 30 días)",
  "Tu equipo cobra con su PIN",
  "Cuentas por mesa",
  "Cuentas con acceso propio para tu equipo, cada quien con su rol",
  "Pregúntale a Comeleal sin límite",
  "Descuentos especiales (staff y familia) — la Caja los aplica sola",
];
let cursor = -1;
for (const line of PRO_LINES) {
  const i = page.indexOf(`"${line}"`);
  must(i > cursor, `renglón de Pro fuera de orden o ausente: ${line}`);
  cursor = i;
}
must(page.includes("Menú QR, Caja, pedidos, puntos sin tope, tus clientes y reportes: gratis siempre."), "línea del plan Gratis");
must(page.includes("Plan Gratis — para operar"), "título del plan Gratis");
must(page.includes("Plan Pro activo"), "título del plan Pro activo");
must(page.includes("{PRO_PRICE_LABEL}/mes — para cuando tu Caja crece"), "el precio sale de PRO_PRICE_LABEL, no a mano");
must(/export const PRO_AMOUNT_MXN = 499;/.test(pricing), "PRO_AMOUNT_MXN = 499");
must(!/\$?299/.test(page), "el 299 viejo no aparece en Configuración");
// 30-sep: el bypass de fundador (Luzz) pinta "Tu plan" como Pro en la web, igual que la app.
must(page.includes("|| isFounderTestRestaurant(rid)"), "la tarjeta Tu plan honra el bypass de fundador");
const planPage = readFileSync(new URL("../app/vendor/plan/page.tsx", import.meta.url), "utf8");
must(planPage.includes("|| isFounderTestRestaurant(restaurantId)"), "/vendor/plan honra el bypass de fundador");

if (failed) process.exit(1);
console.log("validate-plan-card: OK");
