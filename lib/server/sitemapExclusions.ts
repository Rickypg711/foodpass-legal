// lib/server/sitemapExclusions.ts
//
// Sin imports con alias a propósito: lo lee el candado
// scripts/validate-sitemap-excluded.mjs con --experimental-strip-types.

/**
 * Locales de prueba que NO van al sitemap público (6-oct-2026, lectura SEO):
 * Google los estaba descubriendo junto a los reales. La página sigue
 * existiendo (QR, demos); solo deja de anunciarse a los buscadores.
 * - TAQUERIA EL PRUEBAS ×2 y test-reja-9-sep: pruebas de montaje.
 * - luzz-pizza: el local de pruebas de Ricardo (se excluye de toda métrica).
 */
const SITEMAP_EXCLUDED_IDS = new Set([
  "NWsDb632bu9WM5dHXvOK",
  "ze3EpTxPeEIGbTRXU84y",
]);
const SITEMAP_EXCLUDED_SLUGS = new Set(["test-reja-9-sep", "luzz-pizza"]);
// Nombres que delatan una prueba: "TAQUERIA EL PRUEBAS", "Test Reja", "demo".
const TEST_NAME_RE = /\b(prueba|pruebas|test|testing|demo)\b/i;

export function isSitemapExcluded(
  id: string,
  slug: string | null,
  name: string,
): boolean {
  if (SITEMAP_EXCLUDED_IDS.has(id)) return true;
  if (slug && SITEMAP_EXCLUDED_SLUGS.has(slug)) return true;
  if (slug && TEST_NAME_RE.test(slug.replace(/-/g, " "))) return true;
  return TEST_NAME_RE.test(name);
}
