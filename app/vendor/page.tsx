"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  Timestamp,
} from "firebase/firestore";
import { getFirebaseDb, getFirebaseFunctions } from "@/lib/firebase";
import { httpsCallable } from "firebase/functions";
import { waitForAuthReady } from "@/lib/auth";
import { getAuth, signOut } from "firebase/auth";
import type { User } from "firebase/auth";
import { completedStepCount } from "@/lib/vendorReadiness";

// ─── Types ────────────────────────────────────────────────────────────────────

type LoadState = "loading" | "ready" | "error";

interface RecentScan {
  id: string;
  userId: string;
  customerName: string;
  pointsAwarded: number;
  timestamp: Timestamp | null;
}

interface WeekDay {
  label: string;
  count: number;
  isToday: boolean;
}

interface NbaMetrics {
  atRiskCount: number;
  scans30d: number;
  redemptions30d: number;
  uniqueCustomers30d: number;
  menuItemCount: number;
  rewardCount: number;
}

interface DashboardData {
  restaurantId: string;
  restaurantName: string;
  scanCountTotal: number;
  scansToday: number;
  pointsToday: number;
  weeklyScans: WeekDay[];
  weekTotal: number;
  weeklyBriefText?: string;
  atRiskCount?: number;
  restaurantStatus: string;
  recentScans: RecentScan[];
  isSetupComplete: boolean;
  setupIncompleteReasons: string[];
  // NBA (Next Best Action) from vendorInsights/current
  nbaActionCode: string;
  nbaTitle: string;
  nbaBody: string;
  nbaMetrics: NbaMetrics;
  // Revenue goal
  dailyGoal: number | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DAY_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

function timeAgo(ts: Timestamp | null): string {
  if (!ts) return "";
  const diff = Math.floor((Date.now() - ts.toMillis()) / 1000);
  if (diff < 60) return "ahora";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

function resolveCustomerName(
  uid: string,
  displayName?: string | null,
  email?: string | null
): string {
  if (displayName?.trim()) return displayName.trim().split(" ")[0];
  if (email?.trim()) return email.split("@")[0];
  return `#${uid.slice(-4).toUpperCase()}`;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function VendorDashboard() {
  const router = useRouter();
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [user, setUser] = useState<User | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    async function init() {
      const u = await waitForAuthReady();
      if (!u || u.isAnonymous) { router.push("/activar"); return; }
      setUser(u);

      try {
        const db = getFirebaseDb();
        const userSnap = await getDoc(doc(db, "users", u.uid));
        const userData = userSnap.data();
        if (!userData?.ownedRestaurantId) { router.push("/activar"); return; }

        const rid = userData.ownedRestaurantId as string;

        const todayStart = (() => {
          const d = new Date(); d.setHours(0, 0, 0, 0);
          return Timestamp.fromDate(d);
        })();

        const sevenDaysAgo = (() => {
          const d = new Date(); d.setDate(d.getDate() - 6); d.setHours(0, 0, 0, 0);
          return Timestamp.fromDate(d);
        })();

        const [restaurantSnap, insightsSnap, visitsSnap, weekSnap, recentSnap] =
          await Promise.all([
            getDoc(doc(db, "restaurants", rid)),
            getDoc(doc(db, "restaurants", rid, "vendorInsights", "current")),
            getDocs(query(
              collection(db, "restaurants", rid, "visitHistory"),
              where("timestamp", ">=", todayStart)
            )),
            getDocs(query(
              collection(db, "restaurants", rid, "visitHistory"),
              where("timestamp", ">=", sevenDaysAgo),
              orderBy("timestamp", "asc")
            )),
            getDocs(query(
              collection(db, "restaurants", rid, "visitHistory"),
              orderBy("timestamp", "desc"),
              limit(6)
            )),
          ]);

        const r = restaurantSnap.data() ?? {};
        const ins = insightsSnap.exists() ? insightsSnap.data() : {};

        // Today's counts
        let scansToday = 0, pointsToday = 0;
        visitsSnap.forEach((d) => {
          scansToday++;
          pointsToday += (d.data().pointsAwarded as number) ?? 0;
        });

        // 7-day chart data
        const dailyCounts: Record<string, number> = {};
        weekSnap.forEach((d) => {
          const ts = d.data().timestamp as Timestamp;
          if (!ts) return;
          const dt = ts.toDate();
          const key = `${dt.getFullYear()}-${dt.getMonth()}-${dt.getDate()}`;
          dailyCounts[key] = (dailyCounts[key] ?? 0) + 1;
        });

        const today = new Date();
        const weeklyScans: WeekDay[] = Array.from({ length: 7 }, (_, i) => {
          const d = new Date();
          d.setDate(today.getDate() - (6 - i));
          const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
          return {
            label: DAY_LABELS[d.getDay()],
            count: dailyCounts[key] ?? 0,
            isToday: i === 6,
          };
        });

        const weekTotal = weeklyScans.reduce((s, d) => s + d.count, 0);

        // Resolve customer names
        const recentDocs = recentSnap.docs;
        const uniqueUids = [...new Set(recentDocs.map((d) => d.data().userId as string))];
        const userDocsArr = await Promise.all(
          uniqueUids.map((uid) => getDoc(doc(db, "users", uid)).catch(() => null))
        );
        const nameMap: Record<string, string> = {};
        uniqueUids.forEach((uid, i) => {
          const uData = userDocsArr[i]?.data();
          nameMap[uid] = resolveCustomerName(uid, uData?.displayName, uData?.email);
        });

        const recentScans: RecentScan[] = recentDocs.map((d) => ({
          id: d.id,
          userId: d.data().userId as string,
          customerName: nameMap[d.data().userId as string] ??
            `#${(d.data().userId as string).slice(-4).toUpperCase()}`,
          pointsAwarded: (d.data().pointsAwarded as number) ?? 1,
          timestamp: (d.data().timestamp as Timestamp) ?? null,
        }));

        const insMetrics = (ins?.metrics ?? {}) as Record<string, unknown>;
        setData({
          restaurantId: rid,
          restaurantName: (r.name as string) ?? "Mi restaurante",
          scanCountTotal: (r.scanCount as number) ?? 0,
          scansToday,
          pointsToday,
          weeklyScans,
          weekTotal,
          weeklyBriefText: ins?.weeklyBriefText as string | undefined,
          atRiskCount: (insMetrics.atRiskCount as number | undefined) ?? (ins?.atRiskCount as number | undefined),
          restaurantStatus: (r.status as string) ?? "active",
          recentScans,
          isSetupComplete: (r.isSetupComplete as boolean) ?? true,
          setupIncompleteReasons: (r.setupIncompleteReasons as string[]) ?? [],
          nbaActionCode: (ins?.actionCode as string) ?? "unknown",
          nbaTitle: (ins?.title_es as string) ?? "Siguiente mejor acción",
          nbaBody: (ins?.body_es as string) ?? "",
          nbaMetrics: {
            atRiskCount: (insMetrics.atRiskCount as number) ?? 0,
            scans30d: (insMetrics.scans30d as number) ?? 0,
            redemptions30d: (insMetrics.redemptions30d as number) ?? 0,
            uniqueCustomers30d: (insMetrics.uniqueCustomers30d as number) ?? 0,
            menuItemCount: (insMetrics.menuItemCount as number) ?? 0,
            rewardCount: (insMetrics.rewardCount as number) ?? 0,
          },
          dailyGoal: (r.dailyRevenueGoal as number | null) ?? null,
        });
        setLoadState("ready");
      } catch (err) {
        console.error("[vendor/dashboard]", err);
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
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center"
        style={{ background: "#F5F3EF" }}>
        <p className="text-sm" style={{ color: "rgba(28,37,38,0.45)" }}>
          No pudimos cargar tu panel.
        </p>
        <button onClick={() => window.location.reload()}
          className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white"
          style={{ background: "#d97757" }}>
          Reintentar
        </button>
      </div>
    );
  }

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Buenos días" : hour < 19 ? "Buenas tardes" : "Buenas noches";
  const firstName = user?.displayName?.split(" ")[0] ?? "";
  const isLive = data.scansToday > 0;
  const riskCount = data.atRiskCount ?? 0;
  const sidebarW = sidebarOpen ? 220 : 60;

  return (
    <div className="flex min-h-screen" style={{ background: "#F5F3EF" }}>

      {/* ══════════ SIDEBAR ══════════ */}
      <aside
        className="fixed left-0 top-0 z-30 hidden h-screen flex-col transition-all duration-200 md:flex"
        style={{ width: sidebarW, background: "#1C2526", overflow: "hidden" }}
      >
        {/* Logo */}
        <div className="flex h-[60px] shrink-0 items-center gap-3 px-4"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.07)", minWidth: sidebarW }}>
          <Link href="/" className="flex shrink-0 items-center gap-2.5">
            <Image src="/comeleal-app-icon.png" alt="Comeleal"
              width={28} height={28}
              className="h-7 w-7 shrink-0 rounded-[7px]"
              style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.12)" }} />
            {sidebarOpen && (
              <span className="whitespace-nowrap text-[15px] font-bold text-white tracking-tight">
                Comeleal
              </span>
            )}
          </Link>
        </div>

        {/* Restaurant name */}
        {sidebarOpen && (
          <div className="shrink-0 px-4 py-3"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
            <p className="mb-0.5 text-[10px] font-bold uppercase tracking-widest"
              style={{ color: "rgba(255,255,255,0.28)" }}>
              Restaurante
            </p>
            <p className="truncate text-[13px] font-semibold text-white">
              {data.restaurantName}
            </p>
            {isLive && (
              <div className="mt-1.5 flex items-center gap-1.5">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-70" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-400" />
                </span>
                <span className="text-[10px] font-semibold text-green-400">En vivo</span>
              </div>
            )}
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
          <NavItem href="/vendor" icon={<IconHome />} label="Panel" active open={sidebarOpen} />
          <NavItem href="/vendor/scanner" icon={<IconQr size={15} />} label="Escanear" open={sidebarOpen} />
          <NavItem href="/vendor/clientes" icon={<IconUsers />} label="Clientes" open={sidebarOpen} />
          <NavItem href="/vendor/brain" icon={<IconBrain />} label="Brain AI" open={sidebarOpen} />
          <NavItem href="/vendor/reportes" icon={<IconBarChart />} label="Reportes" open={sidebarOpen} />
          {sidebarOpen && (
            <div className="my-2" style={{ height: 1, background: "rgba(255,255,255,0.07)" }} />
          )}
          <NavItem href="/vendor/configuracion" icon={<IconGear />} label="Configuración" open={sidebarOpen} />
          <NavItem href="/para-restaurantes" icon={<IconHelp />} label="Ayuda" open={sidebarOpen} />
        </nav>

        {/* Collapse toggle */}
        <button
          onClick={() => setSidebarOpen((o) => !o)}
          className="flex h-11 w-full shrink-0 items-center justify-center transition-colors hover:bg-white/5"
          style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}
          title={sidebarOpen ? "Colapsar menú" : "Expandir menú"}
        >
          <span className="text-white/40" style={{ transform: sidebarOpen ? "none" : "rotate(180deg)", display: "inline-block" }}>
            <IconChevronLeft />
          </span>
        </button>

        {/* User */}
        {sidebarOpen && (
          <div className="shrink-0 p-3"
            style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
            <div className="flex items-center gap-2.5">
              {user?.photoURL ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.photoURL} alt=""
                  className="h-7 w-7 shrink-0 rounded-full"
                  style={{ boxShadow: "0 0 0 1.5px rgba(255,255,255,0.16)" }} />
              ) : (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                  style={{ background: "rgba(242,140,56,0.2)", color: "#d97757" }}>
                  {(user?.displayName?.[0] ?? user?.email?.[0] ?? "?").toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] font-semibold"
                  style={{ color: "rgba(255,255,255,0.7)" }}>
                  {user?.displayName ?? user?.email ?? "Propietario"}
                </p>
                <span className="inline-flex rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider"
                  style={{ background: "rgba(242,140,56,0.18)", color: "#d97757" }}>
                  Free
                </span>
              </div>
              <button
                onClick={async () => { await signOut(getAuth()); router.push("/activar"); }}
                className="shrink-0 rounded-lg p-1.5 transition-colors hover:bg-white/10"
                title="Cerrar sesión"
              >
                <IconLogOut />
              </button>
            </div>
          </div>
        )}
        {!sidebarOpen && (
          <div className="flex shrink-0 items-center justify-center py-3">
            {user?.photoURL ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.photoURL} alt="" className="h-7 w-7 rounded-full" />
            ) : (
              <div className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold"
                style={{ background: "rgba(242,140,56,0.2)", color: "#d97757" }}>
                {(user?.displayName?.[0] ?? user?.email?.[0] ?? "?").toUpperCase()}
              </div>
            )}
          </div>
        )}
      </aside>

      {/* Sidebar spacer — reserves sidebar width in the flex layout (sidebar is fixed/out-of-flow) */}
      <div className="hidden shrink-0 transition-all duration-200 md:block" style={{ width: sidebarW }} />

      {/* ══════════ MAIN ══════════ */}
      <div
        className="flex min-h-screen min-w-0 flex-1 flex-col"
        id="main-content"
      >
        {/* Mobile header */}
        <header className="sticky top-0 z-20 flex items-center justify-between px-4 py-3 md:hidden"
          style={{
            background: "rgba(255,255,255,0.92)",
            backdropFilter: "blur(12px)",
            borderBottom: "1px solid rgba(28,37,38,0.07)",
          }}>
          <div className="flex items-center gap-2">
            <Link href="/">
              <Image src="/comeleal-app-icon.png" alt="" width={26} height={26}
                className="h-[26px] w-[26px] rounded-[6px]" />
            </Link>
            <span className="text-[14px] font-semibold" style={{ color: "#1C2526" }}>
              {data.restaurantName}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {isLive && (
              <span className="flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold text-green-700"
                style={{ background: "#D1FAE5" }}>
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" />
                En vivo
              </span>
            )}
            <Link href="/vendor/scanner"
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-bold text-white"
              style={{ background: "#d97757" }}>
              <IconQr size={11} /> Escanear
            </Link>
          </div>
        </header>

        {/* Desktop top bar */}
        <div className="hidden items-center justify-between px-8 py-4 md:flex"
          style={{
            background: "#ffffff",
            borderBottom: "1px solid rgba(28,37,38,0.07)",
          }}>
          <div>
            <p className="text-[11px] capitalize" style={{ color: "rgba(28,37,38,0.38)" }}>
              {new Date().toLocaleDateString("es-MX", {
                weekday: "long", day: "numeric", month: "long"
              })}
            </p>
            <h1 className="mt-0.5 text-[21px] font-bold" style={{ color: "#1C2526" }}>
              {greeting}{firstName ? `, ${firstName}` : ""}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            {isLive && (
              <div className="flex items-center gap-1.5 rounded-full border px-3 py-1.5"
                style={{ borderColor: "#BBF7D0", background: "#F0FDF4" }}>
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
                </span>
                <span className="text-[11px] font-semibold text-green-700">En vivo</span>
              </div>
            )}
            <Link href="/vendor/scanner"
              className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-semibold text-white transition hover:opacity-90"
              style={{ background: "#1C2526" }}>
              <IconQr size={13} /> Escanear cliente
            </Link>
          </div>
        </div>

        {/* ── Page content ── */}
        <main className="flex-1 px-4 pb-16 pt-5 md:px-8 md:pt-7">

          {/* Mobile scanner CTA */}
          <Link href="/vendor/scanner"
            className="mb-6 flex items-center justify-between rounded-2xl p-5 transition-transform active:scale-[0.98] md:hidden"
            style={{
              background: "linear-gradient(135deg, #FF9A45 0%, #d97757 55%, #E07830 100%)",
              boxShadow: "0 6px 28px rgba(242,140,56,0.28)",
            }}>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/60">
                Acción principal
              </p>
              <p className="mt-0.5 text-[20px] font-bold text-white">Escanear cliente</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl text-white"
              style={{ background: "rgba(255,255,255,0.2)" }}>
              <IconQr size={24} />
            </div>
          </Link>

          {/* ── Setup banner ── */}
          {!data.isSetupComplete && (
            <SetupBanner reasons={data.setupIncompleteReasons} />
          )}

          {/* ── Next Best Action (Brain NBA) ── */}
          <NextBestActionCard
            actionCode={data.nbaActionCode}
            title={data.nbaTitle}
            body={data.nbaBody}
            metrics={data.nbaMetrics}
          />

          {/* ── Stats ── */}
          <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="Scans hoy" value={data.scansToday} icon={<IconScan />} accent={isLive} />
            <StatCard label="Esta semana" value={data.weekTotal} icon={<IconWaveform />} />
            <StatCard label="Total histórico" value={data.scanCountTotal} icon={<IconTrendUp />} />
            <StatCard label="En riesgo" value={riskCount} icon={<IconAlert />} danger={riskCount > 0} />
          </div>

          {/* ── Attention alert ── */}
          {riskCount > 0 && (
            <div className="mb-5 flex items-center gap-3 rounded-2xl px-5 py-4"
              style={{
                background: "#ffffff",
                border: "1px solid rgba(239,68,68,0.18)",
                boxShadow: "0 1px 4px rgba(28,37,38,0.05)",
              }}>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                style={{ background: "rgba(239,68,68,0.09)" }}>
                <IconAlert />
              </div>
              <div className="flex-1">
                <p className="text-[13px] font-semibold" style={{ color: "#1C2526" }}>
                  {riskCount} cliente{riskCount !== 1 ? "s" : ""} sin regresar en 14+ días
                </p>
                <p className="text-[11px]" style={{ color: "rgba(28,37,38,0.4)" }}>
                  Activa una campaña de reenganche pronto
                </p>
              </div>
            </div>
          )}

          {/* ── Acciones rápidas ── */}
          <p className="mb-2.5 text-[10px] font-bold uppercase tracking-[0.1em]"
            style={{ color: "rgba(28,37,38,0.35)" }}>
            Acciones rápidas
          </p>
          <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-2">
            <Link href="/vendor/scanner"
              className="flex items-center gap-4 rounded-2xl px-5 py-4 transition hover:opacity-90 active:scale-[0.98]"
              style={{
                background: "#1C2526",
                boxShadow: "0 4px 16px rgba(28,37,38,0.18)",
              }}>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white"
                style={{ background: "rgba(242,140,56,0.25)" }}>
                <IconQr size={18} />
              </div>
              <div>
                <p className="text-[14px] font-bold text-white">Escanear cliente</p>
                <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.45)" }}>
                  Registra una visita de fidelidad
                </p>
              </div>
              <span className="ml-auto text-white/30">›</span>
            </Link>
            <Link href="/vendor/clientes"
              className="flex items-center gap-4 rounded-2xl px-5 py-4 transition hover:opacity-90 active:scale-[0.98]"
              style={{
                background: "#1C2526",
                boxShadow: "0 4px 16px rgba(28,37,38,0.18)",
              }}>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white"
                style={{ background: "rgba(255,255,255,0.1)" }}>
                <IconUsers />
              </div>
              <div>
                <p className="text-[14px] font-bold text-white">Ver clientes</p>
                <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.45)" }}>
                  Historial de fidelidad
                </p>
              </div>
              <span className="ml-auto text-white/30">›</span>
            </Link>
          </div>

          {/* ── 7-day chart ── */}
          <div className="mb-5 rounded-2xl p-5"
            style={{
              background: "#ffffff",
              border: "1px solid rgba(28,37,38,0.07)",
              boxShadow: "0 1px 4px rgba(28,37,38,0.05)",
            }}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-[14px] font-bold" style={{ color: "#1C2526" }}>
                  Scans — últimos 7 días
                </p>
                <p className="text-[11px]" style={{ color: "rgba(28,37,38,0.38)" }}>
                  {data.weekTotal} visitas esta semana
                </p>
              </div>
              <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
                style={{ background: "#F5F3EF", color: "rgba(28,37,38,0.45)" }}>
                7d
              </span>
            </div>
            <WeekChart days={data.weeklyScans} />
          </div>

          {/* ── Loyalty proof (30d lookback) ── */}
          <OwnerLookbackCard restaurantId={data.restaurantId} />

          {/* ── Weekly AI Brief ── */}
          <WeeklyGrowthBriefCard
            restaurantId={data.restaurantId}
            restaurantName={data.restaurantName}
          />

          {/* ── Ask the Brain ── */}
          <BrainQueryCard restaurantId={data.restaurantId} />

          {/* ── At-risk customers ── */}
          <AtRiskCustomersCard
            restaurantId={data.restaurantId}
            restaurantName={data.restaurantName}
          />

          {/* ── Recent activity ── */}
          <div className="mb-5 rounded-2xl p-5"
            style={{
              background: "#ffffff",
              border: "1px solid rgba(28,37,38,0.07)",
              boxShadow: "0 1px 4px rgba(28,37,38,0.05)",
            }}>
            <div className="mb-4 flex items-center justify-between">
              <p className="text-[14px] font-bold" style={{ color: "#1C2526" }}>
                Actividad reciente
              </p>
              <Link href="/vendor/clientes"
                className="text-[11px] font-semibold"
                style={{ color: "#d97757" }}>
                Ver todos →
              </Link>
            </div>
            {data.recentScans.length > 0 ? (
              <div className="grid grid-cols-1 gap-0.5 md:grid-cols-2">
                {data.recentScans.map((scan, i) => (
                  <div key={scan.id}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                    style={{ background: i === 0 ? "rgba(242,140,56,0.06)" : "transparent" }}>
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                      style={{ background: "rgba(242,140,56,0.12)", color: "#d97757" }}>
                      {(scan.customerName[0] ?? "C").toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold" style={{ color: "#1C2526" }}>
                        {scan.customerName}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold"
                      style={{ background: "rgba(242,140,56,0.1)", color: "#E07830" }}>
                      +{scan.pointsAwarded}pt
                    </span>
                    <span className="w-7 shrink-0 text-right text-[11px]"
                      style={{ color: "rgba(28,37,38,0.22)" }}>
                      {timeAgo(scan.timestamp)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center py-8 text-center">
                <span className="text-[28px]">👋</span>
                <p className="mt-2 text-[13px]" style={{ color: "rgba(28,37,38,0.35)" }}>
                  Sin visitas aún — escanea tu primer cliente.
                </p>
              </div>
            )}
          </div>

          {/* ── QR Card ── */}
          <QrCard restaurantId={data.restaurantId} restaurantName={data.restaurantName} />

          {/* ── Atajos — mobile only (sidebar handles desktop nav) ── */}
          <p className="mb-2.5 text-[10px] font-bold uppercase tracking-[0.1em] md:hidden"
            style={{ color: "rgba(28,37,38,0.35)" }}>
            Atajos
          </p>
          <div className="grid grid-cols-3 gap-3 md:hidden">
            <Atajo href="/vendor/scanner" emoji="📷" label="Escanear" />
            <Atajo href="/vendor/clientes" emoji="👥" label="Clientes" />
            <Atajo href="/vendor/brain" emoji="🧠" label="Brain" />
            <Atajo href="/vendor/reportes" emoji="📊" label="Reportes" />
            <Atajo href="/vendor/configuracion" emoji="⚙️" label="Config" />
            <Atajo
              href="https://apps.apple.com/mx/app/foodpass/id6745301069"
              emoji="📱"
              label="App"
              external
            />
          </div>
        </main>
      </div>

    </div>
  );
}

// ─── QR Card ──────────────────────────────────────────────────────────────────

function QrCard({ restaurantId, restaurantName }: { restaurantId: string; restaurantName: string }) {
  const [expanded, setExpanded] = useState(false);
  const qrUrl = `https://comeleal.com/menu/${restaurantId}`;
  const qrImgSrc = `https://chart.googleapis.com/chart?cht=qr&chs=400x400&chl=${encodeURIComponent(qrUrl)}&choe=UTF-8&chld=M|1`;

  function handlePrint() {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html><html><head>
        <title>QR — ${restaurantName}</title>
        <style>
          *{margin:0;padding:0;box-sizing:border-box}
          body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
            display:flex;flex-direction:column;align-items:center;justify-content:center;
            min-height:100vh;padding:40px;background:#fff}
          .logo{font-size:14px;font-weight:700;letter-spacing:.08em;color:#d97757;
            margin-bottom:28px;text-transform:uppercase}
          img{width:260px;height:260px}
          h1{margin-top:24px;font-size:22px;font-weight:800;color:#141413;text-align:center}
          p{margin-top:8px;font-size:13px;color:#141413;opacity:.5;text-align:center;
            max-width:220px;line-height:1.5}
          .cta{margin-top:20px;font-size:15px;font-weight:700;color:#d97757;text-align:center}
        </style>
      </head><body>
        <span class="logo">Comeleal</span>
        <img src="${qrImgSrc}" alt="QR" />
        <h1>${restaurantName}</h1>
        <p>Escanea para ganar puntos y recompensas</p>
        <p>Descarga la app Comeleal y únete al programa de lealtad</p>
        <script>window.onload=()=>{window.print()}<\/script>
      </body></html>
    `);
    win.document.close();
  }

  return (
    <div className="mb-5 rounded-2xl"
      style={{
        background: "#ffffff",
        border: "1px solid rgba(28,37,38,0.07)",
        boxShadow: "0 1px 4px rgba(28,37,38,0.05)",
      }}>
      {/* Header row — always visible */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-3 px-5 py-4 transition-colors hover:bg-[#faf9f5] rounded-2xl"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[17px]"
          style={{ background: "rgba(217,119,87,0.1)" }}>
          📲
        </div>
        <div className="flex-1 text-left">
          <p className="text-[13px] font-bold" style={{ color: "#1C2526" }}>Tu QR de menú</p>
          <p className="text-[11px]" style={{ color: "rgba(28,37,38,0.42)" }}>
            Los clientes lo escanean para ver tu menú y encontrarte en la app
          </p>
        </div>
        <span className="text-[13px] transition-transform duration-200"
          style={{
            color: "rgba(28,37,38,0.3)",
            display: "inline-block",
            transform: expanded ? "rotate(180deg)" : "none",
          }}>
          ▾
        </span>
      </button>

      {/* Expanded QR */}
      {expanded && (
        <div className="flex flex-col items-center gap-4 px-5 pb-5">
          <div className="mx-auto flex h-44 w-44 items-center justify-center rounded-xl bg-white p-2 shadow-sm ring-1 ring-[#141413]/8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrImgSrc} alt="QR de tu restaurante" className="h-full w-full" />
          </div>
          <p className="text-[10px] font-mono text-[#141413]/30 break-all text-center">
            comeleal.com/menu/{restaurantId}
          </p>
          <button
            onClick={handlePrint}
            className="flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition-all hover:bg-[#d97757]/10"
            style={{ borderColor: "rgba(217,119,87,0.3)", color: "#d97757", background: "rgba(217,119,87,0.05)" }}
          >
            🖨️ Imprimir QR
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Setup Banner ─────────────────────────────────────────────────────────────

const SETUP_STEPS = [
  { key: "hours" as const, label: "Horario", href: "/vendor/setup/horario", emoji: "🕐" },
  { key: "menu" as const, label: "Menú", href: "/vendor/setup/menu", emoji: "🍽️" },
  { key: "rewards" as const, label: "Recompensas", href: "/vendor/setup/recompensas", emoji: "🎁" },
] as const;

const REASON_TO_STEP: Record<string, typeof SETUP_STEPS[number]["key"]> = {
  business_hours: "hours",
  menu_items: "menu",
  reward_tiers: "rewards",
  first_purchase_reward: "rewards",
  // business info — required at signup so rarely hit, but mapped so the
  // banner never silently drops a pending reason
  name: "hours",
  address: "hours",
  phone: "hours",
  category: "hours",
};

function SetupBanner({ reasons }: { reasons: string[] }) {
  // completedStepCount counts 4 groups (business, hours, menu, rewards).
  // We only show 3 web steps (hours, menu, rewards — business is done at signup).
  // Cap at 3 to avoid "4 de 3 · 133% listo".
  const doneCount = Math.min(completedStepCount(reasons), 3);
  const total = 3;
  const pct = Math.round((doneCount / total) * 100);
  const pendingKeys = new Set(reasons.map((r) => REASON_TO_STEP[r]).filter(Boolean));

  return (
    <Link href="/vendor/setup"
      className="mb-5 flex flex-col rounded-2xl p-5 transition-all hover:shadow-md active:scale-[0.99]"
      style={{
        background: "linear-gradient(135deg, #fff8f5 0%, #ffffff 100%)",
        border: "1px solid rgba(217,119,87,0.22)",
        boxShadow: "0 2px 12px rgba(217,119,87,0.08)",
      }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl text-base"
            style={{ background: "rgba(217,119,87,0.12)" }}>
            🚀
          </div>
          <div>
            <p className="text-[13px] font-bold" style={{ color: "#1C2526" }}>
              Completa tu configuración
            </p>
            <p className="text-[11px]" style={{ color: "rgba(28,37,38,0.42)" }}>
              {doneCount} de {total} pasos · {pct}% listo
            </p>
          </div>
        </div>
        <span style={{ color: "#d97757", fontSize: 12, fontWeight: 600 }}>Ver →</span>
      </div>

      {/* Progress bar */}
      <div className="mb-3 h-1.5 w-full rounded-full overflow-hidden" style={{ background: "rgba(28,37,38,0.07)" }}>
        <div className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: "linear-gradient(90deg, #FF9A45, #d97757)" }} />
      </div>

      {/* Step chips */}
      <div className="flex gap-2 flex-wrap">
        {SETUP_STEPS.map((step) => {
          const pending = pendingKeys.has(step.key);
          return (
            <div key={step.key}
              className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
              style={pending
                ? { background: "rgba(217,119,87,0.1)", color: "#d97757" }
                : { background: "rgba(28,37,38,0.06)", color: "rgba(28,37,38,0.45)" }
              }>
              {pending ? step.emoji : "✓"} {step.label}
            </div>
          );
        })}
      </div>
    </Link>
  );
}

// ─── WeekChart ────────────────────────────────────────────────────────────────

function WeekChart({ days }: { days: WeekDay[] }) {
  const maxCount = Math.max(...days.map((d) => d.count), 1);
  const barH = 72;

  return (
    <div className="flex items-end justify-between gap-1.5" style={{ height: barH + 28 }}>
      {days.map((day, i) => {
        const barPx = Math.max(day.count > 0 ? Math.round((day.count / maxCount) * barH) : 4, day.count > 0 ? 12 : 4);
        return (
          <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
            {day.count > 0 && (
              <span className="text-[10px] font-bold tabular-nums"
                style={{ color: day.isToday ? "#d97757" : "rgba(28,37,38,0.4)" }}>
                {day.count}
              </span>
            )}
            {day.count === 0 && <span className="text-[10px]" style={{ color: "transparent" }}>0</span>}
            <div
              className="w-full rounded-lg transition-all"
              style={{
                height: barPx,
                background: day.isToday
                  ? "linear-gradient(180deg, #FF9A45 0%, #d97757 100%)"
                  : day.count > 0
                  ? "rgba(242,140,56,0.35)"
                  : "rgba(28,37,38,0.07)",
                marginTop: "auto",
              }}
            />
            <span className="text-[10px] font-medium"
              style={{ color: day.isToday ? "#d97757" : "rgba(28,37,38,0.4)" }}>
              {day.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Sidebar nav item ─────────────────────────────────────────────────────────

function NavItem({
  href, icon, label, active = false, open,
}: {
  href: string; icon: ReactNode; label: string; active?: boolean; open: boolean;
}) {
  return (
    <Link href={href}
      className="flex w-full items-center gap-3 rounded-xl px-2.5 py-[9px] text-[13px] font-medium transition-colors"
      title={!open ? label : undefined}
      style={active
        ? { background: "rgba(242,140,56,0.16)", color: "#d97757" }
        : { color: "rgba(255,255,255,0.52)" }
      }
    >
      <span className="shrink-0">{icon}</span>
      {open && <span className="whitespace-nowrap">{label}</span>}
    </Link>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label, value, icon, accent = false, danger = false,
}: {
  label: string; value: number; icon: ReactNode; accent?: boolean; danger?: boolean;
}) {
  const dangerActive = danger && value > 0;
  return (
    <div className="rounded-2xl p-4"
      style={{
        background: "#ffffff",
        border: `1px solid ${dangerActive ? "rgba(239,68,68,0.15)" : "rgba(28,37,38,0.07)"}`,
        boxShadow: "0 1px 4px rgba(28,37,38,0.04)",
      }}>
      <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-xl"
        style={{
          background: dangerActive ? "rgba(239,68,68,0.08)" : "rgba(242,140,56,0.09)",
          color: dangerActive ? "#EF4444" : "#d97757",
        }}>
        {icon}
      </div>
      <p className="font-mono text-[28px] font-bold leading-none tabular-nums md:text-[32px]"
        style={{ color: dangerActive ? "#EF4444" : "#1C2526" }}>
        {value}
      </p>
      <p className="mt-1.5 text-[11px]" style={{ color: "rgba(28,37,38,0.38)" }}>
        {label}
        {accent && value > 0 && (
          <span className="ml-1.5 inline-flex items-center gap-0.5 rounded-full align-middle px-1.5 py-0.5 text-[9px] font-bold text-green-700"
            style={{ background: "#D1FAE5" }}>
            <span className="inline-block h-1 w-1 rounded-full bg-green-500" />
            hoy
          </span>
        )}
      </p>
    </div>
  );
}

// ─── Atajo shortcut ───────────────────────────────────────────────────────────

function Atajo({
  href, emoji, label, external = false,
}: {
  href: string; emoji: string; label: string; external?: boolean;
}) {
  const inner = (
    <div className="flex flex-col items-center gap-2 rounded-2xl px-2 py-4 transition hover:bg-[#EDEBE7] active:scale-[0.96]"
      style={{
        background: "#ffffff",
        border: "1px solid rgba(28,37,38,0.07)",
        boxShadow: "0 1px 4px rgba(28,37,38,0.04)",
      }}>
      <span className="text-[22px]">{emoji}</span>
      <span className="text-[11px] font-semibold" style={{ color: "#1C2526" }}>
        {label}
      </span>
    </div>
  );

  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer">
        {inner}
      </a>
    );
  }
  return <Link href={href}>{inner}</Link>;
}

// ─── NextBestActionCard ───────────────────────────────────────────────────────

function getNbaFallbackBody(actionCode: string): string {
  switch (actionCode) {
    case "complete_profile": return "Completa tu perfil para que tus clientes puedan encontrarte y confiar más rápido en tu negocio.";
    case "add_menu_items": return "Agrega productos a tu menú para que tus clientes vean mejor lo que vendes.";
    case "configure_rewards": return "Crea tu primera recompensa para empezar a motivar visitas recurrentes.";
    case "get_first_scan": return "Comparte tu QR con tus clientes para conseguir tus primeros escaneos.";
    case "review_rewards": return "Revisa tu recompensa. Puede ser una oportunidad para hacerla más atractiva y lograr más redenciones.";
    case "lower_reward_threshold": return "Tu recompensa requiere demasiadas visitas. La mayoría de tus clientes se van antes de ganarla — bajar el umbral puede duplicar tus canjes.";
    case "send_winback": return "Tienes clientes que no han regresado en más de 14 días. Un mensaje personalizado puede traerlos de vuelta.";
    case "healthy":
    case "keep_going": return "Tu negocio va avanzando. Sigue compartiendo tu QR y mantén tus recompensas claras.";
    default: return "Estamos preparando tus recomendaciones. Cuando tengas más actividad, Comeleal te mostrará el siguiente mejor paso.";
  }
}

function getNbaCtaLabel(actionCode: string, atRiskCount: number): string {
  switch (actionCode) {
    case "send_winback": return atRiskCount > 0 ? `Ver ${atRiskCount} clientes ahora` : "Ver clientes en riesgo";
    case "complete_profile": return "Completar perfil";
    case "add_menu_items": return "Agregar productos";
    case "lower_reward_threshold":
    case "configure_rewards":
    case "review_rewards": return "Configurar recompensas";
    case "get_first_scan":
    case "healthy":
    case "keep_going": return "Ver mi código QR";
    default: return "Ver recompensas";
  }
}

function getNbaCtaHref(actionCode: string): string {
  switch (actionCode) {
    case "complete_profile": return "/vendor/configuracion";
    case "add_menu_items": return "/vendor/menu";
    case "lower_reward_threshold":
    case "configure_rewards":
    case "review_rewards": return "/vendor/recompensas";
    case "get_first_scan":
    case "healthy":
    case "keep_going": return "/vendor/scanner";
    case "send_winback": return "#at-risk";
    default: return "/vendor/recompensas";
  }
}

function NextBestActionCard({
  actionCode, title, body, metrics,
}: {
  actionCode: string;
  title: string;
  body: string;
  metrics: NbaMetrics;
}) {
  const displayTitle = title || "Siguiente mejor acción";
  const displayBody = body || getNbaFallbackBody(actionCode);
  const ctaLabel = getNbaCtaLabel(actionCode, metrics.atRiskCount);
  const ctaHref = getNbaCtaHref(actionCode);

  const parts: string[] = [];
  if (metrics.scans30d > 0) parts.push(`${metrics.scans30d} escaneos`);
  if (metrics.redemptions30d > 0) parts.push(`${metrics.redemptions30d} redenciones`);
  if (metrics.uniqueCustomers30d > 0) parts.push(`${metrics.uniqueCustomers30d} clientes`);
  const metricsLine = parts.length > 0 ? `Actividad: ${parts.join(" · ")} (últimos 30d)` : null;

  return (
    <div className="mb-5 overflow-hidden rounded-2xl"
      style={{
        background: "#ffffff",
        border: "1px solid rgba(217,119,87,0.18)",
        boxShadow: "0 1px 4px rgba(28,37,38,0.05)",
        borderLeft: "4px solid #d97757",
      }}>
      <div className="p-5">
        {/* Header */}
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <p className="text-[14px] font-bold" style={{ color: "#d97757" }}>{displayTitle}</p>
            <p className="text-[11px] font-medium" style={{ color: "rgba(28,37,38,0.45)" }}>
              Comeleal te recomienda esta acción
            </p>
          </div>
          <span className="text-[18px] shrink-0">✨</span>
        </div>

        {/* Body */}
        <p className="text-[13px] leading-relaxed mb-3" style={{ color: "rgba(28,37,38,0.8)" }}>
          {displayBody}
        </p>

        {/* Metrics */}
        {metricsLine && (
          <div className="mb-3 flex items-center gap-1.5">
            <span className="text-[11px]">📊</span>
            <p className="text-[11px]" style={{ color: "rgba(28,37,38,0.5)" }}>{metricsLine}</p>
          </div>
        )}

        {/* Win-back urgency banner */}
        {actionCode === "send_winback" && metrics.atRiskCount > 0 && (
          <div className="mb-3 flex items-center gap-2 rounded-xl px-3 py-2"
            style={{ background: "#FFF3E0", border: "1px solid #FFB300" }}>
            <span className="text-[13px]">⚠️</span>
            <p className="text-[12px] font-semibold" style={{ color: "#E65100" }}>
              {metrics.atRiskCount} {metrics.atRiskCount === 1 ? "cliente está" : "clientes están"} a punto de no regresar
            </p>
          </div>
        )}

        {/* CTA */}
        <a href={ctaHref}
          className="inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-[12px] font-semibold transition hover:opacity-80"
          style={{ borderColor: "rgba(217,119,87,0.4)", color: "#d97757" }}>
          {ctaLabel} <span>→</span>
        </a>
      </div>
    </div>
  );
}

// ─── OwnerLookbackCard ────────────────────────────────────────────────────────

function OwnerLookbackCard({ restaurantId }: { restaurantId: string }) {
  type LookbackStats = {
    comelealCustomers: number;
    returnedCustomers: number;
    returnRatePercent: number;
    redemptionsCount: number;
  };
  const [stats, setStats] = useState<LookbackStats | null>(null);

  useEffect(() => {
    if (!restaurantId) return;
    async function load() {
      const db = getFirebaseDb();
      const cutoff = Timestamp.fromDate(
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      );
      const [visitSnap, redemptionSnap] = await Promise.all([
        getDocs(query(
          collection(db, "restaurants", restaurantId, "visitHistory"),
          where("timestamp", ">=", cutoff)
        )),
        getDocs(query(
          collection(db, "restaurants", restaurantId, "redemptions"),
          where("timestamp", ">=", cutoff)
        )),
      ]);
      const visitCounts: Record<string, number> = {};
      visitSnap.forEach((d) => {
        const uid = d.data().userId as string | undefined;
        if (uid) visitCounts[uid] = (visitCounts[uid] ?? 0) + 1;
      });
      const comelealCustomers = Object.keys(visitCounts).length;
      const returnedCustomers = Object.values(visitCounts).filter((c) => c >= 2).length;
      setStats({
        comelealCustomers,
        returnedCustomers,
        returnRatePercent: comelealCustomers > 0 ? (returnedCustomers / comelealCustomers) * 100 : 0,
        redemptionsCount: redemptionSnap.size,
      });
    }
    load().catch(console.error);
  }, [restaurantId]);

  return (
    <div className="mb-5 rounded-2xl p-5"
      style={{
        background: "#ffffff",
        border: "1px solid rgba(28,37,38,0.07)",
        boxShadow: "0 1px 4px rgba(28,37,38,0.05)",
      }}>
      <p className="mb-4 text-[13px] font-semibold" style={{ color: "rgba(28,37,38,0.85)" }}>
        Lealtad — últimos 30 días
      </p>
      {!stats ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-3 rounded" style={{ background: "rgba(28,37,38,0.07)", width: "60%" }} />
              <div className="h-5 rounded" style={{ background: "rgba(28,37,38,0.07)", width: "40%" }} />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            { label: "Clientes con Comeleal", value: stats.comelealCustomers },
            { label: "Regresaron", value: stats.returnedCustomers },
            { label: "Tasa de retorno", value: `${stats.returnRatePercent.toFixed(0)}%` },
            { label: "Canjes", value: stats.redemptionsCount },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-[11px]" style={{ color: "rgba(28,37,38,0.52)" }}>{label}</p>
              <p className="mt-1 text-[18px] font-bold tabular-nums" style={{ color: "#1C2526" }}>{value}</p>
            </div>
          ))}
        </div>
      )}
      <div className="mt-4 flex gap-3">
        <Link href="/vendor/recompensas"
          className="flex-1 rounded-xl border py-2.5 text-center text-[12px] font-semibold transition hover:opacity-80"
          style={{ borderColor: "rgba(217,119,87,0.35)", color: "#d97757" }}>
          Ver programa
        </Link>
        <Link href="/vendor/scanner"
          className="flex-1 rounded-xl py-2.5 text-center text-[12px] font-semibold text-white transition hover:opacity-90"
          style={{ background: "#d97757" }}>
          Escanear
        </Link>
      </div>
    </div>
  );
}

// ─── WeeklyGrowthBriefCard ────────────────────────────────────────────────────

// Module-level cache: restaurantId → { title, text, actionCode, fetchedAt }
const _briefCache = new Map<string, { title: string; text: string; actionCode: string; fetchedAt: number }>();

function WeeklyGrowthBriefCard({
  restaurantId, restaurantName,
}: { restaurantId: string; restaurantName: string }) {
  const [brief, setBrief] = useState<{ title: string; text: string; actionCode: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  async function load(forceRefresh = false) {
    setLoading(true); setError(false);
    const cached = _briefCache.get(restaurantId);
    if (!forceRefresh && cached && Date.now() - cached.fetchedAt < 24 * 3600 * 1000) {
      setBrief(cached); setLoading(false); return;
    }
    try {
      // Load 30d stats from Firestore
      const db = getFirebaseDb();
      const cutoff = Timestamp.fromDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
      const [visitSnap, redemptionSnap] = await Promise.all([
        getDocs(query(
          collection(db, "restaurants", restaurantId, "visitHistory"),
          where("timestamp", ">=", cutoff)
        )),
        getDocs(query(
          collection(db, "restaurants", restaurantId, "redemptions"),
          where("timestamp", ">=", cutoff)
        )),
      ]);
      const userCounts: Record<string, number> = {};
      visitSnap.forEach((d) => {
        const uid = d.data().userId as string | undefined;
        if (uid) userCounts[uid] = (userCounts[uid] ?? 0) + 1;
      });
      const uniqueCustomers = Object.keys(userCounts).length;
      const returned = Object.values(userCounts).filter((c) => c >= 2).length;

      // Call CF
      const fn = httpsCallable<Record<string, unknown>, Record<string, string>>(
        getFirebaseFunctions(), "generateWeeklyGrowthBrief"
      );
      const result = await fn({
        restaurantId,
        restaurantName: restaurantName || "mi restaurante",
        scans30d: visitSnap.size,
        redemptions30d: redemptionSnap.size,
        uniqueCustomers30d: uniqueCustomers,
        returnRatePercent: uniqueCustomers > 0 ? Math.round((returned / uniqueCustomers) * 100) : 0,
      });
      const title = (result.data.briefTitle ?? "").trim() || "¡Tu negocio sigue creciendo!";
      const text = (result.data.growthBriefText_es ?? "").trim();
      const actionCode = (result.data.suggestedActionCode ?? "keep_going").trim();
      if (!text) throw new Error("empty");
      const entry = { title, text, actionCode, fetchedAt: Date.now() };
      _briefCache.set(restaurantId, entry);
      setBrief(entry);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (restaurantId) load(); }, [restaurantId]); // eslint-disable-line react-hooks/exhaustive-deps

  const ctaRoutes: Record<string, string> = {
    get_first_scan: "/vendor/scanner",
    share_with_customers: "/vendor/scanner",
    review_rewards: "/vendor/recompensas",
  };

  return (
    <div className="mb-5 rounded-2xl"
      style={{
        background: "#ffffff",
        border: "1px solid rgba(217,119,87,0.18)",
        boxShadow: "0 1px 4px rgba(28,37,38,0.05)",
      }}>
      <div className="p-5">
        {/* Header */}
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-1.5 rounded-lg px-2.5 py-1"
            style={{ background: "rgba(217,119,87,0.1)" }}>
            <span className="text-[11px]">✨</span>
            <span className="text-[11px] font-bold" style={{ color: "#d97757" }}>Resumen semanal</span>
          </div>
          <button onClick={() => load(true)}
            className="rounded-lg p-1.5 transition hover:bg-[#F5F3EF]"
            title="Actualizar">
            <span className="text-[14px]" style={{ color: "rgba(28,37,38,0.35)" }}>↻</span>
          </button>
        </div>

        {loading ? (
          <div className="space-y-2.5">
            <div className="h-4 w-3/4 rounded" style={{ background: "rgba(28,37,38,0.07)" }} />
            <div className="h-3 w-full rounded" style={{ background: "rgba(28,37,38,0.07)" }} />
            <div className="h-3 w-5/6 rounded" style={{ background: "rgba(28,37,38,0.07)" }} />
          </div>
        ) : error ? (
          <div className="flex items-center gap-2">
            <p className="flex-1 text-[12px]" style={{ color: "rgba(28,37,38,0.5)" }}>
              No se pudo generar el resumen.
            </p>
            <button onClick={() => load(true)}
              className="text-[12px] font-semibold" style={{ color: "#d97757" }}>
              Reintentar
            </button>
          </div>
        ) : brief ? (
          <>
            <p className="mb-2 text-[14px] font-bold" style={{ color: "#1C2526" }}>{brief.title}</p>
            <p className="text-[13px] leading-relaxed" style={{ color: "rgba(28,37,38,0.7)" }}>{brief.text}</p>
            {ctaRoutes[brief.actionCode] && (
              <Link href={ctaRoutes[brief.actionCode]}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold transition hover:opacity-80"
                style={{ background: "rgba(217,119,87,0.09)", border: "1px solid rgba(217,119,87,0.22)", color: "#d97757" }}>
                {brief.actionCode === "review_rewards" ? "Ver recompensas" : "Compartir QR"} →
              </Link>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}

// ─── BrainQueryCard ───────────────────────────────────────────────────────────

const SUGGESTED_QUESTIONS = [
  "¿Qué debo hacer esta semana?",
  "¿Por qué bajaron mis visitas?",
  "¿Mi recompensa está funcionando?",
  "¿Cuáles son mis mejores clientes?",
];

function BrainQueryCard({ restaurantId }: { restaurantId: string }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [lastQ, setLastQ] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ask(q: string) {
    const trimmed = q.trim();
    if (!trimmed || !restaurantId || loading) return;
    setLoading(true); setAnswer(null); setError(null); setLastQ(trimmed);
    try {
      const fn = httpsCallable<Record<string, unknown>, Record<string, string>>(
        getFirebaseFunctions(), "queryRestaurantBrain"
      );
      const result = await fn({ restaurantId, question: trimmed });
      setAnswer((result.data.answer ?? "Sin respuesta.").trim());
    } catch {
      setError("No se pudo conectar con el cerebro. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mb-5 overflow-hidden rounded-2xl"
      style={{
        background: "#ffffff",
        border: "1px solid rgba(217,119,87,0.18)",
        boxShadow: "0 1px 4px rgba(28,37,38,0.05)",
        borderLeft: "4px solid #d97757",
      }}>
      <div className="p-5">
        {/* Header */}
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <p className="text-[14px] font-bold" style={{ color: "#1C2526" }}>Pregúntale al cerebro</p>
            <p className="text-[11px]" style={{ color: "rgba(28,37,38,0.45)" }}>
              Responde con datos reales de tu negocio
            </p>
          </div>
          <span className="text-[18px]">🧠</span>
        </div>

        {/* Suggested questions */}
        <div className="mb-3 flex flex-wrap gap-2">
          {SUGGESTED_QUESTIONS.map((q) => (
            <button key={q} disabled={loading}
              onClick={() => { setQuestion(q); ask(q); }}
              className="rounded-full border px-3 py-1.5 text-[11px] font-medium transition hover:opacity-80"
              style={{ borderColor: "rgba(217,119,87,0.28)", color: "#d97757", background: "rgba(217,119,87,0.06)" }}>
              {q}
            </button>
          ))}
        </div>

        {/* Text input */}
        <div className="flex gap-2">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") ask(question); }}
            disabled={loading}
            placeholder="Escribe tu pregunta…"
            className="flex-1 rounded-full border px-4 py-2 text-[13px] outline-none focus:ring-2"
            style={{
              borderColor: "rgba(217,119,87,0.28)",
              color: "#1C2526",
              background: "#fff",
            }}
          />
          <button
            onClick={() => ask(question)}
            disabled={loading}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white transition"
            style={{ background: loading ? "rgba(217,119,87,0.4)" : "#d97757" }}>
            {loading ? <Spinner /> : <span className="text-[14px]">→</span>}
          </button>
        </div>

        {/* Answer */}
        {(answer !== null || error !== null) && (
          <div className="mt-3 rounded-xl p-4"
            style={{
              background: error ? "rgba(239,68,68,0.05)" : "rgba(217,119,87,0.05)",
              border: `1px solid ${error ? "rgba(239,68,68,0.2)" : "rgba(217,119,87,0.15)"}`,
            }}>
            {lastQ && (
              <p className="mb-1.5 text-[11px] italic" style={{ color: "rgba(28,37,38,0.45)" }}>
                {lastQ}
              </p>
            )}
            <p className="text-[13px] leading-relaxed"
              style={{ color: error ? "#DC2626" : "rgba(28,37,38,0.85)" }}>
              {error ?? answer}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── AtRiskCustomersCard ──────────────────────────────────────────────────────

interface AtRiskCustomer {
  userId: string;
  displayName: string;
  firstName: string;
  phone: string | null;
  daysSinceVisit: number;
  visitCount: number;
  pointsAvailable: number;
  isDormant: boolean;
}

function AtRiskCustomersCard({
  restaurantId, restaurantName,
}: { restaurantId: string; restaurantName: string }) {
  const [customers, setCustomers] = useState<AtRiskCustomer[] | null>(null);
  const [loadingWa, setLoadingWa] = useState<string | null>(null);

  useEffect(() => {
    if (!restaurantId) return;
    async function load() {
      const db = getFirebaseDb();
      const cutoff = Timestamp.fromDate(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000));
      let visitSnap;
      try {
        visitSnap = await getDocs(query(
          collection(db, "restaurants", restaurantId, "visitHistory"),
          where("timestamp", ">=", cutoff),
          orderBy("timestamp", "desc"),
          limit(300)
        ));
      } catch { return; }
      if (visitSnap.empty) { setCustomers([]); return; }

      // Group by userId → most recent + count
      const lastVisit: Record<string, Date> = {};
      const visitCount: Record<string, number> = {};
      const now = new Date();
      visitSnap.forEach((d) => {
        const uid = d.data().userId as string | undefined;
        const ts = d.data().timestamp;
        if (!uid || !(ts instanceof Timestamp)) return;
        const dt = ts.toDate();
        if (!lastVisit[uid] || dt > lastVisit[uid]) lastVisit[uid] = dt;
        visitCount[uid] = (visitCount[uid] ?? 0) + 1;
      });

      // Filter >= 14 days
      const atRisk = Object.entries(lastVisit)
        .map(([uid, dt]) => ({ uid, days: Math.floor((now.getTime() - dt.getTime()) / 86400000) }))
        .filter((e) => e.days >= 14)
        .sort((a, b) => b.days - a.days)
        .slice(0, 20);

      if (atRisk.length === 0) { setCustomers([]); return; }

      // Fetch user profiles in parallel
      const results = await Promise.all(
        atRisk.map(async ({ uid, days }) => {
          try {
            const { getDoc, doc: fsDoc } = await import("firebase/firestore");
            const [userSnap, loyaltySnap] = await Promise.all([
              getDoc(fsDoc(db, "users", uid)),
              getDoc(fsDoc(db, "users", uid, "loyaltyByRestaurant", restaurantId)).catch(() => null),
            ]);
            const ud = userSnap?.data() ?? {};
            const name = ((ud.displayName ?? ud.name ?? "") as string).trim();
            if (!name) return null;
            const rawPhone = ((ud.phone ?? ud.phoneNumber ?? "") as string).trim();
            const points = (loyaltySnap?.data()?.pointsAvailable as number) ?? 0;
            const firstName = name.split(/\s+/)[0] ?? name;
            return {
              userId: uid,
              displayName: name,
              firstName,
              phone: rawPhone || null,
              daysSinceVisit: days,
              visitCount: visitCount[uid] ?? 1,
              pointsAvailable: points,
              isDormant: days >= 30,
            } as AtRiskCustomer;
          } catch { return null; }
        })
      );
      setCustomers(results.filter((c): c is AtRiskCustomer => c !== null));
    }
    load().catch(console.error);
  }, [restaurantId]);

  async function sendWhatsApp(c: AtRiskCustomer) {
    const raw = c.phone!.replace(/[\s\-()]/g, "");
    const phone = raw.startsWith("+") ? raw : `+52${raw}`;
    setLoadingWa(c.userId);
    let text: string;
    try {
      const fn = httpsCallable<Record<string, unknown>, Record<string, string>>(
        getFirebaseFunctions(), "generateWinBackMessage"
      );
      const result = await fn({
        restaurantId,
        userId: c.userId,
        restaurantName: restaurantName || "nuestro lugar",
        daysSinceVisit: c.daysSinceVisit,
      });
      text = (result.data.message ?? "").trim();
      if (!text) throw new Error("empty");
    } catch {
      const name = restaurantName || "nuestro lugar";
      text = c.pointsAvailable > 0
        ? `¡Hola ${c.firstName}! 👋 Te extrañamos en ${name}. Todavía tienes ${c.pointsAvailable} puntos esperándote 🎁`
        : `¡Hola ${c.firstName}! 👋 Hace ${c.daysSinceVisit} días que no te vemos en ${name}. Esta semana tenemos algo especial para ti 🎁`;
    } finally {
      setLoadingWa(null);
    }
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, "_blank");
  }

  const displayed = customers?.slice(0, 5) ?? [];
  const extraCount = (customers?.length ?? 0) - 5;

  return (
    <div id="at-risk" className="mb-5 rounded-2xl p-5"
      style={{
        background: "#ffffff",
        border: "1px solid rgba(28,37,38,0.07)",
        boxShadow: "0 1px 4px rgba(28,37,38,0.05)",
      }}>
      <div className="mb-1 flex items-center justify-between">
        <p className="text-[13px] font-semibold" style={{ color: "rgba(28,37,38,0.85)" }}>
          Clientes que podrías perder
        </p>
        {customers !== null && customers.length > 0 && (
          <span className="rounded-full px-2.5 py-0.5 text-[11px] font-bold"
            style={{ background: "rgba(217,119,87,0.12)", color: "#d97757" }}>
            {customers.length}
          </span>
        )}
      </div>
      <p className="mb-4 text-[12px]" style={{ color: "rgba(28,37,38,0.45)" }}>
        Sin visita reciente — un mensaje puede traerlos de vuelta.
      </p>

      {customers === null ? (
        <div className="flex items-center justify-center py-6">
          <Spinner />
        </div>
      ) : customers.length === 0 ? (
        <div className="flex items-center gap-2">
          <span className="text-[16px]">✅</span>
          <p className="text-[12px]" style={{ color: "rgba(28,37,38,0.55)" }}>
            ¡Todos tus clientes han visitado recientemente!
          </p>
        </div>
      ) : (
        <>
          {displayed.map((c) => {
            const riskColor = c.isDormant ? "#EF4444" : "#F57C00";
            const isLoadingThis = loadingWa === c.userId;
            return (
              <div key={c.userId} className="mb-3 flex items-center gap-2.5">
                {/* Risk dot */}
                <div className="h-2 w-2 shrink-0 rounded-full" style={{ background: riskColor }} />
                {/* Avatar */}
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] font-bold"
                  style={{ background: "rgba(28,37,38,0.07)", color: "rgba(28,37,38,0.65)" }}>
                  {(c.firstName[0] ?? "?").toUpperCase()}
                </div>
                {/* Name + stats */}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold" style={{ color: "#1C2526" }}>
                    {c.displayName}
                  </p>
                  <p className="text-[11px]" style={{ color: "rgba(28,37,38,0.45)" }}>
                    {c.daysSinceVisit}d sin visita · {c.visitCount} visita{c.visitCount !== 1 ? "s" : ""}
                    {c.pointsAvailable > 0 ? ` · ${c.pointsAvailable} pts` : ""}
                  </p>
                </div>
                {/* WA button */}
                {c.phone ? (
                  <button
                    onClick={() => !isLoadingThis && sendWhatsApp(c)}
                    disabled={!!loadingWa}
                    className="flex shrink-0 items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold transition hover:opacity-80"
                    style={{
                      borderColor: "rgba(37,211,102,0.35)",
                      color: "#25D366",
                      background: isLoadingThis ? "rgba(37,211,102,0.04)" : "rgba(37,211,102,0.08)",
                    }}>
                    {isLoadingThis ? <Spinner /> : <>💬 WA</>}
                  </button>
                ) : (
                  <span className="rounded-lg px-2.5 py-1.5 text-[11px]"
                    style={{ background: "rgba(28,37,38,0.05)", color: "rgba(28,37,38,0.3)" }}>
                    Sin tel.
                  </span>
                )}
              </div>
            );
          })}
          {extraCount > 0 && (
            <p className="mt-1 text-[11px]" style={{ color: "rgba(28,37,38,0.38)" }}>
              y {extraCount} más sin visita reciente
            </p>
          )}
        </>
      )}
    </div>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg className="h-5 w-5 animate-spin" style={{ color: "#d97757" }} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 12 5.373 12 12H4z" />
    </svg>
  );
}

function IconQr({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M3 11V3h8v8H3zm2-6v4h4V5H5zm8-2h8v8h-8V3zm2 2v4h4V5h-4zM3 13h8v8H3v-8zm2 2v4h4v-4H5zm10 0h2v2h-2v-2zm2 2h2v2h-2v-2zm-2 2h2v2h-2v-2zm-2-4h2v2h-2v-2zm0 4h2v2h-2v-2zm4-2h2v2h-2v-2zm2-2h2v2h-2v-2z" />
    </svg>
  );
}

function IconHome() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>;
}
function IconUsers() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>;
}
function IconBrain() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z" /><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z" /></svg>;
}
function IconBarChart() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>;
}
function IconGear() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>;
}
function IconHelp() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>;
}
function IconChevronLeft() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>;
}
function IconScan() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2" /><path d="M17 3h2a2 2 0 0 1 2 2v2" /><path d="M21 17v2a2 2 0 0 1-2 2h-2" /><path d="M7 21H5a2 2 0 0 1-2-2v-2" /><line x1="7" y1="12" x2="17" y2="12" /></svg>;
}
function IconWaveform() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>;
}
function IconTrendUp() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg>;
}
function IconAlert() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>;
}
function IconLogOut() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>;
}
