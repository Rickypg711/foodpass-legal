#!/usr/bin/env node
// Candado (30-sep-2026): el rastro del claim del demo. Entre "Quédatelo" y el
// restaurante creado no se veía nada: 5 de 5 claims de la pauta murieron ahí
// sin saber en qué paso. Ahora cada puerta del modal deja su hora (y el
// código de Firebase si falló) en menuDemoJobs.claimTrail y un evento GA4
// demo_claim_step. /admin/prospectos lo lee por prospecto.
// Run: node scripts/validate-claim-trail.mjs
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const jobs = readFileSync("lib/demo/demoJobs.ts", "utf8");
const modal = readFileSync("components/home/ActivarModal.tsx", "utf8");
const ga = readFileSync("lib/analytics/vendorAcquisition.ts", "utf8");
const admin = readFileSync("app/admin/prospectos/page.tsx", "utf8");

// 1. La estampa: claimTrail.<paso> + lastStep + <paso>Code, best-effort.
assert.match(jobs, /export async function stampClaimStep\(jobId: string, step: ClaimStep, code\?: string \| null\)/);
assert.match(jobs, /\[`claimTrail\.\$\{step\}`\]: serverTimestamp\(\)/);
assert.match(jobs, /"claimTrail\.lastStep": step/);
assert.match(jobs, /patch\[`claimTrail\.\$\{step\}Code`\] = String\(code\)\.slice\(0, 80\)/, "el código se recorta: jamás un mensaje largo ni datos");
assert.match(jobs, /doc\(db, "menuDemoJobs", jobId\), patch\)/);

// 2. Cada puerta del modal deja rastro (solo en demo, jamás bloquea).
assert.match(modal, /if \(!demo\?\.jobId\) return;\s*void stampClaimStep\(demo\.jobId, step, code\);\s*trackDemoClaimStep\(step, code\);/, "trail = estampa + GA4, solo con demo");
for (const step of [
  '"phoneChosen"', '"googleChosen"', '"emailChosen"', '"smsRequested"', '"phoneSocialAccount"',
  '"smsSent"', '"smsFailed"', '"codeEntered"', '"codeFailed"', '"accountCreated", "phone"',
  '"accountCreated", "google"', '"accountCreated", "email"', '"accountFailed"', '"formOpened"',
  '"createRequested"', '"createFailed"', '"closed", screen',
]) {
  assert.ok(modal.includes(`trail(${step}`), `falta trail(${step})`);
}
// El código de Firebase viaja en los fallos.
assert.match(modal, /trail\("smsFailed", \(err as \{ code\?: string \}\)\?\.code/);
assert.match(modal, /trail\("codeFailed", \(err as \{ code\?: string \}\)\?\.code/);
// Cerrar (✕ y Escape) dice en qué pantalla estaba.
assert.match(modal, /onClick=\{closeWithTrail\}/);
assert.match(modal, /if \(e\.key === "Escape" && stage !== "signing" && stage !== "creating"\) closeWithTrail\(\);/);
assert.match(modal, /: phoneMode === "code" \? "code"/);

// 3. GA4 sin PII: paso y código, nada más.
assert.match(ga, /demoClaimStep: "demo_claim_step"/);
assert.match(ga, /export function trackDemoClaimStep\(step: string, code\?: string \| null\)/);
const fn = ga.slice(ga.indexOf("export function trackDemoClaimStep"));
assert.doesNotMatch(fn, /phone|email|name/i, "sin datos del dueño en el evento");

// 4. /admin/prospectos lo lee en cristiano.
assert.match(admin, /trail: claimTrailLabel\(x\.claimTrail\)/);
assert.match(admin, /se quedó en: \$\{r\.trail\}/);
assert.match(admin, /smsFailed: "SMS falló"/);

// 5. Reglas (repo hermano): el cliente solo puede tocar claimTrail (mapa).
const rulesPath = "/Users/ricardoparedes/projects/FOODPASS/firestore.rules";
if (existsSync(rulesPath)) {
  const rules = readFileSync(rulesPath, "utf8");
  const block = rules.slice(rules.indexOf("match /menuDemoJobs/{jobId}"));
  assert.match(block.slice(0, 4000), /\['viewedAt', 'playedDemoAt', 'claimStartedAt', 'whatsapp',\s*'claimTrail', 'updatedAt'\]/);
  assert.match(block.slice(0, 4000), /request\.resource\.data\.claimTrail is map/);
}

console.log("✅ validate-claim-trail: cada paso del claim deja hora y código en el job, GA4 sin PII, admin lo lee");
