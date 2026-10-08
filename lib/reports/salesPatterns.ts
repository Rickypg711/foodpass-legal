/**
 * PATRONES DE VENTA — lo que ya está en los pedidos y ningún reporte enseñaba
 * (7-oct-2026, leído en Suadero y Pecado con 60 días de ventas reales).
 *
 * Una sola función pura: recibe los pedidos PAGADOS ya normalizados (la
 * página le pone jornada, día y hora local) y devuelve cada reporte o `null`
 * cuando no hay datos suficientes para decir algo cierto.
 *
 * GRATIS (lo que el dueño usa esta noche): noches de la semana, hora pico,
 * clientes que regresan, combos, platillos que hacen el dinero, efectivo y
 * tarjeta. PRO (sirve con meses de datos): este mes contra el anterior y
 * ventas por mesa. Los avisos (descuento escrito en el nombre, nombres de
 * mesa, cobro al cierre) son gratis: arreglan los números.
 *
 * PARIDAD: espejo exacto de FOODPASS lib/reports/sales_patterns.dart. Las dos
 * pasan el MISMO caso (scripts/fixtures/sales-patterns.json ↔
 * test/fixtures/sales_patterns.json) y el candado
 * scripts/validate-sales-patterns.mjs exige que el JSON sea idéntico.
 * Redondeo: siempre `roundHalfUp` (Math.round y Dart .round() difieren en
 * negativos). Desempates: por nombre con comparación de código, nunca
 * localeCompare.
 */

/** Opción elegida en el platillo ("Carne" → "Suadero"); de selectedModifiers. */
export type PatternChoice = { group: string; choice: string };
export type PatternItem = { name: string; qty: number; revenue: number; options?: PatternChoice[] };

export type PatternOrder = {
  /** createdAt en ms. */
  ms: number;
  /** Llave de la jornada (corte 4 AM): la venta de la 1 AM es de anoche. */
  dayKey: string;
  /** Día de la semana DE LA JORNADA, 0 = domingo … 6 = sábado. */
  weekday: number;
  /** Hora del reloj local, 0–23. */
  hour: number;
  total: number;
  /** paymentMethod crudo ("cash", "card", "transfer", …). */
  method: string;
  /** Teléfono en 10 dígitos o "". */
  phone: string;
  /** customerName tal cual lo tecleó la Caja. */
  name: string;
  /** tabName de la cuenta abierta, o "". */
  tab: string;
  openTab: boolean;
  /** true si la Caja aplicó un Descuento especial (discountApplied.amount > 0). */
  hasDiscount: boolean;
  items: PatternItem[];
};

export type PatternInput = {
  /** Pedidos pagados de los últimos 60 días (los dos meses). */
  orders: PatternOrder[];
  /** Inicio de la jornada de hace 30 días (ms). Antes de esto = mes anterior. */
  last30StartMs: number;
  /** Inicio de la jornada de hace 60 días (ms). */
  prev30StartMs: number;
  /** Teléfonos de la casa (el del local y su WhatsApp): no son clientes. */
  housePhones: string[];
  /** Nombres de los platillos disponibles del menú; null si no se pudo leer. */
  menuNames: string[] | null;
};

// ── Umbrales (los mismos en Dart) ────────────────────────────────────────────
export const PATTERNS_MIN_NIGHTS_PER_WEEKDAY = 2;
export const PATTERNS_MIN_WEEKDAYS = 3;
export const PATTERNS_MIN_GAP_TO_SHOW = 500;
/** Noche "en vivo": las ventas se reparten al menos 45 min… */
export const LIVE_MIN_SPAN_MS = 45 * 60 * 1000;
/** …y entre venta y venta pasan (mediana) al menos 4 min. */
export const LIVE_MIN_MEDIAN_GAP_MS = 4 * 60 * 1000;
export const LIVE_MIN_SALES_PER_NIGHT = 3;
export const LIVE_MIN_NIGHTS = 4;
export const LIVE_MIN_SHARE = 0.6;
export const REGULARS_MIN_CUSTOMERS = 10;
export const REGULARS_MIN_REPEATERS = 3;
export const COMBO_MIN_COUNT = 3;
export const MENU_MIX_MIN_DISHES = 5;
export const PAY_MIX_MIN_SALES = 10;
export const TABLES_MIN_TAGGED = 10;
export const TREND_MIN_UNITS = 8;
/** Sin base el % miente (1 → 43 = "+4200 %"): el mes pasado vendió al menos 5. */
export const TREND_MIN_PREV_UNITS = 5;
/** Horas sueltas en la orilla (2 ventas al mediodía) no estiran la gráfica:
 *  se recortan las de las puntas con menos del 2 % de las ventas. */
