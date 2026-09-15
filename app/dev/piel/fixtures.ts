/**
 * Vista previa LOCAL de una piel (/dev/piel/{skin} y /dev/piel/{skin}/r).
 * No toca Firestore ni el local de verdad: sirve para ver una piel antes de
 * que exista el doc del restaurante. La ruta no existe en producción.
 *
 * Negro Blanco Café (10-sep-2026): los nombres de café, fríos y postres son los
 * de su Google Maps; los PRECIOS SON DE MUESTRA hasta que el dueño mande su
 * menú. El café en grano sí trae los precios de su hoja "Recomendación del
 * Tostador" (foto de Maps, puede estar vieja). Horario real (su highlight de IG).
 */
import type { MenuInitialData } from "@/app/menu/[restaurantId]/MenuView";

export type PielFixture = { id: string; initial: MenuInitialData };

const day = (open: [number, number], close: [number, number]) => ({
  isClosed: false,
  openingTime: { hour: open[0], minute: open[1] },
  closingTime: { hour: close[0], minute: close[1] },
});

const LECHE = {
  id: "leche",
  name: "Leche",
  required: true,
  min: 1,
  max: 1,
  options: [
    { id: "entera", name: "Entera", priceDelta: 0 },
    { id: "deslactosada", name: "Deslactosada", priceDelta: 0 },
    { id: "almendra", name: "Almendra", priceDelta: 15 },
    { id: "avena", name: "Avena", priceDelta: 15 },
  ],
};

type Row = [category: string, name: string, price: number, description?: string, withMilk?: boolean];

const NB_ROWS: Row[] = [
  ["Espresso", "Espresso", 45, "Doble. Pregunta por el café de la semana."],
  ["Espresso", "Americano", 50],
  ["Espresso", "Cortado", 60, "Espresso con un poco de leche.", true],
  ["Espresso", "Flat white", 70, undefined, true],
  ["Espresso", "Cappuccino", 70, undefined, true],
  ["Espresso", "Latte", 75, undefined, true],
  ["Espresso", "Latte avellana", 85, "Latte con avellana.", true],
  ["Métodos", "V60 del día", 90, "Veracruz · Coatepec · Gildardo Villa · honey"],
  ["Métodos", "Chemex para dos", 150, "Nayarit · El Cuarenteño · Gerardo Vázquez · natural"],
  ["Métodos", "Prensa francesa", 80, "Mezcla de la casa · Huatusco, Veracruz · lavado"],
  ["Métodos", "Café de olla", 55],
  ["Fríos", "Cold brew", 75, "Reposado en frío."],
  ["Fríos", "Americano en las rocas", 60],
  ["Fríos", "Espresso tonic", 85],
  ["Fríos", "Mocktail de temporada", 95, "Pregunta en barra por el de esta temporada."],
  ["Sin café", "Té chai latte", 75, undefined, true],
  ["Sin café", "Matcha latte", 85, undefined, true],
  ["Sin café", "Chocolate", 70, undefined, true],
  ["Pan y postres", "Tiramisú", 95],
  ["Pan y postres", "Tarta de frutos rojos", 90],
  ["Pan y postres", "Pastel de chocolate", 90],
  ["Pan y postres", "Galleta con chispas", 45],
  ["Café en grano", "Coatepec · honey · 250 g", 287, "Veracruz · productor Gildardo Villa"],
  ["Café en grano", "El Cuarenteño · natural · 250 g", 260, "Nayarit · productor Gerardo Vázquez"],
  ["Café en grano", "La Cañada · natural · 250 g", 235, "Guerrero · productor Ricardo Maciel"],
  ["Café en grano", "Mezcla de la casa · lavado · 1 kg", 425, "Huatusco, Veracruz"],
];

