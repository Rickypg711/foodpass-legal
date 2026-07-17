// lib/loyalty/redeemCode.ts
//
// Código de canje — in-store redemption verification (anti-fraud).
//
// Threat model: an employee types a regular customer's phone into the Caja and
// redeems their reward for themselves. Mitigation: redeeming in-store asks for
// a 4-digit code that ONLY the customer can see — it's displayed on their
// "Mis puntos" page (comeleal.com/puntos), which sits behind Firebase SMS
// verification of that exact phone number. Same identity model as the web
// checkout redemption (OTP-verified phone).
//
// The code is deterministic — SHA-256(phone|restaurant|5-min window) — so the
// customer's page and the Caja compute it independently with no server, no
// Firestore writes, and no messaging infra. It rotates every 5 minutes and the
// Caja accepts the current + previous window (10 min of validity).
//
// Honest limitation: the derivation runs client-side, so a technically savvy
// employee could reproduce it. Defense in depth: every redemption records
// redemptionVerified on the order, and no-code overrides are flagged for the
// owner. This is fraud *friction* proportional to a $100 pizza, not a vault.

const WINDOW_MS = 5 * 60 * 1000;
const CODE_DIGITS = 4;
const SALT = "comeleal-canje-v1";

function normalizePhone10(digits: string): string {
  const d = digits.replace(/\D/g, "");
  return d.length > 10 ? d.slice(-10) : d;
}

async function codeForWindow(
  phone10: string,
  restaurantId: string,
  windowIndex: number,
): Promise<string> {
  const input = `${phone10}|${restaurantId}|${windowIndex}|${SALT}`;
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input),
  );
  const b = new Uint8Array(buf);
  const num = (((b[0] << 24) | (b[1] << 16) | (b[2] << 8) | b[3]) >>> 0) >>> 0;
  return String(num % 10 ** CODE_DIGITS).padStart(CODE_DIGITS, "0");
}

/** Current código de canje for this phone at this restaurant (rotates every 5 min). */
export async function currentRedemptionCode(
  phoneDigits: string,
  restaurantId: string,
): Promise<string> {
  const phone10 = normalizePhone10(phoneDigits);
  return codeForWindow(phone10, restaurantId, Math.floor(Date.now() / WINDOW_MS));
}

/** Seconds until the current code rotates. */
export function secondsUntilRotation(): number {
  return Math.ceil((WINDOW_MS - (Date.now() % WINDOW_MS)) / 1000);
}

/** Validate a typed code — accepts the current and previous 5-min window. */
export async function validateRedemptionCode(
  typed: string,
  phoneDigits: string,
  restaurantId: string,
): Promise<boolean> {
  const clean = typed.replace(/\D/g, "");
  if (clean.length !== CODE_DIGITS) return false;
  const phone10 = normalizePhone10(phoneDigits);
  const nowWindow = Math.floor(Date.now() / WINDOW_MS);
  for (const w of [nowWindow, nowWindow - 1]) {
    if ((await codeForWindow(phone10, restaurantId, w)) === clean) return true;
  }
  return false;
}
