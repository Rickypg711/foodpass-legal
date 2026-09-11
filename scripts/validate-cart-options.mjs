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

import { readFileSync } from "node:fs";
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
  isOptionAvailable,
  groupHasAvailableOption,
  setOptionAvailability,
  applyOptionAvailabilityToMenu,
  optionAvailabilityChanges,
  applyOptionAvailabilityChangesToMenu,
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

// ------------------------------------------- el editor del dueño (fuente)
// El div de cada grupo usa key={g.id}. Si el onChange del nombre vuelve a
// calcular el id en cada tecla, la key cambia, React destruye y recrea el
// bloque, y el input pierde el foco a la PRIMERA letra: el dueño escribia "S"
// y tenia que volver a hacer clic para la siguiente. Se cazo probando el
// editor a mano, no leyendo el codigo. Esta asercion es sobre el CODIGO
// FUENTE porque es un comportamiento de render, no una funcion pura.
const editorSrc = readFileSync(
  new URL("../components/vendor/OptionGroupsEditor.tsx", import.meta.url),
  "utf8",
);
const nombreGrupoOnChange = editorSrc.match(
  /placeholder="Nombre del grupo[^]*?onChange=\{\(e\) => updateGroup\(gi, \{([^}]*)\}\)\}/,
);
check("el onChange del nombre del grupo existe", Boolean(nombreGrupoOnChange), true);
check(
  "el nombre del grupo NO reescribe g.id (si no, el input pierde el foco)",
  (nombreGrupoOnChange?.[1] ?? "").includes("id:"),
  false,
);
check("el grupo se sigue renderizando con key={g.id}", editorSrc.includes("key={g.id}"), true);

// ── El TAMANO es la unica eleccion obligatoria QUE CUESTA ──────────────────
// Una pizza sin tamano no es un pedido. Sin esto, "Elige tu tamano: Personal,
// Grande +$90" quedaba opcional. Espejo del test de Dart.
{
  const g = parseOptionGroupsFromDescription("Elige tu tamano: Personal, Grande +$90.");
  check("tamano: sale un grupo", g.length, 1);
  check("tamano: es OBLIGATORIO aunque cueste", g[0]?.required, true);
  check("tamano: min 1", g[0]?.min, 1);
  check("tamano: el delta se lee", g[0]?.options.at(-1)?.priceDelta, 90);
}
// ...y la excepcion NO vuelve obligatorio todo lo que cuesta.
{
  const g = parseOptionGroupsFromDescription("Elige tus extras: Queso +$20, Tocino +$25.");
  check("un extra con precio sigue siendo OPCIONAL", g[0]?.required, false);
}

// ------------------------------------------------------- agotado hoy
// Tacos de Suadero La Familia (9-sep-2026) se quedo sin asada a media noche y la
// unica salida era BORRAR la opcion del selector y acordarse de regresarla.
// Ahora la opcion se apaga sin borrarse; ausente = disponible para los menus
// ya guardados, que no traen el campo.
{
  const carne = [{
    id: "carne", name: "Carne", required: true, min: 1, max: 1,
    options: [
      { id: "suadero", name: "Suadero", priceDelta: 0 },
      { id: "bistec", name: "Bistec", priceDelta: 0 },
    ],
  }];
  check("sin campo => disponible", isOptionAvailable(carne[0].options[1]), true);
  const apagado = setOptionAvailability(carne, "carne", "bistec", false);
  check("apagar escribe available:false", apagado[0].options[1].available, false);
  check("apagar no toca las demas", apagado[0].options[0], { id: "suadero", name: "Suadero", priceDelta: 0 });
  check("apagar es puro: el original no cambia", carne[0].options[1].available, undefined);
  check("el grupo sigue teniendo opcion disponible", groupHasAvailableOption(apagado[0]), true);
  const prendido = setOptionAvailability(apagado, "carne", "bistec", true);
  check("prender QUITA el campo (queda como lo escribe el editor)", "available" in prendido[0].options[1], false);
  const todoApagado = setOptionAvailability(apagado, "carne", "suadero", false);
  check("todo agotado => el grupo obligatorio bloquea el platillo", groupHasAvailableOption(todoApagado[0]), false);
  check("un grupo que no existe se deja igual", setOptionAvailability(carne, "salsa", "x", false), carne);
}

