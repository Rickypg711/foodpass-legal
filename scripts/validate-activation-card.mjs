#!/usr/bin/env node
// Candado 6-oct-2026: activación en tres toques después del claim.
// Espec: FOODPASS/docs/ACTIVACION_TRES_TOQUES.md. Si alguien le quita un paso,
// la esconde el primer día, mete wa.me, exclamaciones o emojis, esto truena.
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
const rd = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");

// 1) La librería pura.
const lib = await import("../lib/vendor/activation.ts");
{
  const none = lib.activationSteps(null);
  assert.equal(none.length, 4, "4 pasos (menú listo + 3 toques)");
  assert.equal(none[0].key, "menu");
  assert.ok(none[0].done, "progreso dotado: 'Tu menú ya está listo' cuenta como hecho");
  assert.equal(lib.activationCurrent(none), "share", "primer toque = mandarlo por WhatsApp");
  assert.equal(lib.activationProgressLabel(none), "1 de 4 listo");

  const s1 = lib.activationSteps({ shareTappedAt: Date.now() });
  assert.equal(lib.activationCurrent(s1), "place", "después de compartir sigue 'ponlo donde te buscan'");
  const s2 = lib.activationSteps({ shareTappedAt: 1, linkCopiedAt: 2 });
  assert.equal(lib.activationCurrent(s2), "test", "luego el pedido de prueba");
  assert.ok(lib.activationAllDone({ shareTappedAt: 1, linkCopiedAt: 2, hasMenuOrder: true }), "los tres hechos = listo");
  assert.ok(!lib.activationAllDone({ shareTappedAt: 1, linkCopiedAt: 2, hasMenuOrder: false }), "sin pedido no está listo");

  // Señal real del paso 3: misma regla que Hoy (no POS, no cancelado, no borrador).
  assert.ok(lib.isActivationMenuOrder({ orderSource: "customer_web", status: "pending" }));
  assert.ok(!lib.isActivationMenuOrder({ orderSource: "pos", status: "completed" }), "una venta de Caja no cuenta");
  assert.ok(!lib.isActivationMenuOrder({ orderSource: "customer_web", status: "cancelled" }));

  // Link con rastro + slug canónico cuando existe.
  assert.equal(lib.activationPublicLink("ABC123", "tacos-el-sol", "whatsapp"), "https://comeleal.com/r/tacos-el-sol?utm_source=whatsapp&utm_medium=owner_share");
  assert.equal(lib.activationPublicLink("ABC123", null, "instagram"), "https://comeleal.com/r/ABC123?utm_source=instagram&utm_medium=owner_share");

  // El mensaje del dueño: su voz, su nombre, su link, sin "¡" ni emojis.
  const msg = lib.activationShareMessage("Tacos El Sol", "https://comeleal.com/r/tacos-el-sol?utm_source=whatsapp&utm_medium=owner_share");
  assert.ok(msg.startsWith("Hola, ya puedes ver el menú de Tacos El Sol"), msg);
  assert.ok(msg.includes("utm_source=whatsapp"));
  assert.ok(!/[¡!]/.test(msg) && !/[\u{1F300}-\u{1FAFF}]/u.test(msg), "mensaje sin exclamaciones ni emojis");

  // Timestamps de Firestore y ms se leen igual.
  const sig = lib.activationSignalsFromRestaurant({ activation: { shareTappedAt: { toMillis: () => 1700 }, linkCopiedAt: 1800 } }, true);
  assert.deepEqual(sig, { shareTappedAt: 1700, linkCopiedAt: 1800, hasMenuOrder: true });

  // "Lo hago después" dura 24 h.
  assert.ok(lib.activationLaterActive(1000, 1000 + 60_000));
  assert.ok(!lib.activationLaterActive(1000, 1000 + lib.ACTIVATION_LATER_MS + 1));
}