export const HOUR_EDGE_MIN_SHARE = 0.02;
export const TREND_MIN_PCT = 25;
export const STOPPED_MIN_PREV_UNITS = 5;
/** "Lo que eligen" (7-oct, Ricardo: "cuál carne se vende más, no solo tacos"):
 *  un grupo de opciones sale con al menos 10 elecciones en 30 días. */
export const CHOICES_MIN_PICKS = 10;
export const CHOICES_MAX_GROUPS = 3;
export const CHOICES_MAX_ROWS = 6;
export const PREV_MONTH_MIN_NIGHTS = 8;
export const PREV_MONTH_MAX_LATE_START_MS = 10 * 24 * 60 * 60 * 1000;
export const BUSINESS_CUTOFF_HOUR = 4;

/** Lo que no es un platillo: la "Venta rápida" de la Caja. */
export const NOT_A_DISH = "Venta rápida";

/** Mesa tecleada como nombre: "T1", "L2", "M 3", "Mesa 4", "Barra", "TV". */
export const TABLE_NAME_RE = /^(mesa\s*\d{1,3}|[a-z]{1,2}\s?\d{1,2}|barra|terraza|tv)$/i;
/** Descuento escrito a mano en el nombre: "LEVI -15%", "Juan 10 %". */
export const TYPED_DISCOUNT_RE = /\d{1,2}\s?%/;

// ── Utilidades compartidas con Dart ──────────────────────────────────────────

export function roundHalfUp(x: number): number {
  return Math.floor(x + 0.5);
}

/** % entero; `whole` 0 → 0. */
export function pctOf(part: number, whole: number): number {
  return whole > 0 ? roundHalfUp((part / whole) * 100) : 0;
}

/** Cambio % de `prev` a `now`, redondeado lejos de ambigüedades. */
export function changePct(now: number, prev: number): number {
  if (prev <= 0) return 0;
  const raw = ((now - prev) / prev) * 100;
  return raw < 0 ? -roundHalfUp(-raw) : roundHalfUp(raw);
}

function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function normPhone(raw: string): string {
  let d = String(raw ?? "").replace(/\D/g, "");
  if (d.length > 10) d = d.slice(-10);
  return d.length === 10 ? d : "";
}

const WEEKDAY_NAMES = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const WEEKDAY_PLURAL = ["domingos", "lunes", "martes", "miércoles", "jueves", "viernes", "sábados"];
const WEEKDAY_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
export function weekdayName(w: number): string {
  return WEEKDAY_NAMES[w] ?? "";
}
export function weekdayPlural(w: number): string {
  return WEEKDAY_PLURAL[w] ?? "";
}
export function weekdayShort(w: number): string {
  return WEEKDAY_SHORT[w] ?? "";
}
/** Orden de la gráfica de noches: lunes primero, domingo al final. */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

/** "8 PM", "12 AM". */
export function hourShort(h: number): string {
  const x = ((h % 24) + 24) % 24;
  return `${x % 12 === 0 ? 12 : x % 12} ${x < 12 ? "AM" : "PM"}`;
}
/** "8 a 9 PM", "11 AM a 12 PM", "11 PM a 12 AM". */
export function hourRange(h: number): string {
  const a = ((h % 24) + 24) % 24;
  const b = (a + 1) % 24;
  const n = (x: number) => (x % 12 === 0 ? 12 : x % 12);
  const sa = a < 12 ? "AM" : "PM";
  const sb = b < 12 ? "AM" : "PM";
  return sa === sb ? `${n(a)} a ${n(b)} ${sb}` : `${n(a)} ${sa} a ${n(b)} ${sb}`;
}