const NEGRO_BLANCO: PielFixture = {
  id: "preview-negroblanco",
  initial: {
    raw: {
      name: "Negro Blanco Café",
      tagline: "Café especial, humor ácido.",
      description:
        "Barra de café de especialidad y tostador en San Felipe. Café mexicano de productores con nombre, de Veracruz a Chiapas.",
      menuSkin: "negroblanco",
      coverImageUrl: "/skins/negroblanco/portada.jpg",
      address: "Trasviña y Retes 3300-B, San Felipe, Chihuahua",
      phone: "6146884720",
      categories: ["Cafetería"],
      menuCategoryOrder: ["Espresso", "Métodos", "Fríos", "Sin café", "Pan y postres", "Café en grano"],
      businessHours: {
        monday: day([7, 0], [22, 0]),
        tuesday: day([7, 0], [22, 0]),
        wednesday: day([7, 0], [22, 0]),
        thursday: day([7, 0], [22, 0]),
        friday: day([7, 0], [22, 0]),
        saturday: day([8, 0], [22, 0]),
        sunday: day([15, 0], [22, 0]),
      },
    },
    menu: NB_ROWS.map(([category, name, price, description, withMilk], i) => ({
      id: `nb-${i + 1}`,
      data: {
        category,
        name,
        price,
        ...(description ? { description } : {}),
        isAvailable: true,
        ...(withMilk ? { optionGroups: [LECHE] } : {}),
      },
    })),
  },
};

/* ───────────────────────── Omu Balls & Sushi (13-sep-2026) ─────────────────────────
 * Su hoja única (foto de WhatsApp del 13-sep): Ármalas a tu gusto (4 pasos, Ball $95 / Sushi $105), Omu Premium (12),
 * Omu Boneless (300 gr / 600 gr / 1 kg), Para compartir (2 box), ¡Complementa! (refrescos y postres) y Extras
 * (+$25 el ingrediente extra). Los PRECIOS SON LOS DE SU PAPEL. Mismos datos que scripts/seedOmu.js en FOODPASS. */
type OG = { id: string; name: string; required: boolean; min: number; max: number; options: { id: string; name: string; priceDelta: number }[] };
const og = (id: string, name: string, required: boolean, max: number, options: [string, string, number?][]): OG => ({
  id, name, required, min: required ? 1 : 0, max,
  options: options.map(([oid, oname, d]) => ({ id: oid, name: oname, priceDelta: d ?? 0 })),
});
const PROTEINAS: [string, string][] = [
  ["pollo", "Pollo"], ["res", "Res"], ["tocino", "Tocino"], ["camaron", "Camarón"], ["cangrejo", "Cangrejo"],
  ["cebolla_dulce", "Cebolla dulce"], ["ostiones", "Ostiones"],
];
const OMU_CUBIERTA_BALL = og("cubierta", "Cubierta", true, 1, [
  ["empanizada", "Empanizada"], ["natural", "Natural (temperatura ambiente)"], ["flamin_hot", "Flamin' Hot"], ["doritos", "Doritos"],
]);
const OMU_CUBIERTA_SUSHI = og("cubierta", "Cubierta", true, 1, [
  ["empanizada", "Empanizada"], ["natural", "Natural (temperatura ambiente)"], ["flamin_hot", "Flamin' Hot"], ["doritos", "Doritos"],
  ["alga_completa", "Alga completa"],
]);
const OMU_PROTEINA = og("proteina", "Proteína", true, 1, PROTEINAS);
const OMU_ADEREZOS = og("aderezos", "Aderezos", true, 2, [
  ["chipotle", "Chipotle"], ["soya", "Soya"], ["salsa_anguila", "Salsa anguila"], ["ranch", "Ranch"], ["buffalo", "Búffalo"],
]);
const OMU_VEGETALES = og("vegetales", "Vegetales", true, 2, [
  ["jicama", "Jícama"], ["pepino", "Pepino"], ["zanahoria", "Zanahoria"], ["chiles_toreados", "Chiles toreados"],
]);
const OMU_EXTRA = og("ingrediente_extra", "Ingrediente extra", false, 5, [
  ["pollo", "Pollo", 25], ["res", "Res", 25], ["tocino", "Tocino", 25], ["camaron", "Camarón", 25], ["cangrejo", "Cangrejo", 25],
  ["pastor", "Pastor", 25], ["cebolla_dulce", "Cebolla dulce", 25], ["ostion_ahumado", "Ostión ahumado", 25],
  ["salsa_buffalo_habanero", "Salsa búffalo habanero", 25], ["salsa_bufalo", "Salsa búfalo", 25], ["salsa_bbq", "Salsa BBQ", 25],
  ["salsa_pimienta_limon", "Salsa pimienta limón", 25], ["salsa_fresa_chipotle", "Salsa fresa chipotle", 25],
  ["aderezo_sriracha", "Aderezo sriracha", 10], ["aderezo_chipotle", "Aderezo chipotle", 10], ["aderezo_soya", "Aderezo soya", 10],
  ["aderezo_anguila", "Aderezo anguila", 10], ["aderezo_ranch", "Aderezo ranch", 15], ["aderezo_pasta_tampico", "Aderezo pasta Tampico", 10],
]);
const OMU_BOLA_SUSHI = og("presentacion", "Presentación", true, 1, [["bola", "Bola"], ["sushi", "Sushi"]]);
const OMU_ESTILO = og("estilo", "Estilo", true, 1, [["natural", "Natural (frío)"], ["empanizado", "Empanizado"], ["flamin_hot", "Flamin' Hot"]]);
const OMU_SALSA_BONELESS_PREMIUM = og("salsa", "Salsa", true, 1, [["chipotle", "Chipotle"], ["buffalo", "Búffalo"], ["ranch", "Ranch"]]);
const OMU_TAMANO_BONELESS = og("tamano", "Tamaño", true, 1, [
  ["individual", "Individual 300 gr"], ["pareja", "Pareja 600 gr", 74], ["familiar", "Familiar 1 kg", 174],
]);
const OMU_SALSA_BONELESS = og("salsa", "Salsa", true, 1, [
  ["bufalo", "Búfalo"], ["bbq", "BBQ"], ["fresa_chipotle", "Fresa chipotle"], ["buffalo_habanero", "Búffalo habanero"], ["pimienta_limon", "Pimienta limón"],
]);
const omuRollo = (n: number): OG[] => [
  og(`rollo${n}_ing`, `Rollo ${n} · ingrediente`, true, 1, PROTEINAS),
  og(`rollo${n}_pres`, `Rollo ${n} · presentación`, true, 1, [["natural", "Natural"], ["empanizado", "Empanizado"], ["flamin_hot", "Flamin' Hot"]]),
];
const OMU_ADEREZOS_BOX = og("aderezos_box", "Aderezos (van 6, elige cuáles)", true, 5, [
  ["chipotle", "Chipotle"], ["soya", "Soya"], ["salsa_anguila", "Salsa anguila"], ["ranch", "Ranch"], ["buffalo", "Búffalo"],
]);
const OMU_SALSAS_BOX = og("salsas_boneless", "Salsas del boneless", true, 2, [
  ["bufalo", "Búfalo"], ["bbq", "BBQ"], ["fresa_chipotle", "Fresa chipotle"], ["buffalo_habanero", "Búffalo habanero"], ["pimienta_limon", "Pimienta limón"],
]);

