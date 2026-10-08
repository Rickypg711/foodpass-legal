/**
 * LAZOS CERRADOS DE LOS PATRONES — lado cliente (7-oct-2026).
 *
 * El cerebro (FOODPASS functions/pattern_loops.js) deja en
 * vendorInsights/current.patternLoops lo que cada consejo necesita para que el
 * dueño lo apruebe con UN toque:
 *   promo_weak_night → el WhatsApp ya escrito para su noche floja
 *   publish_combo    → el combo con su precio sugerido
 *   hide_stale_dish  → el platillo que dejó de venderse
 * y lo medido (lo que vendió la noche que mandó el mensaje, las unidades del
 * combo). Este archivo solo LEE y arma frases; la tarjeta hace el toque.
 *
 * ESPEJO: FOODPASS lib/reports/pattern_loops_insight.dart (mismas frases; el
 * candado scripts/validate-pattern-loops.mjs las compara).
 */

export const PATTERN_LOOP_CODES = ["promo_weak_night", "publish_combo", "hide_stale_dish"] as const;
export type PatternLoopCode = (typeof PATTERN_LOOP_CODES)[number];
export const TABLE_TAB_SUGGEST = "table_tab_suggest";

export function isPatternLoopCode(code: string): code is PatternLoopCode {
  return (PATTERN_LOOP_CODES as readonly string[]).includes(code);
}

export type WeakNightInsight = {
  weekday: number;
  weekdayName: string;
  perNight: number;
  avgPerNight: number;
  daysUntil: number;
  targetDayKey: string;
  active: boolean;
  alreadySent: boolean;
  message: string;
};
export type ComboInsight = {
  a: string;
  b: string;
  aId: string;
  bId: string;
  count: number;
  fullPrice: number;
  price: number;
  name: string;
  category: string;
};
export type StaleDishInsight = { id: string; name: string; prev: number };
export type PromoResults = {
  sent: number;
  measured: number;
  wins: number;
  avgLiftPct: number | null;
  last: { dayKey: string; weekdayName: string; revenue: number; baseline: number; liftPct: number } | null;
};
export type PatternLoopsInsight = {
  weakNight: WeakNightInsight | null;
  promoResults: PromoResults | null;
  combo: ComboInsight | null;
  staleDish: StaleDishInsight | null;
};

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const str = (v: unknown) => (typeof v === "string" ? v : "");

/** vendorInsights.patternLoops → forma segura (o null). */
export function parsePatternLoops(raw: unknown): PatternLoopsInsight | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const w = r.weakNight as Record<string, unknown> | null | undefined;
  const c = r.combo as Record<string, unknown> | null | undefined;
  const s = r.staleDish as Record<string, unknown> | null | undefined;
  const p = r.promoResults as Record<string, unknown> | null | undefined;
  const last = p?.last as Record<string, unknown> | null | undefined;
  return {
    weakNight:
      w && str(w.message).trim() && str(w.targetDayKey)
        ? {
            weekday: num(w.weekday),
            weekdayName: str(w.weekdayName),
            perNight: num(w.perNight),
            avgPerNight: num(w.avgPerNight),
            daysUntil: num(w.daysUntil),
            targetDayKey: str(w.targetDayKey),
            active: w.active === true,
            alreadySent: w.alreadySent === true,
            message: str(w.message).trim(),
          }
        : null,
    combo:
      c && str(c.a) && str(c.b) && num(c.price) > 0
        ? {
            a: str(c.a),
            b: str(c.b),
            aId: str(c.aId),
            bId: str(c.bId),
            count: num(c.count),
            fullPrice: num(c.fullPrice),
            price: num(c.price),
            name: str(c.name) || `${str(c.a)} + ${str(c.b)}`,
            category: str(c.category) || "Combos",
          }
        : null,
    staleDish: s && str(s.id) && str(s.name) ? { id: str(s.id), name: str(s.name), prev: num(s.prev) } : null,
    promoResults: p
      ? {
          sent: num(p.sent),
          measured: num(p.measured),
          wins: num(p.wins),
          avgLiftPct: typeof p.avgLiftPct === "number" ? p.avgLiftPct : null,
          last:
            last && str(last.dayKey)
              ? {
                  dayKey: str(last.dayKey),
                  weekdayName: str(last.weekdayName),
                  revenue: num(last.revenue),
                  baseline: num(last.baseline),
                  liftPct: num(last.liftPct),
                }
              : null,
        }
      : null,
  };
}

/** ¿Este consejo tiene con qué hacerse en un toque? */
export function loopReady(code: string, loops: PatternLoopsInsight | null): boolean {
  if (!loops) return false;
  if (code === "promo_weak_night") return !!loops.weakNight;
  if (code === "publish_combo") return !!loops.combo;
  if (code === "hide_stale_dish") return !!loops.staleDish;
  return false;
}

function money(n: number): string {
  const v = Math.floor(n + 0.5);
  return `$${String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}

// ── Frases (idénticas en la app) ─────────────────────────────────────────────
export const LOOP_COPY = {
  promoPreviewLabel: "Tu mensaje",
  promoButton: "Mandar por WhatsApp",
  promoSentLine: "Listo. Mándalo a tu lista de difusión, a tu estado o a quien tú quieras.",
  comboNameLabel: "Nombre",
  comboPriceLabel: "Precio",
  comboButton: "Publicar combo",
  comboDoneLine: "Listo, ya está en tu menú.",
  staleButton: "Esconderlo del menú",
  staleDoneLine: "Listo, ya no sale en tu menú. Lo vuelves a prender en Menú cuando quieras.",
  errorLine: "No se pudo guardar. Intenta otra vez.",
  seeMenu: "Ver mi menú",
} as const;

/** "El miércoles que mandaste vendiste $1,820 (tu promedio $1,354)." */
export function promoResultLine(r: PromoResults | null): string | null {
  if (!r || !r.last) return null;
  const l = r.last;
  return `El ${l.weekdayName} que mandaste el mensaje vendiste ${money(l.revenue)} (tu promedio es ${money(l.baseline)}).`;
}

/** Etiqueta del botón en la cola de pendientes. */
export function loopCtaLabel(code: string): string | null {
  switch (code) {
    case "promo_weak_night":
      return LOOP_COPY.promoButton;
    case "publish_combo":
      return LOOP_COPY.comboButton;
    case "hide_stale_dish":
      return LOOP_COPY.staleButton;
    default:
      return null;
  }
}

/** Precio tecleado → número válido (entero positivo) o null. */
export function parsePrice(text: string): number | null {
  const n = Number(String(text).replace(/[^\d.]/g, ""));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

/** Lo que se guarda en restaurants/{id}/menu al publicar el combo. */
export function comboMenuDoc(combo: ComboInsight, name: string, price: number) {
  return {
    name: name.trim() || combo.name,
    description: `${combo.a} y ${combo.b}`,
    price,
    category: combo.category || "Combos",
    imageUrl: null,
    isAvailable: true,
    optionGroups: [],
    // El cerebro lo reconoce (no lo vuelve a sugerir) y mide sus ventas.
    comboFromBrain: { a: combo.a, b: combo.b, aId: combo.aId, bId: combo.bId },
  };
}