const PAY_LABEL: Record<string, string> = {
  cash: "Efectivo",
  card: "Tarjeta",
  transfer: "Transferencia",
  other: "Otro",
};
export function payLabel(key: string): string {
  return PAY_LABEL[key] ?? "Otro";
}

// ── Resultado ────────────────────────────────────────────────────────────────

export type WeekNight = { weekday: number; nights: number; revenue: number; perNight: number };
export type WeekNights = {
  /** Lunes → domingo; `nights` 0 = no abrió ese día en 30 días. */
  days: WeekNight[];
  best: WeekNight;
  worst: WeekNight;
  avgPerNight: number;
  /** Dinero al mes si la noche floja llegara al promedio; 0 si es poco. */
  monthlyGap: number;
};

export type PeakHour = {
  hours: { hour: number; count: number }[];
  peak: { hour: number; count: number };
  peakPct: number;
  sales: number;
};

export type Regulars = {
  customers: number;
  repeaters: number;
  repeatPct: number;
  repeaterAvg: number;
  onceAvg: number;
  repeaterSharePct: number;
};

export type Combo = { a: string; b: string; count: number };

export type MenuMix = {
  dishesSold: number;
  top80Count: number;
  top80: { name: string; revenue: number; pct: number }[];
  /** Del menú disponible, los que nadie pidió en 30 días (nombre del menú). */
  idle: string[];
};

export type PayMix = { rows: { key: string; count: number; revenue: number; pct: number }[]; sales: number };

export type DishTrend = { name: string; now: number; prev: number; pct: number };
export type MonthCompare = {
  /** repeatPct null = menos de 10 clientes con número: el % no dice nada. */
  now: { revenue: number; count: number; ticket: number; repeatPct: number | null };
  prev: { revenue: number; count: number; ticket: number; repeatPct: number | null };
  revenuePct: number;
  up: DishTrend[];
  down: DishTrend[];
  stopped: { name: string; prev: number }[];
};

export type Tables = { rows: { name: string; count: number; revenue: number; ticket: number }[]; tagged: number };

/** Por grupo de opción: cuántas veces se eligió cada una (unidades). */
export type ChoiceGroup = { group: string; total: number; rows: { choice: string; units: number; pct: number }[] };

export type PatternHints = {
  typedDiscounts: { count: number; example: string } | null;
  tableNames: { count: number } | null;
  bulkCapture: boolean;
};

export type SalesPatterns = {
  weekNights: WeekNights | null;
  peakHour: PeakHour | null;
  regulars: Regulars | null;
  combos: Combo[];
  menuMix: MenuMix | null;
  /** Lo que eligen dentro del platillo (carne, tamaño, picante…). */
  choices: ChoiceGroup[];
  payMix: PayMix | null;
  /** PRO. null = todavía no hay un mes anterior completo para comparar. */
  monthCompare: MonthCompare | null;
  /** PRO. */
  tables: Tables | null;
  hints: PatternHints;
};

// ── Cálculo ──────────────────────────────────────────────────────────────────

function payKey(method: string): string {
  const m = String(method ?? "").trim().toLowerCase();
  if (m === "cash" || m === "card" || m === "transfer") return m;
  return "other";
}

function dishesOf(o: PatternOrder): PatternItem[] {
  return o.items.filter((i) => i.name && i.name !== NOT_A_DISH);
}

/** Etiqueta de mesa de un pedido, o "" si no trae. */
export function tableTag(o: Pick<PatternOrder, "tab" | "name">): string {
  const tab = (o.tab ?? "").trim();
  if (tab) return tab.toUpperCase();
  const n = (o.name ?? "").trim();
  return TABLE_NAME_RE.test(n) ? n.toUpperCase().replace(/\s+/g, "") : "";
}