const OMU_SALSA_APARTE = og("salsa", "Salsa", true, 1, [
  ["bufalo", "Búfalo"], ["bbq", "BBQ"], ["fresa_chipotle", "Fresa chipotle"], ["buffalo_habanero", "Búffalo habanero"], ["pimienta_limon", "Pimienta limón"],
]);
const OMU_ADEREZO_APARTE = og("aderezo", "Aderezo", true, 1, [
  ["sriracha", "Sriracha"], ["chipotle", "Chipotle"], ["soya", "Soya"], ["anguila", "Anguila"], ["ranch", "Ranch", 5], ["pasta_tampico", "Pasta Tampico"],
]);

type OmuRow = [category: string, name: string, price: number, description: string, groups: OG[]];
const OMU_ROWS: OmuRow[] = [
  ["Ármalas a tu gusto", "Omu Ball", 95, "Elige 1 cubierta, 1 proteína, 2 aderezos y 2 vegetales.", [OMU_CUBIERTA_BALL, OMU_PROTEINA, OMU_ADEREZOS, OMU_VEGETALES, OMU_EXTRA]],
  ["Ármalas a tu gusto", "Omu Sushi", 105, "Elige 1 cubierta, 1 proteína, 2 aderezos y 2 vegetales.", [OMU_CUBIERTA_SUSHI, OMU_PROTEINA, OMU_ADEREZOS, OMU_VEGETALES, OMU_EXTRA]],

  ["Omu Premium", "Omu Queen", 119, "Natural, empanizado o Flamin' Hot con camarones y deliciosa salsa Tampico.", [OMU_BOLA_SUSHI, OMU_ESTILO, OMU_EXTRA]],
  ["Omu Premium", "Omu King", 119, "Natural, empanizado o Flamin' Hot con carne de res y deliciosa salsa Tampico.", [OMU_BOLA_SUSHI, OMU_ESTILO, OMU_EXTRA]],
  ["Omu Premium", "Omu Mar y Tierra", 129, "Natural, empanizado o Flamin' Hot con deliciosa carne de res y camarones.", [OMU_BOLA_SUSHI, OMU_ESTILO, OMU_EXTRA]],
  ["Omu Premium", "Omu Boneless", 119, "Bola empanizada con boneless bañados en salsa chipotle, búffalo o ranch.", [OMU_SALSA_BONELESS_PREMIUM, OMU_EXTRA]],
  ["Omu Premium", "Omu Veggie", 89, "Natural, empanizado o Flamin' Hot con aguacate, pepino, zanahoria y ajonjolí.", [OMU_BOLA_SUSHI, OMU_ESTILO, OMU_EXTRA]],
  ["Omu Premium", "Omu Bacon", 129, "Natural, empanizado o Flamin' Hot con tocino y deliciosa salsa Tampico.", [OMU_BOLA_SUSHI, OMU_ESTILO, OMU_EXTRA]],
  ["Omu Premium", "Omu Squid", 124, "Natural, empanizado o Flamin' Hot con delicioso calamar frito.", [OMU_BOLA_SUSHI, OMU_ESTILO, OMU_EXTRA]],
  ["Omu Premium", "Omu Salmón", 119, "Natural (frío) con rico salmón y ajonjolí.", [OMU_BOLA_SUSHI, OMU_ESTILO, OMU_EXTRA]],
  ["Omu Premium", "Omu Mango Especial", 119, "Natural (frío) con mango, camarón, ajonjolí y salsa fresa chipotle.", [OMU_BOLA_SUSHI, OMU_ESTILO, OMU_EXTRA]],
  ["Omu Premium", "Omu Doble Empanizado", 109, "Empanizado con camarones empanizados.", [OMU_BOLA_SUSHI, OMU_EXTRA]],
  ["Omu Premium", "Omu Atún Especial", 124, "Rellena de delicioso lomo de atún.", [OMU_BOLA_SUSHI, OMU_ESTILO, OMU_EXTRA]],
  ["Omu Premium", "Omu Frut", 114, "Natural (frío) cubierta con fruta de temporada, queso crema y fresa chipotle.", [OMU_BOLA_SUSHI, OMU_ESTILO, OMU_EXTRA]],

  ["Omu Boneless", "Omu Boneless", 135, "Todas las porciones incluyen papas y verduras. Escoge tu salsa: búfalo, BBQ, fresa chipotle, búffalo habanero o pimienta limón.", [OMU_TAMANO_BONELESS, OMU_SALSA_BONELESS]],

  ["Para compartir", "Omu Box Sushi & Boneless", 465, "3 rollos, cada uno con su ingrediente y su presentación (natural, empanizado o Flamin' Hot) + 500 gr de boneless con 1 o 2 salsas al gusto + 6 aderezos. Incluye papas y verduras.", [...omuRollo(1), ...omuRollo(2), ...omuRollo(3), OMU_SALSAS_BOX, OMU_ADEREZOS_BOX, OMU_EXTRA]],
  ["Para compartir", "Omu Box Sushi", 414, "5 rollos, cada uno con su ingrediente y su presentación (natural, empanizado o Flamin' Hot) + zanahoria y pepino + chipotle, soya y salsa anguila. Incluye papas y verduras.", [...omuRollo(1), ...omuRollo(2), ...omuRollo(3), ...omuRollo(4), ...omuRollo(5), OMU_EXTRA]],

  ["Refrescos", "Coca Cola 355 ml", 30, "", []],
  ["Refrescos", "Pepsi 400 ml", 30, "", []],
  ["Refrescos", "Mirinda 400 ml", 30, "", []],
  ["Refrescos", "Manzanita 400 ml", 30, "", []],

  ["Postres", "Rebanada de pay", 30, "", []],
  ["Postres", "Rebanada de pastel", 30, "", []],
  ["Postres", "Omu galleta", 20, "", []],

  ["Extras", "Salsa extra", 25, "Para acompañar: búffalo habanero, búfalo, BBQ, pimienta limón o fresa chipotle.", [OMU_SALSA_APARTE]],
  ["Extras", "Aderezo extra", 10, "Para acompañar: sriracha, chipotle, soya, anguila o pasta Tampico $10; ranch $15.", [OMU_ADEREZO_APARTE]],

];

