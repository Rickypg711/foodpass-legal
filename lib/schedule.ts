// lib/schedule.ts
//
// Horario del negocio — espejo EXACTO del evaluador del app
// (FOODPASS BusinessHoursUtils.activeWindowAt):
//   restaurants/{rid}.businessHours[day] =
//     { isClosed: bool, openingTime: {hour, minute}, closingTime: {hour, minute} }
//   Claves de día en minúscula O Capitalizadas ("monday" | "Monday") — el app
//   acepta ambas y aquí también.
//   Nocturno soportado con DERRAME DE AYER: 16:00–02:00 sigue abierto a la
//   1 AM aunque HOY esté cerrado o abra a otra hora — la madrugada se evalúa
//   primero contra la ventana nocturna del día ANTERIOR (misma regla en
//   ambas plataformas o en ninguna; el "solo la fila de hoy" era el bug).
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

/**
 * Cierre manual "por hoy": restaurants/{id}.manualCloseUntil. Cerrado
 * mientras now < manualCloseUntil — auto-expira al corte del día (lo escribe
 * el app del dueño con corte 4 AM). Acepta Timestamp del SDK (toDate),
 * {seconds}, REST {timestampValue}, Date, epoch ms e ISO string.
 */
function manualCloseUntilOf(rdata: Record<string, unknown>): Date | null {
  const raw = rdata["manualCloseUntil"];
  if (!raw) return null;
  if (raw instanceof Date) return raw;
  if (typeof raw === "number") return new Date(raw);
  if (typeof raw === "string") {
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof raw === "object") {
    const o = raw as { toDate?: () => Date; timestampValue?: unknown; seconds?: unknown };
    if (typeof o.toDate === "function") {
      try {
        return o.toDate();
      } catch {
        return null;
      }
    }
    if (typeof o.timestampValue === "string") {
      const d = new Date(o.timestampValue);
      return isNaN(d.getTime()) ? null : d;
    }
    if (typeof o.seconds === "number") return new Date(o.seconds * 1000);
  }
  return null;
}

/** ¿El dueño cerró manualmente y sigue vigente? Gana al horario en TODO. */
export function manuallyClosedNow(
  rdata: Record<string, unknown>,
  now: Date = new Date(),
): boolean {
  const until = manualCloseUntilOf(rdata);
  return until !== null && now < until;
}

/**
 * Apertura manual "Abrir ahora" (espejo del cierre): manualOpenUntil abre
 * fuera de horario, mismo auto-expire al corte 4 AM. Excluyentes: quien
 * escribe uno borra el otro; si ambos existieran, el cierre gana.
 */
function manualOpenUntilOf(rdata: Record<string, unknown>): Date | null {
  const raw = rdata["manualOpenUntil"];
  if (!raw) return null;
  if (raw instanceof Date) return raw;
  if (typeof raw === "number") return new Date(raw);
  if (typeof raw === "string") {
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof raw === "object") {
    const o = raw as { toDate?: () => Date; timestampValue?: unknown; seconds?: unknown };
    if (typeof o.toDate === "function") {
      try {
        return o.toDate();
      } catch {
        return null;
      }
    }
    if (typeof o.timestampValue === "string") {
      const d = new Date(o.timestampValue);
      return isNaN(d.getTime()) ? null : d;
    }
    if (typeof o.seconds === "number") return new Date(o.seconds * 1000);
  }
  return null;
}

/** ¿El dueño abrió manualmente y sigue vigente? (el cierre manual le gana) */
export function manuallyOpenNow(
  rdata: Record<string, unknown>,
  now: Date = new Date(),
): boolean {
  if (manuallyClosedNow(rdata, now)) return false;
  const until = manualOpenUntilOf(rdata);
  return until !== null && now < until;
}

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

function spansMidnight(d: DayHours): boolean {
  if (!d.open || !d.close) return false;
  const o = d.open.hour * 60 + d.open.minute;
  const c = d.close.hour * 60 + d.close.minute;
  return c <= o;
}