function repeatStats(orders: PatternOrder[], house: Set<string>) {
  const by = new Map<string, { nights: Set<string>; revenue: number }>();
  for (const o of orders) {
    const p = normPhone(o.phone);
    if (!p || house.has(p)) continue;
    const c = by.get(p) ?? { nights: new Set<string>(), revenue: 0 };
    c.nights.add(o.dayKey);
    c.revenue += o.total;
    by.set(p, c);
  }
  let repeaters = 0;
  let repRev = 0;
  let onceRev = 0;
  for (const c of by.values()) {
    if (c.nights.size >= 2) {
      repeaters++;
      repRev += c.revenue;
    } else {
      onceRev += c.revenue;
    }
  }
  return { customers: by.size, repeaters, repRev, onceRev };
}

function liveNights(orders: PatternOrder[]) {
  const byNight = new Map<string, number[]>();
  for (const o of orders) {
    const arr = byNight.get(o.dayKey) ?? [];
    arr.push(o.ms);
    byNight.set(o.dayKey, arr);
  }
  const live = new Set<string>();
  let qualified = 0;
  for (const [key, list] of byNight) {
    if (list.length < LIVE_MIN_SALES_PER_NIGHT) continue;
    qualified++;
    const ms = [...list].sort((a, b) => a - b);
    const gaps: number[] = [];
    for (let i = 1; i < ms.length; i++) gaps.push(ms[i] - ms[i - 1]);
    gaps.sort((a, b) => a - b);
    const median = gaps[Math.floor((gaps.length - 1) / 2)];
    const span = ms[ms.length - 1] - ms[0];
    if (span >= LIVE_MIN_SPAN_MS && median >= LIVE_MIN_MEDIAN_GAP_MS) live.add(key);
  }
  return { live, qualified };
}

function dishUnits(orders: PatternOrder[]) {
  const units = new Map<string, number>();
  const revenue = new Map<string, number>();
  for (const o of orders) {
    for (const i of dishesOf(o)) {
      units.set(i.name, (units.get(i.name) ?? 0) + i.qty);
      revenue.set(i.name, (revenue.get(i.name) ?? 0) + i.revenue);
    }
  }
  return { units, revenue };
}

