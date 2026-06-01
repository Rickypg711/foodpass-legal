/**
 * generateEventId — produces a unique ID shared between the browser Pixel call
 * and the server-side CAPI call for the same logical event.
 *
 * Meta uses matching event_id values to deduplicate a browser Pixel event
 * against its CAPI counterpart. Both sides MUST use the same ID or Meta counts
 * the event twice.
 *
 * Safe in:
 *   - Browsers (crypto.randomUUID, supported Chrome 92+, Firefox 95+, Safari 15.4+)
 *   - Node.js 14.17+ / Vercel Edge / Node 18 (crypto.randomUUID built-in)
 *   - Older environments (timestamp + Math.random fallback — still sufficient entropy
 *     for deduplication within a single session)
 */
export function generateEventId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  // Fallback: timestamp in base-36 + two 32-bit random segments.
  const ts = Date.now().toString(36);
  const r1 = Math.floor(Math.random() * 0xffffffff).toString(36).padStart(6, "0");
  const r2 = Math.floor(Math.random() * 0xffffffff).toString(36).padStart(6, "0");
  return `${ts}-${r1}-${r2}`;
}
