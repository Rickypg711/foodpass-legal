/**
 * Candado (30-sep-2026): la sección "Equipo" de /vendor/configuracion
 * (PosStaffSection) es la fuente que copia el hub Equipo de la app
 * (FOODPASS lib/team/pages/team_hub_page.dart, candado
 * test/negocio/equipo_boton_por_boton_test.dart). Si aquí cambia el copy,
 * los mensajes del PIN o el tope gratis, los dos se ponen rojos juntos.
 *
 * Run: node scripts/validate-equipo-parity.mjs
 */
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../app/vendor/configuracion/page.tsx", import.meta.url), "utf8");
const ent = readFileSync(new URL("../lib/subscription/entitlement.ts", import.meta.url), "utf8");

let failed = 0;
function must(cond, label) {
  if (!cond) {
    console.error(`FAIL ${label}`);
    failed = 1;
  }
}

for (const s of [
  "PINs de la Caja",
  "Agrega a tu equipo con un PIN de 4 dígitos. En la Caja eligen quién",
  "El primer PIN es gratis; el segundo y los que siguen son Pro.",
  '"Ponle nombre (ej. Juan)."',
  '"El PIN debe ser de 4 dígitos."',
  '"Ese PIN ya lo usa alguien más."',
  '"No pudimos guardar. Intenta de nuevo."',
  "Nueva persona",
  "Agregar al equipo",
  '{canAdd ? "Agregar persona" : "Agregar persona · Pro"}',
  '{showPins ? "Ocultar PINs" : "Mostrar PINs"}',
  "Sí, eliminar",
  "Cuentas con acceso propio",
  "Incluido en Pro",
  "Cuentas con acceso propio para tu equipo: cada quien entra con su",
  'wall="posStaff"',
]) {
  must(page.includes(s), `copy ausente en Equipo: ${s}`);
}
must(/export const POS_STAFF_FREE_LIMIT = 1;/.test(ent), "POS_STAFF_FREE_LIMIT = 1 (kPosStaffFreeLimit en la app)");
// Lo que se guarda en posStaff es el mismo doc en los dos lados.
must(page.includes("role: fRole,") && page.includes("active: true,") && page.includes("createdAt: serverTimestamp(),"), "esquema de posStaff");

if (failed) process.exit(1);
console.log("validate-equipo-parity: OK");