const OMU: PielFixture = {
  id: "preview-omu",
  initial: {
    raw: {
      name: "Omu Balls & Sushi",
      description: "Bolas de arroz y sushi armados a tu gusto, boneless y boxes para compartir. Zona norte de Chihuahua.",
      menuSkin: "omu",
      address: "Calle Juana de Arco y Av. Colonias Populares (puesto rojo), Miguel Sigala, 31137 Chihuahua, Chih.",
      phone: "6143245009",
      whatsapp: "6143245009",
      categories: ["Sushi"],
      menuCategoryOrder: ["Ármalas a tu gusto", "Omu Premium", "Omu Boneless", "Para compartir", "Refrescos", "Postres", "Extras"],
      businessHours: {
        monday: day([14, 0], [22, 0]),
        tuesday: day([14, 0], [22, 0]),
        wednesday: day([14, 0], [22, 0]),
        thursday: day([14, 0], [22, 0]),
        friday: day([14, 0], [22, 0]),
        saturday: day([14, 0], [22, 0]),
        sunday: day([14, 0], [22, 0]),
      },
    },
    menu: OMU_ROWS.map(([category, name, price, description, groups], i) => ({
      id: `omu-${i + 1}`,
      data: {
        category,
        name,
        price,
        ...(description ? { description } : {}),
        isAvailable: true,
        ...(groups.length ? { optionGroups: groups } : {}),
      },
    })),
  },
};