/**
 * LA ventana activa en `now`, o null si está cerrado — espejo de
 * activeWindowAt del app. Revisa PRIMERO el derrame nocturno de AYER
 * (a la 1 AM manda el turno de anoche), luego la ventana de HOY (en
 * nocturno, solo su parte vespertina: la madrugada la cubre el derrame
 * de mañana).
 */
function activeWindowAt(
  hours: Record<string, unknown>,
  now: Date,
): { close: TimeHM } | null {
  const cur = now.getHours() * 60 + now.getMinutes();

  // 1) Derrame nocturno de ayer.
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  const yd = readDay(hours, dayIdxFor(y));
  if (yd && !yd.isClosed && yd.open && yd.close && spansMidnight(yd)) {
    const c = yd.close.hour * 60 + yd.close.minute;
    if (cur < c) return { close: yd.close };
  }

  // 2) Ventana de hoy.
  const d = readDay(hours, dayIdxFor(now));
  if (d && !d.isClosed && d.open && d.close) {
    const o = d.open.hour * 60 + d.open.minute;
    const c = d.close.hour * 60 + d.close.minute;
    if (o < c ? cur >= o && cur < c : cur >= o) return { close: d.close };
  }
  return null;
}

/**
 * Avance ESPERADO del día (0..100) según el horario real del negocio — joya
 * robada de la app 27-ago (today_overview_card._expectedProgressPercentFromBusinessHours):
 * el ritmo a meta se mide contra la ventana de apertura de HOY, no contra un
 * día de 24h, incluyendo el derrame nocturno de ayer (cerró 2 AM → a la 1 AM
 * sigue midiendo contra el turno de anoche). null = hoy cerrado y sin
 * derrame: la línea de ritmo simplemente no se muestra.
 */
export function expectedDayProgressPercent(
  rdata: Record<string, unknown>,
  now: Date = new Date(),
): number | null {
  const hours = parseBusinessHours(rdata);
  if (!hours) return null;

  const pct = (openAt: Date, closeAt: Date): number | null => {
    const total = closeAt.getTime() - openAt.getTime();
    if (total <= 0) return null;
    if (now < openAt) return null;
    if (now > closeAt) return 100;
    return ((now.getTime() - openAt.getTime()) / total) * 100;
  };

  // 1) Derrame nocturno de AYER (a la 1 AM manda el turno de anoche).
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  const yd = readDay(hours, dayIdxFor(y));
  if (yd && !yd.isClosed && yd.open && yd.close && spansMidnight(yd)) {
    const openAtY = new Date(y.getFullYear(), y.getMonth(), y.getDate(), yd.open.hour, yd.open.minute);
    const closeAtT = new Date(now.getFullYear(), now.getMonth(), now.getDate(), yd.close.hour, yd.close.minute);
    if (now >= openAtY && now <= closeAtT) return pct(openAtY, closeAtT);
  }

  // 2) Ventana de HOY (nocturna cierra mañana).
  const d = readDay(hours, dayIdxFor(now));
  if (!d || d.isClosed) return null; // hoy cerrado → sin línea de ritmo
  if (!d.open || !d.close) return null;
  const openAt = new Date(now.getFullYear(), now.getMonth(), now.getDate(), d.open.hour, d.open.minute);
  let closeAt = new Date(now.getFullYear(), now.getMonth(), now.getDate(), d.close.hour, d.close.minute);
  if (closeAt <= openAt) closeAt = new Date(closeAt.getTime() + 24 * 60 * 60 * 1000);
  if (now < openAt) return 0; // día abierto, antes de abrir → 0% de la ventana
  return pct(openAt, closeAt);
}

/** ¿Abierto ahorita? Sin datos → false (conservador, como el mapa del app). */
export function isOpenNow(rdata: Record<string, unknown>, now: Date = new Date()): boolean {
  if (manuallyClosedNow(rdata, now)) return false;
  if (manuallyOpenNow(rdata, now)) return true;
  const hours = parseBusinessHours(rdata);
  if (!hours) return false;
  return activeWindowAt(hours, now) !== null;
}

/**
 * ¿Bloquear pedidos? true cuando el dueño cerró MANUALMENTE (dato explícito,
 * bloquea aun sin horario) o cuando hay horario configurado Y dice cerrado.
 * Sin businessHours ni cierre manual → false: nunca bloqueamos ventas por
 * datos faltantes.
 */
