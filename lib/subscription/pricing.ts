/**
 * EL precio de Pro (web). Un solo número; quien lo enseña o lo cobra lo importa.
 *
 * $499 MXN/mes para suscriptores NUEVOS (decisión de Ricardo, 7-sep-2026;
 * benchmark en FOODPASS/docs/PRECIOS_BENCHMARK_GLOBAL.md §5f). Quien ya paga
 * (Pecado Escondido, $299) se queda en su precio: el preapproval viejo de
 * Mercado Pago conserva su monto solo — grandfathering gratis, nada que tocar.
 *
 * Candado: scripts/validate-caja-pro-gate.mjs afirma 499 aquí y que la ruta de
 * cobro (app/api/mercado-pago/subscribe/route.ts) importa este constante.
 */
export const PRO_AMOUNT_MXN = 499;

/** "$499" — para copy. Nunca escribas el número a mano en una página. */
export const PRO_PRICE_LABEL = `$${PRO_AMOUNT_MXN}`;

/** El precio que pagan los suscriptores de antes del 8-sep-2026. Solo para
 * docs y soporte; ningún flujo nuevo lo cobra. */
export const PRO_LEGACY_AMOUNT_MXN = 299;
