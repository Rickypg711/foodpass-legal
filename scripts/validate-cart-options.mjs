/**
 * Opciones por platillo (salsas sin costo, extras con sobreprecio) — contrato.
 *
 * POR QUE EXISTE: esta capa decide CUANTO cuesta una linea del carrito, y ese
 * monto viaja tal cual al pedido y de ahi a Mercado Pago. validate-cart-editing
 * solo revisa que existan los nombres en el codigo; aqui se ejecuta la logica.
 *
 * Todo lo que se prueba es puro y sin imports con alias @/ ejecutables, asi que
 * node --experimental-strip-types lo carga directo (mismo truco que
 * validate-table-orders.mjs).
 *
 * Run: node scripts/validate-cart-options.mjs
 */

import {
  buildLineId,
  optionsPriceDelta,
  describeSelectedOptions,
} from "../lib/cart/lineId.ts";
import {
  incrementCartLine,
  decrementCartLine,
  updateCartLineQuantity,
  cartSubtotal,
} from "../lib/cart/cartLineMath.ts";
import {
  parseOptionGroupsFromDescription,
  resolveOptionGroups,
} from "../lib/menu/optionGroups.ts";

let failed = 0;
function check(label, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    console.error(`FAIL ${label}\n  esperado: ${e}\n  recibido: ${a}`);
    failed = 1;
  }
}

// ---------------------------------------------------------------- lineId
// Sin opciones la llave NO cambia: los carritos ya guardados y los platillos
// sin opciones se comportan igual que antes de este cambio.
check("sin opciones lineId === menuItemId", buildLineId("abc"), "abc");
check("null tambien", buildLineId("abc", null), "abc");

const bufalo = [
  { groupId: "salsa", groupName: "Salsa", options: [{ id: "bufalo", name: "Búfalo", priceDelta: 0 }] },
];
const bbq = [
  { groupId: "salsa", groupName: "Salsa", options: [{ id: "bbq", name: "BBQ", priceDelta: 0 }] },
];
check("opciones distintas => llaves distintas", buildLineId("a", bufalo) !== buildLineId("a", bbq), true);
check("misma opcion => misma llave", buildLineId("a", bufalo), buildLineId("a", bufalo));

// El orden en que el cliente toca las opciones no puede partir la linea en dos.
const dosGrupos = [
  { groupId: "salsa", groupName: "Salsa", options: [{ id: "bbq", name: "BBQ", priceDelta: 0 }] },
  { groupId: "aderezo", groupName: "Aderezo", options: [{ id: "ranch", name: "Ranch", priceDelta: 0 }] },
];
const dosGruposAlReves = [dosGrupos[1], dosGrupos[0]];
check("el orden de eleccion no cambia la llave", buildLineId("a", dosGrupos), buildLineId("a", dosGruposAlReves));

// ------------------------------------------------------------ sobreprecio
const camaron = [
  { groupId: "extras", groupName: "Extras", options: [{ id: "camaron", name: "Camarón", priceDelta: 25 }] },
];
check("delta de un extra", optionsPriceDelta(camaron), 25);
check("sin opciones no hay delta", optionsPriceDelta(undefined), 0);
check("salsa sin costo no suma", optionsPriceDelta(bufalo), 0);
check(
  "varios grupos se suman",
  optionsPriceDelta([...camaron, { groupId: "g", groupName: "G", options: [{ id: "x", name: "X", priceDelta: 10 }] }]),
  35,
);
check("texto para cocina", describeSelectedOptions(dosGrupos), "Salsa: BBQ · Aderezo: Ranch");

// ------------------------------------------------- carrito con dos variantes
// El mismo platillo dos veces con salsa distinta: son DOS lineas y editar una
// no toca la otra. Antes, indexado por menuItemId, se pisaban.
const lineas = [
  { lineId: buildLineId("alitas", bufalo), menuItemId: "alitas", name: "Alitas", price: 120, quantity: 1, subtotal: 120 },
  { lineId: buildLineId("alitas", bbq), menuItemId: "alitas", name: "Alitas", price: 120, quantity: 2, subtotal: 240 },
];
const masBufalo = incrementCartLine(lineas, buildLineId("alitas", bufalo));
check("sube solo la variante tocada", masBufalo.map((l) => l.quantity), [2, 2]);
check("el subtotal de la linea se recalcula", masBufalo[0].subtotal, 240);
check("el carrito suma las dos variantes", cartSubtotal(masBufalo), 480);

const menosBbq = decrementCartLine(lineas, buildLineId("alitas", bbq));
check("baja solo la variante tocada", menosBbq.map((l) => l.quantity), [1, 1]);
check("llegar a 0 elimina la linea", updateCartLineQuantity(lineas, buildLineId("alitas", bbq), 0).length, 1);

