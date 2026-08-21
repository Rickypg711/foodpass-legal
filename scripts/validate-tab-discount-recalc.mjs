/**
 * Recálculo del descuento AL CERRAR una cuenta (5.1.4).
 * Espejo EXACTO de FOODPASS/test/loyalty/tab_discount_recalc_test.dart —
 * paridad de dinero web↔app. Si un caso cambia aquí, cambia allá.
 *
 * El cierre es la única fuente de verdad: el descuento se recalcula desde las
 * líneas ORIGINALES, sobre TODAS las rondas, y nunca se apila sobre un total
 * ya descontado.
 *
 * Run: node scripts/validate-tab-discount-recalc.mjs
 * Requiere Node >= 22.18 (type stripping nativo para importar el .ts).
 */

import {
  recalcTabDiscount,
  tabLinesFromItems,
} from "../lib/loyalty/tabDiscountRecalc.ts";

let failed = 0;
function check(label, actual, expected) {
  if (actual !== expected) {
    console.error(`FAIL ${label}: esperaba ${expected}, obtuvo ${actual}`);
    failed = 1;
  }
}

const staff = {
  id: "staff",
  name: "Staff",
  type: "per_category",
  bebidasPct: 100,
  alimentosPct: 50,
  totalPct: 0,
  earnsPoints: true,
};
const familia = {
  id: "fam",
  name: "Familia",
  type: "total",
  bebidasPct: 0,
  alimentosPct: 0,
  totalPct: 15,
  earnsPoints: true,
};

// ── sin perfil: el total no se mueve ─────────────────────────────────────────
{
  const r = recalcTabDiscount({
    lines: [{ menuItemId: "a", price: 100, quantity: 2 }],
  });
  check("sin perfil gross", r.gross, 200);
  check("sin perfil discount", r.discount, 0);
  check("sin perfil net", r.net, 200);
  check("sin perfil discountApplied", r.discountApplied, null);
  check("sin perfil hasDiscount", r.hasDiscount, false);

  const vacia = recalcTabDiscount({ lines: [], profile: staff });
  check("cuenta vacia gross", vacia.gross, 0);
  check("cuenta vacia net", vacia.net, 0);
}

// ── EL BUG DE 5.1.3: el descuento cubre TODAS las rondas ─────────────────────
{
  const ronda1 = [
    { menuItemId: "t", price: 120, quantity: 1, categoryName: "Tacos" },
  ];
  const todas = [
    ...ronda1,
    { menuItemId: "c", price: 60, quantity: 2, categoryName: "Cerveza" },
    { menuItemId: "c2", price: 60, quantity: 1, categoryName: "Cerveza" },
  ];
  const soloPrimera = recalcTabDiscount({ lines: ronda1, profile: staff });
  check("solo ronda 1 (como se calculaba antes)", soloPrimera.discount, 60);

  const alCierre = recalcTabDiscount({ lines: todas, profile: staff });
  check("al cierre gross", alCierre.gross, 300);
  check("al cierre discount", alCierre.discount, 240); // 120*50% + 180*100%
  check("al cierre net", alCierre.net, 60);
  check("al cierre profileId", alCierre.discountApplied.profileId, "staff");
  check("al cierre amount", alCierre.discountApplied.amount, 240);
  check("al cierre bebidas", alCierre.discountApplied.breakdown.bebidas, 180);
}

// ── idempotencia: volver a entrar NO apila ───────────────────────────────────
{
  const lines = [
    { menuItemId: "a", price: 400, quantity: 2, categoryName: "Pizzas" },
  ];
  const a = recalcTabDiscount({ lines, profile: familia });
  const b = recalcTabDiscount({ lines, profile: familia });
  check("idempotente net", a.net, b.net);
  check("idempotente discount", a.discount, b.discount);
  check("familia 15% de 800", a.net, 680);

  // Si alguien pasara el NETO como precio (el bug), daría 578. El contrato es
  // que la entrada son siempre las líneas originales.
  const apilado = recalcTabDiscount({
    lines: [{ menuItemId: "a", price: 680, quantity: 1, categoryName: "Pizzas" }],
    profile: familia,
  });
  check("apilado (lo que NO debe pasar)", apilado.net, 578);
}

// ── el caso de Ricardo: pizza $100 + cerveza $50 con Familia 15% ─────────────
{
  const r = recalcTabDiscount({
    lines: [
      { menuItemId: "pizza", price: 100, quantity: 1, categoryName: "Pizzas" },
      { menuItemId: "cerv", price: 50, quantity: 1, categoryName: "Cervezas" },
    ],
    profile: familia,
  });
  check("ricardo gross", r.gross, 150);
  check("ricardo discount", r.discount, 22.5);
  // Ni 150 (descuento borrado por addItemsToTab) ni 108.38 (descuento sobre
  // descuento). Una sola operación, sobre precios originales.
  check("ricardo net", r.net, 127.5);
}

// ── categoría faltante (órdenes anteriores a 5.1.4) ──────────────────────────
{
  const lines = [{ menuItemId: "cerv", price: 50, quantity: 2 }];
  const sinMenu = recalcTabDiscount({ lines, profile: staff });
  check("sin fallback cuenta como alimento", sinMenu.discount, 50);

  const conMenu = recalcTabDiscount({
    lines,
    profile: staff,
    categoryByMenuItemId: { cerv: "Cervezas" },
  });
  check("con fallback es bebida", conMenu.discount, 100);
  check("con fallback net", conMenu.net, 0);

  const gana = recalcTabDiscount({
    lines: [
      { menuItemId: "x", price: 100, quantity: 1, categoryName: "Pizzas" },
    ],
    profile: staff,
    categoryByMenuItemId: { x: "Cervezas" },
  });
  check("la categoria de la linea gana sobre el menu", gana.discount, 50);
}

// ── límites de dinero ────────────────────────────────────────────────────────
{
  const todo = {
    id: "x",
    name: "X",
    type: "total",
    bebidasPct: 0,
    alimentosPct: 0,
    totalPct: 100,
    earnsPoints: true,
  };
  const r = recalcTabDiscount({
    lines: [{ menuItemId: "a", price: 250, quantity: 1 }],
    profile: todo,
  });
  check("100% discount", r.discount, 250);
  check("100% net nunca negativo", r.net, 0);

  const p = {
    id: "p",
    name: "P",
    type: "total",
    bebidasPct: 0,
    alimentosPct: 0,
    totalPct: 33,
    earnsPoints: true,
  };
  const rr = recalcTabDiscount({
    lines: [{ menuItemId: "a", price: 99.99, quantity: 1 }],
    profile: p,
  });
  check("redondeo gross", rr.gross, 99.99);
  check("redondeo discount", rr.discount, 33);
  check("redondeo net", rr.net, 66.99);
}

// ── tabLinesFromItems: lee el crudo de Firestore ─────────────────────────────
{
  const lines = tabLinesFromItems([
    { menuItemId: "a", name: "soda", price: 20, quantity: 3, categoryName: "Bebidas" },
    { menuItemId: "b", name: "pizza", price: 200, quantity: 1 }, // legacy, sin cat
    { name: "basura" }, // sin precio: se ignora
  ]);
  check("tabLines largo", lines.length, 2);
  check("tabLines categoria", lines[0].categoryName, "Bebidas");
  check("tabLines legacy sin categoria", lines[1].categoryName, null);
  check("tabLines no-array", tabLinesFromItems(undefined).length, 0);
}

if (failed) {
  console.error("\n❌ validate-tab-discount-recalc: FALLÓ");
  process.exit(1);
}
console.log("✅ validate-tab-discount-recalc: todos los casos pasan (espejo del .dart)");