export function isPositivelyClosedNow(
  rdata: Record<string, unknown>,
  now: Date = new Date(),
): boolean {
  if (manuallyClosedNow(rdata, now)) return true;
  if (manuallyOpenNow(rdata, now)) return false;
  return parseBusinessHours(rdata) !== null && !isOpenNow(rdata, now);
}

function fmt12(t: TimeHM): string {
  const h12 = ((t.hour + 11) % 12) + 1;
  const mm = String(t.minute).padStart(2, "0");
  const ampm = t.hour >= 12 ? "pm" : "am";
  return `${h12}:${mm} ${ampm}`;
}

/** Día en formato schema.org ("Monday"…) + horas "HH:MM" de 24h. */
export type WeeklyHoursRaw = { day: string; opens: string; closes: string };

/**
 * Horario semanal CRUDO para datos estructurados (JSON-LD
 * openingHoursSpecification): solo días abiertos, horas en 24h. Ventanas
 * nocturnas se emiten tal cual (opens 16:00 / closes 02:00 — schema.org lo
 * interpreta como "cruza medianoche"). null sin businessHours.
 */
export function weeklyHoursRaw(
  rdata: Record<string, unknown>,
): WeeklyHoursRaw[] | null {
  const hours = parseBusinessHours(rdata);
  if (!hours) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  const out: WeeklyHoursRaw[] = [];
  for (let idx = 0; idx < DAY_KEYS.length; idx++) {
    const d = readDay(hours, idx);
    if (!d || d.isClosed || !d.open || !d.close) continue;
    const key = DAY_KEYS[idx];
    out.push({
      day: key[0].toUpperCase() + key.slice(1),
      opens: `${pad(d.open.hour)}:${pad(d.open.minute)}`,
      closes: `${pad(d.close.hour)}:${pad(d.close.minute)}`,
    });
  }
  return out;
}

export type WeeklyScheduleRow = {
  /** "lunes" … "domingo" */
  day: string;
  /** "9:00 am – 8:00 pm" o "Cerrado" */
  hours: string;
  /** true para la fila del día de HOY (para resaltarla en la UI). */
  isToday: boolean;
};

/**
 * Horario semanal para la página pública del restaurante (landing).
 * null cuando no hay businessHours configurado — la sección no se muestra
 * (misma regla de oro: sin datos no inventamos ni bloqueamos nada).
 */
export function weeklySchedule(
  rdata: Record<string, unknown>,
  now: Date = new Date(),
): WeeklyScheduleRow[] | null {
  const hours = parseBusinessHours(rdata);
  if (!hours) return null;
  const todayIdx = dayIdxFor(now);
  return DAY_LABELS_ES.map((label, idx) => {
    const d = readDay(hours, idx);
    const openRow = d && !d.isClosed && d.open && d.close;
    return {
      day: label,
      hours: openRow ? `${fmt12(d.open!)} – ${fmt12(d.close!)}` : "Cerrado",
      isToday: idx === todayIdx,
    };
  });
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
  // Cierre manual: gana al horario y se muestra aun sin businessHours —
  // acción explícita del dueño, no dato faltante (paridad con el app).
  if (manuallyClosedNow(rdata, now)) {
    return { open: false, label: "Cerrado por hoy" };
  }
  if (manuallyOpenNow(rdata, now)) {
    // Con ventana REAL de horario cae al flujo normal ("Abierto · cierra X");
    // fuera de horario no prometemos hora de cierre.
    const hours = parseBusinessHours(rdata);
    const window = hours ? activeWindowAt(hours, now) : null;
    if (!window) return { open: true, label: "Abierto ahora" };
  }
  const hours = parseBusinessHours(rdata);
  if (!hours) return null;

  const todayIdx = dayIdxFor(now);
  const window = activeWindowAt(hours, now);
  if (window) {
    // Cierre de la ventana ACTIVA (a la 1 AM: el de anoche, "cierra 2:00 am").
    return { open: true, label: `Abierto · cierra ${fmt12(window.close)}` };
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
