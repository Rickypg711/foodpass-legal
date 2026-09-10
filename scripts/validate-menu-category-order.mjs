/**
 * Orden de categorías del menú público (10-sep-2026).
 *
 * POR QUÉ EXISTE: alfabético ponía "Bebidas" primero en 15 de 40 locales y
 * "Extras" antes que los tacos. Contrato (lib/menu/categoryOrder.ts, espejo de
 * lib/utils/menu_category_order.dart en la app):
 *  1. Con `menuCategoryOrder` en el doc, ese orden manda; lo que no esté en la
 *     lista va después, por la regla fija.
 *  2. Sin lista: entradas → desayunos → ensaladas → fuertes (desconocidos aquí,
 *     alfabético) → combos → postres → bebidas → extras.
 *  3. La comparación ignora acentos y mayúsculas ("Con Café" == "con cafe").
 *  4. paperCategoryOrder devuelve las categorías únicas en orden de lectura.
 *
 * Run: node --experimental-strip-types scripts/validate-menu-category-order.mjs
 */
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const m = await import(join(root, "lib/menu/categoryOrder.ts"));
const { orderMenuCategories, sortMenuRows, paperCategoryOrder, categoryRank, normalizeCategoryKey,
  RANK_STARTERS, RANK_BREAKFAST, RANK_SALADS, RANK_MAINS, RANK_COMBOS, RANK_DESSERTS, RANK_DRINKS, RANK_EXTRAS } = m;

// 3. normalización
assert.equal(normalizeCategoryKey(" Con Café "), "con cafe");
assert.equal(normalizeCategoryKey("Pa' Papear"), "pa papear");
assert.equal(normalizeCategoryKey(null), "");

// 2. escalones de la regla fija (los nombres reales de producción)
assert.equal(categoryRank("Bebidas"), RANK_DRINKS);
assert.equal(categoryRank("Con Café"), RANK_DRINKS);
assert.equal(categoryRank("Sin café"), RANK_DRINKS);
assert.equal(categoryRank("Mocktails"), RANK_DRINKS);
assert.equal(categoryRank("De temporada"), RANK_DRINKS);
assert.equal(categoryRank("Extras"), RANK_EXTRAS);
assert.equal(categoryRank("Adicionales"), RANK_EXTRAS);
assert.equal(categoryRank("Otros"), RANK_EXTRAS);
assert.equal(categoryRank(""), RANK_EXTRAS);
assert.equal(categoryRank("Postres"), RANK_DESSERTS);
assert.equal(categoryRank("Combos"), RANK_COMBOS);
assert.equal(categoryRank("Especiales"), RANK_COMBOS);
assert.equal(categoryRank("Entradas"), RANK_STARTERS);
assert.equal(categoryRank("Pa' papear"), RANK_STARTERS);
assert.equal(categoryRank("Desayunos"), RANK_BREAKFAST);
assert.equal(categoryRank("Con pan"), RANK_BREAKFAST);
assert.equal(categoryRank("Ensaladas"), RANK_SALADS);
assert.equal(categoryRank("Tacos"), RANK_MAINS);
assert.equal(categoryRank("Tortas"), RANK_MAINS);
assert.equal(categoryRank("Fortachon"), RANK_MAINS);

// 2. el caso que dolía: taquería con Bebidas y Extras
assert.deepEqual(
  orderMenuCategories(["Bebidas", "Extras", "Tacos", "Combos", "Postres", "Entradas", "Burritos"]),
  ["Entradas", "Burritos", "Tacos", "Combos", "Postres", "Bebidas", "Extras"],
);
// desconocidos en medio y alfabéticos entre sí; sin repetir por mayúsculas
assert.deepEqual(orderMenuCategories(["tacos", "Tacos", "Alitas", "Bebidas"]), ["Alitas", "tacos", "Bebidas"]);

// 1. la lista guardada manda; lo que no está en ella va después por la regla
const raw = { menuCategoryOrder: ["Desayunos", "Con pan", "Ensaladas", "Entradas", "Pa' papear", "Sandos", "Fuertes"] };
assert.deepEqual(
  orderMenuCategories(["Sin café", "Fuertes", "Postres", "Con pan", "Sandos", "Desayunos", "Extras"], raw),
  ["Desayunos", "Con pan", "Sandos", "Fuertes", "Postres", "Sin café", "Extras"],
);
// lista con basura → se ignora lo que no sea string
assert.deepEqual(orderMenuCategories(["B", "A"], { menuCategoryOrder: [1, null, "b"] }), ["B", "A"]);
assert.deepEqual(orderMenuCategories(["B", "A"], { menuCategoryOrder: "nope" }), ["A", "B"]);

// filas: categoría (tres capas) y luego nombre
const rows = sortMenuRows(
  [
    { category: "Bebidas", name: "Coca" },
    { category: "Tacos", name: "Pastor" },
    { category: "Tacos", name: "Asada" },
    { category: "Extras", name: "Queso" },
  ],
  null,
);
assert.deepEqual(rows.map((r) => `${r.category}/${r.name}`), ["Tacos/Asada", "Tacos/Pastor", "Bebidas/Coca", "Extras/Queso"]);

// 4. orden del papel al reclamar el demo
assert.deepEqual(
  paperCategoryOrder([{ category: "AM" }, { category: "AM" }, { category: "CON PAN" }, { category: "" }, { category: null }, { category: "Con pan" }, { category: "Postres" }]),
  ["AM", "CON PAN", "Postres"],
);

console.log("validate-menu-category-order: OK");
