# Agent instructions for foodpass-legal (the Comeleal web)

The full rules live in the app repo: `/Users/ricardoparedes/projects/FOODPASS/AGENTS.md` (production data, QA, Firestore scripts, preserving work). Read them before working here.

## Copy Sin Robot (mandatory, since 8-oct-2026)

Every text an owner or a customer will see must pass the skill **comeleal-copy-sin-robot** (`.claude/skills/comeleal-copy-sin-robot`, linked to the one in FOODPASS).

* `npm test` runs `scripts/validate-copy-sin-robot.mjs`: a NEW text with a robot form fails. Fix the text; only a true false positive goes in `scripts/copy-sin-robot-baseline.json` (`--update-baseline`), with the reason in the commit.
* It mirrors `FOODPASS/scripts/video/anti_robot.py`: if you add a form in one, add it to the other.
* Also read by hand: the script does not catch false promises (e.g. promising points when `loyaltyReady === false`).
