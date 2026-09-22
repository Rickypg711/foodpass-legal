// 🎁 Referidos por teléfono — candado del 18-sep-2026 (docs/REFERIDOS_POR_TELEFONO.md §4, §5, §9).
//
// Cinco reglas que no se pueden volver a romper:
//   1. El teléfono de quien invita NUNCA viaja en el link ni en el pedido.
//      Viaja un código que solo el servidor puede resolver.
//   2. El código no trae letras que se dicten mal por teléfono (0/O, 1/I/L,
//      2/Z, 5/S, 8/B), y se lee aunque lo teclen en minúsculas o con espacios.
//      Su alfabeto es el MISMO que en FOODPASS/functions/referral.js: si uno
//      cambia, el link de un volante deja de resolver.
//   3. El código aguanta 30 días en el navegador del amigo (abre el link hoy y
//      viene el viernes), y el pedido lo recoge de ahí.
//   4. La reclamación de mostrador contesta 204 SIEMPRE: decir por qué no se
//      pudo le diría a un curioso si un número ya compró en el local.
//   5. El copy no miente: nunca "liga", nunca "automático", nunca "vi que".
// Run: node --experimental-strip-types scripts/validate-referral.mjs

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CODE_ALPHABET,
  CODE_LEN,
  REF_TTL_DAYS,
  parseReferralCode,
  parseStoredRef,
  storedRefValue,
  referralLink,
  inviteTextFallback,
  notifyTextFallback,
} from "../lib/referral/referralLink.ts";

/**
 * Quita comentarios antes de revisar el copy: lo que le llega al comensal son
 * los textos, y un comentario que DICE "nunca automático" no es una promesa.
 */
const soloCopy = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");

const RID = "gn3bKaysYnHIU3r8tun1";
const TEL = "6141112233";

// ── 1. El número no viaja ──────────────────────────────────────────────────
const link = referralLink(RID, "ACDEFG", "https://comeleal.com");
assert.equal(link, `https://comeleal.com/menu/${RID}?ref=ACDEFG`);
assert.ok(!link.includes(TEL), "el link JAMÁS puede llevar el teléfono");
assert.ok(!/\d{10}/.test(new URL(link).search), "ni algo con forma de teléfono en la query");
assert.equal(
  referralLink(RID, "no-sirve"),
  `https://comeleal.com/menu/${RID}`,
  "con un código inválido sale el menú pelón, no un link roto",
);

// ── 2. El alfabeto del código ──────────────────────────────────────────────
assert.equal(CODE_LEN, 6);
for (const malo of ["0", "O", "1", "I", "L", "2", "Z", "5", "S", "8", "B"]) {
  assert.ok(!CODE_ALPHABET.includes(malo), `el alfabeto no debe traer ${malo}`);
}
// Espejo exacto con el servidor: si esto falla, los códigos dejan de resolver.
const serverSrc = readFileSync(
  "/Users/ricardoparedes/projects/FOODPASS/functions/referral.js",
  "utf8",
);
const serverAlphabet = /CODE_ALPHABET\s*=\s*'([A-Z0-9]+)'/.exec(serverSrc)?.[1];
assert.equal(
  serverAlphabet,
  CODE_ALPHABET,
  "el alfabeto de la web y el de functions/referral.js tienen que ser IDÉNTICOS",
);
const serverLen = /CODE_LEN\s*=\s*(\d+)/.exec(serverSrc)?.[1];
assert.equal(Number(serverLen), CODE_LEN, "el largo del código también tiene que coincidir");

assert.equal(parseReferralCode("acdefg"), "ACDEFG", "tecleado en minúsculas vale");
assert.equal(parseReferralCode("  ACDEFG  "), "ACDEFG", "con espacios pegados vale");
for (const malo of ["", "ABC", "ABCDEFG", "ABCDE0", "ABCDE1", "../../x", "ABC DEF", null, 7, {}]) {
  assert.equal(parseReferralCode(malo), null, JSON.stringify(malo));
}