export function salesPatterns(input: PatternInput): SalesPatterns {
  const house = new Set(input.housePhones.map(normPhone).filter(Boolean));
  // Orden fijo por hora de venta: el "ejemplo" del aviso y los empates no
  // dependen del orden en que Firestore devolvió los pedidos.
  const orders = [...input.orders].sort((a, b) => a.ms - b.ms);
  const last = orders.filter((o) => o.ms >= input.last30StartMs);
  const prev = orders.filter((o) => o.ms >= input.prev30StartMs && o.ms < input.last30StartMs);

  // 1. Noches de la semana (30 días, solo noches que abrió).
  let weekNights: WeekNights | null = null;
  {
    const nightsBy = new Map<number, Set<string>>();
    const revBy = new Map<number, number>();
    for (const o of last) {
      const s = nightsBy.get(o.weekday) ?? new Set<string>();
      s.add(o.dayKey);
      nightsBy.set(o.weekday, s);
      revBy.set(o.weekday, (revBy.get(o.weekday) ?? 0) + o.total);
    }
    const days: WeekNight[] = WEEK_ORDER.map((w) => {
      const nights = nightsBy.get(w)?.size ?? 0;
      const revenue = revBy.get(w) ?? 0;
      return { weekday: w, nights, revenue, perNight: nights > 0 ? revenue / nights : 0 };
    });
    const solid = days.filter((d) => d.nights >= PATTERNS_MIN_NIGHTS_PER_WEEKDAY);
    if (solid.length >= PATTERNS_MIN_WEEKDAYS) {
      const best = solid.reduce((a, b) => (b.perNight > a.perNight ? b : a));
      const worst = solid.reduce((a, b) => (b.perNight < a.perNight ? b : a));
      const totalNights = days.reduce((s, d) => s + d.nights, 0);
      const totalRev = days.reduce((s, d) => s + d.revenue, 0);
      const avgPerNight = totalNights > 0 ? totalRev / totalNights : 0;
      const rawGap = (avgPerNight - worst.perNight) * worst.nights;
      const gap = roundHalfUp(rawGap / 100) * 100;
      weekNights = { days, best, worst, avgPerNight, monthlyGap: gap >= PATTERNS_MIN_GAP_TO_SHOW ? gap : 0 };
    }
  }

  // 2. Hora pico — solo si cobra al momento (no todo junto al cierre).
  const { live, qualified } = liveNights(last);
  const liveShare = qualified > 0 ? live.size / qualified : 0;
  const isLive = qualified >= LIVE_MIN_NIGHTS && liveShare >= LIVE_MIN_SHARE;
  let peakHour: PeakHour | null = null;
  if (isLive) {
    const count = new Map<number, number>();
    let sales = 0;
    for (const o of last) {
      if (!live.has(o.dayKey)) continue;
      count.set(o.hour, (count.get(o.hour) ?? 0) + 1);
      sales++;
    }
    // Orden de jornada: 4 AM primero, la 1 AM al final.
    const pos = (h: number) => (h - BUSINESS_CUTOFF_HOUR + 24) % 24;
    const present = [...count.keys()].sort((a, b) => pos(a) - pos(b));
    const hours: { hour: number; count: number }[] = [];
    for (let p = pos(present[0]); p <= pos(present[present.length - 1]); p++) {
      const h = (p + BUSINESS_CUTOFF_HOUR) % 24;
      hours.push({ hour: h, count: count.get(h) ?? 0 });
    }
    while (hours.length > 1 && hours[0].count < HOUR_EDGE_MIN_SHARE * sales) hours.shift();
    while (hours.length > 1 && hours[hours.length - 1].count < HOUR_EDGE_MIN_SHARE * sales) hours.pop();
    const peak = hours.reduce((a, b) => (b.count > a.count ? b : a));
    peakHour = { hours, peak, peakPct: pctOf(peak.count, sales), sales };
  }

  // 3. Clientes que regresan (30 días, sin los teléfonos de la casa).
  let regulars: Regulars | null = null;
  {
    const r = repeatStats(last, house);
    if (r.customers >= REGULARS_MIN_CUSTOMERS) {
      const once = r.customers - r.repeaters;
      regulars = {
        customers: r.customers,
        repeaters: r.repeaters,
        repeatPct: pctOf(r.repeaters, r.customers),
        repeaterAvg: r.repeaters > 0 ? r.repRev / r.repeaters : 0,
        onceAvg: once > 0 ? r.onceRev / once : 0,
        repeaterSharePct: pctOf(r.repRev, r.repRev + r.onceRev),
      };
    }
  }

  // 4. Combos: dos platillos distintos en la misma cuenta.
  const pairs = new Map<string, Combo>();
  for (const o of last) {
    const names = [...new Set(dishesOf(o).map((i) => i.name))].sort(cmp);
    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) {
        const k = `${names[i]}\u0000${names[j]}`;
        const c = pairs.get(k) ?? { a: names[i], b: names[j], count: 0 };
        c.count++;
        pairs.set(k, c);
      }
    }
  }
  const combos = [...pairs.values()]
    .filter((c) => c.count >= COMBO_MIN_COUNT)
    .sort((x, y) => y.count - x.count || cmp(x.a, y.a) || cmp(x.b, y.b))
    .slice(0, 3);

  // 5. Pocos platillos, casi todo el dinero.
  const lastDish = dishUnits(last);
  let menuMix: MenuMix | null = null;
  if (lastDish.revenue.size >= MENU_MIX_MIN_DISHES) {
    const ranked = [...lastDish.revenue.entries()].sort((a, b) => b[1] - a[1] || cmp(a[0], b[0]));
    const total = ranked.reduce((s, [, v]) => s + v, 0);
    let acc = 0;
    let k = 0;
    for (const [, v] of ranked) {
      acc += v;
      k++;
      if (acc >= 0.8 * total) break;
    }
    const sold = new Set([...lastDish.units.keys()].map((n) => n.trim().toLowerCase()));
    const idle = (input.menuNames ?? [])
      .map((n) => n.trim())
      .filter((n) => n && !sold.has(n.toLowerCase()));
    menuMix = {
      dishesSold: ranked.length,
      top80Count: k,
      top80: ranked.slice(0, Math.min(k, 5)).map(([name, revenue]) => ({ name, revenue, pct: pctOf(revenue, total) })),
      idle: [...new Set(idle)].sort(cmp),
    };
  }

  // 5b. Lo que eligen: cada opción elegida cuenta las unidades del platillo
  // (si eligió dos carnes en una orden, cuentan las dos).
  const choiceBy = new Map<string, Map<string, number>>();
  for (const o of last) {
    for (const i of dishesOf(o)) {
      for (const c of i.options ?? []) {
        const g = (c.group ?? "").trim();
        const ch = (c.choice ?? "").trim();
        if (!g || !ch) continue;
        const m = choiceBy.get(g) ?? new Map<string, number>();
        m.set(ch, (m.get(ch) ?? 0) + i.qty);
        choiceBy.set(g, m);
      }
    }
  }
  const choices: ChoiceGroup[] = [...choiceBy.entries()]
    .map(([group, m]) => {
      const total = [...m.values()].reduce((x, y) => x + y, 0);
      const rows = [...m.entries()]
        .sort((a, b) => b[1] - a[1] || cmp(a[0], b[0]))
        .slice(0, CHOICES_MAX_ROWS)
        .map(([choice, units]) => ({ choice, units, pct: pctOf(units, total) }))
        .filter((r) => r.pct > 0); // una venta suelta de 300 no es "0 %"
      return { group, total, rows };
    })
    .filter((g) => g.total >= CHOICES_MIN_PICKS && g.rows.length >= 2)
    .sort((a, b) => b.total - a.total || cmp(a.group, b.group))
    .slice(0, CHOICES_MAX_GROUPS);

  // 6. Efectivo, tarjeta, transferencia (por dinero).
  let payMix: PayMix | null = null;
  if (last.length >= PAY_MIX_MIN_SALES) {
    const by = new Map<string, { count: number; revenue: number }>();
    let total = 0;
    for (const o of last) {
      const k = payKey(o.method);
      const b = by.get(k) ?? { count: 0, revenue: 0 };
      b.count++;
      b.revenue += o.total;
      by.set(k, b);
      total += o.total;
    }
    const rows = ["cash", "card", "transfer", "other"]
      .filter((k) => (by.get(k)?.count ?? 0) > 0)
      .map((k) => ({ key: k, count: by.get(k)!.count, revenue: by.get(k)!.revenue, pct: pctOf(by.get(k)!.revenue, total) }));
    payMix = { rows, sales: last.length };
  }

  // 7–8–10. PRO: este mes contra el anterior.
  let monthCompare: MonthCompare | null = null;
  {
    const prevNights = new Set(prev.map((o) => o.dayKey)).size;
    const earliest = prev.reduce((m, o) => Math.min(m, o.ms), Number.POSITIVE_INFINITY);
    const ready =
      prevNights >= PREV_MONTH_MIN_NIGHTS &&
      earliest <= input.prev30StartMs + PREV_MONTH_MAX_LATE_START_MS;
    if (ready && last.length > 0) {
      const sum = (list: PatternOrder[]) => {
        const revenue = list.reduce((s, o) => s + o.total, 0);
        const r = repeatStats(list, house);
        return {
          revenue,
          count: list.length,
          ticket: list.length > 0 ? revenue / list.length : 0,
          repeatPct: r.customers >= REGULARS_MIN_CUSTOMERS ? pctOf(r.repeaters, r.customers) : null,
        };
      };
      const prevDish = dishUnits(prev);
      const names = new Set([...lastDish.units.keys(), ...prevDish.units.keys()]);
      const trends: DishTrend[] = [];
      const stopped: { name: string; prev: number }[] = [];
      const onMenu =
        input.menuNames == null ? null : new Set(input.menuNames.map((n) => n.trim().toLowerCase()));
      for (const name of names) {
        const n = lastDish.units.get(name) ?? 0;
        const p = prevDish.units.get(name) ?? 0;
        if (n === 0 && p >= STOPPED_MIN_PREV_UNITS && (onMenu == null || onMenu.has(name.trim().toLowerCase()))) {
          stopped.push({ name, prev: p });
        }
        if (n > 0 && p >= TREND_MIN_PREV_UNITS && Math.max(n, p) >= TREND_MIN_UNITS) {
          trends.push({ name, now: n, prev: p, pct: changePct(n, p) });
        }
      }
      const nowS = sum(last);
      const prevS = sum(prev);
      monthCompare = {
        now: nowS,
        prev: prevS,
        revenuePct: changePct(nowS.revenue, prevS.revenue),
        up: trends
          .filter((t) => t.pct >= TREND_MIN_PCT)
          .sort((a, b) => b.pct - a.pct || cmp(a.name, b.name))
          .slice(0, 3),
        down: trends
          .filter((t) => t.pct <= -TREND_MIN_PCT)
          .sort((a, b) => a.pct - b.pct || cmp(a.name, b.name))
          .slice(0, 3),
        stopped: stopped.sort((a, b) => b.prev - a.prev || cmp(a.name, b.name)).slice(0, 5),
      };
    }
  }

  // 9. PRO: ventas por mesa (cuenta abierta o nombre de mesa).
  let tables: Tables | null = null;
  {
    const by = new Map<string, { count: number; revenue: number }>();
    let tagged = 0;
    for (const o of last) {
      const t = tableTag(o);
      if (!t) continue;
      tagged++;
      const b = by.get(t) ?? { count: 0, revenue: 0 };
      b.count++;
      b.revenue += o.total;
      by.set(t, b);
    }
    if (tagged >= TABLES_MIN_TAGGED) {
      tables = {
        tagged,
        rows: [...by.entries()]
          .map(([name, v]) => ({ name, count: v.count, revenue: v.revenue, ticket: v.revenue / v.count }))
          .sort((a, b) => b.revenue - a.revenue || cmp(a.name, b.name)),
      };
    }
  }

  // Avisos: números que salen mal por cómo se captura.
  const typed = last.filter((o) => !o.hasDiscount && TYPED_DISCOUNT_RE.test(o.name ?? ""));
  const byName = last.filter((o) => !(o.tab ?? "").trim() && TABLE_NAME_RE.test((o.name ?? "").trim()));
  const byNameOpen = byName.filter((o) => o.openTab).length;
  const hints: PatternHints = {
    typedDiscounts: typed.length > 0 ? { count: typed.length, example: typed[0].name.trim() } : null,
    tableNames:
      byName.length >= TABLES_MIN_TAGGED && byNameOpen * 5 < byName.length ? { count: byName.length } : null,
    bulkCapture: qualified >= LIVE_MIN_NIGHTS && !isLive,
  };

  return { weekNights, peakHour, regulars, combos, menuMix, choices, payMix, monthCompare, tables, hints };
}

