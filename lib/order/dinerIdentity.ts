// Identidad del COMENSAL en este navegador — nombre y teléfono que ya dio en
// un pedido anterior, para prefillear el checkout de la siguiente ronda (o de
// la siguiente visita). En localStorage a propósito: el snapshot del pedido
// vive en sessionStorage (por PESTAÑA) y por eso el prefill v1 fallaba si la
// ronda 2 salía de otra pestaña (bug de Ricardo, 25-ago, segunda ronda).
//
// PRIVACIDAD: esto jamás viaja en URLs ni a otros servicios — es el propio
// navegador del comensal recordando lo que él mismo tecleó, como cualquier
// autofill. Se sobreescribe con cada pedido nuevo.

export type DinerIdentity = {
  name: string;
  phone: string;
};

const KEY = "comeleal_diner_identity_v1";

export function saveDinerIdentity(identity: Partial<DinerIdentity>): void {
  if (typeof window === "undefined") return;
  try {
    const prev = loadDinerIdentity();
    const next: DinerIdentity = {
      name: (identity.name ?? prev?.name ?? "").trim(),
      phone: (identity.phone ?? prev?.phone ?? "").trim(),
    };
    if (!next.name && !next.phone) return;
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* best-effort */
  }
}

export function loadDinerIdentity(): DinerIdentity | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DinerIdentity>;
    const name = typeof parsed.name === "string" ? parsed.name.trim() : "";
    const phone = typeof parsed.phone === "string" ? parsed.phone.trim() : "";
    return name || phone ? { name, phone } : null;
  } catch {
    return null;
  }
}
