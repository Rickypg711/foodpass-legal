// Núcleo PURO del cooldown del hub de servicio (robo #5) — sin imports para
// poder ejecutarlo en tests de node (validate-service-requests.mjs). La capa
// con Firebase vive en serviceRequests.ts.

export const SERVICE_COOLDOWN_MS = 30_000;

/** ms restantes de cooldown (0 = ya se puede volver a tocar). */
export function cooldownRemainingMs(
  lastSentMs: number | null,
  nowMs: number,
  cooldownMs: number = SERVICE_COOLDOWN_MS,
): number {
  if (typeof lastSentMs !== "number" || !Number.isFinite(lastSentMs)) return 0;
  const remaining = lastSentMs + cooldownMs - nowMs;
  return remaining > 0 ? remaining : 0;
}
