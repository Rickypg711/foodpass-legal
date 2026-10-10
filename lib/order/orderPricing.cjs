'use strict';
/**
 * El precio de un pedido del comensal lo pone el servidor (10-oct-2026).
 *
 * POR QUÉ EXISTE: `items[].price` y `total` los escribía el teléfono. La ruta
 * que arma la preferencia de Mercado Pago cobraba lo que dijera el pedido y el
 * webhook comparaba el pago contra ese mismo `total`. Alguien podía pagar $1
 * por $300 de comida y quedar "pagado" (docs/PRECIO_EN_SERVIDOR_10_OCT.md).
 *
 * La regla, una sola para app y web:
 *   precio de la línea = precio del platillo en el menú del local
 *                        + sobreprecio de cada opción elegida
 *   total              = suma de líneas + envío que el dueño puso en Configuración
 * Nada de lo que manda el teléfono entra a la cuenta: ni precios, ni envío, ni
 * descuentos, ni comisión. Del pedido solo se lee QUÉ pidió y CUÁNTOS.
 *
 * Matemática pura: sin Firebase y sin reloj. Quien la llama trae el menú y el
 * local, y decide qué escribir.
 *
 * ESTE ARCHIVO VIVE DOS VECES, IDÉNTICO:
 *   FOODPASS/functions/order_pricing.js          (webhook y pedidos al recoger)
 *   foodpass-legal/lib/order/orderPricing.cjs    (create-preference)
 * junto con order_option_groups.cjs (las opciones del platillo). El candado
 * `npm run test:order-pricing` de la web truena si difieren en un solo
 * carácter. Se cambia aquí y se copia allá el mismo día.
 */

// Mismo nombre y extensión en los dos repos, para que este archivo sea idéntico.
// (La línea de eslint es para la web, que no deja usar require en otros archivos.)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const {toNumber, resolveOptionGroups, parseOptionGroupsFromDescription} = require('./order_option_groups.cjs');

const PRICING_VERSION = 1;
/** Mismo tope que firestore.rules (`items.size() <= 200`). */
const MAX_LINES = 200;
/** Un pedido grande de fiesta cabe; un número absurdo no. */
const MAX_QTY_PER_LINE = 500;
/** Un centavo: lo que se mueve al redondear. */
const TOLERANCE_CENTS = 1;

const CUSTOMER_ORDER_SOURCES = ['customer_app', 'customer_web'];

/** Razones por las que NO se puede poner precio (no hay total del servidor). */
const BLOCKING_REASONS = [
  'no_items',
  'too_many_items',
  'bad_item',
  'unknown_item',
  'bad_quantity',
  'bad_menu_price',
  'unknown_option',
];

/**
 * Tiene precio, pero hoy no se puede vender así: platillo apagado, opción
 * agotada, o a domicilio en un local que no entrega. En línea no se cobra; al
 * recoger el dueño lo ve con su precio y decide.
 */
const UNAVAILABLE_REASONS = ['item_unavailable', 'option_unavailable', 'delivery_not_offered'];

function toCents(v) {
  const n = toNumber(v);
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
}

function fromCents(c) {
  return c / 100;
}

function isCustomerOrder(order) {
  return Boolean(order) && CUSTOMER_ORDER_SOURCES.includes(String(order.orderSource || ''));
}

/** La moneda es la del local. Los locales viejos no traen el campo: son de México. */
function currencyOf(restaurant) {
  const raw = restaurant && typeof restaurant.currencyCode === 'string' ? restaurant.currencyCode.trim().toUpperCase() : '';
  return /^[A-Z]{3}$/.test(raw) ? raw : 'MXN';
}

const sameName = (a, b) => String(a).trim().toLowerCase() === String(b).trim().toLowerCase();

/**
 * Sobreprecio (en centavos) de lo que el pedido dice que eligió, contra las
 * opciones del platillo en el menú. Lo elegido viaja por NOMBRE
 * (`selectedModifiers: [{modifierName, selectedOptions: [nombres]}]`), igual
 * en app y web.
 */