/* ─────────────────────────── La Fresheria (15-sep-2026) ─────────────────────────── */
/** Espejo de FOODPASS scripts/seedFresheria.js: su PDF con los tamaños, fruta, coberturas, panes, toppings y extras
 *  como grupos. Precios REALES de su papel. */
const fo = (id: string, name: string, priceDelta = 0) => ({ id, name, priceDelta });
const fg = (id: string, name: string, required: boolean, max: number, options: OG["options"], min?: number): OG => ({ id, name, required, min: min ?? (required ? 1 : 0), max, options });
const frTam = (m: number, lt: number) => fg("tamano", "Tamaño", true, 1, [fo("ch", "Chico (CH)"), fo("m", "Mediano (M)", m), fo("lt", "Litro (LT)", lt)]);
const FR_FRUTA = (max = 4) => fg("fruta", "Fruta (una o varias)", true, max, [fo("fresa", "Fresa"), fo("platano", "Plátano"), fo("manzana", "Manzana"), fo("mango", "Mango", 15)]);
const FR_COB3 = fg("cobertura", "Cobertura", true, 1, [fo("chocolate", "Chocolate"), fo("caramelo", "Caramelo"), fo("lechera", "Lechera")]);
const FR_COB2 = fg("cobertura", "Cobertura", true, 1, [fo("chocolate", "Chocolate"), fo("caramelo", "Caramelo")]);
const FR_PANES = (max = 1, name = "Pan") => fg("pan", name, true, max, [fo("pinguino", "Pingüino"), fo("gansito", "Gansito"), fo("chocorrol", "Chocorrol")]);
const FR_TOP_OPTS = [fo("chispas", "Chispas de chocolate"), fo("cacahuate", "Cacahuate garapiñado"), fo("arandanos", "Arándanos"), fo("granola", "Granola"), fo("almendras", "Almendras"), fo("nuez", "Nuez"), fo("coco", "Coco rallado"), fo("oreo", "Galleta Oreo"), fo("chocoretas", "Chocoretas")];
const FR_TOP2 = fg("toppings", "Toppings (dos incluidos)", true, 2, FR_TOP_OPTS);
const FR_TOP1 = fg("toppings", "Topping (uno incluido)", true, 1, FR_TOP_OPTS);
const FR_TOP_EXTRA = fg("topping_extra", "Topping extra (+$5 c/u)", false, 4, FR_TOP_OPTS.map((o) => fo(o.id, o.name, 5)));
const FR_REB = fg("rebanada", "Rebanada", true, 1, [fo("tortuga", "Tortuga"), fo("limon", "Limón"), fo("queso", "Queso horneado")]);
const FR_SABOR = fg("sabor", "Sabor", true, 1, [fo("fresas_crema", "Fresas con crema"), fo("pistache", "Pistache"), fo("vainilla", "Vainilla"), fo("coco", "Coco"), fo("crema_chispas", "Crema con chispas"), fo("yogurt_zanahoria", "Yogurt con zanahoria"), fo("zarzamora", "Zarzamora"), fo("crema_galleta", "Crema con galleta")]);
const FR_EXTRAS = fg("extras", "Extras", false, 8, [fo("nieve", "Nieve", 15), fo("pay_costco", "Pay de Costco", 30), fo("pay_casero", "Pay casero", 25), fo("waffer", "Waffer", 5), fo("chocolate", "Chocolate", 5), fo("crema_pistache", "Crema de pistache", 15), fo("cereza", "Cereza", 5), fo("panecito", "Panecito Marinela", 10), fo("rafaello", "Rafaello", 15), fo("caramelo", "Caramelo", 5), fo("galleta_biscoff", "Galleta Biscoff", 5), fo("gomitas", "Gomitas enchiladas", 5), fo("serpentinas", "Serpentinas", 5), fo("banderilla", "Banderilla de chile", 10)]);
const FR_P = "Postres con crema";
const FR_ROWS: OmuRow[] = [
  ...(["Oreo", 70, "Moka", 70, "Café", 75, "Fresa (dulce)", 80, "Mango (dulce)", 80, "Chili mango", 90, "Chili fresa", 90, "Pingüino", 80, "Gansito", 80, "Chocorrol", 80, "Lotus", 95, "Nutella", 80, "Rafaello", 95] as (string | number)[])
    .reduce<OmuRow[]>((acc, v, i, arr) => (i % 2 === 0 ? [...acc, ["Frappés", `Frappé ${v}`, arr[i + 1] as number, "", []]] : acc), []),
  ["Malteadas", "Malteada", 80, "Pregunta los sabores de nieve disponibles para tu malteada.", []],
  ["FreshePops", "FreshePop", 45, "Paleta de crema bañada en chocolate y espolvoreada en tu topping favorito.", [FR_SABOR, FR_TOP1, FR_TOP_EXTRA]],
  ["Nieves", "Nieve sencilla", 55, "Incluye 1 panecito Marinela, 1 sabor de nieve, 1 topping y 1 waffer. Pregunta por los sabores de nieve disponibles.", [FR_COB2, FR_PANES(), FR_TOP1, FR_TOP_EXTRA]],
  ["Nieves", "Nieve especial", 70, "Incluye 1 panecito Marinela, 2 sabores de nieve, 1 topping y 1 waffer. Pregunta por los sabores de nieve disponibles.", [FR_COB2, FR_PANES(), FR_TOP1, FR_TOP_EXTRA]],
  ["Enchilados", "Fresas enchiladas", 75, "Fresas con chamoy, tico y Tajín, acompañadas de churros lokos, gomitas, serpentina y banderilla de chile.", [frTam(20, 110), FR_EXTRAS]],
  ["Enchilados", "Mango enchilado", 80, "Mango con chamoy, tico y Tajín, acompañado de churros lokos, gomitas, serpentina y banderilla de chile.", [frTam(20, 115), FR_EXTRAS]],
  ["Rebanadas", "Rebanada", 65, "Tortuga, limón o queso horneado.", [FR_REB]],
  ["Rebanadas", "Rebanada preparada", 110, "2 frutas a elección, 1 rebanada a elección, 2 toppings, chocolate o caramelo (solo 1) y 2 waffers.", [FR_FRUTA(2), FR_REB, FR_TOP2, FR_COB2, FR_EXTRAS, FR_TOP_EXTRA]],
  [FR_P, "Freshoncho", 165, "Tu bebida favorita, frutas a elegir con crema, una cobertura, dos toppings, una rebanada a elegir y waffer de chocolate.", [FR_FRUTA(), FR_COB3, FR_TOP2, FR_REB, FR_EXTRAS, FR_TOP_EXTRA]],
  [FR_P, "Sencillas", 60, "Tus frutas favoritas con crema, una cobertura, dos toppings y un waffer de chocolate.", [frTam(20, 95), FR_FRUTA(), FR_COB3, FR_TOP2, FR_EXTRAS, FR_TOP_EXTRA]],
  [FR_P, "Fresheras", 65, "Tus frutas favoritas con crema, una cobertura, dos toppings, panecito Marinela y un waffer de chocolate.", [frTam(20, 100), FR_FRUTA(), FR_COB3, FR_PANES(), FR_TOP2, FR_EXTRAS, FR_TOP_EXTRA]],
  [FR_P, "Hersheys", 70, "Tus frutas favoritas con crema, una cobertura de chocolate Hersheys, dos toppings, pan Hersheys y un waffer de chocolate.", [frTam(20, 105), FR_FRUTA(), FR_TOP2, FR_EXTRAS, FR_TOP_EXTRA]],
  [FR_P, "De nieve", 75, "Tus frutas favoritas con crema, una cobertura, dos toppings, una bola de nieve y un waffer de chocolate. Pregunta por los sabores de nieve disponibles.", [frTam(20, 110), FR_FRUTA(), FR_COB3, FR_TOP2, FR_EXTRAS, FR_TOP_EXTRA]],
  [FR_P, "Lotus Biscoff", 85, "Tus frutas favoritas con crema, cobertura de crema Biscoff, galleta Biscoff al centro y arriba y una galleta entera con más crema.", [frTam(25, 130), FR_FRUTA(), FR_EXTRAS]],
  [FR_P, "Chocolatadas", 75, "Tus frutas favoritas con crema, una cobertura de chocolate alrededor, al centro y arriba, dos toppings y un waffer de chocolate.", [frTam(20, 110), FR_FRUTA(), FR_TOP2, FR_EXTRAS, FR_TOP_EXTRA]],
  [FR_P, "Rafaello", 85, "Tus frutas favoritas con crema, cobertura de crema Rafaello alrededor, al centro y arriba, con almendra, coco y un chocolate Rafaello arriba.", [frTam(50, 180), FR_FRUTA(), FR_EXTRAS]],
  [FR_P, "Dubai", 85, "Tus frutas favoritas con crema de pistache, una cobertura de chocolate alrededor, al centro y arriba, con crema de pistache, cataifi y una cereza arriba.", [frTam(40, 160), FR_FRUTA(), FR_EXTRAS]],
  [FR_P, "De Costco", 80, "Tus frutas favoritas con crema, una cobertura, dos toppings, una rebanada a elegir y waffer de chocolate.", [frTam(25, 125), FR_FRUTA(), FR_COB3, FR_TOP2, FR_REB, FR_EXTRAS, FR_TOP_EXTRA]],
  [FR_P, "De queso horneado", 80, "Tus frutas favoritas con crema de pistache, una cobertura, dos toppings, pay de queso horneado y waffer de chocolate.", [frTam(20, 115), FR_FRUTA(), FR_COB3, FR_TOP2, FR_EXTRAS, FR_TOP_EXTRA]],
  [FR_P, "Mega", 115, "Tus frutas favoritas con crema, una cobertura, dos toppings, panecito Marinela (1 pan en mediano, 2 en litro), una rebanada a elegir y waffer de chocolate.", [fg("tamano", "Tamaño", true, 1, [fo("m", "Mediano (M) · 1 pan"), fo("lt", "Litro (LT) · 2 panes", 110)]), FR_FRUTA(), FR_COB3, FR_TOP2, FR_PANES(2, "Panes (1 en mediano, 2 en litro)"), FR_REB, FR_EXTRAS, FR_TOP_EXTRA]],
];

