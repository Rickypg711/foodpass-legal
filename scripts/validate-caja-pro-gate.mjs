/**
 * La reja de Pro vive en la Caja (8-sep-2026) — candado del lado web.
 *
 * Decisión de Ricardo (7-sep noche, FOODPASS/docs/PLAN_REJA_CAJA_8_SEP.md):
 *   1. Free NO tiene tope: ni escaneos, ni ventas, ni puntos. phonePoints
 *      JAMÁS regresa points = 0 por un conteo.
 *   2. Tres paredes: historial >30 días, 2° cajero (PIN), mesas. Reportes
 *      más allá de 30 días usan la pared 1.
 *   3. Pro cuesta $499 para nuevos. Quien ya paga se queda en su precio.
 *   4. Los cuatro nombres de entitlement son los MISMOS en la app (Dart):
 *      historyDays · posStaffAccess · tableTabsAccess · reportsAccess.
 *   5. El bypass de fundador (Luzz) nunca ve una pared.
 *
 * Molde: scripts/validate-discount-pro-gate.mjs (tabla de verdad) +
 * validate-subscription-entitlement.mjs (paridad cross-repo leyendo el Dart).
 *
 * Run: node scripts/validate-caja-pro-gate.mjs
 * Requiere Node >= 22.18 (type stripping nativo para importar el .ts).
 */

import { readFileSync, existsSync } from "node:fs";

import {
  entitlementsOf,
  historyAllowed,
  wallClosed,
  FREE_ENTITLEMENTS,
  PRO_ENTITLEMENTS,
  HISTORY_DAYS_FREE,
  POS_STAFF_FREE_LIMIT,
} from "../lib/subscription/entitlement.ts";
import { canAddPosStaff } from "../lib/posStaff.ts";
import { isFounderTestRestaurant } from "../lib/subscription/founderBypass.ts";
import { PRO_AMOUNT_MXN, PRO_PRICE_LABEL } from "../lib/subscription/pricing.ts";

let failed = 0;
function check(label, actual, expected) {
  if (actual !== expected) {
    console.error(`FAIL ${label}: esperaba ${expected}, obtuvo ${actual}`);
    failed = 1;
  }
}
const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");

const now = Date.UTC(2026, 8, 8, 12); // 8 sep 2026
const futuro = Date.UTC(2026, 9, 8); // 8 oct 2026
const pasado = Date.UTC(2026, 7, 1); // 1 ago 2026
const LUZZ = "kdjJsNwriU4AL4528a4d";
const ts = (ms) => ({ toMillis: () => ms });
const pro = (status, expiresAt) => ({
  subscriptionPlan: "pro",
  subscriptionAccessStatus: status,
  ...(expiresAt === undefined ? {} : { subscriptionAccessExpiresAt: expiresAt }),
});

// ── 1. Constantes compartidas con la app ──
check("HISTORY_DAYS_FREE = 30", HISTORY_DAYS_FREE, 30);
check("POS_STAFF_FREE_LIMIT = 1 (solo el dueño)", POS_STAFF_FREE_LIMIT, 1);

// ── 2. La tabla: free vs pro ──
check("free: historial 30 días", FREE_ENTITLEMENTS.historyDays, 30);
check("free: sin 2° cajero", FREE_ENTITLEMENTS.posStaffAccess, false);
check("free: sin mesas", FREE_ENTITLEMENTS.tableTabsAccess, false);
check("free: sin reportes >30d", FREE_ENTITLEMENTS.reportsAccess, false);
check("pro: historial sin límite (null)", PRO_ENTITLEMENTS.historyDays, null);
check("pro: 2° cajero", PRO_ENTITLEMENTS.posStaffAccess, true);
check("pro: mesas", PRO_ENTITLEMENTS.tableTabsAccess, true);
check("pro: reportes", PRO_ENTITLEMENTS.reportsAccess, true);
// Free NO trae ningún campo de tope: la tabla no conoce escaneos.
for (const k of Object.keys(FREE_ENTITLEMENTS)) {
  check(`free sin campo de tope: ${k}`, /scan|limit|cap|quota/i.test(k), false);
}