// Un extra con costo se cobra por unidad, no una sola vez.
const conExtra = 120 + optionsPriceDelta(camaron);
check("el extra entra al precio unitario", conExtra, 145);
check("y se multiplica por cantidad", updateCartLineQuantity(
  [{ lineId: "x", menuItemId: "a", name: "A", price: conExtra, quantity: 1, subtotal: conExtra }],
  "x",
  3,
)[0].subtotal, 435);

// -------------------------------------------------------- parseo del menu
const salsas = parseOptionGroupsFromDescription(
  "Diez piezas crujientes. Elige tu salsa: Mango Habanero, Búfalo, BBQ.",
);
check("un grupo de salsas", salsas.length, 1);
check("la salsa es obligatoria", salsas[0]?.required, true);
check("tres opciones", salsas[0]?.options.length, 3);
check("sin costo", salsas[0]?.options.every((o) => o.priceDelta === 0), true);

// TEXTO REAL del menú de Sushin-Gón. Dice "Opcional:", no "Si la quieres de:":
// con la lista corta de encabezados este platillo NO detectaba nada.
const extras = parseOptionGroupsFromDescription(
  "Todas las bolas van acompañadas de salsa de chipotle, anguila, soya, siracha " +
    "y con zanahoria rallada y cebollín. Opcional: Camarón +$25, Pastor +$25, " +
    "Res +$25, Res + Camarón +$35.",
);
check("un grupo de extras", extras.length, 1);
check("un extra con costo NO es obligatorio", extras[0]?.required, false);
check(
  "el + del nombre se respeta y solo se toma el precio del final",
  extras[0]?.options.map((o) => [o.name, o.priceDelta]),
  [["Camarón", 25], ["Pastor", 25], ["Res", 25], ["Res + Camarón", 35]],
);

// El mismo encabezado escrito de otras formas tambien cuenta.
for (const encabezado of ["Si la quieres de", "Agrega", "Extras", "Añade", "Opcionales"]) {
  const g = parseOptionGroupsFromDescription(`Rica. ${encabezado}: Camarón +$25, Pastor +$25.`);
  check(`encabezado "${encabezado}"`, g.length, 1);
  check(`encabezado "${encabezado}" cobra`, g[0]?.options.map((o) => o.priceDelta), [25, 25]);
}

// Descripcion real de un platillo con dos elecciones obligatorias seguidas.
const boneless = parseOptionGroupsFromDescription(
  "250 GR DE PECHUGA. Acompañadas de papas a la francesa y ensalada pequeña. " +
    "Elige tu salsa: Mango Habanero, Búfalo, BBQ, Pimienta Limón, Ajo Parmesano Spicy. " +
    "Elige tu aderezo: Ranch, César, Mil Islas.",
);
check("dos grupos obligatorios", boneless.map((g) => [g.name, g.required, g.options.length]), [
  ["Salsa", true, 5],
  ["Aderezo", true, 3],
]);

// Sin punto final tambien se lee (hay descripciones que no lo traen).
check("sin punto final", parseOptionGroupsFromDescription("Elige tu salsa: BBQ, Búfalo").length, 1);
// Un precio con centavos no parte la lista en el punto decimal.
check(
  "precio con centavos",
  parseOptionGroupsFromDescription("Opcional: Queso +$12.50, Tocino +$18.")[0]
    ?.options.map((o) => o.priceDelta),
  [12.5, 18],
);

// "Acompañada de" es lo que YA viene incluido: no es una eleccion del cliente.
check(
  "acompañada de no genera grupo",
  parseOptionGroupsFromDescription("Acompañada de: arroz, ensalada, tortillas.").length,
  0,
);
check("descripcion vacia", parseOptionGroupsFromDescription("").length, 0);
check("descripcion sin opciones", parseOptionGroupsFromDescription("Rica y caliente.").length, 0);
// Nunca se inventa un precio: si el menu no lo escribe, es 0.
check(
  "precio nunca inferido",
  parseOptionGroupsFromDescription("Elige tu término: Medio, Tres cuartos, Bien cocido.")[0]
    ?.options.every((o) => o.priceDelta === 0),
  true,
);

// ------------------------------------------------------------- quien manda
const guardados = [
  { id: "salsa", name: "Salsa", required: true, min: 1, max: 1, options: [{ id: "unica", name: "Única", priceDelta: 0 }] },
];
check(
  "lo guardado por el dueño manda sobre lo detectado",
  resolveOptionGroups({ optionGroups: guardados, description: "Elige tu salsa: A, B, C." }),
  guardados,
);
check(
  "sin guardados se lee la descripcion",
  resolveOptionGroups({ description: "Elige tu salsa: A, B, C." }).length,
  1,
);
check("sin nada, nada", resolveOptionGroups({}).length, 0);

if (failed) process.exit(1);
console.log("validate-cart-options: OK");
