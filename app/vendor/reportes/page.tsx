"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  Timestamp,
  orderBy,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import { waitForAuthReady } from "@/lib/auth";
import { businessDayStart, businessDayStartDaysAgo, businessDayKey } from "@/lib/businessDay";
import { tipStaysWithStaff } from "@/lib/pos/paidOrderFields";
import { resolveVendorContext, vendorHomeForRole } from "@/lib/vendorContext";
import { fetchWithBilling } from "@/lib/subscription/billingDoc";
import {
  entitlementOf,
  entitlementsOf,
  historyAllowed,
  HISTORY_DAYS_FREE,
  FREE_ENTITLEMENTS,
  type Entitlement,
  type Entitlements,
} from "@/lib/subscription/entitlement";
import { ProWall } from "@/components/vendor/ProWall";

// ─── Types ─────────────────────────────────────────────────────────────────────

type LoadState = "loading" | "ready" | "error";

interface WeekStats {
  label: string;
  scans: number;
  sales: number;
  dateStr: string;
}

interface InsightsMetrics {
  atRiskCount: number;
  scans30d: number;
  redemptions30d: number;
  uniqueCustomers30d: number;
  menuItemCount: number;
  rewardCount: number;
}

interface TopProduct {
  name: string;
  qty: number;
  revenue: number;
}

interface ReportsData {
  restaurantId: string;
  restaurantName: string;
  dailyGoal: number | null;
  // Today's stats
  todayRevenue: number;
  todaySalesCount: number;
  todayAvgTicket: number;
  todayScans: number;
  // Lookback metrics
  metrics30d: InsightsMetrics | null;
  // 7-day data for charts
  weeklyStats: WeekStats[];
  weeklyRevenueTotal: number;
  weeklyScansTotal: number;
  // Top products
  topProducts: TopProduct[];
  /** Descuentos especiales dados (30d) — auditoría del dueño. null = ninguno. */
  discounts30d: { total: number; count: number; byProfile: Record<string, number> } | null;
  /** Ventas por empleado (30d, soldBy del equipo de la caja). null = sin datos. */
  staffSales30d: { name: string; count: number; revenue: number }[] | null;
  /** Propinas (30d) — total y por empleado. null = ninguna. */
  tips30d: {
    total: number;
    /** Efectivo: el mesero ya la tiene. Tarjeta/transferencia: la cobro el dueno y aun no llega al mesero. */
    cash: number;
    card: number;
    byStaff: Record<string, { total: number; cash: number; card: number }>;
  } | null;
}

/** Historial de ventas por rango (pared 1 de la Caja, 8-sep). */
type HistoryRange = 30 | 90 | null; // null = todo el historial
const HISTORY_RANGES: { days: HistoryRange; label: string }[] = [
  { days: 30, label: "30 días" },
  { days: 90, label: "90 días" },
  { days: null, label: "Todo" },
];
interface SalesHistory {
  days: HistoryRange;
  count: number;
  revenue: number;
  byMonth: { key: string; label: string; count: number; revenue: number }[];
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 2 });
}

function Spinner() {
  return (
    <svg className="h-7 w-7 animate-spin" style={{ color: "#F28C38" }} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 12 5.373 12 12H4z" />
    </svg>
  );
}

// Opción A (23-sep-2026, lienzo "Sistema Comeleal"): los mismos tokens que el
// Panel, Pedidos, Caja y Clientes. Crema + tinta, UNA serif (Lora) solo en
// títulos, cifras en tabular, naranja solo para resaltar "hoy" en la gráfica
// de ingresos. Sin sombras, sin degradados, sin emojis.
const SERIF = "var(--font-lora), Lora, Georgia, serif";
const INK = "#1C2526";
const INK_MUTED = "#3F4A4D";
const INK_SOFT = "#5B6366";
const HAIRLINE = "#E9E3D7";
const BORDER = "#D9D2C5";
const LINK = "#8A4B12";
const BRAND = "#F28C38";
const TILE = "#F0EBE1";
const ICON = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
function IconChart() { return <svg {...ICON} stroke={INK_SOFT}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>; }

/** Título de la pantalla: Lora 22 + caption 13 debajo, y el link al Panel. */
function PageTitle({ caption }: { caption?: string }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-0.5">
        <h1 className="text-[22px] font-semibold leading-[26px] md:text-[24px] md:leading-7" style={{ color: INK, fontFamily: SERIF }}>Reportes</h1>
        {caption && <p className="truncate text-[13px] leading-4" style={{ color: INK_SOFT }}>{caption}</p>}
      </div>
      <Link href="/vendor" className="shrink-0 text-[14px] font-semibold hover:underline" style={{ color: LINK }}>
        Panel
      </Link>
    </div>
  );
}

