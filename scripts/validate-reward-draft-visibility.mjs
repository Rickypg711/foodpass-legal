/**
 * El borrador de premios de la IA JAMÁS vuelve a ser invisible.
 *
 * POR QUÉ EXISTE: el barrido del 1-sep-2026 encontró el muro #1 del embudo:
 * 7 restaurantes con su propuesta de premios generada y sentada en `draft`
 * sin que nadie la aplicara. La página /vendor/recompensas (el destino del
 * consejo check_ai_draft del panel) NO leía rewardRecommendationDrafts — el
 * dueño llegaba a "Sin recompensas todavía" con su propuesta invisible atrás.
 * Además "Recompensas" vivía enterrada en Configuración y el item "Puntos"
 * del sidebar abría el escáner (nombre mentiroso).
 *
 * Este script fija el contrato en el código fuente:
 *  1. /vendor/recompensas lee rewardRecommendationDrafts (el banner existe).
 *  2. El NBA check_ai_draft tiene título y cuerpo propios (no cae al default).
 *  3. El sidebar tiene botón propio de Recompensas y el escáner se llama
 *     "Escanear", no "Puntos".
 *  4. La llamada web a applyRewardDraft sigue mandando firstPurchaseReward
 *     (el 1-sep se cazó que la app lo omitía y perdía la bienvenida).
 *  5. El wizard de premios conserva la salida "← Panel" (regla de Ricardo,
 *     26-ago: el wizard no es trampa) — la atajada la intercepta, no la mata.
 *
 * Run: node scripts/validate-reward-draft-visibility.mjs
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");

// 1. La página de recompensas del panel lee el borrador y lo pinta
const recompensas = read("app/vendor/recompensas/page.tsx");
assert.ok(
  recompensas.includes("rewardRecommendationDrafts"),
  "/vendor/recompensas debe leer rewardRecommendationDrafts — sin esto el consejo del panel manda a un callejón sin salida",
);
assert.ok(
  recompensas.includes("proposedFirstPurchaseReward"),
  "/vendor/recompensas debe leer proposedFirstPurchaseReward del borrador (los campos van con prefijo proposed)",
);
assert.ok(
  recompensas.includes("/vendor/setup/recompensas"),
  "el banner del borrador debe llevar al wizard donde un tap lo aplica",
);

// 2. El NBA habla del borrador con voz propia
const panel = read("app/vendor/page.tsx");
const bodyIdx = panel.indexOf("function getNbaFallbackBody");
const titleIdx = panel.indexOf("function getNbaFallbackTitle");
assert.ok(bodyIdx > 0 && titleIdx > 0, "getNbaFallbackBody/getNbaFallbackTitle deben existir");
assert.ok(
  panel.slice(bodyIdx).split("function ")[1].includes('"check_ai_draft"'),
  "getNbaFallbackBody debe tener case check_ai_draft — sin él, el consejo cae al copy genérico",
);
assert.ok(
  /case "check_ai_draft": return "[^"]+";/.test(panel.slice(titleIdx, bodyIdx)),
  "getNbaFallbackTitle debe tener case check_ai_draft con título propio",
);
// El resolver no puede sobrescribir check_ai_draft con el fallback genérico
const resolveIdx = panel.indexOf("function resolveNbaActionCode");
assert.ok(
  panel.slice(resolveIdx, titleIdx).includes('brainActionCode === "check_ai_draft"'),
  "resolveNbaActionCode debe respetar check_ai_draft — sobrescribirlo borra la mención del borrador para el dueño atorado",
);

// 3. Sidebar: Recompensas con botón propio; el escáner no se llama "Puntos"
const layout = read("app/vendor/layout.tsx");
assert.ok(
  /href: "\/vendor\/recompensas",\s*label: "Recompensas"/.test(layout),
  "el sidebar debe tener el botón propio de Recompensas (orden de Ricardo, 1-sep)",
);
assert.ok(
  !/href: "\/vendor\/scanner",\s*label: "Puntos"/.test(layout),
  'el item del escáner no puede llamarse "Puntos" — es nombre mentiroso',
);

// 4. La llamada a applyRewardDraft manda la bienvenida
const wizard = read("app/vendor/setup/recompensas/page.tsx");
const applyIdx = wizard.indexOf('httpsCallable(functions, "applyRewardDraft")');
assert.ok(applyIdx > 0, "la llamada a applyRewardDraft debe existir en el wizard");
assert.ok(
  wizard.slice(applyIdx, applyIdx + 400).includes("firstPurchaseReward"),
  "applyRewardDraft debe mandar firstPurchaseReward — omitirlo perdía la bienvenida (bug 28-ago)",
);

// 5b. EL ORIGEN DEL MURO #1 jamás regresa: el dueño llega del claim ~20s
//     antes que el borrador de la IA. El claim DEBE mandar born=demo y la
//     pantalla DEBE entrar al estado de escucha en vez de enseñar el
//     formulario vacío tras la promesa del festejo (cazado en vivo, 1-sep).
const activar = read("components/home/ActivarModal.tsx");
assert.ok(
  activar.includes("/vendor/setup/recompensas?wizard=1&born=demo"),
  "el claim debe mandar born=demo — sin él, el paso de premios no sabe que la IA viene en camino",
);
assert.ok(
  /born.{0,20}=== "demo"/.test(wizard),
  "el paso de premios debe leer born=demo",
);
assert.ok(
  /bornFromDemo && !hasRewards[\s\S]{0,80}setAiStep\("generating"\)/.test(wizard),
  "sin borrador y viniendo del claim, la pantalla debe ESCUCHAR (setAiStep generating), no enseñar el formulario vacío",
);
// 5c. Un trono por estado: Guardar apagado con el formulario vacío (vacío =
// nunca armado; lo APAGADO a propósito sí se guarda — ver
// validate-rewards-off-honesty.mjs, 2-sep)
assert.ok(
  wizard.includes("disabled={saving || saved || (!formHasContent && !formIsDeliberatelyOff)}"),
  "Guardar debe apagarse con el formulario vacío — el rey del estado vacío es Armarlos por mí",
);

// 5. El wizard conserva la salida al panel (interceptable, jamás eliminada)
const stepper = read("components/vendor/WizardStepper.tsx");
assert.ok(
  stepper.includes("← Panel"),
  "el wizard debe conservar la salida ← Panel (regla de Ricardo 26-ago: no es trampa)",
);
assert.ok(
  stepper.includes("onPanelClick"),
  "la salida debe ser interceptable (la atajada de premios del 1-sep)",
);

console.log("validate-reward-draft-visibility: OK — el borrador de la IA es visible, con botón propio y salida honesta");