// ── 3. Los 30 días en el navegador del amigo ───────────────────────────────
assert.equal(REF_TTL_DAYS, 30);
const NOW = Date.parse("2026-09-18T20:00:00Z");
const guardado = storedRefValue("ACDEFG", NOW);
assert.equal(parseStoredRef(guardado, NOW), "ACDEFG");
assert.equal(
  parseStoredRef(guardado, NOW + 29 * 86400000),
  "ACDEFG",
  "a los 29 días todavía vale",
);
assert.equal(
  parseStoredRef(guardado, NOW + 31 * 86400000),
  null,
  "a los 31 días se olvida: no se le cuelga un referido viejo a un pedido nuevo",
);
assert.equal(parseStoredRef("ACDEFG", NOW), "ACDEFG", "formato viejo sin fecha: se acepta");
assert.equal(parseStoredRef("basura{", NOW), null);
assert.equal(parseStoredRef(null, NOW), null);

// ── El código llega al pedido ──────────────────────────────────────────────
// (por fuente, como validate-order-payload.mjs: buildOrderPayload importa con
//  el alias "@/" y node no lo resuelve fuera de Next)
const payloadSrc = readFileSync(new URL("../lib/order/buildOrderPayload.ts", import.meta.url), "utf8");
assert.ok(
  /const ref = parseReferralCode\(input\.referralCode\)/.test(payloadSrc),
  "buildOrderPayload debe pasar el referido por parseReferralCode: basura no se guarda",
);
assert.ok(
  /if \(ref\) \{\s*payload\.referralCode = ref;/.test(payloadSrc),
  "buildOrderPayload solo escribe referralCode cuando el código es válido",
);
const createSrc = readFileSync(new URL("../lib/order/createCustomerOrder.ts", import.meta.url), "utf8");
assert.ok(
  /referralCode: readStoredRef\(params\.restaurantId\)/.test(createSrc),
  "el pedido debe leer el código guardado en el navegador del amigo, o su amigo no gana nada",
);
// Y nunca el teléfono de quien invita.
assert.ok(
  !/referrerPhone/.test(payloadSrc) && !/referrerPhone/.test(createSrc),
  "el teléfono de quien invita jamás se arma en el navegador",
);

// ── 4. La reclamación contesta 204 siempre ─────────────────────────────────
const claims = readFileSync(new URL("../app/api/referral-claims/route.ts", import.meta.url), "utf8");
assert.ok(
  !/status:\s*(4\d\d|5\d\d)/.test(claims),
  "referral-claims NO debe contestar 4xx ni 5xx: siempre 204, o se filtra quién ya es cliente",
);
assert.ok(
  /visits\s*\?\?\s*0\s*\)\s*>\s*0\)\s*return noContent\(\)/.test(claims.replace(/\s+/g, " ")) ||
    /visits[^\n]*>\s*0/.test(claims),
  "referral-claims debe descartar a un teléfono que ya le compró al local (candado 1 de §5)",
);
assert.ok(
  /referrerPhone === phone/.test(claims),
  "referral-claims debe impedir que alguien se refiera a sí mismo",
);

// El endpoint del código exige pedido PAGADO (§2: su prueba de que ya compró).
const codeRoute = readFileSync(new URL("../app/api/referral-code/route.ts", import.meta.url), "utf8");
assert.ok(
  /paymentStatus !== "paid"/.test(codeRoute),
  "referral-code solo entrega código si ese pedido está pagado",
);
assert.ok(
  /receiptViewFromOrder/.test(codeRoute),
  "referral-code debe exigir recibo público: el link es la llave",
);

// Ninguna de las dos rutas confía en un teléfono que venga del navegador para
// decidir de QUIÉN es el premio: el de quien invita sale del doc del código.
assert.ok(
  !/body\.referrerPhone|body\.phone.*referrer/.test(claims),
  "el teléfono de quien invita jamás se acepta desde el navegador",
);

