// lib/loyalty/freeItems.ts
//
// Tacos como filas — espejo EXACTO de FOODPASS/functions/free_items.js y de la
// app (docs/REFERIDOS_POR_TELEFONO.md §6 y §7). Si cambia uno, cambian los tres.
//
// Antes la bienvenida era un sí/no (`firstVisitRewardUnlocked`) y un sí/no no
// puede guardar dos tacos ni dos fechas: con la bienvenida pendiente y el amigo
// pagando al día siguiente, el taco de referido se perdía.
//
// Ahora cada taco es una fila en restaurants/{rid}/phoneCustomers/{phone}:
//   { id, source: 'welcome'|'referral', itemName, bornAt, seenAt|null,
//     expiresAt, redeemedAt|null, redeemedOrderId|null }
// y la bandera pasa a significar "hay al menos un taco vivo".
//
// QUIÉN ESCRIBE: solo el servidor (trigger + endpoints con Admin SDK). La web
// NUNCA escribe `freeItems` — las reglas de Firestore no la dejan. Para canjear
// deja `freeItemsRedeemIntent = { orderId, via }` y el servidor marca la fila.
//
// Nadie recalcula el vencimiento: se LEE de `expiresAt`. La cuenta de aquí
// (computeExpiresAtMs) existe solo para que el servidor la fije al nacer y al
// primer "visto"; las pantallas solo comparan con ahora.

export const DAY_MS = 86400000;
/** Días que vive un taco desde que el comensal lo VE. */
export const SEEN_WINDOW_DAYS = 7;
/** Tope duro desde que nace, lo vea o no. */
export const BORN_CAP_DAYS = 30;

export type FreeItemSource = "welcome" | "referral";

export type FreeItemRow = {
  id: string;
  source: FreeItemSource | string;
  itemName: string;
  bornAt?: unknown;
  seenAt?: unknown;
  expiresAt?: unknown;
  redeemedAt?: unknown;
  redeemedOrderId?: string | null;
  redeemedVia?: string;
  referredName?: string;
};

/** Timestamp | Date | number | {seconds} → ms (o null). Igual que en functions. */
export function toMs(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (v instanceof Date) return v.getTime();
  const o = v as {
    toMillis?: () => number;
    toDate?: () => Date;
    _seconds?: number;
    _nanoseconds?: number;
    seconds?: number;
  };
  if (typeof o.toMillis === "function") return o.toMillis();
  if (typeof o.toDate === "function") return o.toDate().getTime();
  if (typeof o._seconds === "number") {
    return o._seconds * 1000 + Math.floor((o._nanoseconds ?? 0) / 1e6);
  }
  if (typeof o.seconds === "number") return o.seconds * 1000;
  return null;
}

/** expiresAt = min(seenAt + 7 d, bornAt + 30 d); sin seenAt = bornAt + 30 d. */
export function computeExpiresAtMs(
  bornAtMs: number,
  seenAtMs: number | null,
): number {
  const cap = bornAtMs + BORN_CAP_DAYS * DAY_MS;
  if (seenAtMs == null) return cap;
  return Math.min(seenAtMs + SEEN_WINDOW_DAYS * DAY_MS, cap);
}

/** Vivo = sin canjear y sin vencer. */
export function isLive(row: FreeItemRow, nowMs: number = Date.now()): boolean {
  if (!row) return false;
  if (toMs(row.redeemedAt) != null) return false;
  const exp = toMs(row.expiresAt);
  return typeof exp === "number" && exp > nowMs;
}

export function parseRows(v: unknown): FreeItemRow[] {
  return Array.isArray(v) ? (v as FreeItemRow[]).filter((r) => r && typeof r.id === "string") : [];
}

/** Los tacos vivos, del que vence primero al que vence después. */
export function liveRows(
  rows: unknown,
  nowMs: number = Date.now(),
): FreeItemRow[] {
  return parseRows(rows)
    .filter((r) => isLive(r, nowMs))
    .sort((a, b) => (toMs(a.expiresAt) ?? 0) - (toMs(b.expiresAt) ?? 0));
}

/** La fila que se canjea: la viva que vence primero. Misma regla en los tres lados. */
export function soonestLive(
  rows: unknown,
  nowMs: number = Date.now(),
): FreeItemRow | null {
  const live = liveRows(rows, nowMs);
  return live.length ? live[0] : null;
}

export function anyLive(rows: unknown, nowMs: number = Date.now()): boolean {
  return liveRows(rows, nowMs).length > 0;
}

/** ¿Este local ya usa filas? Fuera de la compuerta todo sigue como antes. */
export function freeItemsEnabled(restaurant: unknown): boolean {
  const r = restaurant as { freeItemsV2Enabled?: unknown } | null | undefined;
  return !!r && r.freeItemsV2Enabled === true;
}

/**
 * ¿Se puede canjear la bienvenida/taco AHORA?
 *
 * Con la compuerta prendida manda la fila (`expiresAt`, que el servidor ya
 * calculó). Con la compuerta apagada, o sin filas todavía (doc sin migrar),
 * se cae al comportamiento de siempre que decide el llamador — por eso aquí
 * se devuelve `null`, que significa "no sé, usa la regla vieja".
 */
export function freeItemClaimable(
  restaurant: unknown,
  phoneCustomer: unknown,
  nowMs: number = Date.now(),
): boolean | null {
  if (!freeItemsEnabled(restaurant)) return null;
  const rows = parseRows((phoneCustomer as { freeItems?: unknown } | null)?.freeItems);
  if (!rows.length) return null;
  return anyLive(rows, nowMs);
}

/**
 * Días COMPLETOS que le quedan a un taco (0 = se muere hoy). Para el texto,
 * nunca para decidir — decidir es `isLive`. Se trunca, igual que el `.inDays`
 * de la app, para que las dos digan el mismo número.
 */
export function daysLeft(row: FreeItemRow, nowMs: number = Date.now()): number {
  const exp = toMs(row.expiresAt);
  if (exp == null) return 0;
  return Math.max(0, Math.floor((exp - nowMs) / DAY_MS));
}

/** "vence hoy" / "vence mañana" / "vence el 23 de septiembre" — copy de secundaria. */
export function expiryLabel(row: FreeItemRow, nowMs: number = Date.now()): string {
  const exp = toMs(row.expiresAt);
  if (exp == null) return "";
  const d = daysLeft(row, nowMs);
  if (d <= 0) return "vence hoy";
  if (d === 1) return "vence mañana";
  return `vence el ${new Date(exp).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "long",
  })}`;
}

/**
 * Marca "visto" las filas VIVAS que no tenían `seenAt` y recalcula su
 * vencimiento. Puro: devuelve filas nuevas (con fechas en ms) o `null` si no
 * había nada que marcar — así el servidor no escribe de gusto. Espejo de
 * `markSeen` en FOODPASS/functions/free_items.js.
 *
 * "Visto" = el bloque se DIBUJÓ en la pantalla del comensal. El preview de
 * WhatsApp no cuenta: hace el fetch del link pero no corre scripts.
 */
export function markSeenRows(
  rows: unknown,
  nowMs: number = Date.now(),
): FreeItemRow[] | null {
  const parsed = parseRows(rows);
  let changed = false;
  const out = parsed.map((r) => {
    if (!isLive(r, nowMs)) return r;
    if (toMs(r.seenAt) != null) return r;
    changed = true;
    const bornAtMs = toMs(r.bornAt) ?? nowMs;
    return { ...r, seenAt: nowMs, expiresAt: computeExpiresAtMs(bornAtMs, nowMs) };
  });
  return changed ? out : null;
}
