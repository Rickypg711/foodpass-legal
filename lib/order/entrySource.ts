// lib/order/entrySource.ts
//
// ¿Por dónde llegó el cliente? (8-oct-2026). Hoy solo "tarjeta": la tarjeta o
// sticker impreso que el dueño mete en los pedidos de Rappi/DiDi
// (/vendor/bolsa). Su QR abre /menu/{rid}?utm_source=bolsa&utm_medium=impreso.
//
// Sin esto el dueño imprimía tarjetas a ciegas: nadie contaba cuántas
// escaneaban ni cuántas terminaban en pedido, y una herramienta que no enseña
// su resultado se deja de usar. Mismo patrón que el referido
// (lib/referral/refSession.ts): se guarda en el navegador al abrir el menú y el
// checkout lo pega al pedido en el último momento.
//
// localStorage, 14 días, llave por local (lo de un local jamás se cuela a otro).
// Nunca truena: sin almacenamiento, el pedido sale igual que siempre.

export const ENTRY_SOURCES = ["bolsa"] as const;
export type EntrySource = (typeof ENTRY_SOURCES)[number];

const KEY = "cml_entry";
const TTL_MS = 14 * 24 * 60 * 60 * 1000;

export function parseEntrySource(v: unknown): EntrySource | null {
  return typeof v === "string" && (ENTRY_SOURCES as readonly string[]).includes(v) ? (v as EntrySource) : null;
}

/** Lee la URL: solo cuenta si viene impreso (utm_medium=impreso). */
export function entrySourceFromSearch(search: string): EntrySource | null {
  try {
    const sp = new URLSearchParams(search);
    if (sp.get("utm_medium") !== "impreso") return null;
    return parseEntrySource(sp.get("utm_source"));
  } catch {
    return null;
  }
}

export function storedEntryValue(source: EntrySource, nowMs: number): string {
  return JSON.stringify({ s: source, t: nowMs });
}

export function parseStoredEntry(raw: string | null, nowMs: number): EntrySource | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as { s?: unknown; t?: unknown };
    if (typeof o.t !== "number" || nowMs - o.t > TTL_MS || nowMs < o.t) return null;
    return parseEntrySource(o.s);
  } catch {
    return null;
  }
}

/**
 * Al abrir el menú: si llegó por la tarjeta, lo guarda y suma 1 escaneo
 * (una vez por sesión) en restaurants/{id}/private/stats.linkVisits.bolsa,
 * el mismo contador del "abrieron tu link" del Panel. No guarda nada de la persona.
 */
export function captureEntrySource(restaurantId: string): void {
  if (!restaurantId || typeof window === "undefined") return;
  const src = entrySourceFromSearch(window.location.search);
  if (!src) return;
  try {
    window.localStorage.setItem(`${KEY}_${restaurantId}`, storedEntryValue(src, Date.now()));
  } catch {
    /* sin almacenamiento: no se recuerda */
  }
  try {
    const once = `cml_entry_visit_${restaurantId}_${src}`;
    if (window.sessionStorage.getItem(once)) return;
    window.sessionStorage.setItem(once, "1");
  } catch {
    /* se cuenta igual */
  }
  void fetch("/api/landing-visit", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ restaurantId, source: src }),
    keepalive: true,
  }).catch(() => {});
}

/** Lo que el checkout pega al pedido. */
export function readStoredEntrySource(restaurantId: string): EntrySource | null {
  if (!restaurantId || typeof window === "undefined") return null;
  try {
    return parseStoredEntry(window.localStorage.getItem(`${KEY}_${restaurantId}`), Date.now());
  } catch {
    return null;
  }
}