// ── 3. Tabla de verdad de entitlementsOf (misma regla única que descuentos) ──
const E = (d, rid = null) => entitlementsOf(d, rid, now).plan;
check("active vigente → pro", E(pro("active", ts(futuro))), "pro");
check("trialing vigente → pro (la prueba abre TODO)", E(pro("trialing", ts(futuro))), "pro");
check("active VENCIDO → free", E(pro("active", ts(pasado))), "free");
check("trialing VENCIDO → free", E(pro("trialing", ts(pasado))), "free");
check("sin fecha → free (fail-closed)", E(pro("active", undefined)), "free");
check("sin data → free", E(undefined), "free");
check("plan free → free", E({ subscriptionPlan: "free" }), "free");
check("past_due → free", E(pro("past_due", ts(futuro))), "free");
check("legado plan pro sin canónicos → pro", E({ plan: "pro" }), "pro");
// Bypass fundador (plan §6.3): Luzz jamás ve una pared.
check("Luzz sin data → pro", E(undefined, LUZZ), "pro");
check("Luzz plan free → pro", E({ subscriptionPlan: "free" }, LUZZ), "pro");
check("Luzz vencido → pro", E(pro("active", ts(pasado)), LUZZ), "pro");
check("otro id plan free → free", E({ subscriptionPlan: "free" }, "otro"), "free");
check("isFounderTestRestaurant sigue exportado desde discountProfiles",
  typeof (await import("../lib/loyalty/discountProfiles.ts")).isFounderTestRestaurant, "function");
check("bypass = mismo id en los dos módulos", isFounderTestRestaurant(LUZZ), true);

// ── 4. Pared 1 — historial ──
check("free: 7 días ok", historyAllowed(FREE_ENTITLEMENTS, 7), true);
check("free: 30 días ok (la ventana de hoy sigue gratis)", historyAllowed(FREE_ENTITLEMENTS, 30), true);
check("free: 31 días → pared", historyAllowed(FREE_ENTITLEMENTS, 31), false);
check("free: 90 días → pared", historyAllowed(FREE_ENTITLEMENTS, 90), false);
check("free: todo (null) → pared", historyAllowed(FREE_ENTITLEMENTS, null), false);
check("pro: 90 días ok", historyAllowed(PRO_ENTITLEMENTS, 90), true);
check("pro: todo ok", historyAllowed(PRO_ENTITLEMENTS, null), true);
check("wallClosed history free", wallClosed(FREE_ENTITLEMENTS, "history"), true);
check("wallClosed history pro", wallClosed(PRO_ENTITLEMENTS, "history"), false);

// ── 5. Pared 2 — segundo cajero ──
check("free: el primer PIN (dueño) entra", canAddPosStaff(FREE_ENTITLEMENTS, 0), true);
check("free: el 2° PIN → pared", canAddPosStaff(FREE_ENTITLEMENTS, 1), false);
check("free: el 5° PIN → pared", canAddPosStaff(FREE_ENTITLEMENTS, 4), false);
check("pro: sin tope de PINs", canAddPosStaff(PRO_ENTITLEMENTS, 9), true);
check("wallClosed posStaff free", wallClosed(FREE_ENTITLEMENTS, "posStaff"), true);
check("wallClosed posStaff pro", wallClosed(PRO_ENTITLEMENTS, "posStaff"), false);

// ── 6. Pared 3 — mesas ──
check("wallClosed tableTabs free", wallClosed(FREE_ENTITLEMENTS, "tableTabs"), true);
check("wallClosed tableTabs pro", wallClosed(PRO_ENTITLEMENTS, "tableTabs"), false);

// ── 7. Free SIN tope: los puntos nunca caen a cero por conteo ──
{
  // phonePoints.ts importa "@/lib" y firebase (node no lo resuelve): el
  // contrato se fija sobre el fuente, como validate-readiness-opt-out.
  const pp = read("../lib/loyalty/phonePoints.ts");
  check("phonePoints: sin capReached", pp.includes("capReached"), false);
  check("phonePoints: sin DEFAULT_MONTHLY_LIMIT", pp.includes("DEFAULT_MONTHLY_LIMIT"), false);
  check("phonePoints: sin monthlyLimit", pp.includes("monthlyLimit"), false);
  check("phonePoints: sin isProActive (el plan no decide puntos)", pp.includes("isProActive"), false);
  check("phonePoints: los puntos salen de la política, sin condición",
    pp.includes("const points = computeOrderPoints(total, items, earn);"), true);
  check("registerPayment: sin capReached", read("../lib/pos/registerPayment.ts").includes("capReached:"), false);
  check("panel: LoyaltyQuotaCard muerto", read("../app/vendor/page.tsx").includes("LoyaltyQuotaCard"), false);
  const pos = read("../app/vendor/pos/page.tsx");
  check("caja: sin aviso 'se llenó'", pos.includes("se llenó"), false);
  check("caja: sin capReached", pos.includes("capReached"), false);
  const activar = read("../components/home/ActivarModal.tsx");
  check("alta: no siembra scanCount en el doc público", /^\s*scanCount:/m.test(activar), false);
  check("alta: no siembra subscriptionPlan en el doc público", /^\s*subscriptionPlan:/m.test(activar), false);
  check("alta: no siembra lastReset en el doc público", /^\s*lastReset:/m.test(activar), false);
}

