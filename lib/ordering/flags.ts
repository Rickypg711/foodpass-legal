/**
 * Phase 1 web ordering rollout. Default false — set NEXT_PUBLIC_ORDERING_ENABLED=true to enable.
 */
export function isWebOrderingEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ORDERING_ENABLED === "true";
}
