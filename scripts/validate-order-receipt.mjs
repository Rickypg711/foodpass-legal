/**
 * Recibo de la Caja por link — contrato.
 *
 * POR QUE EXISTE (10-sep-2026, La Familia): el WhatsApp "Tu recibo y tus
 * puntos" abria en la Mac del dueño (sesion del local) y en el telefono del
 * cliente decia "No pudimos cargar tu pedido": la venta de la Caja no trae
 * customerId y las reglas solo dejan leer al dueño del pedido o al local.
 * Ahora /api/order-receipt lee con Admin SDK y regresa una vista de recibo.
 *
 * Lo que este candado cuida es que esa vista NO se vuelva una fuga: allowlist
 * (un campo nuevo en el pedido no sale solo), sin PIN (con el otro recogeria el
 * pedido), sin direccion, sin notas del pedido, sin quien cobro, sin descuento,
 * sin propina, solo el primer nombre, y solo pedidos de la Caja y del menu web
 * (12-sep-2026: el link del menu web tampoco abria sin sesion). Las reglas de
 * Firestore de orders NO se abren.
 *
 * Run: node scripts/validate-order-receipt.mjs
 */

import { readFileSync, existsSync } from "node:fs";
import { receiptViewFromOrder } from "../lib/order/receiptView.ts";

let failed = 0;
function check(label, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    console.error(`FAIL ${label}\n  esperado: ${e}\n  recibido: ${a}`);
    failed = 1;
  }
}

// ── La vista (allowlist) ─────────────────────────────────────────────────────
const pos = {
  orderSource: "pos",
  status: "pending",
  paymentMethod: "cash",
  orderType: "in_store",
  total: 95,
  loyaltyAwarded: true,
  customerName: "Aracely López Ruiz",
  customerPhone: "6141234567",
  pickupPin: "4821",
  deliveryAddress: "Calle 5 #12",
  notes: "cliente frecuente, fiado",
  customerId: "uid-del-local",
  soldBy: { uid: "x", name: "Ruby" },
  discount: { name: "familia", amount: 10 },
  tipAmount: 20,
  campoNuevoSecreto: "no debe salir",
  items: [
    {
      name: "Torta",
      quantity: 1,
      subtotal: 95,
      price: 95,
      menuItemId: "m1",
      categoryName: "Tortas",
      selectedModifiers: [{ modifierName: "Carne", selectedOptions: ["Suadero"] }],
      notes: "sin cebolla",
      costoInterno: 30,
    },
  ],
};
const v = receiptViewFromOrder(pos, "Tacos De Suadero La Familia");
const json = JSON.stringify(v);

check("pedido de la Caja => hay recibo", v !== null, true);
for (const campo of [
  "pickupPin", "deliveryAddress", "customerId", "soldBy", "discount",
  "tipAmount", "campoNuevoSecreto", "costoInterno", "menuItemId", "categoryName",
]) {
  check(`NO sale ${campo}`, json.includes(`"${campo}"`), false);
}
check("NO sale el PIN (valor)", json.includes("4821"), false);
check("NO sale la dirección (valor)", json.includes("Calle 5"), false);
check("NO sale la nota del pedido (valor)", json.includes("fiado"), false);
check("NO sale quién cobró (valor)", json.includes("Ruby"), false);
check("nombre: solo el primero", v?.customerName, "Aracely");
check("NO sale el apellido", json.includes("López"), false);
check("el teléfono SÍ (la tarjeta de puntos manda el SMS a ese número)", v?.customerPhone, "6141234567");
check("nombre del local: del doc del restaurante si el pedido no lo trae", v?.restaurantName, "Tacos De Suadero La Familia");
check("el platillo sale con su carne y su nota", v?.items, [
  {
    name: "Torta",
    quantity: 1,
    subtotal: 95,
    selectedModifiers: [{ modifierName: "Carne", selectedOptions: ["Suadero"] }],
    notes: "sin cebolla",
  },
]);
check("puntos acreditados", v?.loyaltyAwarded, true);
check("total", v?.total, 95);

