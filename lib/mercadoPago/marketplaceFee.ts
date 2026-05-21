/**
 * Checkout Pro Marketplace commission (MXN fixed amount on preference).
 * Seller OAuth token is unchanged; only marketplace_fee is added when rate > 0.
 */

/** Parse MERCADO_PAGO_MARKETPLACE_FEE_RATE; missing/invalid → 0 (fee disabled). */
export function parseMarketplaceFeeRate(raw: string | undefined | null): number {
  if (raw == null || String(raw).trim() === "") {
    return 0;
  }
  const n = Number.parseFloat(String(raw).trim());
  if (!Number.isFinite(n) || n < 0) {
    return 0;
  }
  return n;
}

/** Fixed MXN marketplace_fee for MP preferences; rounded to 2 decimals. */
export function calculateMarketplaceFeeAmount(total: number, rate: number): number {
  const safeTotal = Number.isFinite(total) && total > 0 ? total : 0;
  const safeRate = Number.isFinite(rate) && rate > 0 ? rate : 0;
  if (safeTotal === 0 || safeRate === 0) {
    return 0;
  }
  return Math.round(safeTotal * safeRate * 100) / 100;
}