// ── 8. Copy: "50 visitas" no existe en ninguna superficie ──
{
  const { execSync } = await import("node:child_process");
  const root = new URL("..", import.meta.url).pathname;
  let hits = "";
  try {
    hits = execSync(
      `grep -rniE "50 visitas|50 escaneos|lealtad ilimitada|tope de 50" --include='*.ts' --include='*.tsx' app lib components`,
      { cwd: root, encoding: "utf8" },
    );
  } catch {
    hits = ""; // grep sin matches sale con 1
  }
  check(`copy del tope de 50 fuera de app/lib/components${hits ? ":\n" + hits : ""}`, hits.trim(), "");
}

// ── 9. Precio: $499 nuevos, un solo constante ──
check("PRO_AMOUNT_MXN = 499", PRO_AMOUNT_MXN, 499);
check("PRO_PRICE_LABEL = $499", PRO_PRICE_LABEL, "$499");
{
  const route = read("../app/api/mercado-pago/subscribe/route.ts");
  check("la ruta de cobro importa PRO_AMOUNT_MXN de pricing.ts",
    route.includes('import { PRO_AMOUNT_MXN } from "@/lib/subscription/pricing";'), true);
  check("la ruta de cobro NO define su propio monto", /const PRO_AMOUNT_MXN\s*=/.test(route), false);
  check("la ruta manda el monto al preapproval", route.includes("PRO_AMOUNT_MXN"), true);
  // Ningún "$299" a mano en superficies (billingDoc.ts y pricing.ts narran el
  // legado a propósito). Ningún "$499" a mano tampoco: se importa PRO_PRICE_LABEL.
  const { execSync } = await import("node:child_process");
  const root = new URL("..", import.meta.url).pathname;
  let hits = "";
  try {
    hits = execSync(
      `grep -rnE '\\$(299|499)' --include='*.ts' --include='*.tsx' app lib components | grep -v 'lib/subscription/billingDoc.ts\\|lib/subscription/pricing.ts'`,
      { cwd: root, encoding: "utf8" },
    );
  } catch {
    hits = "";
  }
  // Excepción ANGOSTA (10-sep-2026): la página de comparación cita el precio de
  // MASPEDIDOS ("desde $299/mes"), no el de Comeleal. Solo se perdona "$299" en
  // ESE archivo; un "$499" a mano ahí sigue tumbando el candado, y el precio de
  // Comeleal en esa página tiene que salir de PRO_PRICE_LABEL (check de abajo).
  const COMPARATIVA = "app/mejores-apps-menu-digital-restaurantes/page.tsx";
  hits = hits
    .split("\n")
    .filter((l) => !(l.startsWith(`${COMPARATIVA}:`) && l.includes("$299") && !l.includes("$499")))
    .join("\n");
  check(`sin precio a mano en app/lib/components${hits.trim() ? ":\n" + hits : ""}`, hits.trim(), "");
  check("la comparativa pinta el precio de Comeleal con PRO_PRICE_LABEL",
    read(`../${COMPARATIVA}`).includes("Pro ${PRO_PRICE_LABEL}/mes"), true);
}

