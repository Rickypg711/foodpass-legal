// lib/pos/cashChange.ts
//
// Cambio en efectivo para la Caja web (29-sep-2026): paridad con la app, que
// ya lo calculaba ("Monto recibido" → "Cambio"). Puro: lo prueba
// scripts/validate-cash-change.mjs.

/** Cambio a devolver; null si aún no alcanza (o no hay monto). */
export function cashChange(total: number, received: number | ""): number | null {
  if (received === "" || !Number.isFinite(Number(received))) return null;
  const r = Number(received);
  if (r < total) return null;
  return Math.round((r - total) * 100) / 100;
}

/** "Cambio $20.00" / "Faltan $30.00" / "Exacto". */
export function cashChangeLabel(total: number, received: number | ""): string | null {
  if (received === "") return null;
  const r = Number(received);
  if (!Number.isFinite(r)) return null;
  if (r < total) return `Faltan $${(total - r).toFixed(2)}`;
  const c = cashChange(total, r) ?? 0;
  return c === 0 ? "Exacto" : `Cambio $${c.toFixed(2)}`;
}