// ── Copy (las frases que lee el dueño; idénticas en la app) ───────────────────
// Nivel secundaria, sin jerga. Dinero sin centavos: "$1,234".

export function money0(n: number): string {
  const v = roundHalfUp(n);
  const neg = v < 0;
  const s = String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${neg ? "-" : ""}$${s}`;
}

/** "+34 %" / "-41 %" / "0 %". */
export function signedPct(p: number): string {
  return `${p > 0 ? "+" : ""}${p} %`;
}

export type PatternsCopy = {
  nightsHeadline: string | null;
  nightsGap: string | null;
  peakHeadline: string | null;
  regularsHeadline: string | null;
  regularsLine: string | null;
  mixHeadline: string | null;
  idleLine: string | null;
  compareTeaser: string | null;
  tablesTeaser: string | null;
  hints: string[];
};

/** "Suadero es lo que más piden en carne (51 %)." */
export function choiceHeadline(g: ChoiceGroup): string {
  const top = g.rows[0];
  return `${top.choice} es lo que más piden en ${g.group.toLowerCase()} (${top.pct} %).`;
}

export const COMBOS_CAPTION = "Platillos que tus clientes piden en la misma cuenta. Puedes armarlos como combo.";
export const COMBOS_LINK = "Armar un combo en tu menú";
export const REGULARS_LINK = "Escríbeles a los que no han vuelto";
export const COMPARE_EMPTY = "Todavía no hay un mes anterior completo para comparar.";
export const PRO_CTA = "Verlo con Pro";
export const HINT_BULK =
  "Cobras casi todo junto al final de la noche. Si cobras cada venta en el momento, aquí vas a ver tu hora pico.";
export const HINT_DISCOUNT_LINK = "Descuentos especiales";
export const HINT_TABLES_LINK = "Abrir la Caja";

export function patternsCopy(p: SalesPatterns): PatternsCopy {
  const w = p.weekNights;
  const nightsHeadline = w
    ? `Tu mejor noche es el ${weekdayName(w.best.weekday)}: ${money0(w.best.perNight)}. La más floja, el ${weekdayName(w.worst.weekday)}: ${money0(w.worst.perNight)}.`
    : null;
  const nightsGap =
    w && w.monthlyGap > 0
      ? `Si tus ${weekdayPlural(w.worst.weekday)} llegaran a tu promedio (${money0(w.avgPerNight)}), serían ${money0(w.monthlyGap)} más al mes.`
      : null;
  const peakHeadline = p.peakHour
    ? `Tu hora pico es de ${hourRange(p.peakHour.peak.hour)}. Ahí cae el ${p.peakHour.peakPct} % de tus ventas.`
    : null;
  const r = p.regulars;
  const regularsHeadline =
    r && r.repeaters >= REGULARS_MIN_REPEATERS && r.repeaterAvg > r.onceAvg
      ? `Un cliente que regresa te deja ${money0(r.repeaterAvg)}. Uno que vino una vez, ${money0(r.onceAvg)}.`
      : null;
  const regularsLine = r ? `Regresaron ${r.repeaters} de ${r.customers} clientes con número (${r.repeatPct} %).` : null;
  const m = p.menuMix;
  const mixHeadline = m
    ? `${m.top80Count} de tus ${m.dishesSold} platillos vendidos hacen el 80 % de tu dinero.`
    : null;
  const idleLine =
    m && m.idle.length > 0
      ? `Nadie los pidió en 30 días: ${m.idle.slice(0, 8).join(", ")}${m.idle.length > 8 ? ` y ${m.idle.length - 8} más` : ""}.`
      : null;
  const compareTeaser = p.monthCompare
    ? "Qué platillo sube, cuál baja y cuál dejó de venderse, contra el mes pasado."
    : null;
  const tablesTeaser = p.tables
    ? `Cuánto deja cada mesa: ${p.tables.rows.length} ${p.tables.rows.length === 1 ? "mesa" : "mesas"} en 30 días.`
    : null;
  const hints: string[] = [];
  if (p.hints.bulkCapture) hints.push(HINT_BULK);
  if (p.hints.typedDiscounts) {
    const n = p.hints.typedDiscounts.count;
    hints.push(
      `Escribiste un descuento en el nombre del cliente ("${p.hints.typedDiscounts.example}") en ${n} ${n === 1 ? "venta" : "ventas"}. Si lo pones en Descuentos especiales, la Caja lo aplica sola y aquí sale contado.`,
    );
  }
  if (p.hints.tableNames) {
    hints.push(
      `Escribes la mesa en el nombre (T1, T2…) en ${p.hints.tableNames.count} ventas. Con Cuentas por mesa juntas las rondas y cobras una sola vez.`,
    );
  }
  return {
    nightsHeadline,
    nightsGap,
    peakHeadline,
    regularsHeadline,
    regularsLine,
    mixHeadline,
    idleLine,
    compareTeaser,
    tablesTeaser,
    hints,
  };
}
