// Robo #4 — contrato del núcleo de rechazos de upsell.
// Run: node scripts/validate-upsell-dismissals.mjs

import assert from "node:assert/strict";
import {
  DISMISSAL_TTL_MS,
  dismissalKey,
  isDismissedIn,
  pruneDismissals,
  withDismissal,
} from "../lib/cart/upsellDismissals.ts";

const NOW = 1_000_000;

// 1. Un rechazo se recuerda dentro del TTL y se olvida después
{
  const map = withDismissal({}, "r1", "papas", NOW);
  assert.equal(isDismissedIn(map, "r1", "papas", NOW + 1), true);
  assert.equal(
    isDismissedIn(map, "r1", "papas", NOW + DISMISSAL_TTL_MS + 1),
    false,
    "después del TTL, el platillo recupera su oportunidad",
  );
}

// 2. El rechazo es POR restaurante: decir no a las papas de r1 no calla a r2
{
  const map = withDismissal({}, "r1", "papas", NOW);
  assert.equal(isDismissedIn(map, "r2", "papas", NOW + 1), false);
}

// 3. prune limpia expirados y conserva vigentes
{
  const map = {
    [dismissalKey("r1", "a")]: NOW - 1, // expirado
    [dismissalKey("r1", "b")]: NOW + 1000,
  };
  const pruned = pruneDismissals(map, NOW);
  assert.deepEqual(Object.keys(pruned), [dismissalKey("r1", "b")]);
}

// 4. withDismissal poda de paso (el store no crece para siempre)
{
  const dirty = { [dismissalKey("r1", "viejo")]: NOW - 5 };
  const next = withDismissal(dirty, "r1", "nuevo", NOW);
  assert.equal(dismissalKey("r1", "viejo") in next, false);
  assert.equal(isDismissedIn(next, "r1", "nuevo", NOW + 1), true);
}

console.log("validate-upsell-dismissals: OK");