function optionsDeltaCents(line, groups) {
  const reasons = [];
  let cents = 0;
  const selected = Array.isArray(line.selectedModifiers) ? line.selectedModifiers : [];
  const chosenGroups = new Set();

  for (const sel of selected) {
    if (!sel || typeof sel !== 'object') {
      reasons.push('unknown_option');
      continue;
    }
    const picks = Array.isArray(sel.selectedOptions) ? sel.selectedOptions : [];
    if (picks.length === 0) continue;
    const group = groups.find((g) => sameName(g.name, sel.modifierName));
    if (!group) {
      reasons.push('unknown_option');
      continue;
    }
    chosenGroups.add(group);
    // Más opciones de las que el grupo permite no detiene el pedido: cada una
    // se cobra, así que nadie paga de menos. Solo queda anotado.
    if (picks.length > group.max) reasons.push('too_many_options');
    for (const pick of picks) {
      const option = group.options.find((o) => sameName(o.name, pick));
      if (!option) {
        reasons.push('unknown_option');
        continue;
      }
      if (option.available === false) reasons.push('option_unavailable');
      cents += Math.round(option.priceDelta * 100);
    }
  }

  // Obligatorio que no viene (un carrito guardado antes de que el dueño
  // agregara el tamaño): se cobra la opción disponible más barata. Nadie paga
  // menos que eso por el platillo, y el pedido honesto no se detiene.
  for (const group of groups) {
    if (!group.required || chosenGroups.has(group)) continue;
    const disponibles = group.options.filter((o) => o.available !== false);
    if (disponibles.length === 0) continue;
    const barata = Math.min(...disponibles.map((o) => Math.round(o.priceDelta * 100)));
    if (barata !== 0) {
      cents += barata;
      reasons.push('missing_required_option');
    }
  }
  return {cents, reasons};
}

/**
 * Envío: el que el dueño puso en Configuración, solo si el pedido va a
 * domicilio y el local entrega. Lo que mande el teléfono no cuenta.
 */
function deliveryFeeCents(order, restaurant) {
  if (!order || order.orderType !== 'delivery') return {cents: 0, reasons: []};
  if (!restaurant || restaurant.deliveryEnabled !== true) {
    return {cents: 0, reasons: ['delivery_not_offered']};
  }
  const fee = toCents(restaurant.deliveryFee);
  return {cents: Number.isFinite(fee) && fee > 0 ? fee : 0, reasons: []};
}

/**
 * Pone precio a un pedido del comensal.
 *
 * @param {object} input
 * @param {object} input.order       el pedido tal como está en Firestore
 * @param {object} input.menuById    {menuItemId: doc de restaurants/{rid}/menu} SOLO de este local
 * @param {object} input.restaurant  doc del local (deliveryEnabled, deliveryFee, currencyCode)
 * @returns {{
 *   version: number, priceable: boolean, available: boolean, currency: string,
 *   lines: Array<{menuItemId: string, name: string, quantity: number, unitPrice: number, subtotal: number}>,
 *   itemsTotal: number|null, deliveryFee: number|null, serverTotal: number|null,
 *   clientTotal: number|null, mismatch: boolean, reasons: string[],
 * }}
 */
function priceCustomerOrder({order, menuById, restaurant}) {
  const reasons = new Set();
  const menu = menuById && typeof menuById === 'object' ? menuById : {};
  const items = order && Array.isArray(order.items) ? order.items : [];
  const lines = [];
  let itemsCents = 0;
  let anyLineDiffers = false;

  if (items.length === 0) reasons.add('no_items');
  if (items.length > MAX_LINES) reasons.add('too_many_items');

  for (const line of items.slice(0, MAX_LINES)) {
    const id = line && typeof line === 'object' && typeof line.menuItemId === 'string' ? line.menuItemId.trim() : '';
    if (!id) {
      reasons.add('bad_item');
      continue;
    }
    // Un id con '/' saldría del menú de este local; los '__' son ventas
    // rápidas de la Caja, nunca de un comensal.
    const menuItem = !id.includes('/') && !id.startsWith('__') && Object.prototype.hasOwnProperty.call(menu, id) ? menu[id] : null;
    if (!menuItem || typeof menuItem !== 'object') {
      reasons.add('unknown_item');
      continue;
    }
    if (menuItem.isAvailable === false) reasons.add('item_unavailable');

    const qty = line.quantity;
    if (typeof qty !== 'number' || !Number.isInteger(qty) || qty < 1 || qty > MAX_QTY_PER_LINE) {
      reasons.add('bad_quantity');
      continue;
    }
    const baseCents = toCents(menuItem.price);
    if (!Number.isFinite(baseCents) || baseCents < 0) {
      reasons.add('bad_menu_price');
      continue;
    }
    const opts = optionsDeltaCents(line, resolveOptionGroups(menuItem));
    for (const r of opts.reasons) reasons.add(r);
    const unitCents = baseCents + opts.cents;
    if (unitCents < 0) {
      reasons.add('bad_menu_price');
      continue;
    }
    const subtotalCents = unitCents * qty;
    itemsCents += subtotalCents;

    const clientUnit = toCents(line.price);
    const clientSubtotal = toCents(line.subtotal);
    if (
      !Number.isFinite(clientUnit) || Math.abs(clientUnit - unitCents) > TOLERANCE_CENTS ||
      !Number.isFinite(clientSubtotal) || Math.abs(clientSubtotal - subtotalCents) > TOLERANCE_CENTS
    ) {
      anyLineDiffers = true;
    }
    lines.push({
      menuItemId: id,
      name: typeof menuItem.name === 'string' && menuItem.name.trim() ? menuItem.name.trim() : 'Platillo',
      quantity: qty,
      unitPrice: fromCents(unitCents),
      subtotal: fromCents(subtotalCents),
    });
  }

  const delivery = deliveryFeeCents(order, restaurant);
  for (const r of delivery.reasons) reasons.add(r);

  const clientCents = toCents(order && order.total);
  const clientTotal = Number.isFinite(clientCents) ? fromCents(clientCents) : null;
  const currency = currencyOf(restaurant);
  const priceable = !BLOCKING_REASONS.some((r) => reasons.has(r));
  const available = priceable && !UNAVAILABLE_REASONS.some((r) => reasons.has(r));

  if (!priceable) {
    return {
      version: PRICING_VERSION,
      priceable: false,
      available: false,
      currency,
      lines: [],
      itemsTotal: null,
      deliveryFee: null,
      serverTotal: null,
      clientTotal,
      mismatch: true,
      reasons: [...reasons].sort(),
    };
  }

  const totalCents = itemsCents + delivery.cents;
  const totalDiffers = !Number.isFinite(clientCents) || Math.abs(clientCents - totalCents) > TOLERANCE_CENTS;
  if (anyLineDiffers) reasons.add('item_price_differs');
  if (totalDiffers) reasons.add('total_differs');
  const clientFee = toCents(order.deliveryFee);
  if ((Number.isFinite(clientFee) ? clientFee : 0) !== delivery.cents) reasons.add('delivery_fee_differs');

  return {
    version: PRICING_VERSION,
    priceable: true,
    available,
    currency,
    lines,
    itemsTotal: fromCents(itemsCents),
    deliveryFee: fromCents(delivery.cents),
    serverTotal: fromCents(totalCents),
    clientTotal,
    mismatch: anyLineDiffers || totalDiffers || reasons.has('delivery_fee_differs'),
    reasons: [...reasons].sort(),
  };
}

