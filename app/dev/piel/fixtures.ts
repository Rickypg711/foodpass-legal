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
const OMU_EXTRA = og("ingrediente_extra", "Ingrediente extra", false, 3, [
  ["pollo", "Pollo", 25], ["res", "Res", 25], ["tocino", "Tocino", 25], ["camaron", "Camarón", 25], ["cangrejo", "Cangrejo", 25],
  ["pastor", "Pastor", 25], ["cebolla_dulce", "Cebolla dulce", 25], ["ostion_ahumado", "Ostión ahumado", 25],
]);
const OMU_BOLA_SUSHI = og("presentacion", "Presentación", true, 1, [["bola", "Bola"], ["sushi", "Sushi"]]);
const OMU_EMP_FH = og("estilo", "Estilo", true, 1, [["empanizado", "Empanizado"], ["flamin_hot", "Flamin' Hot"]]);
const OMU_EMP_FH_NAT = og("estilo", "Estilo", true, 1, [["empanizado", "Empanizado"], ["flamin_hot", "Flamin' Hot"], ["natural", "Natural (frío)"]]);
const OMU_SALSA_BONELESS_PREMIUM = og("salsa", "Salsa", true, 1, [["chipotle", "Chipotle"], ["buffalo", "Búffalo"], ["ranch", "Ranch"]]);
const OMU_TAMANO_BONELESS = og("tamano", "Tamaño", true, 1, [
  ["individual", "Individual 300 gr"], ["pareja", "Pareja 600 gr", 74], ["familiar", "Familiar 1 kg", 174],
]);
const OMU_SALSA_BONELESS = og("salsa", "Salsa", true, 1, [
  ["bufalo", "Búfalo"], ["bbq", "BBQ"], ["fresa_chipotle", "Fresa chipotle"], ["buffalo_habanero", "Búffalo habanero"], ["pimienta_limon", "Pimienta limón"],
]);
const OMU_ROLLOS_PRES = og("presentacion_rollos", "Presentación de los rollos", true, 1, [
  ["naturales", "Naturales"], ["empanizados", "Empanizados"],
]);
const OMU_ROLLOS_ING = og("ingrediente_rollos", "Ingrediente de los rollos", true, 1, PROTEINAS);
const OMU_SALSAS_BOX = og("salsas_boneless", "Salsas del boneless", true, 2, [
  ["bufalo", "Búfalo"], ["bbq", "BBQ"], ["fresa_chipotle", "Fresa chipotle"], ["buffalo_habanero", "Búffalo habanero"], ["pimienta_limon", "Pimienta limón"],
]);
const OMU_EXTRA_CUAL = og("cual", "Cuál", true, 1, [
  ["pollo", "Pollo"], ["res", "Res"], ["tocino", "Tocino"], ["camaron", "Camarón"], ["cangrejo", "Cangrejo"], ["pastor", "Pastor"],
  ["cebolla_dulce", "Cebolla dulce"], ["ostion_ahumado", "Ostión ahumado"],
  ["salsa_buffalo_habanero", "Salsa búffalo habanero"], ["salsa_bufalo", "Salsa búfalo"], ["salsa_bbq", "Salsa BBQ"],
  ["salsa_pimienta_limon", "Salsa pimienta limón"], ["salsa_fresa_chipotle", "Salsa fresa chipotle"],
  ["aderezo_sriracha", "Aderezo sriracha"], ["aderezo_chipotle", "Aderezo chipotle"], ["aderezo_soya", "Aderezo soya"],
  ["aderezo_anguila", "Aderezo anguila"], ["aderezo_ranch", "Aderezo ranch"], ["aderezo_pasta_tampico", "Aderezo pasta Tampico"],
]);