// ── 5. El copy ─────────────────────────────────────────────────────────────
const invita = inviteTextFallback({
  itemName: "Taco suelto",
  restaurantName: "Tacos de Suadero La Familia",
  link,
});
const avisa = notifyTextFallback({
  itemName: "Taco suelto",
  restaurantName: "Tacos de Suadero La Familia",
  friendName: "Ysendi",
  expiryLabel: "vence el 25 de septiembre",
});
const claimBar = readFileSync(new URL("../components/loyalty/ReferralClaimBar.tsx", import.meta.url), "utf8");
const bloque = readFileSync(new URL("../components/loyalty/ReceiptRewardsBlock.tsx", import.meta.url), "utf8");
for (const texto of [invita, avisa, soloCopy(claimBar), soloCopy(bloque)]) {
  assert.ok(!/\bliga\b/i.test(texto), 'jamás "liga": se dice "link"');
  assert.ok(!/autom[áa]tic/i.test(texto), 'jamás prometer "automático": lo manda una persona');
  assert.ok(!/vi que (entraste|abriste|viste)/i.test(texto), 'jamás "vi que entraste"');
}
assert.ok(invita.includes(link), "el texto de invitación lleva el link");
assert.ok(invita.includes("Taco suelto"), "y dice qué se regala, con su nombre");
assert.ok(avisa.includes("Ysendi"), "el aviso dice quién vino");
assert.ok(avisa.includes("vence el 25 de septiembre"), "y hasta cuándo puede pedirlo");
// La barra del amigo no promete lo que los candados pueden negar.
assert.ok(
  /primera vez/i.test(claimBar),
  'la barra debe decir "si es tu primera vez": un cliente viejo no califica',
);
assert.ok(
  /No te\s+mandamos mensajes|No te mandamos mensajes/.test(claimBar.replace(/\s+/g, " ")),
  "la barra debe decir que no le vamos a mandar mensajes por dejar su número",
);

// ── El recibo de WhatsApp cierra con la invitación, nunca antes del total ──
const receiptSrc = readFileSync(new URL("../lib/receiptWhatsapp.ts", import.meta.url), "utf8");
assert.ok(
  /inviteLink\?:\s*string \| null;/.test(receiptSrc),
  "el recibo debe aceptar inviteLink OPCIONAL: sin él sale como siempre",
);
const idxLink = receiptSrc.indexOf("Tu recibo y tus puntos");
// Se busca la LÍNEA del mensaje (la que pega el link), no el comentario del tipo.
const idxInvita = receiptSrc.indexOf("${r.inviteLink}");
assert.ok(idxInvita > idxLink && idxLink > 0, "la invitación va DESPUÉS del link del recibo");
const idxTotal = receiptSrc.indexOf("*Total:");
assert.ok(idxInvita > idxTotal && idxTotal > 0, "y nunca antes del total");