// ------------------------------------------- agotado hoy en TODO el menu
// 10-sep-2026: La Familia tiene "Bistec (carne asada)" en 6 platillos. Marcarla
// agotada platillo por platillo eran 6 vueltas a media venta; ahora un toque la
// apaga (o prende) en cada platillo que la trae. Espejo del test de Dart.
{
  const carne = () => [{
    id: "carne", name: "Carne", required: true, min: 1, max: 1,
    options: [
      { id: "suadero", name: "Suadero", priceDelta: 0 },
      { id: "bistec", name: "Bistec (carne asada)", priceDelta: 0 },
    ],
  }];
  // Mismo id de opcion ("bistec") en OTRO grupo: no se debe tocar.
  const extras = [{
    id: "extras", name: "Extras", required: false, min: 0, max: 1,
    options: [
      { id: "bistec", name: "Bistec", priceDelta: 20 },
      { id: "queso", name: "Queso", priceDelta: 15 },
    ],
  }];
  const menu = [
    { id: "tacos", groups: carne() },
    { id: "torta", groups: carne() },
    { id: "coca", groups: [] },
    { id: "nachos", groups: extras },
  ];
  const apagar = applyOptionAvailabilityToMenu(menu, "carne", "bistec", false);
  check("apaga en TODOS los platillos que la traen, y solo en esos", apagar.map((c) => c.id), ["tacos", "torta"]);
  check("cada uno queda con available:false", apagar.every((c) => c.groups[0].options[1].available === false), true);
  check("es pura: el menu original no cambia", menu[0].groups[0].options[1].available, undefined);
  const medio = [
    { id: "tacos", groups: setOptionAvailability(menu[0].groups, "carne", "bistec", false) },
    menu[1], menu[2], menu[3],
  ];
  check("solo regresa los que CAMBIAN", applyOptionAvailabilityToMenu(medio, "carne", "bistec", false).map((c) => c.id), ["torta"]);
  const prender = applyOptionAvailabilityToMenu(medio, "carne", "bistec", true);
  check("prender regresa los apagados", prender.map((c) => c.id), ["tacos"]);
  check("prender QUITA el campo", "available" in prender[0].groups[0].options[1], false);
}

// ------------------------------------------- el EDITOR también reparte
// 10-sep-2026: la casilla "Agotado" del editor (/vendor/menu) cambiaba solo ese
// platillo; ahora, al guardar, reparte igual que la Caja.
{
  const g = (bistecOff, extra = {}) => [{
    id: "carne", name: "Carne", required: true, min: 1, max: 1,
    options: [
      { id: "suadero", name: "Suadero", priceDelta: 0, ...extra },
      bistecOff ? { id: "bistec", name: "Bistec", priceDelta: 0, available: false } : { id: "bistec", name: "Bistec", priceDelta: 0 },
    ],
  }];
  check("sin cambio de agotado => nada que repartir", optionAvailabilityChanges(g(false), g(false)), []);
  check("apagar bistec en el editor => 1 cambio", optionAvailabilityChanges(g(false), g(true)),
    [{ groupId: "carne", optionId: "bistec", available: false }]);
  check("prender bistec en el editor => 1 cambio", optionAvailabilityChanges(g(true), g(false)),
    [{ groupId: "carne", optionId: "bistec", available: true }]);
  check("cambiar precio o nombre NO es cambio de agotado",
    optionAvailabilityChanges(g(false), g(false, { priceDelta: 5, name: "Suadero!" })), []);
  const nueva = [{ ...g(false)[0], options: [...g(false)[0].options, { id: "tripa", name: "Tripa", priceDelta: 0, available: false }] }];
  check("opción NUEVA ya agotada no se reparte", optionAvailabilityChanges(g(false), nueva), []);
  check("grupo NUEVO no se reparte", optionAvailabilityChanges([], g(true)), []);

  const menu = [
    { id: "tacos", groups: g(false) },
    { id: "torta", groups: g(false) },
    { id: "coca", groups: [] },
  ];
  const dos = [
    { groupId: "carne", optionId: "bistec", available: false },
    { groupId: "carne", optionId: "suadero", available: false },
  ];
  const res = applyOptionAvailabilityChangesToMenu(menu, dos);
  check("varios cambios: cada platillo sale UNA vez", res.map((r) => r.id), ["tacos", "torta"]);
  check("varios cambios: se acumulan (bistec y suadero apagados)",
    res.every((r) => r.groups[0].options.every((o) => o.available === false)), true);
  check("sin cambios => nada", applyOptionAvailabilityChangesToMenu(menu, []), []);
}

const editorPageSrc = readFileSync(new URL("../app/vendor/setup/menu/page.tsx", import.meta.url), "utf8");
check("el editor reparte el agotado al guardar", editorPageSrc.includes("applyOptionAvailabilityChangesToMenu("), true);
check("el editor reparte ANTES de recargar la lista (onChanged)",
  editorPageSrc.indexOf("applyOptionAvailabilityChangesToMenu(") > 0 &&
  editorPageSrc.indexOf("applyOptionAvailabilityChangesToMenu(") < editorPageSrc.indexOf("await onChanged();"), true);

// La Caja lo usa de verdad: un toque guarda en lote, no platillo por platillo.
const posSrc = readFileSync(new URL("../app/vendor/pos/page.tsx", import.meta.url), "utf8");
check("la Caja web aplica el agotado a todo el menu", posSrc.includes("applyOptionAvailabilityToMenu("), true);
check("la Caja web guarda en un lote (writeBatch)", posSrc.includes("writeBatch(db)"), true);

// Al FINAL: antes el exit vivia a media hoja y los checks de tamano y de agotado
// podian fallar sin tumbar el candado.
if (failed) process.exit(1);
console.log("validate-cart-options: OK");
