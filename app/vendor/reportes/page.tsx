"use client";

import { useEffect, useState } from "react";
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

const DAY_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReportesPage() {
  const router = useRouter();
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [data, setData] = useState<ReportsData | null>(null);

  useEffect(() => {
    async function init() {
      const u = await waitForAuthReady();
      if (!u || u.isAnonymous) {
        router.push("/activar");
        return;
      }

      try {
        const db = getFirebaseDb();
        const userSnap = await getDoc(doc(db, "users", u.uid));
        const userData = userSnap.data();
        if (!userData?.ownedRestaurantId) {
          router.push("/activar");
          return;
        }

        const rid = userData.ownedRestaurantId as string;

        // Timestamps setup
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const sevenDaysAgo = new Date(todayStart.getTime() - 6 * 24 * 60 * 60 * 1000);
        const thirtyDaysAgo = new Date(todayStart.getTime() - 30 * 24 * 60 * 60 * 1000);

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
        monthOrdersSnap?.forEach((d) => {
          const o = d.data();
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
            const dt = ts.toDate();
            const key = `${dt.getFullYear()}-${dt.getMonth()}-${dt.getDate()}`;
            phoneDailyCounts[key] = (phoneDailyCounts[key] ?? 0) + 1;
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
          const dt = ts.toDate();
          const key = `${dt.getFullYear()}-${dt.getMonth()}-${dt.getDate()}`;
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
          const dt = ts.toDate();
          const key = `${dt.getFullYear()}-${dt.getMonth()}-${dt.getDate()}`;
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
          const items = doc.data().items as any[] ?? [];
          items.forEach((item) => {
            const name = item.name as string;
            const quantity = (item.quantity as number) ?? 0;
            const subtotal = (item.subtotal as number) ?? ((item.price ?? 0) * quantity);
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
      <div className="flex min-h-screen items-center justify-center" style={{ background: "#F5F3EF" }}>
        <Spinner />
      </div>
    );
  }

  if (loadState === "error" || !data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center" style={{ background: "#F5F3EF" }}>
        <p className="text-sm text-gray-500">No pudimos cargar tus reportes.</p>
        <button onClick={() => window.location.reload()} className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white bg-[#F28C38]">
          Reintentar
        </button>
      </div>
    );
  }

  // Calculate daily goal percentage
  const goalProgress = data.dailyGoal && data.dailyGoal > 0 ? (data.todayRevenue / data.dailyGoal) * 100 : 0;
  const goalProgressDisplay = Math.min(Math.round(goalProgress), 100);

  // SVG Chart sizing helpers
  const maxSales = Math.max(...data.weeklyStats.map((s) => s.sales), 1);
  const maxScans = Math.max(...data.weeklyStats.map((s) => s.scans), 1);

  return (
    <div className="min-h-screen pb-16" style={{ background: "#F5F3EF" }}>
      
      {/* Sticky Top Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4"
        style={{ background: "#ffffff", borderBottom: "1px solid rgba(28,37,38,0.07)" }}>
        <div className="flex items-center gap-3">
          <Link href="/vendor" className="text-[13px] font-bold text-gray-400 hover:opacity-75 transition-opacity">
            ← Panel
          </Link>
          <span style={{ color: "rgba(28,37,38,0.2)" }}>/</span>
          <h1 className="text-[15px] font-black uppercase tracking-wider" style={{ color: "#1C2526" }}>Reportes</h1>
        </div>
      </div>

      <main className="px-4 pt-6 md:px-8 md:pt-8 space-y-6">
        
        {/* Today's Title */}
        <div>
          <h2 className="text-[20px] font-black tracking-tight" style={{ color: "#1C2526" }}>Resultados de hoy</h2>
          <p className="text-[12px] text-gray-400">Rendimiento en tiempo real para las ventas de hoy</p>
        </div>

        {/* Today's Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          
          {/* Revenue */}
          <div className="rounded-2xl p-5 bg-white space-y-3" style={{ border: "1px solid rgba(28,37,38,0.07)" }}>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Ingresos hoy</p>
            <p className="text-[26px] font-black text-[#1C2526]">{fmt(data.todayRevenue)}</p>
            <p className="text-[11px] text-gray-400">{data.todaySalesCount} ventas totales</p>
          </div>

          {/* Average Ticket */}
          <div className="rounded-2xl p-5 bg-white space-y-3" style={{ border: "1px solid rgba(28,37,38,0.07)" }}>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Ticket promedio</p>
            <p className="text-[26px] font-black text-[#1C2526]">{fmt(data.todayAvgTicket)}</p>
            <p className="text-[11px] text-gray-400">Valor promedio de compra</p>
          </div>

          {/* Scans/Visits */}
          <div className="rounded-2xl p-5 bg-white space-y-3" style={{ border: "1px solid rgba(28,37,38,0.07)" }}>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Clientes Comeleal hoy</p>
            <p className="text-[26px] font-black text-[#1C2526]">{data.todayScans}</p>
            <p className="text-[11px] text-gray-400">Visitas con app o número</p>
          </div>

          {/* Daily Goal Progress */}
          {data.dailyGoal && data.dailyGoal > 0 ? (
            <div className="rounded-2xl p-5 bg-white flex items-center justify-between" style={{ border: "1px solid rgba(28,37,38,0.07)" }}>
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Meta diaria</p>
                <p className="text-[18px] font-black text-[#1C2526]">{fmt(data.todayRevenue)} / {fmt(data.dailyGoal)}</p>
                <p className="text-[11px] text-[#F28C38] font-bold">{goalProgressDisplay}% de la meta alcanzado</p>
              </div>
              <div className="relative w-16 h-16">
                {/* SVG circular progress indicator */}
                <svg className="w-full h-full" viewBox="0 0 36 36">
                  <path className="text-gray-100" strokeWidth="3" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                  <path className="text-[#F28C38]" strokeWidth="3.2" strokeDasharray={`${goalProgressDisplay}, 100`} strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center text-[11px] font-black text-[#1C2526]">{goalProgressDisplay}%</div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl p-5 bg-white flex flex-col justify-center text-center space-y-1" style={{ border: "1px solid rgba(28,37,38,0.07)" }}>
              <p className="text-[12px] font-bold text-gray-400">Meta diaria no configurada</p>
              <Link href="/vendor/configuracion" className="text-[11px] font-bold text-[#F28C38] hover:underline">
                Establecer meta en Configuración →
              </Link>
            </div>
          )}
        </div>

        {/* 7-Day Performance Title */}
        <div className="pt-4">
          <h2 className="text-[20px] font-black tracking-tight" style={{ color: "#1C2526" }}>Rendimiento semanal</h2>
          <p className="text-[12px] text-gray-400">Resultados e historial de los últimos 7 días</p>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Sales chart */}
          <div className="rounded-3xl p-6 bg-white space-y-4" style={{ border: "1px solid rgba(28,37,38,0.07)" }}>
            <div>
              <p className="text-[14px] font-bold text-[#1C2526]">Ingresos de la semana</p>
              <p className="text-[22px] font-black text-[#F28C38]">{fmt(data.weeklyRevenueTotal)}</p>
            </div>
            
            {/* Custom SVG Bar Chart */}
            <div className="h-48 flex items-end justify-between gap-1.5 pt-4">
              {data.weeklyStats.map((day, idx) => {
                const heightPct = (day.sales / maxSales) * 100;
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                    <span className="text-[9px] font-bold text-gray-500 tabular-nums">
                      {day.sales > 0 ? `$${Math.round(day.sales)}` : ""}
                    </span>
                    <div
                      className="w-full rounded-t-lg transition-all duration-300"
                      style={{
                        height: `${Math.max(heightPct, 2)}%`,
                        background: "linear-gradient(180deg, #FF9A45 0%, #F28C38 100%)",
                      }}
                    />
                    <div className="text-center">
                      <p className="text-[10px] font-bold text-[#1C2526]">{day.label}</p>
                      <p className="text-[8px] text-gray-400 whitespace-nowrap">{day.dateStr}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Visits/Scans chart */}
          <div className="rounded-3xl p-6 bg-white space-y-4" style={{ border: "1px solid rgba(28,37,38,0.07)" }}>
            <div>
              <p className="text-[14px] font-bold text-[#1C2526]">Clientes Comeleal — semana</p>
              <p className="text-[22px] font-black text-[#1C2526]">{data.weeklyScansTotal} visitas</p>
              <p className="text-[11px] text-gray-400">Con app o con número — los que puedes traer de vuelta</p>
            </div>
            
            {/* Custom SVG Bar Chart */}
            <div className="h-48 flex items-end justify-between gap-1.5 pt-4">
              {data.weeklyStats.map((day, idx) => {
                const heightPct = (day.scans / maxScans) * 100;
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                    <span className="text-[9px] font-bold text-gray-500 tabular-nums">
                      {day.scans > 0 ? day.scans : ""}
                    </span>
                    <div
                      className="w-full rounded-t-lg transition-all duration-300 bg-gray-300"
                      style={{
                        height: `${Math.max(heightPct, 2)}%`,
                        background: "linear-gradient(180deg, #4B5563 0%, #1F2937 100%)",
                      }}
                    />
                    <div className="text-center">
                      <p className="text-[10px] font-bold text-[#1C2526]">{day.label}</p>
                      <p className="text-[8px] text-gray-400 whitespace-nowrap">{day.dateStr}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* Lower Grid: Top products and 30d lealtad */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Top selling items */}
          <div className="rounded-3xl p-6 bg-white space-y-4" style={{ border: "1px solid rgba(28,37,38,0.07)" }}>
            <p className="text-[14px] font-bold text-[#1C2526] border-b border-gray-100 pb-2">Top 5 productos más vendidos (semana)</p>
            {data.topProducts.length === 0 ? (
              <div className="py-12 text-center text-gray-400 text-[13px]">
                No se registraron ventas esta semana
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {data.topProducts.map((p, idx) => (
                  <div key={idx} className="flex justify-between items-center py-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-orange-50 text-[11px] font-black text-[#F28C38]">
                        #{idx + 1}
                      </span>
                      <span className="text-[13px] font-bold text-[#1C2526]">{p.name}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-[13px] font-black text-[#1C2526]">{p.qty} unidades</p>
                      <p className="text-[10px] text-gray-400">Total: {fmt(p.revenue)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 30-Day Insights */}
          <div className="rounded-3xl p-6 bg-white space-y-4" style={{ border: "1px solid rgba(28,37,38,0.07)" }}>
            <p className="text-[14px] font-bold text-[#1C2526] border-b border-gray-100 pb-2">Métricas de fidelidad (30 días)</p>
            {data.metrics30d ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded-2xl space-y-1">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Visitas Comeleal</p>
                  <p className="text-[20px] font-black text-[#1C2526]">{data.metrics30d.scans30d}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-2xl space-y-1">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Canjes de premios</p>
                  <p className="text-[20px] font-black text-[#1C2526]">{data.metrics30d.redemptions30d}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-2xl space-y-1">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Clientes únicos</p>
                  <p className="text-[20px] font-black text-[#1C2526]">{data.metrics30d.uniqueCustomers30d}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-2xl space-y-1">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Clientes en riesgo</p>
                  <p className="text-[20px] font-black text-[#F28C38]">{data.metrics30d.atRiskCount}</p>
                </div>
              </div>
            ) : (
              <div className="py-16 text-center text-gray-400 text-[13px]">
                <span className="block text-2xl mb-2">🤖</span>
                El Brain de Comeleal está calculando tus métricas mensuales. Vuelve mañana.
              </div>
            )}
          </div>

        </div>

      </main>
    </div>
  );
}