const FRESHERIA: PielFixture = {
  id: "preview-fresheria",
  initial: {
    raw: {
      name: "La Fresheria",
      tagline: "postres y snacks",
      description: "Fresas con crema, postres y snacks en la colonia Saucito, Chihuahua.",
      menuSkin: "fresheria",
      address: "Calle Vicente Leñero 6323, Col. Saucito, Chihuahua, Chih.",
      phone: "6148287886",
      whatsapp: "6148287886",
      categories: ["Postres"],
      menuCategoryOrder: ["Frappés", "Malteadas", "FreshePops", "Nieves", "Enchilados", "Rebanadas", FR_P],
      businessHours: {
        monday: { isClosed: true },
        tuesday: day([16, 0], [21, 0]),
        wednesday: day([16, 0], [21, 0]),
        thursday: day([16, 0], [21, 0]),
        friday: day([16, 0], [22, 0]),
        saturday: day([16, 0], [22, 0]),
        sunday: day([16, 0], [22, 0]),
      },
    },
    menu: FR_ROWS.map(([category, name, price, description, groups], i) => ({
      id: `fr-${i + 1}`,
      data: { category, name, price, ...(description ? { description } : {}), isAvailable: true, ...(groups.length ? { optionGroups: groups } : {}) },
    })),
  },
};

const FIXTURES: Record<string, PielFixture> = { negroblanco: NEGRO_BLANCO, omu: OMU, fresheria: FRESHERIA };

export function pielFixture(skin: string): PielFixture | null {
  return FIXTURES[skin] ?? null;
}
