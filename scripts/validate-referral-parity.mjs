// 🎁 Referido por teléfono, app ↔ web — candado espejo (9-oct-2026,
// FOODPASS docs/REFERIDOS_PARIDAD_9_OCT.md). Su gemelo en la app:
// FOODPASS test/referral/phone_referral_parity_test.dart (lee los .ts de aquí).
//
// Había dos referidos: el de Branch en la app (+1 punto calculado en el
// teléfono del cajero) y el de teléfono del servidor (premio de bienvenida al
// que invita cuando el amigo PAGA, con cuatro candados). Ahora hay UNO: el del
// servidor. Esto truena si la app y la web se separan en:
//   1. el link (/menu/{rid}?ref=CODIGO), el alfabeto, el largo y los 30 días;
//   2. la compuerta (freeItemsV2Enabled === true) — apagada, nadie promete;
//   3. el campo del pedido (referralCode) que lee functions/referral.js;
//   4. el mensaje fijo y lo que se le explica al comensal del premio;
//   5. la ruta de la sesión (/api/referral-code/by-account) y sus candados.
// Run: node --experimental-strip-types scripts/validate-referral-parity.mjs

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import {
  CODE_ALPHABET,
  CODE_LEN,
  REF_PARAM,
  REF_STORAGE_KEY,
  REF_TTL_DAYS,
  inviteTextFallback,
  referralLink,
} from "../lib/referral/referralLink.ts";
import {
  REFERRAL_ACCOUNT_ENDPOINT,
  decideAccountInvite,
  phoneFromAccount,
  phoneVariants,
} from "../lib/referral/accountInvite.ts";
import { freeItemsEnabled, welcomeItemNameOf } from "../lib/loyalty/freeItems.ts";

const APP = "/Users/ricardoparedes/projects/FOODPASS";
const rd = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");

// ── 5. La ruta de la sesión: decisión pura ──────────────────────────────────
assert.equal(REFERRAL_ACCOUNT_ENDPOINT, "/api/referral-code/by-account");
assert.equal(phoneFromAccount({ tokenPhone: "+526141112233", linkedPhone: "6149998877" }), "6141112233",
  "el número del token (SMS) manda sobre el ligado");
assert.equal(phoneFromAccount({ tokenPhone: null, linkedPhone: "52 614 999 8877" }), "6149998877");
assert.equal(phoneFromAccount({ tokenPhone: "", linkedPhone: "123" }), null);
assert.deepEqual(phoneVariants("6141112233"),
  ["6141112233", "526141112233", "+526141112233", "5216141112233", "+5216141112233"]);
const base = { gateOn: true, itemName: "Taco suelto", phone: "6141112233", paidOrders: 1 };
assert.deepEqual(decideAccountInvite(base), { ok: true });
assert.equal(decideAccountInvite({ ...base, gateOn: false }).reason, "gate_off");
assert.equal(decideAccountInvite({ ...base, itemName: " " }).reason, "no_welcome_item");
assert.equal(decideAccountInvite({ ...base, phone: null }).reason, "no_phone");
assert.equal(decideAccountInvite({ ...base, paidOrders: 0 }).reason, "no_purchase",
  "mismo requisito que el recibo (§2): ≥1 pedido pagado en el local");

const route = rd("app/api/referral-code/by-account/route.ts");
assert.ok(route.includes("verifyIdToken(idToken)"), "by-account exige sesión de Firebase");
assert.ok(/decoded\.phone_number/.test(route) && /\.linkedPhone/.test(route),
  "el teléfono sale del token o de users.linkedPhone");
assert.ok(!/body\.phone/.test(route), "el teléfono JAMÁS sale del cuerpo de la petición");
assert.ok(route.includes('.where("customerPhone", "in", phoneVariants(phone))'),
  "cuenta pedidos pagados con las mismas variantes del número que functions");
assert.ok(route.includes("if (!gateOn || !itemName) return noContent();"),
  "compuerta y premio con nombre antes de leer nada más");
assert.ok(route.includes("referralLink(restaurantId, code, originOf(request))"),
  "el link sale del MISMO armador que el del recibo");
assert.ok(route.includes("tx.set(phoneRef, { referralCode: code }, { merge: true });"),
  "mismo campo que /api/referral-code: un teléfono = un código, venga del recibo o de la app");

// ── 2. La barra del amigo respeta la compuerta en las DOS vistas del menú ───
const menu = rd("app/menu/[restaurantId]/MenuView.tsx");
assert.equal(menu.split("itemName={referralGateOn ? firstVisitReward : null}").length - 1, 2,
  "con la compuerta apagada la barra del amigo no promete nada (menú con y sin pedidos)");
assert.equal(menu.split("setReferralGateOn(freeItemsEnabled(rData));").length - 1, 2);
assert.equal(freeItemsEnabled({ freeItemsV2Enabled: "true" }), false, "solo el booleano true prende");
assert.equal(welcomeItemNameOf({ firstPurchaseReward: { enabled: true, menuItemName: " Taco " } }), "Taco");

// ── Espejo con la app ───────────────────────────────────────────────────────
if (!existsSync(APP)) {
  console.log("validate-referral-parity: OK (FOODPASS no está aquí; espejo saltado)");
  process.exit(0);
}
const app = (rel) => readFileSync(`${APP}/${rel}`, "utf8");
const dart = app("lib/referral/phone_referral.dart");

