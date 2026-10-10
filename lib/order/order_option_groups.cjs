'use strict';
/**
 * Opciones de un platillo ("Elige tu tamaño", "Extras") leídas en el servidor
 * (10-oct-2026). Las usa order_pricing.js para cobrar el sobreprecio de lo que
 * el comensal eligió.
 *
 * Espejo de lib/menu/optionGroups.ts (web) y lib/menu/option_groups.dart (app):
 * lo guardado manda; si no hay, se lee la descripción. El candado de la web
 * (`npm run test:order-pricing`) compara este lector contra el de TypeScript
 * con las mismas descripciones.
 *
 * VIVE DOS VECES, IDÉNTICO y con el mismo nombre:
 *   FOODPASS/functions/order_option_groups.cjs
 *   foodpass-legal/lib/order/order_option_groups.cjs
 */

function toNumber(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : NaN;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : NaN;
  }
  return NaN;
}

function slug(s) {
  return String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

function splitOption(raw) {
  const PRICE_RE = /\+\s*\$?\s*(\d+(?:\.\d{1,2})?)/g;
  let name = String(raw).trim();
  let delta = 0;
  let last = null;
  let m;
  while ((m = PRICE_RE.exec(name)) !== null) last = m;
  if (last) {
    delta = parseFloat(last[1]);
    name = (name.slice(0, last.index) + name.slice(last.index + last[0].length)).trim();
  }
  name = name.replace(/\s{2,}/g, ' ').replace(/[.,;:]+$/, '').trim();
  return {name, delta};
}

function parseOptionGroupsFromDescription(description) {
  if (!description || typeof description !== 'string') return [];
  const groups = [];
  const RE =
    /(?:(elige|escoge|selecciona)\s+(?:tu|tus|su|el|la|los|las)?\s*([^:.]{2,40}?)|(si\s+la\s+quieres\s+de|si\s+lo\s+quieres\s+de|opcional(?:es)?|agrega|a[nñ]ade|extras?))\s*:\s*((?:[^.]|\.(?=\d))+)(?:\.|$)/gi;
  let m;
  while ((m = RE.exec(description)) !== null) {
    const esEleccion = Boolean(m[1]);
    const rawName = esEleccion ? (m[2] || '').trim() : (m[3] || 'Extras').trim();
    const rawList = (m[4] || '').trim();
    if (!rawList) continue;

    const options = rawList
      .split(/,(?![^(]*\))/)
      .map(splitOption)
      .filter((o) => o.name.length > 0 && o.name.length <= 60);
    if (options.length < 2) continue;

    const conPrecio = options.some((o) => o.delta > 0);
    let name = esEleccion ? rawName : conPrecio ? 'Extras' : rawName;
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
      options: options.map((o) => ({id: slug(o.name), name: o.name, priceDelta: o.delta})),
    });
  }
  return groups;
}

function savedOptionGroups(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const g of raw) {
    if (!g || typeof g !== 'object' || typeof g.name !== 'string' || !Array.isArray(g.options)) continue;
    const options = [];
    for (const o of g.options) {
      if (!o || typeof o !== 'object' || typeof o.name !== 'string') continue;
      const delta = toNumber(o.priceDelta);
      options.push({
        id: typeof o.id === 'string' ? o.id : '',
        name: o.name,
        priceDelta: Number.isFinite(delta) ? delta : 0,
        ...(o.available === false ? {available: false} : {}),
      });
    }
    const max = toNumber(g.max);
    out.push({
      id: typeof g.id === 'string' ? g.id : '',
      name: g.name,
      required: g.required === true,
      min: Number.isFinite(toNumber(g.min)) ? toNumber(g.min) : 0,
      max: Number.isFinite(max) && max >= 1 ? Math.floor(max) : 1,
      options,
    });
  }
  return out;
}

/** Lo guardado manda; si no hay, la descripción. */
function resolveOptionGroups(menuItem) {
  const saved = savedOptionGroups(menuItem && menuItem.optionGroups);
  if (saved.length > 0) return saved;
  return parseOptionGroupsFromDescription(menuItem && menuItem.description);
}

module.exports = {toNumber, resolveOptionGroups, parseOptionGroupsFromDescription};
