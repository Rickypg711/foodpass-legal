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

const FIXTURES: Record<string, PielFixture> = { negroblanco: NEGRO_BLANCO };

export function pielFixture(skin: string): PielFixture | null {
  return FIXTURES[skin] ?? null;
}