// 2) La tarjeta: un paso a la vez, botones que hacen el trabajo, canon de copy.
const card = rd("components/vendor/ActivationCard.tsx");
{
  assert.ok(card.includes("buildWhatsappShareUrl("), "paso 1 abre el selector de contactos de WhatsApp con el texto listo");
  assert.ok(!card.includes("wa.me"), "jamás wa.me (rompe emojis y el candado de URLs)");
  assert.ok(card.includes("navigator.clipboard.writeText("), "paso 2 copia el link");
  assert.ok(card.includes('"https://www.instagram.com/accounts/edit/"') && card.includes('"https://business.google.com/"'), "paso 2 abre Instagram y Google");
  assert.ok(card.includes("playNewOrderChime()") && card.includes("flashTabTitle()"), "paso 3 suena con la campana de Pedidos");
  assert.ok(card.includes('onSnapshot(') && card.includes('"orders"'), "paso 3 se marca con un pedido real");
  assert.ok(card.includes("`activation.${field}`"), "los toques se guardan en restaurants.activation.*");
  assert.ok(card.includes("Lo hago después"), "'Lo hago después' existe");
  {
    const i = card.indexOf("onClick={onLater}");
    assert.ok(i > 0, "'Lo hago después' tiene su onLater");
    const tag = card.slice(i, card.indexOf("Lo hago después", i));
    assert.ok(tag.includes("hover:underline") && !tag.includes("BTN_PRIMARY") && !tag.includes("background: BRAND"), "'Lo hago después' es texto link, no botón primario");
  }
  for (const copy of ["Para que te pidan", "Mandar por WhatsApp", "Copiar mi link", "Abrir mi menú", "Te llegó. Así te va a sonar cada vez que alguien te pida."]) {
    assert.ok(card.includes(copy), `copy: ${copy}`);
  }
  const ownerFacing = card.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "");
  assert.ok(!/[¡]|!(?=["<\s])/.test(ownerFacing.replace(/!==|!\w|!\(/g, "")), "sin exclamaciones de cara al dueño");
  assert.ok(!/[\u{1F300}-\u{1FAFF}]/u.test(ownerFacing), "sin emojis");
  assert.ok(!/cerebro|\bcarta\b/i.test(ownerFacing), "ni 'cerebro' ni 'carta'");
  assert.ok(!/vimos que|no has/i.test(ownerFacing), "nunca suena a vigilancia");
}

// 3) Los dos anfitriones: la pantalla "listo" y el panel.
{
  const done = rd("app/vendor/setup/done/page.tsx");
  assert.ok(done.includes('<ActivationCard restaurantId={restaurantId} variant="done" />'), "listo: tarjeta en modo done");
  assert.ok(done.includes("setSlug(slugFromRestaurantData("), "listo: el slug se lee de verdad (bug del 6-oct)");
  assert.ok(!done.includes("🎉") && !done.includes("¡"), "listo: sin confeti ni '¡'");
  const panel = rd("app/vendor/page.tsx");
  assert.ok(panel.includes('import { ActivationCard } from "@/components/vendor/ActivationCard";'));
  const main = panel.slice(panel.indexOf("<main className="), panel.indexOf("</main>"));
  assert.ok(main.indexOf("<ActivationCard ") < main.indexOf("<SetupBanner "), "panel: la tarjeta va antes de la brújula del setup");
}

// 4) El link conserva el utm: /r por ID y /{handle} redirigen con la query.
{
  const r = rd("app/r/[restaurantId]/page.tsx");
  assert.ok(r.includes("redirect(`/r/${resolved.slug}${qs}`)"), "/r: el redirect ID→slug conserva la query");
  assert.ok(r.includes("function buildQueryString("));
  const h = rd("app/[handle]/page.tsx");
  assert.ok(h.includes("redirect(`/r/${resolved.slug ?? resolved.id}${qs}`)"), "/{handle}: conserva la query");
  const an = rd("lib/analytics.ts");
  assert.ok(an.includes('sp.get("utm_medium") === "owner_share"'), "GA4: la vista de portada registra el utm del dueño");
}

console.log("validate-activation-card: OK — tres toques, señales reales, copy limpio, utm vivo");
