/**
 * ¿El borrador de premios de la IA todavía cabe en el menú?
 *
 * Si el menú se reimporta, los platillos traen IDs nuevos y un borrador viejo
 * queda apuntando a platillos que ya no existen: la tarjeta "Aplicar" se pinta
 * y applyRewardDraft la rechaza (menuItemId is not in menu). Kame House,
 * 8-oct-2026. Espejo de `RewardRecommendationDraft.fitsMenu` (app) y
 * `draftItemIds` (functions/reward_recommendation_ai.js).
 *
 * Menú vacío o que no se pudo leer = no se sabe: no lo esconde.
 */
type DraftLike = {
  proposedFirstPurchaseReward?: { menuItemId?: unknown } | null;
  proposedRewardTiers?: unknown;
};

export function draftMenuItemIds(draft: DraftLike): string[] {
  const out = new Set<string>();
  const fprId = draft.proposedFirstPurchaseReward?.menuItemId;
  if (typeof fprId === "string" && fprId) out.add(fprId);
  const tiers = Array.isArray(draft.proposedRewardTiers) ? draft.proposedRewardTiers : [];
  for (const t of tiers) {
    const id = (t as { menuItemId?: unknown } | null)?.menuItemId;
    if (typeof id === "string" && id) out.add(id);
  }
  return [...out];
}

export function rewardDraftFitsMenu(draft: DraftLike, menuItemIds: Iterable<string>): boolean {
  const menu = new Set(menuItemIds);
  if (menu.size === 0) return true;
  return draftMenuItemIds(draft).every((id) => menu.has(id));
}
