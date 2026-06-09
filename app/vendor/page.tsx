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
import { getFirebaseDb } from "@/lib/firebase";
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

interface DashboardData {
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

        setData({
          restaurantName: (r.name as string) ?? "Mi restaurante",
          scanCountTotal: (r.scanCount as number) ?? 0,
          scansToday,
          pointsToday,
          weeklyScans,
          weekTotal,
          weeklyBriefText: ins.weeklyBriefText as string | undefined,
          atRiskCount: ins.atRiskCount as number | undefined,
          restaurantStatus: (r.status as string) ?? "active",
          recentScans,
          isSetupComplete: (r.isSetupComplete as boolean) ?? true,
          setupIncompleteReasons: (r.setupIncompleteReasons as string[]) ?? [],
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

          {/* ── 7-day chart + Brain ── */}
          <div className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-[1fr_380px]">

            {/* 7-day chart */}
            <div className="rounded-2xl p-5"
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

            {/* Brain AI */}
            <div className="rounded-2xl p-5"
              style={{
                background: "#ffffff",
                border: "1px solid rgba(242,140,56,0.16)",
                boxShadow: "0 1px 4px rgba(28,37,38,0.05)",
              }}>
              <div className="mb-4 flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl text-[15px]"
                  style={{ background: "rgba(242,140,56,0.1)" }}>
                  🧠
                </div>
                <div>
                  <p className="text-[14px] font-bold" style={{ color: "#1C2526" }}>
                    Comeleal Brain
                  </p>
                  <p className="text-[10px]" style={{ color: "rgba(28,37,38,0.38)" }}>
                    Resumen semanal con IA
                  </p>
                </div>
              </div>
              {data.weeklyBriefText ? (
                <p className="text-[13px] leading-relaxed" style={{ color: "rgba(28,37,38,0.65)" }}>
                  {data.weeklyBriefText}
                </p>
              ) : (
                <div className="rounded-xl p-4"
                  style={{ background: "rgba(242,140,56,0.05)", border: "1px dashed rgba(242,140,56,0.22)" }}>
                  <p className="text-[12px] font-medium" style={{ color: "rgba(28,37,38,0.5)" }}>
                    Se activa con más visitas
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed" style={{ color: "rgba(28,37,38,0.35)" }}>
                    Escanea clientes y el Brain generará patrones de retención, días pico y recomendaciones automáticamente.
                  </p>
                </div>
              )}
            </div>
          </div>

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
