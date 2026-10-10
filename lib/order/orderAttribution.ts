// lib/order/orderAttribution.ts
//
// De dónde vino cada pedido (9-oct-2026, canon de la red #12: "cerrar cada
// ciclo con atribución"). El pedido guarda `source` (uno de ORDER_SOURCES) y,
// si aplica, `sourceRef` (el id de lo que se tocó).
//
// LA MISMA LISTA vive en la app (FOODPASS lib/orders/order_attribution.dart)
// y en el servidor (FOODPASS functions/order_attribution.js), que la usa para
// aprender qué trae pedidos (feedLearning, memoria del comensal). Candado:
// scripts/validate-order-source-parity.mjs. Si agregas un valor, va en los 3 y
// en el mismo orden.
//
// En la web el origen llega en el link: /menu/{rid}?src=winback&sref=abc. Se
// guarda en el navegador al abrir el menú (7 días, llave por local, mismo
// patrón que entrySource.ts y el referido) y el checkout lo pega al pedido.
// Sin `src`: mesa → qr_menu, referido → referral, tarjeta de la bolsa →
// qr_menu, lo demás → web_link. Nunca truena.
//
// `orderSource` (customer_web) no cambia: dice QUIÉN escribió el pedido.

export const ORDER_SOURCES = [
  "pos",
  "qr_menu",
  "web_link",
  "hoy_pick",
  "hoy_top_dish",
  "hoy_recent_post",
  "hoy_nearby",
  "hoy_jugada",
  "map",
  "reward",
  "search",
  "referral",
  "winback",
  "push",
  "friends",
  "reorder",
  "unknown",
] as const;
export type OrderAttributionSource = (typeof ORDER_SOURCES)[number];

const KEY = "cml_src";
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Valor conocido o null (basura no se guarda). */
export function parseOrderSource(v: unknown): OrderAttributionSource | null {
  if (typeof v !== "string") return null;
  const s = v.trim().toLowerCase();
  return (ORDER_SOURCES as readonly string[]).includes(s) ? (s as OrderAttributionSource) : null;
}

/** id de platillo/post/local: [A-Za-z0-9_-], 1..64. Lo demás → null. */
export function parseSourceRef(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return /^[A-Za-z0-9_-]{1,64}$/.test(s) ? s : null;
}

export type StoredOrderSource = { source: OrderAttributionSource; ref: string | null };

/**
 * Lee `src` (y `sref`) de la URL. Un link nunca puede decir "pos" (eso es la
 * Caja) ni "unknown" (no aporta nada).
 */
export function orderSourceFromSearch(search: string): StoredOrderSource | null {
  try {
    const sp = new URLSearchParams(search);
    const source = parseOrderSource(sp.get("src"));
    if (!source || source === "pos" || source === "unknown") return null;
    return { source, ref: parseSourceRef(sp.get("sref")) };
  } catch {
    return null;
  }
}

export function storedOrderSourceValue(v: StoredOrderSource, nowMs: number): string {
  return JSON.stringify({ s: v.source, r: v.ref, t: nowMs });
}

export function parseStoredOrderSource(raw: string | null, nowMs: number): StoredOrderSource | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as { s?: unknown; r?: unknown; t?: unknown };
    if (typeof o.t !== "number" || nowMs - o.t > TTL_MS || nowMs < o.t) return null;
    const source = parseOrderSource(o.s);
    if (!source || source === "pos" || source === "unknown") return null;
    return { source, ref: parseSourceRef(o.r) };
  } catch {
    return null;
  }
}

/** Al abrir el menú: si el link trae `src`, se recuerda para este local. */
export function captureOrderSource(restaurantId: string): void {
  if (!restaurantId || typeof window === "undefined") return;
  const v = orderSourceFromSearch(window.location.search);
  if (!v) return;
  try {
    window.localStorage.setItem(`${KEY}_${restaurantId}`, storedOrderSourceValue(v, Date.now()));
  } catch {
    /* sin almacenamiento: el pedido sale con el origen deducido */
  }
}

/** Lo que el checkout pega al pedido. */
export function readStoredOrderSource(restaurantId: string): StoredOrderSource | null {
  if (!restaurantId || typeof window === "undefined") return null;
  try {
    return parseStoredOrderSource(window.localStorage.getItem(`${KEY}_${restaurantId}`), Date.now());
  } catch {
    return null;
  }
}

/**
 * El `source` de un pedido web. Puro.
 * 1. Mesa (QR de la mesa) → qr_menu.
 * 2. `src` del link (guardado) → ese.
 * 3. Código de referido → referral.
 * 4. Tarjeta impresa de la bolsa → qr_menu.
 * 5. Lo demás → web_link (llegó por el link del menú).
 */
export function resolveWebOrderSource(input: {
  stored?: StoredOrderSource | null;
  tableNumber?: string | null;
  referralCode?: string | null;
  entrySource?: string | null;
}): { source: OrderAttributionSource; sourceRef: string | null } {
  if ((input.tableNumber ?? "").trim()) return { source: "qr_menu", sourceRef: null };
  const st = input.stored;
  if (st && st.source !== "pos" && st.source !== "unknown" && parseOrderSource(st.source)) {
    return { source: st.source, sourceRef: parseSourceRef(st.ref) };
  }
  if (input.referralCode) return { source: "referral", sourceRef: null };
  if (input.entrySource === "bolsa") return { source: "qr_menu", sourceRef: null };
  return { source: "web_link", sourceRef: null };
}
