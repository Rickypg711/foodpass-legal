/**
 * Grupos de opciones de un platillo ("Elige tu salsa", "Agrega extras").
 *
 * POR QUÉ EXISTE: los menús reales traen elecciones — salsa, aderezo, término,
 * tortilla. Antes vivían como TEXTO dentro de la descripción, así que el pedido
 * llegaba a la cocina sin ellas y alguien tenía que hablarle al cliente. El
 * pedido ya reservaba `selectedModifiers` y la pantalla de Pedidos ya los
 * pintaba: lo que faltaba era de dónde sacarlos y cómo capturarlos.
 */

export type MenuItemOption = {
  id: string;
  name: string;
  /** Sobreprecio en pesos. 0 = sin costo (salsas, término). */
  priceDelta: number;
};

export type MenuItemOptionGroup = {
  id: string;
  name: string;
  /** Si es obligatorio, no se puede agregar al carrito sin elegir. */
  required: boolean;
  /** Mínimo y máximo de opciones seleccionables. max=1 → "elige uno". */
  min: number;
  max: number;
  options: MenuItemOption[];
};

function slug(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

/** Precio explícito dentro del texto de una opción: "+$25", "+ 25". */
const PRICE_RE = /\+\s*\$?\s*(\d+(?:\.\d{1,2})?)/g;

/**
 * Parte "Res + Camarón +$35" en { name: "Res + Camarón", delta: 35 }.
 * Toma el ÚLTIMO "+NN" para no confundirse con los "+" del propio nombre.
 * Si no hay precio escrito, delta = 0. Nunca se adivina un precio.
 */
function splitOption(raw: string): { name: string; delta: number } {
  let name = raw.trim();
  let delta = 0;
  let last: RegExpExecArray | null = null;
  let m: RegExpExecArray | null;
  PRICE_RE.lastIndex = 0;
  while ((m = PRICE_RE.exec(name)) !== null) last = m;
  if (last) {
    delta = parseFloat(last[1]!);
    name = (name.slice(0, last.index) + name.slice(last.index + last[0].length)).trim();
  }
  name = name.replace(/\s{2,}/g, " ").replace(/[.,;:]+$/, "").trim();
  return { name, delta };
}

/**
 * Saca grupos de opciones del texto de la descripción.
 *
 * Reconoce dos formas que los menús reales ya usan:
 *   "Elige tu salsa: A, B, C."          → obligatorio, sin costo
 *   "Opcional: X +$25, Y +$35."         → opcional, con sobreprecio
 *
 * El encabezado de los extras se escribe de varias maneras según quién
 * capturó el menú ("Opcional:", "Si la quieres de:", "Agrega:", "Extras:"),
 * así que la lista de encabezados es amplia a propósito: el menú de
 * Sushin-Gón dice "Opcional:" y con solo "Si la quieres de" no se detectaba.
 *
 * NO toca "Acompañada de: ..." porque eso es lo que YA viene incluido.
 * Los precios solo salen de un "+$NN" ESCRITO en el menú — nunca se infieren.
 *
 * Es un puente, no el destino: si el platillo trae `optionGroups` guardados,
 * esos mandan. Sirve para que los menús ya importados funcionen sin rehacerlos.
 */
export function parseOptionGroupsFromDescription(
  description: string | null | undefined,
): MenuItemOptionGroup[] {
  if (!description) return [];
  const groups: MenuItemOptionGroup[] = [];
  // El punto final es opcional (hay descripciones que no lo traen) y un punto
  // seguido de dígito NO cierra la lista, para no partir un "+$25.50".
  const RE =
    /(?:(elige|escoge|selecciona)\s+(?:tu|tus|su|el|la|los|las)?\s*([^:.]{2,40}?)|(si\s+la\s+quieres\s+de|si\s+lo\s+quieres\s+de|opcional(?:es)?|agrega|a[nñ]ade|extras?))\s*:\s*((?:[^.]|\.(?=\d))+)(?:\.|$)/gi;

  let m: RegExpExecArray | null;
  while ((m = RE.exec(description)) !== null) {
    const esEleccion = Boolean(m[1]);
    const rawName = esEleccion ? (m[2] ?? "").trim() : (m[3] ?? "Extras").trim();
    const rawList = (m[4] ?? "").trim();
    if (!rawList) continue;

    const options = rawList
      .split(/,(?![^(]*\))/)
      .map(splitOption)
      .filter((o) => o.name.length > 0 && o.name.length <= 60);
    if (options.length < 2) continue;

    const conPrecio = options.some((o) => o.delta > 0);
    // Un grupo con sobreprecio es OPCIONAL (son extras). Uno de elección
    // sin costo es OBLIGATORIO (la cocina necesita saber qué salsa).
    const obligatorio = esEleccion && !conPrecio;

    let name = esEleccion ? rawName : conPrecio ? "Extras" : rawName;
    name = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
    const gid = slug(name) || `grupo-${groups.length + 1}`;
    if (groups.some((g) => g.id === gid)) continue;

    groups.push({
      id: gid,
      name,
      required: obligatorio,
      min: obligatorio ? 1 : 0,
      max: 1,
      options: options.map((o) => ({ id: slug(o.name), name: o.name, priceDelta: o.delta })),
    });
  }
  return groups;
}

/** Los grupos guardados mandan; si no hay, se parsea la descripción. */
export function resolveOptionGroups(item: {
  optionGroups?: MenuItemOptionGroup[] | null;
  description?: string | null;
}): MenuItemOptionGroup[] {
  if (item.optionGroups && item.optionGroups.length > 0) return item.optionGroups;
  return parseOptionGroupsFromDescription(item.description);
}
