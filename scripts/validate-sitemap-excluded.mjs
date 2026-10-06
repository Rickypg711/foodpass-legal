// Candado: los locales de prueba NO salen en el sitemap público y los reales SÍ.
// Corre con: node --experimental-strip-types scripts/validate-sitemap-excluded.mjs
import assert from "node:assert/strict";
import { isSitemapExcluded } from "../lib/server/sitemapExclusions.ts";

// Pruebas conocidas (6-oct-2026): fuera.
assert.equal(isSitemapExcluded("NWsDb632bu9WM5dHXvOK", null, "TAQUERIA EL PRUEBAS"), true);
assert.equal(isSitemapExcluded("ze3EpTxPeEIGbTRXU84y", null, "TAQUERIA EL PRUEBAS"), true);
assert.equal(isSitemapExcluded("abc123", "test-reja-9-sep", "Test Reja"), true);
assert.equal(isSitemapExcluded("abc123", "luzz-pizza", "Luzz Pizza"), true);
// Por nombre, aunque el id y el slug sean nuevos.
assert.equal(isSitemapExcluded("nuevo1", null, "Taquería de prueba"), true);
assert.equal(isSitemapExcluded("nuevo2", "demo-tacos", "Demo Tacos"), true);
assert.equal(isSitemapExcluded("nuevo3", null, "Testing Café"), true);

// Reales: dentro. "Pruebas" como parte de otra palabra no cuenta.
assert.equal(isSitemapExcluded("gn3bKaysYnHIU3r8tun1", "tacos-de-suadero-la-familia", "Tacos de Suadero La Familia"), false);
assert.equal(isSitemapExcluded("y8aZJMdGZ8RhuQJeUnuc", null, "Cafetería Los Arcos"), false);
assert.equal(isSitemapExcluded("x1", "la-fresheria", "La Fresheria"), false);
assert.equal(isSitemapExcluded("x2", "contest-burgers", "Contest Burgers"), false);
assert.equal(isSitemapExcluded("x3", null, "Aprobado Tacos"), false);

console.log("validate-sitemap-excluded: OK");
