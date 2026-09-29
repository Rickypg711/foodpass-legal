// lib/loyalty/winbackSignals.ts
//
// Señales del win-back por teléfono (29-sep-2026). Funciones PURAS que la
// Caja usa dentro de la transacción de crédito (phonePoints.ts) para que el
// cliente de teléfono guarde lo que la IA necesita y para atribuir el
// regreso al mensaje del dueño.
//
// Espejo EXACTO de FOODPASS lib/loyalty/winback_signals.dart y de
// functions/winback_signals.js (mismos nombres, mismos topes).
//
// Campos en restaurants/{rid}/phoneCustomers/{phone10}:
//   recentItems        últimos platillos, el más reciente primero (máx 8)
//   visitLog           [{at, dow(1=lun..7=dom), hour, total, via}] (máx 10)
//   lastWinbackAt      último mensaje del dueño (lo pone el callable)
//   winbackReturnedAt  última vez que regresó después de un mensaje
//   winbackReturns     cuántas veces regresó tras un mensaje
//   winbackHistory     [{sentAt, hook, returnedAt?, daysToReturn?}] (máx 10)

import { Timestamp } from "firebase/firestore";

export const RECENT_ITEMS_MAX = 8;
export const VISIT_LOG_MAX = 10;
export const WINBACK_HISTORY_MAX = 10;
/** Una visita cuenta como "regresó por el mensaje" si cae dentro de esto. */
export const WINBACK_RETURN_WINDOW_DAYS = 30;

type Row = Record<string, unknown>;

function toDate(v: unknown): Date | null {
  if (v == null) return null;
  if (v instanceof Date) return v;
  if (typeof v === "number") return new Date(v);
  const t = v as { toDate?: () => Date; seconds?: number };
  if (typeof t.toDate === "function") return t.toDate();
  if (typeof t.seconds === "number") return new Date(t.seconds * 1000);
  return null;
}

/** Nombres de los platillos de un pedido, sin repetir, en orden. */
export function itemNamesOfOrder(items: unknown): string[] {
  const out: string[] = [];
  if (!Array.isArray(items)) return out;
  for (const it of items) {
    if (!it || typeof it !== "object") continue;
    const r = it as Row;
    const raw = r.name ?? r.title ?? r.itemName;
    const name = typeof raw === "string" ? raw.trim() : "";
    if (!name || out.includes(name)) continue;
    out.push(name);
  }
  return out;
}

/** Los de este pedido primero, luego los anteriores sin repetir, tope 8. */
export function mergeRecentItems(prevItems: unknown, orderItems: string[]): string[] {
  const out: string[] = [];
  for (const s of orderItems) {
    const t = s.trim();
    if (t && !out.includes(t)) out.push(t);
  }
  if (Array.isArray(prevItems)) {
    for (const s of prevItems) {
      if (typeof s !== "string") continue;
      const t = s.trim();
      if (t && !out.includes(t)) out.push(t);
    }
  }
  return out.slice(0, RECENT_ITEMS_MAX);
}

/** ISO: 1 = lunes … 7 = domingo (JS getDay da 0 = domingo). */
export function isoWeekday(d: Date): number {
  const js = d.getDay();
  return js === 0 ? 7 : js;
}

/** Agrega la visita de hoy al visitLog (hora LOCAL de la Caja). */
export function appendVisitLog(
  prevLog: unknown,
  entry: { at: Date; total: number; via: string },
): Row[] {
  const out: Row[] = Array.isArray(prevLog)
    ? prevLog.filter((r): r is Row => !!r && typeof r === "object").map((r) => ({ ...r }))
    : [];
  out.push({
    at: Timestamp.fromDate(entry.at),
    dow: isoWeekday(entry.at),
    hour: entry.at.getHours(),
    total: Math.round(entry.total * 100) / 100,
    via: entry.via,
  });
  return out.length > VISIT_LOG_MAX ? out.slice(out.length - VISIT_LOG_MAX) : out;
}

/** ¿Esta visita es la PRIMERA después de un mensaje del dueño, en ventana? */
export function winbackReturnDetected(prev: Row, now: Date): boolean {
  const sent = toDate(prev.lastWinbackAt);
  if (!sent) return false;
  const last = toDate(prev.lastVisitAt);
  if (last && last.getTime() >= sent.getTime()) return false; // ya había vuelto
  const returned = toDate(prev.winbackReturnedAt);
  if (returned && returned.getTime() >= sent.getTime()) return false;
  const days = Math.floor((now.getTime() - sent.getTime()) / 86400000);
  return days <= WINBACK_RETURN_WINDOW_DAYS;
}

/** Marca en el historial el mensaje que trajo al cliente (el último sin returnedAt). */
export function markWinbackReturned(prevHistory: unknown, now: Date, total = 0): Row[] {
  const out: Row[] = Array.isArray(prevHistory)
    ? prevHistory.filter((r): r is Row => !!r && typeof r === "object").map((r) => ({ ...r }))
    : [];
  for (let i = out.length - 1; i >= 0; i--) {
    if (out[i].returnedAt != null) continue;
    const sent = toDate(out[i].sentAt);
    out[i].returnedAt = Timestamp.fromDate(now);
    out[i].daysToReturn = sent ? Math.floor((now.getTime() - sent.getTime()) / 86400000) : null;
    // Dinero que regresó con ese mensaje ("recuperaste $X").
    out[i].returnedTotal = Math.round(total * 100) / 100;
    break;
  }
  return out.length > WINBACK_HISTORY_MAX ? out.slice(out.length - WINBACK_HISTORY_MAX) : out;
}

/**
 * Campos que la transacción de crédito suma al `set(merge)` del cliente.
 * Una sola función para que la Caja y Pedidos escriban exactamente lo mismo.
 */
export function winbackFieldsForVisit(params: {
  prev: Row;
  now: Date;
  total: number;
  via: string;
  orderItems?: string[];
}): Row {
  const { prev, now, total, via, orderItems = [] } = params;
  const fields: Row = {
    visitLog: appendVisitLog(prev.visitLog, { at: now, total, via }),
  };
  if (orderItems.length > 0) {
    fields.recentItems = mergeRecentItems(prev.recentItems, orderItems);
  }
  if (winbackReturnDetected(prev, now)) {
    fields.winbackReturnedAt = Timestamp.fromDate(now);
    fields.winbackReturns = (Number(prev.winbackReturns) || 0) + 1;
    fields.winbackRecoveredTotal = Math.round(((Number(prev.winbackRecoveredTotal) || 0) + total) * 100) / 100;
    fields.winbackHistory = markWinbackReturned(prev.winbackHistory, now, total);
  }
  return fields;
}
