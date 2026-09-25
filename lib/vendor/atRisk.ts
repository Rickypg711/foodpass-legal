// lib/vendor/atRisk.ts
//
// "Clientes en riesgo" que ve el dueño = los de la app + los de teléfono.
//
// 25-sep-2026: el cerebro guarda tres conteos en vendorInsights.metrics:
//   atRiskCount          → usuarios de la APP sin visita en 14+ días
//   atRiskReachableCount → clientes por TELÉFONO sin visita en 14+ días
//   atRiskTotalCount     → la suma
// El consejo ("Tienes 10 clientes con WhatsApp que no han vuelto") y la app
// usan el total o el de teléfono; Panel y Reportes leían SOLO el de la app y
// en Suadero decían "0 en riesgo" al lado de un consejo que decía "10".
// Una sola función para que nadie vuelva a leer el campo equivocado.

export type AtRiskMetrics = {
  atRiskCount?: number | null;
  atRiskReachableCount?: number | null;
  atRiskTotalCount?: number | null;
};

const n = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);

/** Los que el dueño puede perder, app + teléfono. Cerebro viejo sin total → suma. */
export function atRiskShown(m: AtRiskMetrics | null | undefined): number {
  if (!m) return 0;
  if (typeof m.atRiskTotalCount === "number") return m.atRiskTotalCount;
  return n(m.atRiskCount) + n(m.atRiskReachableCount);
}
