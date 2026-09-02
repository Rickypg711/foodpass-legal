/**
 * Apagar premios cuesta una pantalla, no el negocio — y la página nunca se
 * queda muda.
 *
 * POR QUÉ EXISTE: el primer dueño real después de los tapones del muro #1
 * (CURANDERO, 1-sep-2026) apagó la bienvenida a propósito y la página no le
 * dijo nada; y con todo apagado "Guardar" estaba muerto (QA de Ricardo,
 * 2-sep: "it says nothing bro, you can't even save off"). Decisión del mismo
 * día: apagar es su derecho, pero se apaga INFORMADO, y lo apagado se puede
 * guardar.
 *
 * Contrato que fija este script en app/vendor/setup/recompensas/page.tsx:
 *  1. Apagar la bienvenida pregunta una vez, con el argumento ("segunda
 *     visita") y la salida "Apagar de todos modos". Prender no pregunta.
 *  2. Apagar el ÚLTIMO premio por puntos pregunta igual.
 *  3. La consecuencia ("no sale en la app… escáner en pausa") NO está
 *     escrita a mano: sale de evaluateReadiness, la misma verdad que decide
 *     `active`. Cuando la bienvenida deje de bloquear, la frase muere sola.
 *  4. Con lo que tenía APAGADO a propósito se puede guardar (escritura
 *     directa con rewardTiers: [] — applyRewardDraft rechaza lista vacía) y
 *     no hay festejo: vuelve al panel.
 *  5. Lo apagado se explica en la página (franja de estado), no solo en el
 *     modal.
 *
 * Run: node scripts/validate-rewards-off-honesty.mjs
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const page = readFileSync(join(root, "app/vendor/setup/recompensas/page.tsx"), "utf8");

// 1. La bienvenida pregunta antes de apagarse, y prender no pregunta
assert.ok(page.includes("¿Apagar la bienvenida?"), "falta la pregunta al apagar la bienvenida");
assert.ok(page.includes("Se regala en la segunda visita, nunca en la misma."), "el argumento de la segunda visita debe estar en la hoja");
assert.ok(page.includes("Apagar de todos modos"), "apagar sigue siendo su derecho: debe existir la salida");
assert.ok(page.includes("Mejor la dejo"), "la opción de quedarse con la bienvenida debe ser el botón principal");
const welcomeToggle = page.slice(page.indexOf("function requestWelcomeToggle"), page.indexOf("function requestTierToggle"));
assert.ok(welcomeToggle.includes("enabled: true }))") && welcomeToggle.includes("return;"), "prender la bienvenida no debe preguntar");
assert.ok(!page.includes("setCurrentFPR((f) => ({ ...f, enabled: !f.enabled }))"), "el toggle crudo de bienvenida ya no debe existir");

// 2. El último premio por puntos también pregunta
assert.ok(page.includes("¿Apagar tu último premio?"), "falta la pregunta al apagar el último premio");
assert.ok(page.includes("othersOn"), "solo pregunta cuando es el ÚLTIMO premio prendido");

// 3. La consecuencia viene del evaluador de readiness, no de un string fijo
assert.ok(page.includes("evaluateReadiness("), "la consecuencia debe calcularse con evaluateReadiness");
assert.ok(page.includes("welcomeOffWouldBlock") && page.includes("tiersOffWouldBlock"), "cada hoja usa su propio cálculo de bloqueo");
const consequence = "tu local no sale en la app y el escáner queda en pausa";
const idx = page.indexOf(consequence);
assert.ok(idx > 0, "la frase de consecuencia debe existir");
for (let at = idx; at !== -1; at = page.indexOf(consequence, at + 1)) {
  const before = page.slice(Math.max(0, at - 260), at);
  assert.ok(
    /welcomeOffWouldBlock|tiersOffWouldBlock|rewardsOffBlocksNow/.test(before),
    "la frase de consecuencia solo puede pintarse bajo una condición calculada con readiness",
  );
}

// 4. Todo apagado a propósito se guarda, sin festejo
assert.ok(page.includes("formIsDeliberatelyOff"), "debe distinguir vacío-nunca-armado de apagado-a-propósito");
assert.ok(page.includes("rewardTiers: [],"), "con todo apagado se escribe rewardTiers: [] directo (el servidor rechaza lista vacía)");
assert.ok(page.includes('"Guardar así, sin premios →"'), "el botón dice la verdad cuando guarda apagado");
const saveFn = page.slice(page.indexOf("async function handleSave"), page.indexOf("// ¿El formulario tiene algo PRENDIDO"));
assert.ok(saveFn.includes("if (allOff) {") && saveFn.includes("router.push(exitTo ?? backHref)"), "apagado no festeja: vuelve al panel");
assert.ok(page.includes("disabled={saving || saved || (!formHasContent && !formIsDeliberatelyOff)}"), "Guardar vive cuando lo apagado fue a propósito");

// 5. La franja de estado explica lo apagado
assert.ok(page.includes("Bienvenida apagada: tus clientes nuevos no tienen un regalo que los haga volver."), "franja: bienvenida apagada");
assert.ok(page.includes("Sin premios por puntos: lo que juntan tus clientes hoy no vale nada."), "franja: sin premios");

console.log("validate-rewards-off-honesty: OK");