type OmuRow = [category: string, name: string, price: number, description: string, groups: OG[]];
const OMU_ROWS: OmuRow[] = [
  ["Ármalas a tu gusto", "Omu Ball", 95, "Elige 1 cubierta, 1 proteína, 2 aderezos y 2 vegetales.", [OMU_CUBIERTA_BALL, OMU_PROTEINA, OMU_ADEREZOS, OMU_VEGETALES, OMU_EXTRA]],
  ["Ármalas a tu gusto", "Omu Sushi", 105, "Elige 1 cubierta, 1 proteína, 2 aderezos y 2 vegetales.", [OMU_CUBIERTA_SUSHI, OMU_PROTEINA, OMU_ADEREZOS, OMU_VEGETALES, OMU_EXTRA]],

  ["Omu Premium", "Omu Queen", 119, "Empanizado o Flamin' Hot con camarones y deliciosa salsa Tampico.", [OMU_BOLA_SUSHI, OMU_EMP_FH, OMU_EXTRA]],
  ["Omu Premium", "Omu King", 119, "Empanizado o Flamin' Hot con carne de res y deliciosa salsa Tampico.", [OMU_BOLA_SUSHI, OMU_EMP_FH, OMU_EXTRA]],
  ["Omu Premium", "Omu Mar y Tierra", 129, "Empanizado o Flamin' Hot con deliciosa carne de res y camarones.", [OMU_BOLA_SUSHI, OMU_EMP_FH, OMU_EXTRA]],
  ["Omu Premium", "Omu Boneless", 119, "Bola empanizada con boneless bañados en salsa chipotle, búffalo o ranch.", [OMU_SALSA_BONELESS_PREMIUM, OMU_EXTRA]],
  ["Omu Premium", "Omu Veggie", 89, "Empanizado o Flamin' Hot con aguacate, pepino, zanahoria y ajonjolí.", [OMU_BOLA_SUSHI, OMU_EMP_FH, OMU_EXTRA]],
  ["Omu Premium", "Omu Bacon", 129, "Empanizado o Flamin' Hot con tocino y deliciosa salsa Tampico.", [OMU_BOLA_SUSHI, OMU_EMP_FH, OMU_EXTRA]],
  ["Omu Premium", "Omu Squid", 124, "Empanizado, Flamin' Hot o natural (frío) con delicioso calamar frito.", [OMU_BOLA_SUSHI, OMU_EMP_FH_NAT, OMU_EXTRA]],
  ["Omu Premium", "Omu Salmón", 119, "Natural (frío) con rico salmón y ajonjolí.", [OMU_BOLA_SUSHI, OMU_EXTRA]],
  ["Omu Premium", "Omu Mango Especial", 119, "Natural (frío) con mango, camarón, ajonjolí y salsa fresa chipotle.", [OMU_BOLA_SUSHI, OMU_EXTRA]],
  ["Omu Premium", "Omu Doble Empanizado", 109, "Empanizado con camarones empanizados.", [OMU_BOLA_SUSHI, OMU_EXTRA]],
  ["Omu Premium", "Omu Atún Especial", 124, "Rellena de delicioso lomo de atún.", [OMU_BOLA_SUSHI, OMU_EXTRA]],
  ["Omu Premium", "Omu Frut", 114, "Natural (frío) cubierta con fruta de temporada, queso crema y fresa chipotle.", [OMU_BOLA_SUSHI, OMU_EXTRA]],

  ["Omu Boneless", "Omu Boneless", 135, "Todas las porciones incluyen papas y verduras. Escoge tu salsa: búfalo, BBQ, fresa chipotle, búffalo habanero o pimienta limón.", [OMU_TAMANO_BONELESS, OMU_SALSA_BONELESS]],

  ["Para compartir", "Omu Box Sushi & Boneless", 465, "3 rollos de cualquier presentación con 1 ingrediente a elegir + 500 gr de boneless de 1 a 2 salsas al gusto + 6 aderezos. Incluye papas y verduras.", [OMU_ROLLOS_PRES, OMU_ROLLOS_ING, OMU_SALSAS_BOX]],
  ["Para compartir", "Omu Box Sushi", 414, "5 rollos de 1 ingrediente, naturales o empanizados + zanahoria y pepino + chipotle, soya y salsa anguila. Incluye papas y verduras.", [OMU_ROLLOS_PRES, OMU_ROLLOS_ING]],

  ["Refrescos", "Coca Cola 355 ml", 30, "", []],
  ["Refrescos", "Pepsi 400 ml", 30, "", []],
  ["Refrescos", "Mirinda 400 ml", 30, "", []],
  ["Refrescos", "Manzanita 400 ml", 30, "", []],

  ["Postres", "Rebanada de pay", 30, "", []],
  ["Postres", "Rebanada de pastel", 30, "", []],
  ["Postres", "Omu galleta", 20, "", []],

  ["Extras", "Ingrediente extra", 25, "Proteína, salsa o aderezo extra para tu Omu.", [OMU_EXTRA_CUAL]],
];

const OMU: PielFixture = {
  id: "preview-omu",
  initial: {
    raw: {
      name: "Omu Balls & Sushi",
      tagline: "El favorito de los Omu Lovers",
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

const FIXTURES: Record<string, PielFixture> = { negroblanco: NEGRO_BLANCO, omu: OMU };

export function pielFixture(skin: string): PielFixture | null {
  return FIXTURES[skin] ?? null;
}
