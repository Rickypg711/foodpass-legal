/**
 * Ventanas de horario por categoría (10-sep-2026) — lib/menu/categoryWindows.ts,
 * espejo de lib/utils/menu_category_windows.dart (app).
 *  1. Sin entrada para la categoría → { always: true } (todo el día).
 *  2. Entradas mal formadas (hora inválida, to <= from, días fuera de 1..7) se ignoran.
 *  3. Abierta: "hasta las 12:00 pm". Cerrada con ventana más tarde hoy: "de 1:00 pm a
 *     8:00 pm · vuelve hoy a la 1:00 pm". Sin más hoy: "vuelve mañana a las 10:00 am".
 *  4. Lunes=1 … Domingo=7; la una va en singular ("a la 1:00 pm").
 * Run: node --experimental-strip-types scripts/validate-menu-category-windows.mjs
 */
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const m = await import(join(root, "lib/menu/categoryWindows.ts"));
const { categoryWindowsFromRestaurant, categoryAvailability, categoryAvailabilityLabel, isoWeekday } = m;

// El caso real: Café de la Tercera
const raw = {
  menuCategoryWindows: {
    Desayunos: [{ days: [2, 3, 4, 5], from: "09:00", to: "12:00" }, { days: [6, 7], from: "10:00", to: "13:00" }],
    "PM · Fuertes": [{ days: [2, 3, 4, 5], from: "13:00", to: "20:00" }, { days: [6, 7], from: "13:00", to: "18:00" }],
    basura: [{ days: [9], from: "x", to: "12:00" }, { from: "12:00", to: "11:00" }],
    "sin dias": [{ from: "08:00", to: "10:00" }],
  },
};
const w = categoryWindowsFromRestaurant(raw);
assert.deepEqual(Object.keys(w).sort(), ["desayunos", "pm fuertes", "sin dias"]);
assert.deepEqual(w["sin dias"][0].days, [1, 2, 3, 4, 5, 6, 7]);
assert.deepEqual(categoryWindowsFromRestaurant({}), {});
assert.deepEqual(categoryWindowsFromRestaurant({ menuCategoryWindows: "nope" }), {});

// 4. días
const thu = new Date(2026, 8, 10, 10, 30); // jueves 10-sep-2026
assert.equal(isoWeekday(thu), 4);
assert.equal(isoWeekday(new Date(2026, 8, 13, 10)), 7); // domingo

// 1. sin ventana → siempre
assert.deepEqual(categoryAvailability("Mocktails", w, thu), { always: true });

// 3. abierta / cerrada
let a = categoryAvailability("Desayunos", w, thu);
assert.equal(a.openNow, true); assert.equal(a.hoursLabel, "hasta las 12:00 pm");
assert.equal(categoryAvailabilityLabel(a), "hasta las 12:00 pm");

a = categoryAvailability("Fuertes", w, thu); // "pm fuertes" NO es "fuertes" → siempre
assert.deepEqual(a, { always: true });
a = categoryAvailability("PM · Fuertes", w, thu);
assert.equal(a.openNow, false);
assert.equal(categoryAvailabilityLabel(a), "de 1:00 pm a 8:00 pm · vuelve hoy a la 1:00 pm");

a = categoryAvailability("Desayunos", w, new Date(2026, 8, 10, 12, 30)); // jueves 12:30 → mañana viernes 9
assert.equal(categoryAvailabilityLabel(a), "de 9:00 am a 12:00 pm · vuelve mañana a las 9:00 am");

a = categoryAvailability("Desayunos", w, new Date(2026, 8, 11, 15, 0)); // viernes 3 pm → sábado 10
assert.equal(categoryAvailabilityLabel(a), "de 10:00 am a 1:00 pm · vuelve mañana a las 10:00 am");

a = categoryAvailability("Desayunos", w, new Date(2026, 8, 13, 15, 0)); // domingo 3 pm → lunes cerrado → martes 9
assert.equal(categoryAvailabilityLabel(a), "de 9:00 am a 12:00 pm · vuelve el martes a las 9:00 am");

a = categoryAvailability("Desayunos", w, new Date(2026, 8, 12, 12, 59)); // sábado 12:59 → abierta hasta la 1
assert.equal(categoryAvailabilityLabel(a), "hasta las 1:00 pm");

// borde: el límite superior es exclusivo
a = categoryAvailability("Desayunos", w, new Date(2026, 8, 10, 12, 0));
assert.equal(a.openNow, false);

console.log("validate-menu-category-windows: OK");