/** Encabezado de sección: Lora 17/600 y, a la derecha, el rango en 13px. */
function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 className="text-[17px] font-semibold leading-[22px]" style={{ color: INK, fontFamily: SERIF }}>
        {children}
      </h2>
      {right ? <span className="shrink-0 text-[13px] leading-4" style={{ color: INK_SOFT }}>{right}</span> : null}
    </div>
  );
}

/** Fila de cifras con líneas finas arriba/abajo y verticales entre celdas.
 *  `layout` = columnas en móvil / columnas desde md; en móvil la segunda
 *  fila lleva una línea fina arriba. Número 22/700 tabular, label 12. */
type Stat = { label: string; value: ReactNode; sub?: ReactNode; className?: string };
const STAT_GRID = {
  "2/4": {
    grid: "grid-cols-2 md:grid-cols-4",
    cell: "[&:nth-child(2n)]:border-l [&:nth-child(n+3)]:border-t md:[&:not(:first-child)]:border-l md:[&:nth-child(n+3)]:border-t-0",
  },
  "2/3": {
    grid: "grid-cols-2 md:grid-cols-3",
    cell: "[&:nth-child(2n)]:border-l [&:nth-child(n+3)]:border-t md:[&:not(:first-child)]:border-l md:[&:nth-child(n+3)]:border-t-0",
  },
  "2/2": {
    grid: "grid-cols-2",
    cell: "[&:nth-child(2n)]:border-l [&:nth-child(n+3)]:border-t",
  },
} as const;
function StatGrid({ items, layout }: { items: Stat[]; layout: keyof typeof STAT_GRID }) {
  const g = STAT_GRID[layout];
  return (
    <div className={`grid ${g.grid}`} style={{ borderTop: `1px solid ${HAIRLINE}`, borderBottom: `1px solid ${HAIRLINE}` }}>
      {items.map((s) => (
        <div
          key={s.label}
          className={`flex min-w-0 flex-col items-center justify-center gap-0.5 border-[#E9E3D7] px-1 py-3 text-center ${g.cell} ${s.className ?? ""}`}
        >
          <div className="whitespace-nowrap text-[22px] font-bold leading-[26px] tabular-nums" style={{ color: INK }}>{s.value}</div>
          <p className="text-[12px] leading-[14px]" style={{ color: INK_MUTED }}>{s.label}</p>
          {s.sub ? <p className="text-[12px] leading-[14px] tabular-nums" style={{ color: INK_SOFT }}>{s.sub}</p> : null}
        </div>
      ))}
    </div>
  );
}

/** Anillo de la meta del día: trazo tinta sobre línea fina, % adentro 13/700.
 *  El radio 15.9155 da circunferencia 100 → el dasharray es el porcentaje. */
function GoalRing({ pct }: { pct: number }) {
  const r = 15.9155;
  return (
    <div className="relative h-11 w-11" role="img" aria-label={`${pct}% de la meta`}>
      <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
        <circle cx="18" cy="18" r={r} fill="none" stroke={HAIRLINE} strokeWidth="3" />
        <circle cx="18" cy="18" r={r} fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" strokeDasharray={`${pct} 100`} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-[13px] font-bold tabular-nums" style={{ color: INK }}>{pct}%</div>
    </div>
  );
}

/** Gráfica de barras de 7 días: barras planas (sin degradado), valor arriba
 *  en 12 inkSoft, día abajo. La última barra es hoy: etiqueta en 600 y, si
 *  `highlightToday`, la barra en naranja (el único naranja de la gráfica). */
function BarChart({
  points,
  color,
  highlightToday = false,
}: {
  points: { label: string; dateStr: string; value: number; text: string }[];
  color: string;
  highlightToday?: boolean;
}) {
  const max = Math.max(...points.map((p) => p.value), 1);
  const last = points.length - 1;
  return (
    <div className="flex h-44 items-end gap-1.5 md:gap-2">
      {points.map((p, i) => {
        const heightPct = (p.value / max) * 100;
        const today = i === last;
        return (
          <div key={i} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5" title={p.dateStr}>
            <span className="text-[12px] leading-4 tabular-nums" style={{ color: INK_SOFT }}>
              {p.value > 0 ? p.text : ""}
            </span>
            <div
              className="w-full rounded-t"
              style={{ height: `${Math.max(heightPct, 2)}%`, background: today && highlightToday ? BRAND : color }}
            />
            <p className="text-[12px] leading-4" style={{ color: today ? INK : INK_MUTED, fontWeight: today ? 600 : 400 }}>{p.label}</p>
            <p className="hidden whitespace-nowrap text-[12px] leading-4 sm:block" style={{ color: INK_SOFT }}>{p.dateStr}</p>
          </div>
        );
      })}
    </div>
  );
}

/** Tarjeta blanca para LISTAS (la única tarjeta permitida): borde, radio 12,
 *  filas separadas por línea fina. */
function ListCard({ children }: { children: ReactNode }) {
  return (
    <div className="divide-y divide-[#E9E3D7] rounded-xl bg-white px-3.5" style={{ border: `1px solid ${BORDER}` }}>
      {children}
    </div>
  );
}

