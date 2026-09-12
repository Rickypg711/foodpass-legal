// Del recibo por link al pedido exacto en Pedidos (12-sep-2026).
//
// El dueño abre "Mi recibo y puntos" desde WhatsApp. Con sesión del local ve el aviso
// "sigue sin cobrar"; sin sesión, una línea "¿Eres del local?". Los dos llevan aquí:
// Pedidos con ?pedido= baja hasta esa tarjeta y la resalta. Sin sesión, Pedidos rebota
// a Entrar con ?next= y, ya dentro, regresa al mismo pedido.

/** Pedidos con ese pedido marcado. */
export function pedidosHrefForOrder(orderId: string): string {
  return `/vendor/pedidos?pedido=${encodeURIComponent(orderId)}`;
}

/** Entrar y regresar a `next` (solo rutas del panel). */
export function entrarHref(next?: string | null): string {
  const safe = safeVendorNext(next);
  return safe ? `/activar?modo=entrar&next=${encodeURIComponent(safe)}` : "/activar?modo=entrar";
}

/**
 * A dónde regresar después de entrar. SOLO rutas del panel (/vendor/...): cualquier
 * otra cosa (otro sitio, "//host", "\", saltos de línea) se ignora, para que nadie
 * arme un link de Comeleal que mande a un sitio falso después de poner la contraseña.
 */
export function safeVendorNext(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  if (!raw.startsWith("/vendor/")) return null;
  if (raw.includes("\\") || /[\r\n\t]/.test(raw)) return null;
  return raw;
}
