// lib/schedule.ts
//
// Horario del negocio — espejo EXACTO de FilterService.isOpenNow del app
// (FOODPASS/lib/pages/restaurant_search_page/services/filter_service.dart):
//   restaurants/{rid}.businessHours[day] =
//     { isClosed: bool, openingTime: {hour, minute}, closingTime: {hour, minute} }
//   Claves de día en minúscula O Capitalizadas ("monday" | "Monday") — el app
//   acepta ambas y aquí también.
//   Nocturno soportado: 21:00–02:00 abre en la noche y "cierra" de madrugada.
//   (Igual que el app, la madrugada se evalúa contra el horario del día ACTUAL
//   — misma regla en ambas plataformas o en ninguna.)
//
// OJO — son DOS preguntas distintas:
//   isOpenNow()            "¿está abierto?" — sin datos responde false
//                          (conservador, igual que el puntito del mapa del app).
//   isPositivelyClosedNow() "¿debo BLOQUEAR pedidos?" — sin businessHours
//                          responde false: NUNCA matamos ventas por datos
//                          faltantes. Solo bloqueamos cuando el horario
//                          configurado dice positivamente "cerrado".

const DAY_KEYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

const DAY_LABELS_ES = [
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
  "domingo",
] as const;

type TimeHM = { hour: number; minute: number };

type DayHours = {
  isClosed: boolean;
  open: TimeHM | null;
  close: TimeHM | null;
};

export type ScheduleStatus = { open: boolean; label: string };

/** businessHours del doc del restaurante, o null si no está configurado. */
export function parseBusinessHours(
  rdata: Record<string, unknown>,
): Record<string, unknown> | null {
  const bh = rdata.businessHours;
  return bh && typeof bh === "object" && !Array.isArray(bh)
    ? (bh as Record<string, unknown>)
    : null;
}

/** JS Date.getDay() (0=domingo) → índice 0=lunes…6=domingo (como el app). */
function dayIdxFor(now: Date): number {
  return (now.getDay() + 6) % 7;
}

function readDay(hours: Record<string, unknown>, dayIdx: number): DayHours | null {
  const lower = DAY_KEYS[dayIdx];
  const cap = lower[0].toUpperCase() + lower.slice(1);
  const raw = hours[lower] ?? hours[cap];
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Record<string, unknown>;
  const t = (v: unknown): TimeHM | null => {
    if (!v || typeof v !== "object") return null;
    const m = v as Record<string, unknown>;
    return {
      hour: typeof m.hour === "number" ? m.hour : 0,
      minute: typeof m.minute === "number" ? m.minute : 0,
    };
  };
  return {
    // App: `dayHours['isClosed'] as bool? ?? true` — ausente = cerrado.
    isClosed: typeof d.isClosed === "boolean" ? d.isClosed : true,
    open: t(d.openingTime),
    close: t(d.closingTime),
  };
}

/** Misma aritmética que _isCurrentlyOpenFromNumbers del app (incl. nocturno). */
function isWithin(open: TimeHM, close: TimeHM, now: Date): boolean {
  const cur = now.getHours() * 60 + now.getMinutes();
  const o = open.hour * 60 + open.minute;
  const c = close.hour * 60 + close.minute;
  if (o < c) return cur >= o && cur < c; // mismo día (9 AM – 5 PM)
  return cur >= o || cur < c; // nocturno (9 PM – 2 AM)
}

/** ¿Abierto ahorita? Sin datos → false (conservador, como el mapa del app). */
export function isOpenNow(rdata: Record<string, unknown>, now: Date = new Date()): boolean {
  const hours = parseBusinessHours(rdata);
  if (!hours) return false;
  const d = readDay(hours, dayIdxFor(now));
  if (!d || d.isClosed || !d.open || !d.close) return false;
  return isWithin(d.open, d.close, now);
}

/**
 * ¿Bloquear pedidos? true SOLO cuando hay horario configurado Y dice cerrado.
 * Sin businessHours → false: nunca bloqueamos ventas por datos faltantes.
 */
export function isPositivelyClosedNow(
  rdata: Record<string, unknown>,
  now: Date = new Date(),
): boolean {
  return parseBusinessHours(rdata) !== null && !isOpenNow(rdata, now);
}

function fmt12(t: TimeHM): string {
  const h12 = ((t.hour + 11) % 12) + 1;
  const mm = String(t.minute).padStart(2, "0");
  const ampm = t.hour >= 12 ? "pm" : "am";
  return `${h12}:${mm} ${ampm}`;
}

/**
 * Estado para mostrarle al cliente:
 *   { open: true,  label: "Abierto · cierra 8:00 pm" }
 *   { open: false, label: "Cerrado · abre mañana 9:00 am" }
 * null cuando el negocio no tiene horario configurado (no se muestra nada).
 */
export function scheduleStatus(
  rdata: Record<string, unknown>,
  now: Date = new Date(),
): ScheduleStatus | null {
  const hours = parseBusinessHours(rdata);
  if (!hours) return null;

  const todayIdx = dayIdxFor(now);
  if (isOpenNow(rdata, now)) {
    const d = readDay(hours, todayIdx);
    const closes = d?.close ? ` · cierra ${fmt12(d.close)}` : "";
    return { open: true, label: `Abierto${closes}` };
  }

  // Cerrado: buscar la siguiente apertura en los próximos 7 días.
  const curMin = now.getHours() * 60 + now.getMinutes();
  for (let i = 0; i < 7; i++) {
    const idx = (todayIdx + i) % 7;
    const d = readDay(hours, idx);
    if (!d || d.isClosed || !d.open || !d.close) continue;
    const openMin = d.open.hour * 60 + d.open.minute;
    if (i === 0 && curMin >= openMin) continue; // hoy ya pasó la apertura
    const when = i === 0 ? "hoy" : i === 1 ? "mañana" : `el ${DAY_LABELS_ES[idx]}`;
    return { open: false, label: `Cerrado · abre ${when} ${fmt12(d.open)}` };
  }
  return { open: false, label: "Cerrado" };
}