// ── Pedido del menú web (12-sep-2026, IGO #KGPAPR): el link de WhatsApp se abre SIN la sesión que lo hizo ──
const web = {
  orderSource: "customer_web",
  status: "pending",
  paymentMethod: "pay_at_pickup",
  pickupPaymentMethod: "cash",
  orderType: "delivery",
  total: 280,
  deliveryFee: 50,
  customerName: "Ricardo Paredes Prueba",
  customerPhone: "6145948544",
  customerId: "uid-anonimo-del-comensal",
  pickupPin: "8184",
  deliveryAddress: "Río Tapachula 2705, Lomas de San Pedro",
  campoNuevoSecreto: "no debe salir",
  items: [{ name: "Pizza pepperoni", quantity: 1, subtotal: 195, price: 195, menuItemId: "p1" }],
};
const w = receiptViewFromOrder(web, "IGO Pizzeria");
const wjson = JSON.stringify(w);
check("pedido del menú web => SÍ hay recibo público", w !== null, true);
check("menú web: orderSource se conserva", w?.orderSource, "customer_web");
for (const campo of ["pickupPin", "deliveryAddress", "customerId", "campoNuevoSecreto", "menuItemId"]) {
  check(`menú web: NO sale ${campo}`, wjson.includes(`"${campo}"`), false);
}
check("menú web: NO sale el PIN (valor)", wjson.includes("8184"), false);
check("menú web: NO sale la dirección (valor)", wjson.includes("Tapachula"), false);
check("menú web: solo el primer nombre", w?.customerName, "Ricardo");
check("menú web: sí el envío (precio, no dato de nadie)", w?.deliveryFee, 50);
check("menú web: sí cómo va a pagar", w?.pickupPaymentMethod, "cash");
check("menú web: sí sabe que es a domicilio (sin dirección)", w?.orderType, "delivery");
check("pedido de la app => sin recibo público (la app no manda link)",
  receiptViewFromOrder({ ...web, orderSource: "customer_app" }), null);
check("orderSource inventado => sin recibo público",
  receiptViewFromOrder({ ...web, orderSource: "web" }), null);
check("sin orderSource => sin recibo público", receiptViewFromOrder({ total: 1 }), null);
check("sin pedido => null", receiptViewFromOrder(undefined), null);
check("basura en items no truena",
  receiptViewFromOrder({ orderSource: "pos", items: [null, 5, { name: "" }, { name: "Coca" }] })?.items,
  [{ name: "Coca", quantity: 1, subtotal: 0 }]);

// ── La ruta y la página ─────────────────────────────────────────────────────
const route = readFileSync(new URL("../app/api/order-receipt/route.ts", import.meta.url), "utf8");
check("la ruta usa la allowlist", route.includes("receiptViewFromOrder("), true);
check("la ruta valida los ids", route.includes("ID_RE.test(restaurantId)") && route.includes("ID_RE.test(orderId)"), true);
check("la ruta no se cachea", route.includes('"Cache-Control": "private, no-store"'), true);
check("la ruta NO regresa el doc crudo", /\.data\(\)\s*\}/.test(route) || /order:\s*orderSnap/.test(route), false);

const page = readFileSync(new URL("../app/menu/[restaurantId]/order/[orderId]/page.tsx", import.meta.url), "utf8");
check("el recibo pide al servidor cuando las reglas niegan", page.includes("/api/order-receipt?"), true);
check("recibo público: no enseña un PIN que no trae (ni se queda cargando)", page.includes("Viene en tu mensaje de WhatsApp"), true);
check("recibo público: sin el botón de confirmar por WhatsApp (sin PIN no sirve)", page.includes("isPosOrder || publicReceipt ||"), true);
check("recibo público: a domicilio se sabe por el tipo, no por la dirección", page.includes('order?.orderType === "delivery"'), true);

// ── Las reglas de orders NO se abren ─────────────────────────────────────────
const RULES = "/Users/ricardoparedes/projects/FOODPASS/firestore.rules";
if (existsSync(RULES)) {
  const rules = readFileSync(RULES, "utf8");
  check("orders sigue: leer solo el dueño del pedido o el local",
    /match \/orders\/\{orderId\} \{\s*allow read: if signedIn\(\) && \(/.test(rules), true);
}

if (failed) process.exit(1);
console.log("validate-order-receipt: OK");