// ── 10b. Las tres paredes existen, leen private/billing y usan LA pared ──
{
  const wall = read("../components/vendor/ProWall.tsx");
  check("ProWall: copy canónico", wall.includes("Esto es Pro. Tu Caja sigue gratis. Por ${PRO_PRICE_LABEL} al mes ves todo tu historial, tu equipo cobra con su PIN y llevas mesas. Pruébalo ${TRIAL_DAYS} días, sin tarjeta."), true);
  // 9-sep (Hormozi): cada pared vende el RESULTADO arriba del copy de funciones.
  check("ProWall: resultado historial", wall.includes("Para ver tu mes completo y saber si vas mejor que el pasado."), true);
  check("ProWall: resultado 2° PIN", wall.includes("Para que cada venta quede con el nombre de quien cobró."), true);
  check("ProWall: resultado mesas", wall.includes("Para que la mesa 4 no se te pierda entre rondas en la noche llena."), true);
  check("ProWall: el resultado se pinta", wall.includes("{WALL_OUTCOME[wall]}"), true);
  // Sin prueba disponible, la pared NO promete 14 días (espejo de cajaProWallBodyNoTrial en la app).
  check("ProWall: copy sin prueba existe", wall.includes("export const WALL_COPY_NO_TRIAL"), true);
  check("ProWall: copy sin prueba no promete días", !/WALL_COPY_NO_TRIAL = `[^`]*días/.test(wall), true);
  check("ProWall: elige el copy según canStartTrial", wall.includes('trial.error !== "already_used" ? WALL_COPY : WALL_COPY_NO_TRIAL'), true);
  // 9-sep noche (Ricardo): la pared NO trae su WhatsApp ni "Escríbeme".
  check("ProWall: sin WhatsApp de Ricardo", wall.includes("WhatsApp directo") || wall.includes("Escríbeme"), false);
  check("ProWall: jamás 'carta'", /\bcarta\b/i.test(wall), false);
  check("ProWall: jamás 'upgrade'", /upgrade/i.test(wall), false);
  check("ProWall: jamás 'desbloquea'", /desbloque/i.test(wall), false);
  // Desde el 9-sep la pared OFRECE la prueba con un botón (no la arranca sola):
  // el consentimiento y el reloj se afirman en validate-trial-clock.mjs.
  check("ProWall: ofrece la prueba si puede (canStartTrial)", wall.includes("entitlement.canStartTrial"), true);
  check("ProWall: si no, liga a /vendor/plan con el precio", wall.includes('href="/vendor/plan"') && wall.includes("{PRO_PRICE_LABEL}/mes"), true);
  check("ProWall: tinta oscura sobre naranja (INK_DARK)", wall.includes("INK_DARK") && !/color:\s*"#fff"/.test(wall), true);
  check("ProWall: en móvil no se mete bajo el nav (pb-[72px])", wall.includes("pb-[72px]"), true);
  const hook = read("../lib/subscription/useProTrial.ts");
  check("hook: callable startProTrial", hook.includes('"startProTrial"'), true);
  check("hook: source web", hook.includes('source: "web"'), true);

  for (const [name, path, needles] of [
    ["pared 1 — reportes", "../app/vendor/reportes/page.tsx", ["fetchWithBilling(", "entitlementsOf(", "historyAllowed(", 'wall="history"']],
    ["pared 2 — configuración", "../app/vendor/configuracion/page.tsx", ["fetchWithBilling(", "entitlementsOf(", "canAddPosStaff(", 'wall="posStaff"']],
    ["pared 3 — caja", "../app/vendor/pos/page.tsx", ["fetchWithBilling(", "entitlementsOf(", 'mode === "tab" && !entsRef.current.tableTabsAccess', 'wall="tableTabs"']],
  ]) {
    const src = read(path);
    for (const n of needles) check(`${name}: ${n}`, src.includes(n), true);
  }
  // Cobrar/cerrar una cuenta existente NUNCA se bloquea: el cierre no consulta la pared.
  const pos = read("../app/vendor/pos/page.tsx");
  const closeFn = pos.slice(pos.indexOf("async function closeTabGroup"), pos.indexOf("async function voidTabGroup"));
  check("caja: cerrar cuenta no consulta tableTabsAccess", closeFn.includes("tableTabsAccess"), false);
  // 10-sep (La Familia, free): con la reja cerrada, "Cuenta abierta" abre la pared
  // AL TOCARLA. Antes el botón pedía nombre, quedaba gris sin decir por qué y la
  // pared nunca salía: "la puerta no abre". Espejo de la app (_onChargeLater pide
  // la pared antes que nada).
  const cajaSrc = read("../app/vendor/pos/page.tsx");
  check("caja: tocar 'Cuenta abierta' con reja cerrada abre la pared",
    cajaSrc.includes('opt.key === "tab" && tableTabsLocked && onTabsLocked'), true);
  check("caja: la página pasa onTabsLocked y abre la pared",
    /onTabsLocked=\{\(\) => \{[^}]*setWallOpen\(true\)/.test(cajaSrc), true);
  check("caja: si la reja se abre, pasa sola a 'Cuenta abierta'", cajaSrc.includes('setMode("tab")'), true);
  check("caja: el botón dice qué falta en vez de quedarse gris callado",
    cajaSrc.includes("Escribe el nombre de la cuenta ↑"), true);
}

// ── 10. Paridad con la app: los CUATRO nombres existen en el Dart ──
{
  const dartPath =
    "/Users/ricardoparedes/projects/FOODPASS/lib/subscription/services/subscription_tier_service.dart";
  if (!existsSync(dartPath)) {
    console.error(`FAIL paridad: no encuentro ${dartPath}`);
    failed = 1;
  } else {
    const dart = readFileSync(dartPath, "utf8");
    for (const name of ["historyDays", "posStaffAccess", "tableTabsAccess", "reportsAccess"]) {
      check(`nombre espejo en EffectiveEntitlements (Dart): ${name}`, dart.includes(name), true);
    }
    // La app tampoco conoce el tope: unlimitedScans/monthlyScanLimit ya no
    // deciden nada. (Se afirma suave: el campo puede seguir existiendo como
    // legado, pero free no puede traer 50.)
    check("Dart: free ya no trae monthlyScanLimit: 50", /monthlyScanLimit:\s*50/.test(dart), false);
  }
}

if (failed) {
  console.error("validate-caja-pro-gate: FAILED");
  process.exit(1);
}
console.log("validate-caja-pro-gate: OK");
