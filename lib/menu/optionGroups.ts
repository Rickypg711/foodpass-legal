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
  /**
   * `false` = "agotado hoy": se ve tachada y no se puede elegir. Ausente = disponible
   * (los menús ya guardados no traen el campo). Lo prende y apaga el dueño desde la
   * Caja (web y app) sin borrar la opción: un puesto se queda sin una carne a media
   * noche y mañana la vuelve a tener. Nació el 9-sep-2026 con Tacos de Suadero La
   * Familia, que se quedó sin asada y la única salida era borrarla del selector.
   */
  available?: boolean;
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
    let name = esEleccion ? rawName : conPrecio ? "Extras" : rawName;
    // Un grupo con sobreprecio es OPCIONAL (son extras: "Camarón +$25" no se
    // le puede exigir a nadie). Uno de elección sin costo es OBLIGATORIO (la
    // cocina necesita saber qué salsa).
    //
    // EXCEPCIÓN — el TAMAÑO. Es la única elección que es obligatoria Y cuesta:
    // una pizza sin tamaño no es un pedido. Sin esta línea, "Elige tu tamaño:
    // Personal, Grande +$90" quedaba opcional y se podía mandar a la cocina
    // una pizza sin decir de cuál. Luzz Pizza tiene 4 pizzas capturadas como
    // 8 platillos justo porque no había forma de expresar esto.
    const esTamano = /^(tama[nñ]o|talla|porci[oó]n|size)s?$/i.test(name.trim());
    const obligatorio = esEleccion && (!conPrecio || esTamano);

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

/** ¿Se puede elegir hoy? Ausente = sí (los menús viejos no traen el campo). */
export function isOptionAvailable(o: { available?: boolean }): boolean {
  return o.available !== false;
}

/** Un grupo OBLIGATORIO sin ninguna opción disponible bloquea el platillo ("Sin carne hoy"). */
export function groupHasAvailableOption(g: MenuItemOptionGroup): boolean {
  return g.options.some(isOptionAvailable);
}

/**
 * Prende o apaga una opción ("agotado hoy") sin tocar nada más. Pura: devuelve
 * grupos nuevos. Al prender se QUITA el campo (ausente = disponible) para que el
 * documento quede como lo escribe el editor.
 */
export function setOptionAvailability(
  groups: MenuItemOptionGroup[],
  groupId: string,
  optionId: string,
  available: boolean,
): MenuItemOptionGroup[] {
  return groups.map((g) => {
    if (g.id !== groupId) return g;
    return {
      ...g,
      options: g.options.map((o) => {
        if (o.id !== optionId) return o;
        if (!available) return { ...o, available: false };
        const { available: _omit, ...rest } = o;
        void _omit;
        return rest;
      }),
    };
  });
}

/**
 * "Agotado hoy" en TODO el menú de un jalón: cada platillo que trae la misma opción
 * (mismo grupo y misma opción, por id) se apaga o se prende junto. Pura: recibe los
 * grupos ya resueltos de cada platillo y devuelve SOLO los que cambian, con sus grupos
 * nuevos. Nació el 10-sep-2026: La Familia tiene "Bistec (carne asada)" en 6 platillos
 * y marcarla agotada platillo por platillo eran 6 vueltas a media venta.
 */
export function applyOptionAvailabilityToMenu(
  items: { id: string; groups: MenuItemOptionGroup[] }[],
  groupId: string,
  optionId: string,
  available: boolean,
): { id: string; groups: MenuItemOptionGroup[] }[] {
  const changed: { id: string; groups: MenuItemOptionGroup[] }[] = [];
  for (const item of items) {
    const opt = item.groups.find((g) => g.id === groupId)?.options.find((o) => o.id === optionId);
    if (!opt || isOptionAvailable(opt) === available) continue;
    changed.push({ id: item.id, groups: setOptionAvailability(item.groups, groupId, optionId, available) });
  }
  return changed;
}

export type OptionAvailabilityChange = { groupId: string; optionId: string; available: boolean };

/**
 * Qué casillas "Agotado" cambió el dueño en el editor de un platillo: solo opciones que
 * YA existían (mismo grupo y misma opción, por id) y cuyo agotado cambió. Una opción
 * nueva o renombrada no cuenta: no hay de dónde saber si es la misma de otro platillo.
 */
export function optionAvailabilityChanges(
  before: MenuItemOptionGroup[],
  after: MenuItemOptionGroup[],
): OptionAvailabilityChange[] {
  const out: OptionAvailabilityChange[] = [];
  for (const g of after) {
    const prevGroup = before.find((x) => x.id === g.id);
    if (!prevGroup) continue;
    for (const o of g.options) {
      const prev = prevGroup.options.find((x) => x.id === o.id);
      if (!prev || isOptionAvailable(prev) === isOptionAvailable(o)) continue;
      out.push({ groupId: g.id, optionId: o.id, available: isOptionAvailable(o) });
    }
  }
  return out;
}

/**
 * Varias casillas de un jalón (el editor guarda todo junto): aplica cada cambio sobre el
 * resultado del anterior y devuelve cada platillo tocado UNA vez, con sus grupos finales.
 */
export function applyOptionAvailabilityChangesToMenu(
  items: { id: string; groups: MenuItemOptionGroup[] }[],
  changes: OptionAvailabilityChange[],
): { id: string; groups: MenuItemOptionGroup[] }[] {
  const current = new Map(items.map((i) => [i.id, i.groups]));
  const touched = new Set<string>();
  for (const c of changes) {
    const snapshot = [...current].map(([id, groups]) => ({ id, groups }));
    for (const ch of applyOptionAvailabilityToMenu(snapshot, c.groupId, c.optionId, c.available)) {
      current.set(ch.id, ch.groups);
      touched.add(ch.id);
    }
  }
  return [...touched].map((id) => ({ id, groups: current.get(id)! }));
}