// El cobro no puede quedarse esperando el código.
const posSrc = readFileSync(new URL("../app/vendor/pos/page.tsx", import.meta.url), "utf8");
assert.ok(
  /Promise\.race\(\[[\s\S]{0,400}referral-code[\s\S]{0,400}setTimeout/.test(posSrc),
  "el link de invitación del recibo va con tope de tiempo: el cobro no espera por él",
);

// ── /puntos lee las filas, no recalcula ───────────────────────────────────
const puntosSrc = readFileSync(new URL("../app/puntos/page.tsx", import.meta.url), "utf8");
assert.ok(
  /liveRows\(data\.freeItems\)/.test(puntosSrc),
  "/puntos debe listar los tacos vivos desde las filas",
);
assert.ok(
  /b\.freeItems\.length === 0 && b\.rewardUnlocked/.test(puntosSrc),
  "/puntos: con filas manda la lista; SIN filas, el texto de siempre (nadie pierde su premio)",
);

// ── La Caja dice qué está entregando ──────────────────────────────────────
assert.ok(
  /freeItemSource === "referral"/.test(posSrc),
  'la Caja debe distinguir "(referido)" de "(bienvenida)": no es el mismo premio',
);
const notifySrc = readFileSync(new URL("../components/loyalty/ReferralNotifyButton.tsx", import.meta.url), "utf8");
assert.ok(
  /notifiedAt/.test(notifySrc),
  '"Avísale" debe marcar notifiedAt: si no, se le avisa dos veces al mismo',
);
assert.ok(
  !/autom[áa]tic/i.test(soloCopy(notifySrc)),
  '"Avísale" lo manda una PERSONA: jamás decir automático en pantalla',
);

// ── §8 Las frases de la IA: mejoran el texto, nunca son un requisito ──────
const bloqueSrc = readFileSync(new URL("../components/loyalty/ReceiptRewardsBlock.tsx", import.meta.url), "utf8");
assert.ok(
  /inviteText\s*\n?\s*\?\s*`\$\{inviteText\}\s\$\{invite\.link\}`/.test(bloqueSrc.replace(/\s+/g, " ")) ||
    /\$\{inviteText\} \$\{invite\.link\}/.test(bloqueSrc),
  "el LINK lo pega el sistema al final, nunca el modelo",
);
assert.ok(
  /inviteTextFallback\(/.test(bloqueSrc),
  "sin frase de IA debe quedar el texto fijo: nadie espera por un modelo",
);
assert.ok(
  /notifyTextFallback\(/.test(notifySrc) && /aiNotify\s*\?\?/.test(notifySrc),
  '"Avísale" usa la frase de la IA si existe y el texto fijo si no',
);
assert.ok(
  // 22-sep: el texto fijo vive en INVITE_FALLBACK (con verbo de MANDAR).
  /\(r\.inviteText \|\| ""\)\.trim\(\) \|\| INVITE_FALLBACK/.test(receiptSrc),
  "el recibo cae al texto fijo cuando no hay frase de IA",
);

// La IA no decide NADA de la matemática: solo texto.
const aiSrc = readFileSync(
  "/Users/ricardoparedes/projects/FOODPASS/functions/referral_lines_ai.js",
  "utf8",
);
for (const prohibido of ["expiresAt", "redeemedAt", "freeItems:", "referrerPhone"]) {
  assert.ok(
    !aiSrc.includes(prohibido),
    `la IA solo escribe TEXTO: no puede tocar ${prohibido} (eso es matemática, y va en reglas)`,
  );
}
assert.ok(
  /REFERRAL_LINES_AI_ENABLED/.test(aiSrc),
  "las frases por IA arrancan en dry-run, tras una bandera",
);

// ── §7 El reloj desde /puntos: la llave es la sesión, no el navegador ─────
const byPhone = readFileSync(new URL("../app/api/free-items/seen-by-phone/route.ts", import.meta.url), "utf8");
assert.ok(/verifyIdToken\(idToken\)/.test(byPhone), "seen-by-phone debe verificar el token en el servidor");
assert.ok(
  /phone = String\(decoded\.phone_number/.test(byPhone),
  "EL TELÉFONO SALE DEL TOKEN: si saliera del cuerpo, cualquiera le acortaría el taco a otro",
);
assert.ok(
  !/body\.phone|body\.customerPhone/.test(byPhone),
  "seen-by-phone jamás acepta un teléfono del navegador",
);
const seenByOrder = readFileSync(new URL("../app/api/free-items/seen/route.ts", import.meta.url), "utf8");
assert.ok(
  /markPhoneSeen\(/.test(byPhone) && /markPhoneSeen\(/.test(seenByOrder),
  "el recibo y /puntos arrancan el reloj con la MISMA función",
);
const puntosSrc2 = readFileSync(new URL("../app/puntos/page.tsx", import.meta.url), "utf8");
assert.ok(
  /<SeenOnScreen onSeen=\{\(\) => void markTacosSeen\(b\.restaurantId\)\}>/.test(puntosSrc2),
  "/puntos arranca el reloj solo cuando la lista se DIBUJA en pantalla",
);
assert.ok(/Authorization: `Bearer \$\{idToken\}`/.test(puntosSrc2), "/puntos manda su sesión, no su número");

// ── 19-sep: al AMIGO no se le promete el taco en su primera compra ────────
// Con su primer pedido se lo GANA, para su SIGUIENTE visita (así funciona la
// bienvenida). Prometerle otra cosa hace que llegue pidiéndolo y el local le
// diga que no, justo en su primera visita.
{
  const bar = soloCopy(readFileSync(new URL("../components/loyalty/ReferralClaimBar.tsx", import.meta.url), "utf8"));
  const blk = soloCopy(readFileSync(new URL("../components/loyalty/ReceiptRewardsBlock.tsx", import.meta.url), "utf8"));
  const inv = inviteTextFallback({ itemName: "Taco suelto", restaurantName: "Suadero", link: "https://x" });
  for (const [nombre, texto] of [["barra del amigo", bar], ["bloque del recibo", blk], ["invitación", inv]]) {
    const plano = texto.replace(/\s+/g, " ");
    assert.ok(/siguiente visita/i.test(plano), `${nombre}: tiene que decir "siguiente visita"`);
    assert.ok(!/en su primera compra|cuando pagues, y di|te lo damos con tu primer pedido|te regala un/i.test(plano),
      `${nombre}: vuelve a prometer el taco en la primera compra`);
  }
}

// 19-sep, cazado en producción: justo después de "Apuntar" la barra tiene que
// enseñar "Ya quedó apuntado", no desaparecer.
{
  const barSrc = readFileSync(new URL("../components/loyalty/ReferralClaimBar.tsx", import.meta.url), "utf8");
  assert.ok(
    /hidden && state !== "done"/.test(barSrc),
    'la barra no se puede esconder en el mismo momento en que confirma "Ya quedó apuntado"',
  );
}

console.log("✅ referidos: el número no viaja, el código resuelve solo en el servidor, y el copy no miente");

// ── 22-sep-2026: el link del recibo es para REENVIARLO, y la barra no miente ─
{
  const { readFileSync } = await import("fs");
  const rd = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");

  // 1) El texto fijo del recibo trae verbo de MANDAR. Espejo de kInviteFallback
  //    (app) y del fallback de functions/referral_lines_ai.js. Si el que invita
  //    cree que el link es para abrirlo, cae en el menú con "un amigo te
  //    invitó" dirigido a él mismo.
  const recibo = rd("lib/receiptWhatsapp.ts");
  const m = recibo.match(/export const INVITE_FALLBACK = "([^"]+)"/);
  if (!m) throw new Error("falta INVITE_FALLBACK en lib/receiptWhatsapp.ts");
  if (m[1] !== "Mándale este link a un amigo y los dos ganan:") {
    throw new Error(`INVITE_FALLBACK cambió (${m[1]}): tiene que ser el MISMO que kInviteFallback en la app y el fallback de functions`);
  }
  if (!/\b(m[áa]ndale|comparte|p[áa]sale|env[íi]ale)\b/i.test(m[1])) {
    throw new Error("INVITE_FALLBACK debe llevar un verbo de mandar");
  }

  // 2) La barra no se pinta para el código PROPIO.
  const barra = rd("components/loyalty/ReferralClaimBar.tsx");
  if (!barra.includes("isMyReferralCode(")) throw new Error("ReferralClaimBar debe esconderse cuando el código es el propio (isMyReferralCode)");
  const bloque = rd("components/loyalty/ReceiptRewardsBlock.tsx");
  if (!bloque.includes("rememberMyReferralCode(")) throw new Error("ReceiptRewardsBlock debe guardar el código propio (rememberMyReferralCode)");

  // 3) La confirmación no promete en firme: el servidor contesta 204 siempre
  //    (para no revelar si ese número ya compró), así que "ya quedó apuntado"
  //    sin condición era una promesa que el grant puede rechazar.
  if (/Ya quedó apuntado\. Paga tu primer pedido/.test(barra)) {
    throw new Error("la confirmación de la barra no puede prometer en firme: lleva 'Si es tu primera vez aquí'");
  }
  if (!/Si es tu primera vez aquí/.test(barra)) {
    throw new Error("la confirmación de la barra debe decir 'Si es tu primera vez aquí'");
  }
  console.log("✅ el link del recibo dice que se MANDE; la barra no se pinta para el código propio ni promete en firme");
}