function EmptyLine({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-[14px]" style={{ color: INK_MUTED }}>{children}</p>;
}

const DAY_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReportesPage() {
  const router = useRouter();
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [data, setData] = useState<ReportsData | null>(null);

  // ── Pared 1: historial >30 días es Pro (docs/PRICING.md v2.0) ──────────────
  // El plan se lee FUNDIDO con private/billing (fetchWithBilling): el doc
  // público ya no trae la suscripción desde la migración del 24-ago.
  const [ent, setEnt] = useState<Entitlement | null>(null);
  const [ents, setEnts] = useState<Entitlements>(FREE_ENTITLEMENTS);
  const [rangeDays, setRangeDays] = useState<HistoryRange>(HISTORY_DAYS_FREE as HistoryRange);
  const [pendingRange, setPendingRange] = useState<HistoryRange>(30);
  const [wallOpen, setWallOpen] = useState(false);
  const [history, setHistory] = useState<SalesHistory | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  /** Ventas pagadas del rango, agrupadas por mes. `null` = sin cota (Pro). */
  async function loadHistory(rid: string, days: HistoryRange) {
    setHistoryLoading(true);
    try {
      const db = getFirebaseDb();
      const base = collection(db, "restaurants", rid, "orders");
      const q =
        days == null
          ? query(base, where("paymentStatus", "==", "paid"))
          : query(
              base,
              where("createdAt", ">=", Timestamp.fromDate(businessDayStartDaysAgo(days))),
              where("paymentStatus", "==", "paid"),
            );
      const snap = await getDocs(q);
      const byMonth: Record<string, { key: string; label: string; count: number; revenue: number }> = {};
      let count = 0;
      let revenue = 0;
      snap.forEach((d) => {
        const o = d.data();
        const ts = o.createdAt as Timestamp | undefined;
        if (!ts?.toDate) return;
        const dt = ts.toDate();
        const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
        const total = (o.total as number) ?? 0;
        count++;
        revenue += total;
        const b =
          byMonth[key] ??
          (byMonth[key] = {
            key,
            label: dt.toLocaleDateString("es-MX", { month: "long", year: "numeric" }),
            count: 0,
            revenue: 0,
          });
        b.count++;
        b.revenue += total;
      });
      setHistory({
        days,
        count,
        revenue,
        byMonth: Object.values(byMonth).sort((a, b) => (a.key < b.key ? 1 : -1)),
      });
    } catch (e) {
      console.error("[reportes/history]", e);
      setHistory(null);
    } finally {
      setHistoryLoading(false);
    }
  }

  /** El selector: dentro de la ventana gratis carga; fuera, enseña la pared. */
  function pickRange(days: HistoryRange) {
    if (!historyAllowed(ents, days)) {
      setPendingRange(days);
      setWallOpen(true);
      return;
    }
    setRangeDays(days);
    if (data?.restaurantId) void loadHistory(data.restaurantId, days);
  }

  useEffect(() => {
    async function init() {
      const u = await waitForAuthReady();
      if (!u || u.isAnonymous) {
        router.push("/activar?modo=entrar");
        return;
      }

      try {
        const db = getFirebaseDb();
        // Staff-aware: reportes = analytics (dueño/manager, como en el app).
        const ctx = await resolveVendorContext(db, u.uid);
        if (!ctx) {
          router.push("/activar?modo=entrar");
          return;
        }
        if (ctx.role === "employee") {
          router.push(vendorHomeForRole(ctx.role));
          return;
        }

        const rid = ctx.restaurantId;

        // JORNADA comercial (corte 4 AM, lib/businessDay.ts) — "hoy" no se
        // corta a medianoche para locales con turno nocturno.
        const todayStart = businessDayStart();
        const sevenDaysAgo = businessDayStartDaysAgo(6);
        const thirtyDaysAgo = businessDayStartDaysAgo(30);

        const [restaurantSnap, insightsSnap, todayOrdersSnap, todayVisitsSnap, weeklyOrdersSnap, weeklyVisitsSnap, monthOrdersSnap] =
          await Promise.all([
            getDoc(doc(db, "restaurants", rid)),
            getDoc(doc(db, "restaurants", rid, "vendorInsights", "current")),
            // Today's paid orders
            getDocs(query(
              collection(db, "restaurants", rid, "orders"),
              where("createdAt", ">=", Timestamp.fromDate(todayStart)),
              where("paymentStatus", "==", "paid")
            )),
            // Today's loyalty visits
            getDocs(query(
              collection(db, "restaurants", rid, "visitHistory"),
              where("timestamp", ">=", Timestamp.fromDate(todayStart))
            )),
            // Weekly paid orders (last 7 days including today)
            getDocs(query(
              collection(db, "restaurants", rid, "orders"),
              where("createdAt", ">=", Timestamp.fromDate(sevenDaysAgo)),
              where("paymentStatus", "==", "paid")
            )),
            // Weekly loyalty visits (last 7 days including today)
            getDocs(query(
              collection(db, "restaurants", rid, "visitHistory"),
              where("timestamp", ">=", Timestamp.fromDate(sevenDaysAgo)),
              orderBy("timestamp", "asc")
            )),
            // 30d orders → phone-sale loyalty metrics (phone customers have no
            // app, so they never appear in visitHistory / the brain's numbers).
            getDocs(query(
              collection(db, "restaurants", rid, "orders"),
              where("createdAt", ">=", Timestamp.fromDate(thirtyDaysAgo))
            )).catch(() => null),
          ]);

        const restData = restaurantSnap.data() ?? {};
        const insightsData = insightsSnap.exists() ? insightsSnap.data() : null;

        // Plan (pared 1): fundido con private/billing — la regla única.
        const merged = await fetchWithBilling(db, rid, restData as Record<string, unknown>);
        setEnt(entitlementOf(merged));
        setEnts(entitlementsOf(merged, rid));
        void loadHistory(rid, HISTORY_DAYS_FREE);

        // Today's revenue & average ticket
        let todayRevenue = 0;
        let todaySalesCount = 0;
        todayOrdersSnap.forEach((doc) => {
          todayRevenue += (doc.data().total as number) ?? 0;
          todaySalesCount++;
        });
        const todayAvgTicket = todaySalesCount > 0 ? todayRevenue / todaySalesCount : 0;

        // ── Phone-sale visits (Caja/checkout con número) ─────────────────────
        // phoneLoyaltyAt is written ONLY by creditPhonePointsForOrder, so every
        // order carrying it is a real "venta con número" that earned/redeemed
        // points. App scans live in visitHistory; phone customers don't. Sum =
        // every loyalty visit, no double-counting.
        const phoneDailyCounts: Record<string, number> = {};
        let phoneVisitsToday = 0;
        let phoneVisits30d = 0;
        let phoneRedemptions30d = 0;
        const uniquePhones30d = new Set<string>();
        // Descuentos especiales (30d) — se leen del order.discountApplied que
        // escribe la caja; ninguna colección nueva.
        let discTotal30d = 0;
        let discCount30d = 0;
        const discByProfile: Record<string, number> = {};
        // Ventas por empleado — soldBy lo estampa la caja (equipo con PIN).
        const staffMap: Record<string, { count: number; revenue: number }> = {};
        // Propinas — separadas de total; por empleado cuando hay soldBy.
        let tipsTotal30d = 0;
        let tipsCash30d = 0;
        let tipsCard30d = 0;
        const tipsByStaff: Record<string, { total: number; cash: number; card: number }> = {};
        monthOrdersSnap?.forEach((d) => {
          const o = d.data();
          const disc = o.discountApplied as
            | { amount?: unknown; profileName?: unknown }
            | undefined;
          const discAmt = Number(disc?.amount) || 0;
          if (discAmt > 0 && o.paymentStatus === "paid") {
            discTotal30d += discAmt;
            discCount30d++;
            const pn = String(disc?.profileName ?? "Descuento").trim() || "Descuento";
            discByProfile[pn] = (discByProfile[pn] ?? 0) + discAmt;
          }
          const sb = o.soldBy as { name?: unknown } | undefined;
          const sbName = typeof sb?.name === "string" ? sb.name.trim() : "";
          if (sbName && o.paymentStatus === "paid") {
            if (!staffMap[sbName]) staffMap[sbName] = { count: 0, revenue: 0 };
            staffMap[sbName].count++;
            staffMap[sbName].revenue += (o.total as number) ?? 0;
          }
          const tipAmt = Number(o.tipAmount) || 0;
          if (tipAmt > 0 && o.paymentStatus === "paid") {
            tipsTotal30d += tipAmt;
            // tipMethod se escribe desde ago 2026; las ordenes viejas no lo
            // traen -> caen al metodo de pago de la cuenta, que era el supuesto.
            // Dos cubetas, no tres: lo que importa es si el mesero YA la
            // tiene (efectivo) o si la cobró el negocio (tarjeta O
            // transferencia) y se la debe al equipo.
            const rawTip =
              typeof o.tipMethod === "string" && o.tipMethod
                ? o.tipMethod
                : o.paymentMethod;
            const tMethod = tipStaysWithStaff(rawTip) ? "cash" : "card";
            if (tMethod === "card") tipsCard30d += tipAmt;
            else tipsCash30d += tipAmt;
            const tKey = sbName || "Caja";
            const bucket =
              tipsByStaff[tKey] ?? (tipsByStaff[tKey] = { total: 0, cash: 0, card: 0 });
            bucket.total += tipAmt;
            if (tMethod === "card") bucket.card += tipAmt;
            else bucket.cash += tipAmt;
          }
          const ts = o.phoneLoyaltyAt as Timestamp | undefined;
          if (!ts?.toMillis) return;
          const ms = ts.toMillis();
          phoneVisits30d++;
          let ph = String(o.customerPhone ?? "").replace(/\D/g, "");
          if (ph.length > 10) ph = ph.slice(-10);
          if (ph.length === 10) uniquePhones30d.add(ph);
          if (o.redemptionResult === "applied") phoneRedemptions30d++;
          if (ms >= todayStart.getTime()) phoneVisitsToday++;
          if (ms >= sevenDaysAgo.getTime()) {
            // Llave de JORNADA: la visita de la 1 AM cuenta en el día de ayer.
            phoneDailyCounts[businessDayKey(ts.toDate())] =
              (phoneDailyCounts[businessDayKey(ts.toDate())] ?? 0) + 1;
          }
        });

        const todayScans = todayVisitsSnap.size + phoneVisitsToday;

        // 30-day lealtad metrics: brain (app/visitHistory) + phone sales.
        let metrics30d: InsightsMetrics | null = null;
        if (insightsData?.metrics) {
          const m = insightsData.metrics;
          metrics30d = {
            atRiskCount: (m.atRiskCount as number) ?? 0,
            scans30d: ((m.scans30d as number) ?? 0) + phoneVisits30d,
            redemptions30d: ((m.redemptions30d as number) ?? 0) + phoneRedemptions30d,
            uniqueCustomers30d: ((m.uniqueCustomers30d as number) ?? 0) + uniquePhones30d.size,
            menuItemCount: (m.menuItemCount as number) ?? 0,
            rewardCount: (m.rewardCount as number) ?? 0,
          };
        }

        // Daily aggregation for weekly charts
        const dailyStatsMap: Record<string, { scans: number; sales: number }> = {};
        
        // Init 7 days with zero
        for (let i = 0; i < 7; i++) {
          const d = new Date(sevenDaysAgo.getTime() + i * 24 * 60 * 60 * 1000);
          const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
          dailyStatsMap[key] = { scans: 0, sales: 0 };
        }

        weeklyVisitsSnap.forEach((doc) => {
          const ts = doc.data().timestamp as Timestamp;
          if (!ts) return;
          // Llave de JORNADA (corte 4 AM) — no fecha calendario.
          const key = businessDayKey(ts.toDate());
          if (dailyStatsMap[key]) {
            dailyStatsMap[key].scans++;
          }
        });

        // Add phone-sale visits to the same per-day buckets as app scans.
        Object.entries(phoneDailyCounts).forEach(([key, count]) => {
          if (dailyStatsMap[key]) {
            dailyStatsMap[key].scans += count;
          }
        });

        weeklyOrdersSnap.forEach((doc) => {
          const ts = doc.data().createdAt as Timestamp;
          if (!ts) return;
          // Llave de JORNADA (corte 4 AM) — la venta de la 1 AM suma al día
          // que abrió ayer, no al calendario de hoy.
          const key = businessDayKey(ts.toDate());
          if (dailyStatsMap[key]) {
            dailyStatsMap[key].sales += (doc.data().total as number) ?? 0;
          }
        });

        const weeklyStats: WeekStats[] = Array.from({ length: 7 }, (_, i) => {
          const d = new Date(sevenDaysAgo.getTime() + i * 24 * 60 * 60 * 1000);
          const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
          return {
            label: DAY_LABELS[d.getDay()],
            scans: dailyStatsMap[key]?.scans ?? 0,
            sales: dailyStatsMap[key]?.sales ?? 0,
            dateStr: d.toLocaleDateString("es-MX", { day: "numeric", month: "short" }),
          };
        });

        const weeklyRevenueTotal = weeklyStats.reduce((acc, d) => acc + d.sales, 0);
        const weeklyScansTotal = weeklyStats.reduce((acc, d) => acc + d.scans, 0);

        // Top Sold Products aggregation (from weekly orders)
        const productMap: Record<string, { qty: number; revenue: number }> = {};
        weeklyOrdersSnap.forEach((doc) => {
          const items =
            (doc.data().items as
              | { name?: string; quantity?: number; subtotal?: number; price?: number }[]
              | undefined) ?? [];
          items.forEach((item) => {
            const name = item.name;
            const quantity = item.quantity ?? 0;
            const subtotal = item.subtotal ?? (item.price ?? 0) * quantity;
            if (!name) return;
            if (!productMap[name]) {
              productMap[name] = { qty: 0, revenue: 0 };
            }
            productMap[name].qty += quantity;
            productMap[name].revenue += subtotal;
          });
        });

        const topProducts: TopProduct[] = Object.entries(productMap)
          .map(([name, val]) => ({ name, qty: val.qty, revenue: val.revenue }))
          .sort((a, b) => b.qty - a.qty)
          .slice(0, 5);

        setData({
          restaurantId: rid,
          restaurantName: (restData.name as string) ?? "Reportes",
          dailyGoal: (restData.dailyRevenueGoal as number | null) ?? null,
          todayRevenue,
          todaySalesCount,
          todayAvgTicket,
          todayScans,
          metrics30d,
          weeklyStats,
          weeklyRevenueTotal,
          weeklyScansTotal,
          topProducts,
          discounts30d:
            discCount30d > 0
              ? { total: discTotal30d, count: discCount30d, byProfile: discByProfile }
              : null,
          staffSales30d: (() => {
            const rows = Object.entries(staffMap)
              .map(([name, v]) => ({ name, count: v.count, revenue: v.revenue }))
              .sort((a, b) => b.revenue - a.revenue);
            return rows.length > 0 ? rows : null;
          })(),
          tips30d:
            tipsTotal30d > 0
              ? {
                  total: tipsTotal30d,
                  cash: tipsCash30d,
                  card: tipsCard30d,
                  byStaff: tipsByStaff,
                }
              : null,
        });

        setLoadState("ready");
      } catch (err) {
        console.error("Error loading analytics data", err);
        setLoadState("error");
      }
    }

    init();
  }, [router]);

  if (loadState === "loading") {
    return (
      <main className="px-5 pb-24 pt-5 md:px-8 md:pt-7">
        <PageTitle />
        <div className="flex justify-center py-20"><Spinner /></div>
      </main>
    );
  }

  if (loadState === "error" || !data) {
    return (
      <main className="px-5 pb-24 pt-5 md:px-8 md:pt-7">
        <PageTitle />
        <div className="flex flex-col items-center py-20 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full" style={{ background: TILE }}><IconChart /></div>
          <p className="mt-4 text-[17px] font-semibold leading-[22px]" style={{ color: INK, fontFamily: SERIF }}>No pudimos cargar tus reportes</p>
          <p className="mt-1 text-[14px]" style={{ color: INK_MUTED }}>Revisa tu conexión y vuelve a intentar.</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 flex h-12 items-center rounded-xl px-6 text-[15px] font-semibold"
            style={{ background: BRAND, color: INK }}
          >
            Volver a intentar
          </button>
        </div>
      </main>
    );
  }

  // Calculate daily goal percentage
  const goalProgress = data.dailyGoal && data.dailyGoal > 0 ? (data.todayRevenue / data.dailyGoal) * 100 : 0;
  const goalProgressDisplay = Math.min(Math.round(goalProgress), 100);
  const hasGoal = !!data.dailyGoal && data.dailyGoal > 0;
  const todayLabel = new Date().toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" });
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

  return (
    <main className="px-5 pb-24 pt-5 md:px-8 md:pt-7">
      <PageTitle caption={`${data.restaurantName} · hoy, 7 días y 30 días`} />

      <div className="flex flex-col gap-7">

        {/* ── Resultados de hoy: cuatro cifras en una fila con líneas finas ── */}
        <section>
          <SectionTitle right={todayLabel}>Resultados de hoy</SectionTitle>
          <StatGrid
            layout="2/4"
            items={[
              { label: "ingresos", value: fmt(data.todayRevenue), sub: plural(data.todaySalesCount, "venta", "ventas") },
              { label: "ticket promedio", value: fmt(data.todayAvgTicket) },
              { label: "clientes Comeleal", value: data.todayScans, sub: "con app o con número" },
              hasGoal
                ? { label: "de la meta del día", value: <GoalRing pct={goalProgressDisplay} />, sub: `meta ${fmt(data.dailyGoal!)}` }
                : {
                    label: "meta del día",
                    value: "—",
                    sub: (
                      <Link href="/vendor/configuracion" className="font-semibold hover:underline" style={{ color: LINK }}>
                        Ponerla en Configuración
                      </Link>
                    ),
                  },
            ]}
          />
        </section>

        {/* ── Últimos 7 días: dos gráficas planas, sin tarjeta ── */}
        <section>
          <SectionTitle right="hoy y los 6 días anteriores">Últimos 7 días</SectionTitle>
          <div className="grid grid-cols-1 gap-7 md:grid-cols-2 md:gap-8">
            <div>
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <p className="text-[15px] font-semibold leading-5" style={{ color: INK }}>Ingresos</p>
                <p className="text-[22px] font-bold leading-[26px] tabular-nums" style={{ color: INK }}>{fmt(data.weeklyRevenueTotal)}</p>
              </div>
              <BarChart
                highlightToday
                color={INK}
                points={data.weeklyStats.map((d) => ({
                  label: d.label,
                  dateStr: d.dateStr,
                  value: d.sales,
                  text: `$${Math.round(d.sales)}`,
                }))}
              />
            </div>
            <div>
              <div className="mb-1 flex items-baseline justify-between gap-3">
                <p className="text-[15px] font-semibold leading-5" style={{ color: INK }}>Clientes Comeleal</p>
                <p className="text-[22px] font-bold leading-[26px] tabular-nums" style={{ color: INK }}>{plural(data.weeklyScansTotal, "visita", "visitas")}</p>
              </div>
              <p className="mb-3 text-[13px] leading-4" style={{ color: INK_SOFT }}>Con app o con número. Son los que puedes traer de vuelta.</p>
              <BarChart
                color={INK_MUTED}
                points={data.weeklyStats.map((d) => ({
                  label: d.label,
                  dateStr: d.dateStr,
                  value: d.scans,
                  text: String(d.scans),
                }))}
              />
            </div>
          </div>
        </section>

        {/* ── Historial de ventas por rango — pared 1 de la Caja (8-sep) ──
            30 días gratis (la ventana de siempre); 90 días y Todo son Pro. */}
        <section>
          <SectionTitle>Historial de ventas</SectionTitle>
          <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label="Rango del historial">
            {HISTORY_RANGES.map((r) => {
              const active = rangeDays === r.days;
              const locked = !historyAllowed(ents, r.days);
              return (
                <button
                  key={r.label}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => pickRange(r.days)}
                  className="flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[14px] transition-all"
                  style={
                    active
                      ? { background: INK, color: "#FAF9F5", border: `1px solid ${INK}`, fontWeight: 600 }
                      : { background: "#FFFFFF", color: INK, border: `1px solid ${BORDER}` }
                  }
                  title={locked ? "Esto es Pro" : undefined}
                >
                  <span>{r.label}</span>
                  {locked && (
                    <span className="inline-flex h-5 items-center rounded-full px-2 text-[12px] font-semibold" style={{ background: TILE, color: INK_MUTED }}>
                      Pro
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {historyLoading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : history ? (
            <>
              <StatGrid
                layout="2/3"
                items={[
                  { label: "ventas", value: history.count },
                  { label: "ingresos", value: fmt(history.revenue) },
                  {
                    label: "ticket promedio",
                    value: fmt(history.count > 0 ? history.revenue / history.count : 0),
                    className: "col-span-2 md:col-span-1",
                  },
                ]}
              />
              {history.byMonth.length === 0 ? (
                <EmptyLine>Sin ventas cobradas en este rango.</EmptyLine>
              ) : (
                <div className="mt-4">
                  <ListCard>
                    {history.byMonth.map((m) => (
                      <div key={m.key} className="flex items-center justify-between gap-3 py-3">
                        <span className="text-[15px] capitalize" style={{ color: INK }}>{m.label}</span>
                        <div className="shrink-0 text-right">
                          <p className="text-[15px] font-bold tabular-nums" style={{ color: INK }}>{fmt(m.revenue)}</p>
                          <p className="text-[13px] leading-4 tabular-nums" style={{ color: INK_SOFT }}>{plural(m.count, "venta", "ventas")}</p>
                        </div>
                      </div>
                    ))}
                  </ListCard>
                </div>
              )}
              {ents.historyDays != null && (
                <p className="mt-3 text-[13px] leading-4" style={{ color: INK_SOFT }}>
                  Gratis ves los últimos {ents.historyDays} días. Todo tu historial es Pro.
                </p>
              )}
            </>
          ) : (
            <EmptyLine>No pudimos cargar el historial.</EmptyLine>
          )}
        </section>

        {/* ── Lo de 30 días y los platillos: una columna en móvil, dos desde md ── */}
        <div className="flex flex-col gap-7 md:grid md:grid-cols-2 md:gap-x-8 md:gap-y-7">

          {/* Descuentos especiales (30d) — solo si hubo */}
          {data.discounts30d && (
            <section>
              <SectionTitle right="últimos 30 días">Descuentos especiales</SectionTitle>
              <p className="text-[22px] font-bold leading-[26px] tabular-nums" style={{ color: INK }}>{fmt(data.discounts30d.total)}</p>
              <p className="mt-0.5 text-[13px] leading-4" style={{ color: INK_MUTED }}>
                dados en {plural(data.discounts30d.count, "venta", "ventas")} a equipo, familia y amigos. Los puntos siempre se calculan sobre lo pagado.
              </p>
              <div className="mt-3">
                <ListCard>
                  {Object.entries(data.discounts30d.byProfile)
                    .sort((a, b) => b[1] - a[1])
                    .map(([name, amt]) => (
                      <div key={name} className="flex items-center justify-between gap-3 py-3">
                        <span className="min-w-0 truncate text-[15px]" style={{ color: INK }}>{name}</span>
                        <span className="shrink-0 text-[15px] font-bold tabular-nums" style={{ color: INK }}>{fmt(amt)}</span>
                      </div>
                    ))}
                </ListCard>
              </div>
            </section>
          )}

          {/* Ventas por empleado (30d) — solo si la caja usa el equipo con PIN */}
          {data.staffSales30d && (
            <section>
              <SectionTitle right="últimos 30 días">Ventas por empleado</SectionTitle>
              <ListCard>
                {data.staffSales30d.map((r) => (
                  <div key={r.name} className="flex items-center justify-between gap-3 py-3">
                    <span className="min-w-0 truncate text-[15px]" style={{ color: INK }}>{r.name}</span>
                    <div className="shrink-0 text-right">
                      <p className="text-[15px] font-bold tabular-nums" style={{ color: INK }}>{fmt(r.revenue)}</p>
                      <p className="text-[13px] leading-4 tabular-nums" style={{ color: INK_SOFT }}>{plural(r.count, "venta", "ventas")}</p>
                    </div>
                  </div>
                ))}
              </ListCard>
            </section>
          )}

          {/* Propinas (30d) — para repartir justo al equipo */}
          {data.tips30d && (
            <section>
              <SectionTitle right="últimos 30 días">Propinas</SectionTitle>
              <p className="text-[22px] font-bold leading-[26px] tabular-nums" style={{ color: INK }}>{fmt(data.tips30d.total)}</p>
              <p className="mt-0.5 text-[13px] leading-4" style={{ color: INK_MUTED }}>
                Aparte de tus ventas. No suman puntos ni comisión.
              </p>
              <div className="mt-3">
                <StatGrid
                  layout="2/2"
                  items={[
                    { label: "en efectivo", value: fmt(data.tips30d.cash), sub: "ya la tiene el equipo" },
                    { label: "tarjeta o transferencia", value: fmt(data.tips30d.card), sub: "la cobró el negocio" },
                  ]}
                />
                {/* Sin nota: cuando le paga al equipo lo decide el dueno
                    (diario, semanal, quincenal). El copy no lo inventa. */}
              </div>
              <div className="mt-3">
                <ListCard>
                  {Object.entries(data.tips30d.byStaff)
                    .sort((a, b) => b[1].total - a[1].total)
                    .map(([name, amt]) => (
                      <div key={name} className="flex items-center justify-between gap-3 py-3">
                        <div className="min-w-0">
                          <p className="truncate text-[15px]" style={{ color: INK }}>{name}</p>
                          {amt.card > 0 && (
                            <p className="text-[13px] leading-4 tabular-nums" style={{ color: INK_SOFT }}>
                              tarjeta o transferencia {fmt(amt.card)}
                            </p>
                          )}
                        </div>
                        <span className="shrink-0 text-[15px] font-bold tabular-nums" style={{ color: INK }}>{fmt(amt.total)}</span>
                      </div>
                    ))}
                </ListCard>
              </div>
            </section>
          )}

          {/* Platillos más vendidos (7 días) */}
          <section>
            <SectionTitle right="últimos 7 días">Platillos más vendidos</SectionTitle>
            {data.topProducts.length === 0 ? (
              <EmptyLine>Sin ventas en los últimos 7 días.</EmptyLine>
            ) : (
              <ListCard>
                {data.topProducts.map((p, idx) => (
                  <div key={idx} className="flex items-center gap-3 py-3">
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-bold tabular-nums"
                      style={{ background: TILE, color: INK }}
                    >
                      {idx + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[15px]" style={{ color: INK }}>{p.name}</span>
                    <div className="shrink-0 text-right">
                      <p className="text-[15px] font-bold tabular-nums" style={{ color: INK }}>{plural(p.qty, "unidad", "unidades")}</p>
                      <p className="text-[13px] leading-4 tabular-nums" style={{ color: INK_SOFT }}>{fmt(p.revenue)}</p>
                    </div>
                  </div>
                ))}
              </ListCard>
            )}
          </section>

          {/* Lealtad (30 días) */}
          <section>
            <SectionTitle right="últimos 30 días">Lealtad</SectionTitle>
            {data.metrics30d ? (
              <StatGrid
                layout="2/4"
                items={[
                  { label: "visitas Comeleal", value: data.metrics30d.scans30d },
                  { label: "premios canjeados", value: data.metrics30d.redemptions30d },
                  { label: "clientes distintos", value: data.metrics30d.uniqueCustomers30d },
                  { label: "clientes en riesgo", value: data.metrics30d.atRiskCount },
                ]}
              />
            ) : (
              <EmptyLine>Todavía estamos sumando tus números del mes. Vuelve mañana.</EmptyLine>
            )}
          </section>

        </div>

      </div>

      {/* ── Pared 1: historial >30 días ── */}
      {wallOpen && ent && data && (
        <ProWall
          wall="history"
          restaurantId={data.restaurantId}
          entitlement={ent}
          onClose={() => setWallOpen(false)}
          onUnlocked={(next, nextEnt) => {
            setEnts(next);
            setEnt(nextEnt);
            setWallOpen(false);
            setRangeDays(pendingRange);
            void loadHistory(data.restaurantId, pendingRange);
          }}
        />
      )}
    </main>
  );
}