// 1. Link, código, 30 días.
assert.equal(/kReferralCodeAlphabet = '([A-Z0-9]+)'/.exec(dart)?.[1], CODE_ALPHABET, "alfabeto app = web");
assert.equal(Number(/kReferralCodeLen = (\d+)/.exec(dart)?.[1]), CODE_LEN, "largo app = web");
assert.equal(/kRefParam = '(\w+)'/.exec(dart)?.[1], REF_PARAM, "parámetro del link app = web");
assert.equal(/kRefStorageKey = '(\w+)'/.exec(dart)?.[1], REF_STORAGE_KEY);
assert.equal(Number(/kRefTtlDays = (\d+)/.exec(dart)?.[1]), REF_TTL_DAYS, "30 días en los dos");
assert.equal(/kAccountInvitePath = '([^']+)'/.exec(dart)?.[1], REFERRAL_ACCOUNT_ENDPOINT);
assert.ok(dart.includes("return c != null ? '$base?$kRefParam=$c' : base;"), "la app arma el link igual");
assert.equal(referralLink("r1", "ACDEFG", "https://x.com/"), "https://x.com/menu/r1?ref=ACDEFG");
assert.ok(dart.includes("jsonEncode({'code': code, 'savedAt': nowMs})"), "misma forma guardada {code, savedAt}");

// 2. Compuerta.
assert.ok(dart.includes("restaurant['freeItemsV2Enabled'] == true"), "compuerta app = freeItemsEnabled web");
assert.ok(dart.includes("phoneReferralGateOn(restaurant) && phoneReferralItemName(restaurant) != null"));
const perfil = app("lib/bottom_nav_pages/restarantowner/RestaurantProfileScreen.dart");
assert.ok(perfil.includes("if (!phoneReferralPromises(_restaurantData)) return null;"),
  "el botón 'Regálale … a un amigo' no sale con la compuerta apagada");
const banner = app("lib/referral/referral_friend_banner.dart");
assert.ok(banner.includes("!phoneReferralGateOn(widget.restaurantData)"), "la barra del amigo en la app respeta la compuerta");
const sheet = app("lib/referral/phone_referral_share_sheet.dart");
assert.ok(sheet.includes("if (!phoneReferralPromises(restaurantData)) return false;"));

// 3. El campo del pedido.
const pos = app("lib/services/pos_service.dart");
assert.ok(pos.includes("orderMap['referralCode'] = ref;"), "la app escribe referralCode, como la web");
assert.ok(rd("lib/order/createCustomerOrder.ts").includes("referralCode: readStoredRef(params.restaurantId)"));
assert.ok(app("functions/referral.js").includes("parseReferralCode(order && order.referralCode)"),
  "y el grant lo lee de ahí");
const router = app("lib/app/app_router.dart");
assert.equal(router.split("ReferralRefStore.captureFromQueryParams(id, state.uri.queryParameters);").length - 1, 2,
  "la app guarda el ?ref= al entrar por /menu/{rid} y /restaurant/{rid}");

// 4. El mensaje fijo, byte por byte.
const tpl = /'Aquí se come bien\. Con tu primer pedido\$donde te ganas un \$item '\s*'gratis para tu siguiente visita\. Entra con este link: \$link'/;
assert.ok(tpl.test(dart), "inviteTextFallback de la app cambió de forma");
const L = "https://www.comeleal.com/menu/r1?ref=ACDEFG";
assert.equal(
  inviteTextFallback({ itemName: "Taco suelto", restaurantName: "Tacos La Familia", link: L }),
  `Aquí se come bien. Con tu primer pedido en Tacos La Familia te ganas un Taco suelto gratis para tu siguiente visita. Entra con este link: ${L}`,
);
assert.ok(dart.includes("final item = itemName.trim().isEmpty ? 'algo gratis' : itemName.trim();"));

// 4b. Lo que ve el comensal (app_es.arb) = lo que dice la web.
const es = JSON.parse(app("lib/l10n/app_es.arb"));
const flat = (s) => s.replace(/\s+/g, " ");
const bloque = flat(rd("components/loyalty/ReceiptRewardsBlock.tsx"));
const barra = flat(rd("components/loyalty/ReferralClaimBar.tsx"));
for (const k of ["ref3InviteTitle", "ref3InvitePreviewLabel", "ref3InviteSendWhatsapp"]) {
  assert.ok(bloque.includes(es[k]), `${k} = recibo web: "${es[k]}"`);
}
const [antes, despues] = es.ref3InviteExplainer.split("{itemName}");
assert.ok(bloque.includes(antes.trim()) && bloque.includes(despues.trim().split(",")[0]));
assert.ok(bloque.includes("y tú te ganas otro cuando él pague."));
for (const k of ["ref3FriendInvited", "ref3FriendDone"]) {
  for (const parte of es[k].split("{itemName}")) assert.ok(barra.includes(parte.trim()), `${k}: "${parte.trim()}"`);
}
assert.ok(barra.includes(es.ref3FriendFinePrint), "letra chica de la barra del amigo");
assert.ok(barra.includes(`placeholder="${es.ref3FriendPhoneHint}"`));
assert.ok(barra.includes(`"${es.ref3FriendApuntar}"`));

// Branch ya no paga lo nuevo (y el código se queda, sin uso).
const legacy = app("lib/referral/legacy_branch_referral.dart");
assert.ok(legacy.includes("static const bool acceptsNewAttributions = false;"));
assert.ok(app("lib/services/visit_recording_service.dart").includes("LegacyBranchReferral.paysLegacyBonus(d)"),
  "el +1 del cliente solo para atribuciones de antes del corte");

console.log("validate-referral-parity: OK");
