/**
 * Ventanas de horario por categoría (10-sep-2026): "Desayunos de 9 a 12,
 * Fuertes de 1 a 8". Nació con Café de la Tercera, cuyo papel tiene AM y PM.
 *
 * POR QUÉ EXISTE: un menú con secciones por hora no se podía contar. Antes la
 * única herramienta era apagar platillos a mano dos veces al día.
 *
 * Dato: `restaurants/{id}.menuCategoryWindows` = { [categoría normalizada]:
 * [{ days: [1..7 ISO, lunes=1], from: "HH:mm", to: "HH:mm" }, …] }.
 * Sin entrada para una categoría = todo el día (a nadie más le cambia nada).
 *
 * En el menú público la categoría fuera de su hora NO se esconde: se ve
 * apagada con su horario y cuándo vuelve, y sus platillos no se agregan. El
 * que llega a las 12:30 buscando chilaquiles debe ver que existen y cuándo.
 * La Caja no filtra: el cajero cobra lo que sea.
 *
 * Espejo EXACTO de `lib/utils/menu_category_windows.dart` (app). Candado:
 * scripts/validate-menu-category-windows.mjs. La hora es la LOCAL del que
 * mira (igual que el chip abierto/cerrado).
 */
// Sin imports a propósito: el candado corre en node pelón (sin alias "@/").
// `keyOf` es la misma normalización que lib/menu/categoryOrder.ts y `fmt12`
// el mismo formato que lib/schedule.ts ("9:00 am"); si cambian allá, aquí.
const DAY_LABELS_ES = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];

function normalizeCategoryKey(v: unknown): string {
  if (typeof v !== "string") return "";
  return v
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9ñ]+/g, " ")
    .trim();
}

function fmt12(t: { hour: number; minute: number }): string {
  const h12 = ((t.hour + 11) % 12) + 1;
  const mm = String(t.minute).padStart(2, "0");
  return `${h12}:${mm} ${t.hour >= 12 ? "pm" : "am"}`;
}

export const MENU_CATEGORY_WINDOWS_FIELD = "menuCategoryWindows";

export type CategoryWindow = { days: number[]; from: string; to: string };
export type CategoryWindows = Record<string, CategoryWindow[]>;

export type CategoryAvailability =
  | { always: true }
  | {
      always: false;
      openNow: boolean;
      /** "Hasta las 12:00 pm" (abierta) · "Solo de 9:00 am a 12:00 pm" (fuera de hora). */
      hoursLabel: string;
      /** Solo fuera de hora: "hoy desde la 1:00 pm" / "mañana desde las 10:00 am". Jamás "cerrado": suena a que el LOCAL está cerrado (Ricardo, 10-sep). */
      nextLabel: string | null;
    };

const HM = /^(\d{1,2}):(\d{2})$/;

function toMinutes(v: unknown): number | null {
  if (typeof v !== "string") return null;
  const m = HM.exec(v.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mm = Number(m[2]);
  if (h < 0 || h > 24 || mm < 0 || mm > 59) return null;
  return h * 60 + mm;
}

function cleanWindow(v: unknown): CategoryWindow | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const from = toMinutes(o.from);
  const to = toMinutes(o.to);
  if (from === null || to === null || to <= from) return null;
  const days = Array.isArray(o.days)
    ? o.days.filter((d): d is number => Number.isInteger(d) && (d as number) >= 1 && (d as number) <= 7)
    : [1, 2, 3, 4, 5, 6, 7];
  if (!days.length) return null;
  return { days, from: o.from as string, to: o.to as string };
}

/** Las ventanas del doc, limpias y con la categoría normalizada. {} si no hay. */
export function categoryWindowsFromRestaurant(
  raw: Record<string, unknown> | null | undefined,
): CategoryWindows {
  const v = raw?.[MENU_CATEGORY_WINDOWS_FIELD];
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  const out: CategoryWindows = {};
  for (const [cat, list] of Object.entries(v as Record<string, unknown>)) {
    const key = normalizeCategoryKey(cat);
    if (!key || !Array.isArray(list)) continue;
    const ws = list.map(cleanWindow).filter((w): w is CategoryWindow => w !== null);
    if (ws.length) out[key] = ws;
  }
  return out;
}

/** Lunes=1 … Domingo=7, con la hora local del visitante. */
export function isoWeekday(now: Date): number {
  return ((now.getDay() + 6) % 7) + 1;
}

function fmtMin(min: number): string {
  return fmt12({ hour: Math.floor(min / 60) % 24, minute: min % 60 });
}

/** "desde la 1:00 pm" / "desde las 10:00 am" — el español cuenta la una en singular. */
function desdeLas(min: number): string {
  const h12 = ((Math.floor(min / 60) + 11) % 12) + 1;
  return `${h12 === 1 ? "desde la" : "desde las"} ${fmtMin(min)}`;
}

export function categoryAvailability(
  category: string,
  windows: CategoryWindows,
  now: Date = new Date(),
): CategoryAvailability {
  const ws = windows[normalizeCategoryKey(category)];
  if (!ws || !ws.length) return { always: true };
  const today = isoWeekday(now);
  const cur = now.getHours() * 60 + now.getMinutes();
  const todays = ws
    .filter((w) => w.days.includes(today))
    .map((w) => ({ from: toMinutes(w.from)!, to: toMinutes(w.to)! }))
    .sort((a, b) => a.from - b.from);

  const active = todays.find((w) => cur >= w.from && cur < w.to);
  if (active) {
    return { always: false, openNow: true, hoursLabel: `Hasta las ${fmtMin(active.to)}`, nextLabel: null };
  }

  // Cerrada: horario de hoy (o del próximo día con ventana) + cuándo vuelve.
  const later = todays.find((w) => cur < w.from);
  if (later) {
    return {
      always: false,
      openNow: false,
      hoursLabel: `Solo de ${fmtMin(later.from)} a ${fmtMin(later.to)}`,
      nextLabel: `hoy ${desdeLas(later.from)}`,
    };
  }
  for (let i = 1; i <= 7; i++) {
    const day = ((today - 1 + i) % 7) + 1;
    const next = ws
      .filter((w) => w.days.includes(day))
      .map((w) => ({ from: toMinutes(w.from)!, to: toMinutes(w.to)! }))
      .sort((a, b) => a.from - b.from)[0];
    if (!next) continue;
    const when = i === 1 ? "mañana" : `el ${DAY_LABELS_ES[day - 1]}`;
    return {
      always: false,
      openNow: false,
      hoursLabel: `Solo de ${fmtMin(next.from)} a ${fmtMin(next.to)}`,
      nextLabel: `${when} ${desdeLas(next.from)}`,
    };
  }
  return { always: false, openNow: false, hoursLabel: "Solo a ciertas horas", nextLabel: null };
}

/** Una sola línea para pintar junto al título de la categoría. */
export function categoryAvailabilityLabel(a: CategoryAvailability): string | null {
  if (a.always) return null;
  if (a.openNow) return a.hoursLabel;
  return a.nextLabel ? `${a.hoursLabel} · ${a.nextLabel}` : a.hoursLabel;
}