/**
 * Lo que se guarda en `order.pricing` (solo lo escribe el servidor; las reglas
 * no dejan que el comensal mande ese campo). Quien llama agrega `at`.
 * `by`: 'create_preference' (precio fijado y mandado a Mercado Pago) |
 * 'create_preference_rejected' (no se cobró) | 'order_created' | 'webhook'.
 */
function buildPricingAudit(pricing, {by, corrected}) {
  return {
    version: pricing.version,
    by,
    priceable: pricing.priceable,
    available: pricing.available,
    currency: pricing.currency,
    clientTotal: pricing.clientTotal,
    serverTotal: pricing.serverTotal,
    itemsTotal: pricing.itemsTotal,
    deliveryFee: pricing.deliveryFee,
    mismatch: pricing.mismatch,
    corrected: corrected === true,
    reasons: pricing.reasons,
  };
}

/**
 * Comisión del pedido con el total del servidor. Solo si el pedido ya traía
 * esos campos (la app los manda; la web no): la cifra del teléfono no se queda.
 */
function commissionFieldsFor(order, total, rate) {
  const carries = ['commissionRate', 'commissionAmount', 'restaurantAmount']
    .some((k) => order && order[k] != null);
  if (!carries) return {};
  const r = typeof rate === 'number' && Number.isFinite(rate) && rate >= 0 && rate <= 1 ? rate : 0;
  const amountCents = Math.round(toCents(total) * r);
  return {
    commissionRate: r,
    commissionAmount: fromCents(amountCents),
    restaurantAmount: fromCents(toCents(total) - amountCents),
  };
}

/**
 * Campos del pedido con el precio del servidor, para escribir cuando el
 * teléfono mandó otra cosa. Conserva lo que el comensal pidió (opciones,
 * notas, puntos del upsell) y cambia solo precio, subtotal, total y envío.
 * Solo se llama con un pedido al que sí se le pudo poner precio.
 */
function correctedOrderFields(order, pricing) {
  if (!pricing.priceable) return {};
  const items = (Array.isArray(order.items) ? order.items : []).map((line, i) => {
    const server = pricing.lines[i];
    return {...line, price: server.unitPrice, subtotal: server.subtotal};
  });
  const fields = {items, total: pricing.serverTotal};
  if (pricing.deliveryFee > 0 || order.deliveryFee != null) fields.deliveryFee = pricing.deliveryFee;
  return fields;
}

module.exports = {
  PRICING_VERSION,
  MAX_LINES,
  MAX_QTY_PER_LINE,
  TOLERANCE_CENTS,
  CUSTOMER_ORDER_SOURCES,
  BLOCKING_REASONS,
  UNAVAILABLE_REASONS,
  isCustomerOrder,
  currencyOf,
  toCents,
  resolveOptionGroups,
  parseOptionGroupsFromDescription,
  priceCustomerOrder,
  buildPricingAudit,
  commissionFieldsFor,
  correctedOrderFields,
};
