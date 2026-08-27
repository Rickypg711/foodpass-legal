"use client";

import React, { useEffect, useState } from "react";
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
import { fetchWithBilling } from "@/lib/subscription/billingDoc";
import { expectedDayProgressPercent } from "@/lib/schedule";
import { entitlementOf } from "@/lib/subscription/entitlement";
import { waitForAuthReady } from "@/lib/auth";
import { resolveVendorContext, vendorHomeForRole } from "@/lib/vendorContext";
import type { User } from "firebase/auth";
import { completedStepCount } from "@/lib/vendorReadiness";
import ManualCloseToggle from "./_components/ManualCloseToggle";
import MenuShareModal from "./_components/MenuShareModal";

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
  atRiskReachableCount: number | null;
  atRiskTotalCount: number | null;
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
  ventasHoy: number;
  pedidosCola: number;
  /** Robo inverso de la app (27-ago): pulso de la última hora, del MISMO
   *  snapshot de hoy — cero queries extra. */
  pulseLastHourCount: number;
  /** Robo de la app (27-ago): veredicto HONESTO de la meta medido contra el
   *  horario real del negocio (Adelantado/En camino/Atrasado; Muy cerca ≥80%,
   *  Logrado ≥100%). null = sin meta, o cerrado hoy — no se muestra. */
  metaPaceLabel: string | null;
  pulseLastHourRevenue: number;
  pulsePrevHourCount: number;
  dailyRevenueGoal: number | null;
  cuentasAbiertas: number;
  // Win-back proof — combined: automatic (reEngagementStats, Cloud Functions)
  // + manual taps (phoneCustomers.lastWinbackAt vs lastVisitAt, closed loop)
  winbackSent: number;
  winbackReturned: number;
  manualWinbackSent: number;
  manualWinbackReturned: number;
  expiryRemindersSent: number;
  // Phone customers whose welcome reward expires in ≤2 days (day 5-7 of 7)
  expiringRewards: { name: string; phone: string; daysLeft: number }[];
  /** Estimated MXN recovered = returned × 30d avg paid ticket. Null when no ticket data. */
  winbackPesos: number | null;
  /** % of 30d paid orders with a customer phone — phone-points fuel gauge. Null < 3 paid orders. */
  captureRate: number | null;
  // Top 3 products by quantity sold (30d, excludes synthetic quick-sell line).
  topProducts: { name: string; qty: number }[];
  // Free-tier loyalty quota (docs/PRICING.md "cap honesto")
  isPro: boolean;
  loyaltyUsed: number;
  loyaltyLimit: number;
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

  useEffect(() => {
    async function init() {
      const u = await waitForAuthReady();
      if (!u || u.isAnonymous) { router.push("/activar"); return; }
      setUser(u);

      try {
        const db = getFirebaseDb();
        // Staff-aware: panel es de dueño/manager; empleado aterriza en la caja.
        const ctx = await resolveVendorContext(db, u.uid);
        if (!ctx) { router.push("/activar"); return; }
        if (ctx.role === "employee") { router.push(vendorHomeForRole(ctx.role)); return; }

        const rid = ctx.restaurantId;

        const todayStart = (() => {
          const d = new Date(); d.setHours(0, 0, 0, 0);
          return Timestamp.fromDate(d);
        })();

        const sevenDaysAgo = (() => {
          const d = new Date(); d.setDate(d.getDate() - 6); d.setHours(0, 0, 0, 0);
          return Timestamp.fromDate(d);
        })();

        const thirtyDaysAgo = (() => {
          const d = new Date(); d.setDate(d.getDate() - 30); d.setHours(0, 0, 0, 0);
          return Timestamp.fromDate(d);
        })();

        const [restaurantSnap, insightsSnap, visitsSnap, weekSnap, recentSnap, todayOrdersSnap, winbackSnap, monthOrdersSnap, welcomeSnap, winbackTapsSnap] =
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
            getDocs(query(
              collection(db, "restaurants", rid, "orders"),
              where("createdAt", ">=", todayStart)
            )),
            // Win-back counters. Wrapped in catch: if Firestore rules for
            // reEngagementStats aren't deployed yet, the dashboard still loads.
            getDoc(doc(db, "restaurants", rid, "reEngagementStats", "current")).catch(() => null),
            // 30d orders → avg paid ticket for the "pesos recuperados" estimate.
            getDocs(query(
              collection(db, "restaurants", rid, "orders"),
              where("createdAt", ">=", thirtyDaysAgo)
            )).catch(() => null),
            // Welcome rewards still unclaimed → the day-5 "remind them" nudge.
            getDocs(query(
              collection(db, "restaurants", rid, "phoneCustomers"),
              where("firstVisitRewardUnlocked", "==", true),
              limit(25)
            )).catch(() => null),
            // Manual win-back taps (30d): lastWinbackAt is written when the
            // owner taps "Abrir WhatsApp" in Clientes. Returned = the customer
            // visited again AFTER the tap (lastVisitAt > lastWinbackAt). This
            // closes the measure loop for the owner's-own-number channel.
            getDocs(query(
              collection(db, "restaurants", rid, "phoneCustomers"),
              where("lastWinbackAt", ">=", thirtyDaysAgo)
            )).catch(() => null),
          ]);

        const r = restaurantSnap.data() ?? {};
        const ins = insightsSnap.exists() ? insightsSnap.data() : {};

        // Today's counts
        let scansToday = 0, pointsToday = 0;
        visitsSnap.forEach((d) => {
          scansToday++;
          pointsToday += (d.data().pointsAwarded as number) ?? 0;
        });

        // Calculate operational stats
        let ventasHoy = 0;
        let pedidosCola = 0;
        let cuentasAbiertas = 0;
        // Pulso (joya robada de la app): pedidos PAGADOS de la última hora y
        // la anterior — ritmo del changarro en vivo.
        let pulseLastHourCount = 0;
        let pulseLastHourRevenue = 0;
        let pulsePrevHourCount = 0;
        const ahora = Date.now();
        const unaHora = 60 * 60 * 1000;

        todayOrdersSnap.forEach((doc) => {
          const o = doc.data();
          const total = (o.total as number) ?? 0;
          const status = o.status as string;
          const isOpenTab = o.isOpenTab as boolean | undefined;
          const paymentStatus = o.paymentStatus as string | undefined;

          // 1. Ventas hoy: only paid orders from today
          if (paymentStatus === "paid") {
            ventasHoy += total;
            const createdMs = (o.createdAt as Timestamp | undefined)?.toMillis?.() ?? 0;
            if (createdMs >= ahora - unaHora) {
              pulseLastHourCount++;
              pulseLastHourRevenue += total;
            } else if (createdMs >= ahora - 2 * unaHora) {
              pulsePrevHourCount++;
            }
          }

          // 2. Pedidos en cola: status in ['pending', 'preparing', 'ready']
          if (["pending", "preparing", "ready"].includes(status)) {
            pedidosCola++;
          }

          // 3. Cuentas abiertas: isOpenTab === true, status in ['pending', 'preparing', 'ready'], and paymentStatus !== 'paid'
          if (isOpenTab === true && ["pending", "preparing", "ready"].includes(status) && paymentStatus !== "paid") {
            cuentasAbiertas++;
          }
        });

        // Win-back proof: recovered customers × 30d avg paid ticket
        const wb = winbackSnap?.exists() ? winbackSnap.data() ?? {} : {};
        const autoWinbackSent = typeof wb.totalSent === "number" ? wb.totalSent : 0;
        const autoWinbackReturned = typeof wb.returned === "number" ? wb.returned : 0;
        const expiryRemindersSent = typeof wb.expiryRemindersSent === "number" ? wb.expiryRemindersSent : 0;

        // Manual channel (owner's own WhatsApp, logged via lastWinbackAt):
        // sent = customers tapped in the last 30d; returned = they visited
        // again after the tap. One customer counts once per window.
        let manualWinbackSent = 0;
        let manualWinbackReturned = 0;
        winbackTapsSnap?.forEach((d) => {
          const p = d.data() as Record<string, unknown>;
          const sentMs = (p.lastWinbackAt as Timestamp | undefined)?.toMillis?.();
          if (!sentMs) return;
          manualWinbackSent++;
          const visitMs = (p.lastVisitAt as Timestamp | undefined)?.toMillis?.();
          if (visitMs && visitMs > sentMs) manualWinbackReturned++;
        });

        const winbackSent = autoWinbackSent + manualWinbackSent;
        const winbackReturned = autoWinbackReturned + manualWinbackReturned;

        // Welcome rewards in the day-5-of-7 danger zone (≤2 days left) — the
        // named "remind them by WhatsApp" nudge for phone customers.
        const expiringRewards: { name: string; phone: string; daysLeft: number }[] = [];
        welcomeSnap?.forEach((d) => {
          const pd = d.data() as Record<string, unknown>;
          const createdMs = (pd.createdAt as Timestamp | undefined)?.toMillis?.();
          if (!createdMs) return;
          const daysLeft = 7 - Math.floor((Date.now() - createdMs) / 86400000);
          if (daysLeft < 0 || daysLeft > 2) return;
          const nm = typeof pd.name === "string" && pd.name.trim()
            ? pd.name.trim().split(" ")[0]
            : `··${d.id.slice(-4)}`;
          expiringRewards.push({ name: nm, phone: d.id, daysLeft });
        });
        expiringRewards.sort((a, b) => a.daysLeft - b.daysLeft);

        let paidTotal = 0, paidCount = 0, paidWithPhone = 0;
        monthOrdersSnap?.forEach((d) => {
          const o = d.data();
          if (o.paymentStatus === "paid" && typeof o.total === "number" && o.total > 0) {
            paidTotal += o.total;
            paidCount++;
            if (typeof o.customerPhone === "string" && o.customerPhone.length >= 10) {
              paidWithPhone++;
            }
          }
        });
        // Need at least 3 paid orders for a meaningful avg ticket.
        const avgTicket = paidCount >= 3 ? paidTotal / paidCount : null;

        // ── Phone-sale visits (Caja/checkout con número) ─────────────────────
        // phoneLoyaltyAt is written ONLY by creditPhonePointsForOrder, so every
        // order carrying it is a real "venta con número". These customers have
        // no app → they never appear in visitHistory. Counting them here keeps
        // the chart's promise ("cada venta con número suma aquí") honest, with
        // zero double-counting vs app scans.
        const phoneDailyCounts: Record<string, number> = {};
        let phoneVisitsToday = 0;
        let phoneVisits30d = 0;
        let phoneRedemptions30d = 0;
        const uniquePhones30d = new Set<string>();
        const sevenDaysAgoMs = sevenDaysAgo.toMillis();
        const todayStartMs = todayStart.toMillis();
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
          if (ms >= todayStartMs) phoneVisitsToday++;
          if (ms >= sevenDaysAgoMs) {
            const dt = ts.toDate();
            const key = `${dt.getFullYear()}-${dt.getMonth()}-${dt.getDate()}`;
            phoneDailyCounts[key] = (phoneDailyCounts[key] ?? 0) + 1;
          }
        });
        // Capture rate: % of paid orders with a customer phone — the fuel
        // gauge of the phone-points system (every capture = future winback).
        const captureRate =
          paidCount >= 3 ? Math.round((paidWithPhone / paidCount) * 100) : null;
        const winbackPesos =
          winbackReturned > 0 && avgTicket !== null
            ? Math.round(winbackReturned * avgTicket)
            : null;

        // 7-day chart data: app scans (visitHistory) + phone sales, per day.
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
            count: (dailyCounts[key] ?? 0) + (phoneDailyCounts[key] ?? 0),
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

        // Top products (30d) by quantity — excludes the synthetic quick-sell line,
        // matching the app dashboard's top-products behavior.
        const productQtyMap: Record<string, number> = {};
        monthOrdersSnap?.forEach((d) => {
          const items = (d.data().items as any[]) ?? [];
          items.forEach((item) => {
            if (item?.menuItemId === "__quick_sell__") return;
            const name = item?.name as string | undefined;
            const quantity = (item?.quantity as number) ?? 0;
            if (!name || quantity <= 0) return;
            productQtyMap[name] = (productQtyMap[name] ?? 0) + quantity;
          });
        });
        const topProducts = Object.entries(productQtyMap)
          .map(([name, qty]) => ({ name, qty }))
          .sort((a, b) => b.qty - a.qty)
          .slice(0, 3);

        // ── Free-tier loyalty quota (PRICING.md "cap honesto") ───────────────
        // Same fields phonePoints.ts / the app enforce: scanCount resets each
        // calendar month via lastReset; Pro (either canonical field) = no cap.
        // private/billing (plan) y private/usage (scanCount/lastReset) mandan
        // desde la migración 24-ago — el doc público ya no trae ni el plan ni
        // la cuota; leerlos ahí pintaba Free con contador en cero.
        const rTruth = await fetchWithBilling(db, rid, r as Record<string, unknown>);
        const isPro = entitlementOf(rTruth).isPro;
        const rawLimit = Number(rTruth.monthlyLimit);
        const loyaltyLimit = Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : 50;
        const lastResetTs = rTruth.lastReset as Timestamp | undefined;
        const lastResetDt = lastResetTs?.toDate?.();
        const nowDt = new Date();
        const inSameMonth =
          !!lastResetDt &&
          lastResetDt.getFullYear() === nowDt.getFullYear() &&
          lastResetDt.getMonth() === nowDt.getMonth();
        const loyaltyUsed = inSameMonth ? Number(rTruth.scanCount ?? 0) || 0 : 0;

        const insMetrics = (ins?.metrics ?? {}) as Record<string, unknown>;

        // El consejo lo calcula restaurant_brain y se guarda en Firestore; solo
        // se recalcula en el refresco DIARIO o al aplicar un borrador de
        // recompensas — nunca al terminar el setup. O sea que un dueño que acaba
        // de completar su perfil sigue leyendo "Completa tu perfil" hasta 24
        // horas, y el panel parece roto justo el dia que se dio de alta. Aqui
        // manda el doc VIVO del restaurante, que si esta al dia.
        const brainActionCode = (ins?.actionCode as string) ?? "unknown";
        const nbaCode = resolveNbaActionCode(
            brainActionCode,
            (r.isSetupComplete as boolean) ?? true,
            (r.setupIncompleteReasons as string[]) ?? [],
        );
        const nbaOverridden = nbaCode !== brainActionCode;

        setData({
          restaurantId: rid,
          restaurantName: (r.name as string) ?? "Mi restaurante",
          scanCountTotal: (rTruth.scanCount as number) ?? 0,
          // Visitas hoy = app scans + ventas con número (same rule as the chart).
          scansToday: scansToday + phoneVisitsToday,
          pointsToday,
          weeklyScans,
          weekTotal,
          weeklyBriefText: ins?.weeklyBriefText as string | undefined,
          atRiskCount: (insMetrics.atRiskCount as number | undefined) ?? (ins?.atRiskCount as number | undefined),
          restaurantStatus: (r.status as string) ?? "active",
          recentScans,
          isSetupComplete: (r.isSetupComplete as boolean) ?? true,
          setupIncompleteReasons: (r.setupIncompleteReasons as string[]) ?? [],
          nbaActionCode: nbaCode,
          nbaTitle: nbaOverridden
            ? getNbaFallbackTitle(nbaCode)
            : ((ins?.title_es as string) ?? getNbaFallbackTitle(nbaCode)),
          // Si el codigo se corrigio, el texto guardado por el cerebro habla de
          // OTRA accion: dejarlo pone "Completa tu perfil" arriba de un boton que
          // dice "Cobrar con numero". El texto tiene que venir del codigo que se
          // esta mostrando, no del que el cerebro creia.
          nbaBody: nbaOverridden
            ? getNbaFallbackBody(nbaCode)
            : ((ins?.body_es as string) ?? ""),
          nbaMetrics: {
            atRiskCount: (insMetrics.atRiskCount as number) ?? 0,
            atRiskReachableCount: (insMetrics.atRiskReachableCount as number | null | undefined) ?? null,
            atRiskTotalCount: (insMetrics.atRiskTotalCount as number | null | undefined) ?? null,
            // App metrics (from the brain) + phone-sale metrics (computed here):
            // phone customers have no app, so the brain's visitHistory numbers
            // never include them. Sum = every real visit, no double-counting.
            scans30d: ((insMetrics.scans30d as number) ?? 0) + phoneVisits30d,
            redemptions30d: ((insMetrics.redemptions30d as number) ?? 0) + phoneRedemptions30d,
            uniqueCustomers30d: ((insMetrics.uniqueCustomers30d as number) ?? 0) + uniquePhones30d.size,
            menuItemCount: (insMetrics.menuItemCount as number) ?? 0,
            rewardCount: (insMetrics.rewardCount as number) ?? 0,
          },
          dailyGoal: (r.dailyRevenueGoal as number | null) ?? null,
          ventasHoy,
          // Veredicto de meta contra el horario REAL (espejo de la app,
          // today_overview_card:120-146): ±10 puntos vs el avance esperado
          // de la ventana de apertura; ≥80 "Muy cerca", ≥100 "Logrado".
          metaPaceLabel: (() => {
            const goal = typeof r.dailyRevenueGoal === "number" && r.dailyRevenueGoal > 0
              ? r.dailyRevenueGoal : null;
            if (!goal) return null;
            const metaPct = (ventasHoy / goal) * 100;
            if (metaPct >= 100) return "Logrado";
            if (metaPct >= 80) return "Muy cerca";
            const expected = expectedDayProgressPercent(r as Record<string, unknown>);
            if (expected === null) return null;
            if (metaPct >= expected + 10) return "Adelantado";
            if (metaPct < expected - 10) return "Atrasado";
            return "En camino";
          })(),
          pulseLastHourCount,
          pulseLastHourRevenue,
          pulsePrevHourCount,
          dailyRevenueGoal: typeof r.dailyRevenueGoal === "number" ? r.dailyRevenueGoal : null,
          pedidosCola,
          cuentasAbiertas,
          winbackSent,
          expiryRemindersSent,
          expiringRewards,
          winbackReturned,
          manualWinbackSent,
          manualWinbackReturned,
          winbackPesos,
          captureRate,
          topProducts,
          isPro,
          loyaltyUsed,
          loyaltyLimit,
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
          className="rounded-xl px-5 py-2.5 text-sm font-semibold text-[#1C2526]"
          style={{ background: "#F28C38" }}>
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
  // Modo primer día (veredicto de Ricardo, 26-ago): a un restaurante que no
  // termina de nacer NO se le enseña el cementerio de ceros ($0, tablas
  // vacías) — solo brújula, venta, guía AI y su QR. Al completar el setup
  // se "gradúa" y el panel completo se abre. Gate seguro: todos los
  // restaurantes vivos tienen isSetupComplete=true — intocados.
  const firstDay = !data.isSetupComplete;

  return (
    <>
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
            <ManualCloseToggle restaurantId={data.restaurantId} />
            <Link href="/vendor/pos"
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-bold text-[#1C2526]"
              style={{ background: "#F28C38" }}>
              💰 Cobrar
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
            {/* Sin CSS `capitalize`: ponía "26 De Agosto" — en español el mes
                y el "de" van en minúscula. Solo la primera letra sube. */}
            <p className="text-[11px]" style={{ color: "rgba(28,37,38,0.38)" }}>
              {(() => {
                const d = new Date().toLocaleDateString("es-MX", {
                  weekday: "long", day: "numeric", month: "long",
                });
                return d.charAt(0).toUpperCase() + d.slice(1);
              })()}
            </p>
            <h1 className="mt-0.5 text-[21px] font-bold" style={{ color: "#1C2526" }}>
              {greeting}{firstName ? `, ${firstName}` : ""}
            </h1>
            {/* Frase del día — joya robada de la app (27-ago): el día en una
                línea, leíble en 3 segundos. Solo para el panel graduado. */}
            {!firstDay && (
              <p className="mt-1 text-[12px] font-semibold" style={{ color: "rgba(28,37,38,0.5)" }}>
                Hoy: ${data.ventasHoy.toLocaleString("es-MX")}
                {" · "}Ritmo:{" "}
                <span style={{ color: data.pulseLastHourCount >= 3 ? "#16A34A" : data.pulseLastHourCount >= 1 ? "#B45309" : "rgba(28,37,38,0.45)" }}>
                  {data.pulseLastHourCount >= 3 ? "Fuerte 🔥" : data.pulseLastHourCount >= 1 ? "Normal" : "Lento"}
                </span>
                {data.dailyRevenueGoal ? ` · Meta: ${Math.round((data.ventasHoy / data.dailyRevenueGoal) * 100)}%` : ""}
                {data.metaPaceLabel ? (
                  <>
                    {" · "}
                    <span style={{ color: data.metaPaceLabel === "Atrasado" ? "#DC2626" : data.metaPaceLabel === "En camino" ? "rgba(28,37,38,0.45)" : "#16A34A" }}>
                      {data.metaPaceLabel}
                    </span>
                  </>
                ) : ""}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <ManualCloseToggle restaurantId={data.restaurantId} />
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
            {/* Primary daily action = the sale (POS golden rule: every sale →
                Caja, phone loyalty rides along). Scanner stays in the sidebar
                for app-QR customers. */}
            <Link href="/vendor/pos"
              className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-[14px] font-bold text-white transition hover:opacity-90 active:scale-[0.98]"
              style={{ background: "linear-gradient(135deg, #FF9A45 0%, #F28C38 55%, #E07830 100%)", boxShadow: "0 4px 16px rgba(242,140,56,0.28)" }}>
              💰 Nueva venta
            </Link>
          </div>
        </div>

        {/* ── Page content ── (día cero: columna con tope — en monitor ancho
            las tarjetas full-width se volvían salchichas de un metro) */}
        <main className={`flex-1 px-4 pb-16 pt-5 md:px-8 md:pt-7${firstDay ? " mx-auto w-full max-w-3xl" : ""}`}>

          {/* Día cero: la brújula VA PRIMERO — la acción principal de un
              restaurante sin terminar de nacer es terminar de nacer, no
              "Nueva venta" (cazado por Ricardo en el primer claim). */}
          {!data.isSetupComplete && (
            <SetupBanner reasons={data.setupIncompleteReasons} />
          )}

          {/* Mobile primary CTA — the sale IS the loop (points + premios en la Caja) */}
          <Link href="/vendor/pos"
            className="mb-6 flex items-center justify-between rounded-2xl p-5 transition-transform active:scale-[0.98] md:hidden"
            style={{
              background: "linear-gradient(135deg, #FF9A45 0%, #F28C38 55%, #E07830 100%)",
              boxShadow: "0 6px 28px rgba(242,140,56,0.28)",
            }}>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/60">
                Acción principal
              </p>
              <p className="mt-0.5 text-[20px] font-bold text-white">Nueva venta</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl text-[24px] text-white"
              style={{ background: "rgba(255,255,255,0.2)" }}>
              💰
            </div>
          </Link>

          {/* ── Requieren tu atención ── */}
          {(riskCount > 0 || data.pedidosCola > 0 || data.expiringRewards.length > 0) && (
            <div className="mb-6">
              <p className="mb-2.5 text-[10px] font-bold uppercase tracking-[0.1em]"
                style={{ color: "rgba(28,37,38,0.35)" }}>
                Requieren tu atención
              </p>
              <div className="space-y-2">
                {data.pedidosCola > 0 && (
                  <Link href="/vendor/pedidos"
                    className="flex items-center gap-3 rounded-2xl px-4 py-3.5 transition-all hover:shadow-md"
                    style={{ background: "#ffffff", border: "1px solid rgba(217,119,87,0.35)" }}>
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-lg"
                      style={{ background: "rgba(217,119,87,0.1)" }}>
                      ⏳
                    </div>
                    <p className="flex-1 text-[13px] font-semibold" style={{ color: "#1C2526" }}>
                      {data.pedidosCola} pedido{data.pedidosCola !== 1 ? "s" : ""} en cola esperando
                    </p>
                    <span style={{ color: "rgba(28,37,38,0.3)" }}>›</span>
                  </Link>
                )}
                {/* Named day-5 nudges: welcome reward about to expire → one
                    WhatsApp from the owner saves the first-visit hook. */}
                {data.expiringRewards.slice(0, 2).map((er) => (
                  <Link key={er.phone} href="/vendor/clientes"
                    className="flex items-center gap-3 rounded-2xl px-4 py-3.5 transition-all hover:shadow-md"
                    style={{ background: "#fffbeb", border: "1px solid rgba(255,180,0,0.35)" }}>
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-lg"
                      style={{ background: "rgba(255,180,0,0.12)" }}>
                      🎁
                    </div>
                    <p className="flex-1 text-[13px] font-semibold" style={{ color: "#1C2526" }}>
                      {er.name} — su premio de bienvenida vence{" "}
                      {er.daysLeft <= 0 ? "HOY" : er.daysLeft === 1 ? "mañana" : "en 2 días"} · mándale un WhatsApp
                    </p>
                    <span style={{ color: "rgba(28,37,38,0.3)" }}>›</span>
                  </Link>
                ))}
                {riskCount > 0 && (
                  <Link href="/vendor/clientes"
                    className="flex items-center gap-3 rounded-2xl px-4 py-3.5 transition-all hover:shadow-md"
                    style={{ background: "#fff5f5", border: "1px solid rgba(220,38,38,0.25)" }}>
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-lg"
                      style={{ background: "rgba(220,38,38,0.08)" }}>
                      ⚠️
                    </div>
                    <p className="flex-1 text-[13px] font-semibold" style={{ color: "#1C2526" }}>
                      {data.nbaMetrics.atRiskReachableCount !== null ? (
                        data.nbaMetrics.atRiskReachableCount > 0 ? (
                          <>
                            {data.nbaMetrics.atRiskTotalCount ?? riskCount} clientes sin regresar —{" "}
                            <b>{data.nbaMetrics.atRiskReachableCount} con WhatsApp para contactar tú</b>; al resto la app ya los trabaja 🤖
                          </>
                        ) : (
                          <>
                            {riskCount} cliente{riskCount !== 1 ? "s" : ""} en riesgo — la app ya los está trabajando con notificaciones automáticas 🤖
                          </>
                        )
                      ) : (
                        <>
                          {riskCount} cliente{riskCount !== 1 ? "s" : ""} en riesgo de no volver — mándale{riskCount !== 1 ? "s" : ""} un mensaje
                        </>
                      )}
                    </p>
                    <span style={{ color: "rgba(28,37,38,0.3)" }}>›</span>
                  </Link>
                )}
              </div>
            </div>
          )}

          {/* ── Resumen de hoy (oculto el primer día: puro cero) ── */}
          {!firstDay && (
          <div className="mb-6">
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h2 className="text-[13px] font-bold uppercase tracking-wider" style={{ color: "rgba(28,37,38,0.4)" }}>
                Resumen de hoy
              </h2>
              {/* Pulso en vivo — joya robada de la app: última hora + tendencia */}
              <p className="text-[11px] font-semibold" style={{ color: "rgba(28,37,38,0.45)" }}>
                ⚡ Última hora: {data.pulseLastHourCount} pedido{data.pulseLastHourCount === 1 ? "" : "s"}
                {data.pulseLastHourCount > 0 ? ` · $${data.pulseLastHourRevenue.toLocaleString("es-MX")}` : ""}
                {data.pulseLastHourCount > data.pulsePrevHourCount ? " ↑" : data.pulseLastHourCount < data.pulsePrevHourCount ? " ↓" : ""}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              
              <Link href="/vendor/reportes" className="group rounded-2xl p-5 transition-all hover:shadow-md hover:scale-[1.01]"
                style={{ background: "#ffffff", border: "1px solid rgba(28,37,38,0.06)", boxShadow: "0 2px 10px rgba(0,0,0,0.02)" }}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[12px] font-bold" style={{ color: "rgba(28,37,38,0.5)" }}>Ventas hoy</span>
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl transition-colors group-hover:bg-[#F28C38]/10"
                    style={{ background: "rgba(242,140,56,0.08)", color: "#F28C38" }}>
                    💵
                  </div>
                </div>
                <p className="text-[26px] font-extrabold tracking-tight tabular-nums" style={{ color: "#1C2526" }}>
                  ${data.ventasHoy.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="mt-1 text-[11px] text-[#F28C38] font-semibold group-hover:underline">Ver reportes →</p>
              </Link>

              <Link href="/vendor/pedidos" className="group rounded-2xl p-5 transition-all hover:shadow-md hover:scale-[1.01]"
                style={{ background: "#ffffff", border: "1px solid rgba(28,37,38,0.06)", boxShadow: "0 2px 10px rgba(0,0,0,0.02)" }}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[12px] font-bold" style={{ color: "rgba(28,37,38,0.5)" }}>Pedidos en cola</span>
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl transition-colors group-hover:bg-[#F28C38]/10"
                    style={{ background: "rgba(242,140,56,0.08)", color: "#F28C38" }}>
                    ⏳
                  </div>
                </div>
                <p className="text-[26px] font-extrabold tracking-tight tabular-nums" style={{ color: "#1C2526" }}>
                  {data.pedidosCola}
                </p>
                <p className="mt-1 text-[11px] text-[#F28C38] font-semibold group-hover:underline">Ver cocina →</p>
              </Link>

              <Link href="/vendor/pos" className="group rounded-2xl p-5 transition-all hover:shadow-md hover:scale-[1.01]"
                style={{ background: "#ffffff", border: "1px solid rgba(28,37,38,0.06)", boxShadow: "0 2px 10px rgba(0,0,0,0.02)" }}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[12px] font-bold" style={{ color: "rgba(28,37,38,0.5)" }}>Cuentas abiertas</span>
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl transition-colors group-hover:bg-[#F28C38]/10"
                    style={{ background: "rgba(242,140,56,0.08)", color: "#F28C38" }}>
                    📖
                  </div>
                </div>
                <p className="text-[26px] font-extrabold tracking-tight tabular-nums" style={{ color: "#1C2526" }}>
                  {data.cuentasAbiertas}
                </p>
                <p className="mt-1 text-[11px] text-[#F28C38] font-semibold group-hover:underline">Ir a POS →</p>
              </Link>

              <Link href="/vendor/pos" className="group rounded-2xl p-5 transition-all hover:shadow-md hover:scale-[1.01]"
                style={{ background: "#ffffff", border: "1px solid rgba(28,37,38,0.06)", boxShadow: "0 2px 10px rgba(0,0,0,0.02)" }}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[12px] font-bold" style={{ color: "rgba(28,37,38,0.5)" }}>Clientes Comeleal hoy</span>
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl transition-colors group-hover:bg-[#F28C38]/10"
                    style={{ background: "rgba(242,140,56,0.08)", color: "#F28C38" }}>
                    📱
                  </div>
                </div>
                <p className="text-[26px] font-extrabold tracking-tight tabular-nums" style={{ color: "#1C2526" }}>
                  {data.scansToday}
                </p>
                <p className="mt-1 text-[11px] text-[#F28C38] font-semibold group-hover:underline">Cobrar con número →</p>
              </Link>

            </div>
          </div>
          )}

          {/* ── Coach Comeleal AI Card ── */}
          <AICoachPreviewCard
            actionCode={data.nbaActionCode}
            nbaTitle={data.nbaTitle}
            nbaBody={data.nbaBody}
            metrics={data.nbaMetrics}
            weeklyBriefText={data.weeklyBriefText}
          />

          {/* ── Lealtad quota (free tier) — PRICING.md "cap honesto" ── */}
          {!firstDay && !data.isPro && (
            <LoyaltyQuotaCard used={data.loyaltyUsed} limit={data.loyaltyLimit} />
          )}

          {/* ── Del Top productos a la Actividad: nada de esto existe el
              primer día — se abre al graduarse del setup ── */}
          {!firstDay && (<>
          {/* ── Top productos ── */}
          <div className="mb-6">
            <h2 className="mb-3 text-[13px] font-bold uppercase tracking-wider" style={{ color: "rgba(28,37,38,0.4)" }}>
              Top productos
            </h2>
            <div className="rounded-2xl p-5" style={{ background: "#ffffff", border: "1px solid rgba(28,37,38,0.06)", boxShadow: "0 2px 10px rgba(0,0,0,0.02)" }}>
              <p className="mb-3 text-[11px] font-semibold" style={{ color: "rgba(28,37,38,0.4)" }}>Más vendidos · últimos 30 días</p>
              {data.topProducts.length === 0 ? (
                <p className="py-1 text-[13px]" style={{ color: "rgba(28,37,38,0.5)" }}>
                  Aún no hay productos vendidos. Cobra desde el POS para ver tus más vendidos aquí.
                </p>
              ) : (
                <div className="flex flex-col divide-y" style={{ borderColor: "rgba(28,37,38,0.06)" }}>
                  {data.topProducts.map((p, idx) => (
                    <div key={p.name} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-orange-50 text-[11px] font-black text-[#F28C38]">
                          {idx + 1}
                        </span>
                        <span className="truncate text-[14px] font-semibold" style={{ color: "#1C2526" }}>{p.name}</span>
                      </div>
                      <span className="ml-3 shrink-0 text-[13px] font-bold tabular-nums" style={{ color: "rgba(28,37,38,0.6)" }}>
                        {p.qty} {p.qty === 1 ? "vendida" : "vendidas"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <Link href="/vendor/reportes" className="mt-3 inline-block text-[11px] font-semibold text-[#F28C38] hover:underline">
                Ver reporte completo →
              </Link>
            </div>
          </div>

          {/* ── Win-back proof banner ── */}
          {/* Capture rate — coaches the "¿me das tu número?" habit. */}
          {data.captureRate !== null && (
            // Puerta, no póster (Ricardo, 25-ago): el marcador te deja donde
            // viven los números — la página de Clientes.
            <div className="mb-6 rounded-2xl p-5 flex flex-wrap items-center gap-x-5 gap-y-2 cursor-pointer transition-shadow hover:shadow-md"
              role="button" tabIndex={0}
              onClick={() => router.push("/vendor/clientes")}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); router.push("/vendor/clientes"); } }}
              style={{
                background: "#ffffff",
                border: "1px solid rgba(28,37,38,0.07)",
                boxShadow: "0 1px 4px rgba(28,37,38,0.05)",
              }}>
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-2xl"
                style={{ background: "rgba(242,140,56,0.12)" }}>
                📱
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-extrabold" style={{ color: "#1C2526" }}>
                  Capturas el número en{" "}
                  <span style={{ color: "#F28C38" }}>{data.captureRate}%</span>{" "}
                  de tus ventas
                </p>
                <p className="mt-0.5 text-[12px]" style={{ color: "rgba(28,37,38,0.5)" }}>
                  {data.captureRate >= 60
                    ? "Excelente — cada número es un cliente al que puedes traer de vuelta. 💪"
                    : "Cada número capturado es un cliente recuperable. Pide el teléfono al cobrar: “¿Tu número para tus puntos?”"}
                </p>
              </div>
              <span className="shrink-0 text-[12px] font-bold" style={{ color: "#B45309" }}>
                Ver clientes ›
              </span>
            </div>
          )}

          {(data.winbackSent > 0 || data.expiryRemindersSent > 0) && (
            // Puerta, no póster: el marcador de recuperación te deja en
            // Clientes ya filtrado a "en riesgo" — donde vive el botón de
            // WhatsApp que esta tarjeta promete.
            <div className="mb-6 rounded-2xl p-5 cursor-pointer transition-shadow hover:shadow-md"
              role="button" tabIndex={0}
              onClick={() => router.push("/vendor/clientes?segmento=riesgo")}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); router.push("/vendor/clientes?segmento=riesgo"); } }}
              style={{
                background: data.winbackReturned > 0
                  ? "linear-gradient(135deg, #0d3321 0%, #14532d 100%)"
                  : "#ffffff",
                border: data.winbackReturned > 0
                  ? "1px solid rgba(34,197,94,0.35)"
                  : "1px solid rgba(28,37,38,0.07)",
                boxShadow: data.winbackReturned > 0
                  ? "0 4px 20px rgba(20,83,45,0.25)"
                  : "0 1px 4px rgba(28,37,38,0.05)",
              }}>
              {data.winbackReturned > 0 ? (
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-2xl"
                    style={{ background: "rgba(34,197,94,0.18)" }}>
                    💸
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[16px] font-extrabold text-white">
                      Comeleal te trajo de vuelta{" "}
                      <span style={{ color: "#4ade80" }}>
                        {data.winbackReturned} cliente{data.winbackReturned !== 1 ? "s" : ""}
                      </span>
                      {data.winbackPesos !== null && (
                        <>
                          {" "}≈{" "}
                          <span style={{ color: "#4ade80" }}>
                            ${data.winbackPesos.toLocaleString("es-MX")} MXN
                          </span>
                        </>
                      )}
                    </p>
                    <p className="mt-0.5 text-[12px]" style={{ color: "rgba(255,255,255,0.55)" }}>
                      De {data.winbackSent} mensaje{data.winbackSent !== 1 ? "s" : ""} de recuperación
                      {data.manualWinbackSent > 0
                        ? ` (${data.winbackSent - data.manualWinbackSent} automáticos · ${data.manualWinbackSent} que mandaste tú)`
                        : ""}
                      {data.winbackPesos !== null && " · estimado con tu ticket promedio de 30 días"}
                    </p>
                  </div>
                  <span className="shrink-0 text-[12px] font-bold" style={{ color: "#4ade80" }}>
                    Ver en riesgo ›
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl"
                    style={{ background: "rgba(242,140,56,0.08)" }}>
                    📨
                  </div>
                  <div>
                    <p className="text-[14px] font-bold" style={{ color: "#1C2526" }}>
                      Recuperación en marcha:{" "}
                      {[
                        data.winbackSent - data.manualWinbackSent > 0 ? `${data.winbackSent - data.manualWinbackSent} mensaje${data.winbackSent - data.manualWinbackSent !== 1 ? "s" : ""} automático${data.winbackSent - data.manualWinbackSent !== 1 ? "s" : ""}` : null,
                        data.manualWinbackSent > 0 ? `${data.manualWinbackSent} por tu WhatsApp` : null,
                        data.expiryRemindersSent > 0 ? `${data.expiryRemindersSent} recordatorio${data.expiryRemindersSent !== 1 ? "s" : ""} de premio` : null,
                      ].filter(Boolean).join(" · ")}
                    </p>
                    <p className="text-[11px]" style={{ color: "rgba(28,37,38,0.45)" }}>
                      La máquina detecta y escribe; tú solo das el tap. Aquí verás cuántos regresaron — y cuánto dinero representa.
                    </p>
                  </div>
                  <span className="ml-auto shrink-0 text-[12px] font-bold" style={{ color: "#B45309" }}>
                    Ver en riesgo ›
                  </span>
                </div>
              )}
            </div>
          )}

          {/* ── Acciones rápidas ── */}
          <p className="mb-2.5 text-[10px] font-bold uppercase tracking-[0.1em]"
            style={{ color: "rgba(28,37,38,0.35)" }}>
            Acciones rápidas
          </p>
          <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-2">
            <Link href="/vendor/pos"
              className="flex items-center gap-4 rounded-2xl px-5 py-4 transition hover:opacity-90 active:scale-[0.98]"
              style={{
                background: "linear-gradient(135deg, #FF9A45 0%, #F28C38 55%, #E07830 100%)",
                boxShadow: "0 4px 16px rgba(242,140,56,0.28)",
              }}>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[20px] text-white"
                style={{ background: "rgba(255,255,255,0.2)" }}>
                💰
              </div>
              <div>
                <p className="text-[14px] font-bold text-white">Nueva venta</p>
                <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.7)" }}>
                  Cobra y suma puntos en la Caja
                </p>
              </div>
              <span className="ml-auto text-white/40">›</span>
            </Link>
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
                  Solo si trae la app — si no, cóbrale con su número
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
                  Clientes Comeleal — últimos 7 días
                </p>
                <p className="text-[11px]" style={{ color: "rgba(28,37,38,0.38)" }}>
                  {data.weekTotal} visitas con app o número esta semana
                </p>
              </div>
              <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
                style={{ background: "#F5F3EF", color: "rgba(28,37,38,0.45)" }}>
                7d
              </span>
            </div>
            {data.weekTotal > 0 ? (
              <WeekChart days={data.weeklyScans} />
            ) : (
              <div className="flex flex-col items-center py-6 text-center">
                <span className="text-[26px]">📱</span>
                <p className="mt-2 text-[13px] font-semibold" style={{ color: "rgba(28,37,38,0.5)" }}>
                  Aún sin clientes Comeleal esta semana
                </p>
                <p className="mt-0.5 text-[12px]" style={{ color: "rgba(28,37,38,0.38)" }}>
                  Cada venta con número suma aquí — empieza en la Caja.
                </p>
              </div>
            )}
          </div>

          {/* ── Loyalty proof (30d lookback) ── */}
          <OwnerLookbackCard metrics={data.nbaMetrics} />

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
                style={{ color: "#F28C38" }}>
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
                      style={{ background: "rgba(242,140,56,0.12)", color: "#F28C38" }}>
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
                  Sin visitas aún — cobra con el número de tu cliente en la Caja.
                </p>
              </div>
            )}
          </div>
          </>)}

          {/* ── QR Card ── */}
          <div id="compartir-qr">
            <QrCard restaurantId={data.restaurantId} restaurantName={data.restaurantName} />
          </div>

          {/* ── Atajos — mobile only (sidebar handles desktop nav) ── */}
          <p className="mb-2.5 text-[10px] font-bold uppercase tracking-[0.1em] md:hidden"
            style={{ color: "rgba(28,37,38,0.35)" }}>
            Atajos
          </p>
          <div className="grid grid-cols-3 gap-3 md:hidden">
            {/* Orden phone-first (Ricardo, 26-ago): el escáner es "solo si
                trae la app" — no encabeza el grid. */}
            <Atajo href="/vendor/clientes" emoji="👥" label="Clientes" />
            <Atajo href="/vendor/reportes" emoji="📊" label="Reportes" />
            <Atajo href="/vendor?ai=1" emoji="🧠" label="Comeleal AI" />
            <Atajo href="/vendor/scanner" emoji="⭐" label="Puntos" />
            <Atajo href={`/menu/${data.restaurantId}`} emoji="👀" label="Mi menú" external />
            <Atajo href="/vendor/configuracion" emoji="⚙️" label="Config" />
            <Atajo
              href="https://apps.apple.com/mx/app/foodpass/id6745301069"
              emoji="📱"
              label="App"
              external
            />
          </div>
        </main>
    </>
  );
}

// ─── QR Card ──────────────────────────────────────────────────────────────────

function QrCard({ restaurantId, restaurantName }: { restaurantId: string; restaurantName: string }) {
  // Entrada al modal ÚNICO de compartir (MenuShareModal — tarjeta de marca,
  // QR local, link bonito, imprimir). Antes: acordeón con QR de un servicio
  // externo (api.qrserver.com), link de ID feo y un segundo botón "Compartir
  // menú" duplicando el de la sidebar. En móvil esta fila es LA entrada
  // (la sidebar está oculta).
  const [shareOpen, setShareOpen] = useState(false);
  void restaurantName; // el modal lee nombre/logo/slug frescos del doc

  return (
    <div className="mb-5 rounded-2xl"
      style={{
        background: "#ffffff",
        border: "1px solid rgba(28,37,38,0.07)",
        boxShadow: "0 1px 4px rgba(28,37,38,0.05)",
      }}>
      <button
        onClick={() => setShareOpen(true)}
        className="flex w-full items-center gap-3 px-5 py-4 transition-colors hover:bg-[#faf9f5] rounded-2xl"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[17px]"
          style={{ background: "rgba(217,119,87,0.1)" }}>
          📲
        </div>
        <div className="flex-1 text-left">
          <p className="text-[13px] font-bold" style={{ color: "#1C2526" }}>Tu QR de menú</p>
          <p className="text-[11px]" style={{ color: "rgba(28,37,38,0.42)" }}>
            Compártelo o imprímelo — tus clientes escanean y ordenan
          </p>
        </div>
        <span className="text-[13px]" style={{ color: "rgba(28,37,38,0.3)" }}>›</span>
      </button>

      {/* Ver el menú como lo ve el cliente. Antes solo se llegaba desde
          Configuración — el dueño no tenia forma de abrir su propia pagina
          publica desde el panel. */}
      <a
        href={`/menu/${restaurantId}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex w-full items-center gap-3 border-t px-5 py-3 transition-colors hover:bg-[#faf9f5]"
        style={{ borderColor: "rgba(28,37,38,0.07)" }}
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[17px]"
          style={{ background: "rgba(28,37,38,0.05)" }}>
          👀
        </div>
        <div className="flex-1 text-left">
          <p className="text-[13px] font-bold" style={{ color: "#1C2526" }}>Ver mi menú</p>
          <p className="text-[11px]" style={{ color: "rgba(28,37,38,0.42)" }}>
            Ábrelo como lo ve tu cliente al escanear
          </p>
        </div>
        <span className="text-[13px]" style={{ color: "rgba(28,37,38,0.3)" }}>↗</span>
      </a>

      {/* Pagina publica /r/ — la que sale en Google. Acepta el ID y redirige
          sola al slug bonito en cuanto el restaurante tiene uno. */}
      <a
        href={`/r/${restaurantId}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex w-full items-center gap-3 border-t px-5 py-3 transition-colors hover:bg-[#faf9f5] rounded-b-2xl"
        style={{ borderColor: "rgba(28,37,38,0.07)" }}
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[17px]"
          style={{ background: "rgba(28,37,38,0.05)" }}>
          🌎
        </div>
        <div className="flex-1 text-left">
          <p className="text-[13px] font-bold" style={{ color: "#1C2526" }}>Ver mi página</p>
          <p className="text-[11px]" style={{ color: "rgba(28,37,38,0.42)" }}>
            La que encuentran en Google
          </p>
        </div>
        <span className="text-[13px]" style={{ color: "rgba(28,37,38,0.3)" }}>↗</span>
      </a>

      <MenuShareModal
        restaurantId={restaurantId}
        open={shareOpen}
        onClose={() => setShareOpen(false)}
      />
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
  // Se cuenta SOLO lo que esta tarjeta muestra (hours, menu, rewards) — la
  // misma lección que ya cobró la página del setup: contar sobre 4 grupos
  // (con "business", que aquí no se pinta) presumía "2 de 3 · 67%" con una
  // sola palomita puesta (cazado por Ricardo en el primer claim, 26-ago).
  const pendingKeys = new Set(reasons.map((r) => REASON_TO_STEP[r]).filter(Boolean));
  const total = 3;
  const doneCount = SETUP_STEPS.filter((s) => !pendingKeys.has(s.key)).length;
  const pct = Math.round((doneCount / total) * 100);

  // La tarjeta ya no es UN solo link: el encabezado lleva al MAPA (Ver →) y
  // cada chip es PUERTA DIRECTA a su paso (regla de Ricardo, 26-ago: si
  // tiene forma de chip y nombre de destino, LLEVA al destino — links
  // anidados son HTML inválido, por eso el contenedor es div).
  return (
    <div
      className="mb-5 flex flex-col rounded-2xl p-5 transition-all hover:shadow-md"
      style={{
        background: "linear-gradient(135deg, #fff8f5 0%, #ffffff 100%)",
        border: "1px solid rgba(217,119,87,0.22)",
        boxShadow: "0 2px 12px rgba(217,119,87,0.08)",
      }}>
      <Link href="/vendor/setup" className="flex items-center justify-between mb-3 active:scale-[0.99] transition-transform">
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
        <span style={{ color: "#F28C38", fontSize: 12, fontWeight: 600 }}>Ver →</span>
      </Link>

      {/* Progress bar */}
      <div className="mb-3 h-1.5 w-full rounded-full overflow-hidden" style={{ background: "rgba(28,37,38,0.07)" }}>
        <div className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: "linear-gradient(90deg, #FF9A45, #F28C38)" }} />
      </div>

      {/* Step chips — cada uno abre SU paso (en modo wizard, con stepper).
          Anatomía de BOTÓN (fondo blanco, borde, sombra, ›): un pill plano
          no grita "tócame" aunque sea link (Ricardo, 26-ago). */}
      <div className="flex gap-2 flex-wrap">
        {SETUP_STEPS.map((step) => {
          const pending = pendingKeys.has(step.key);
          return (
            <Link key={step.key}
              href={`${step.href}?wizard=1`}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-bold shadow-sm transition-all hover:shadow-md hover:-translate-y-px active:scale-[0.97]"
              style={pending
                ? { background: "#ffffff", color: "#F28C38", border: "1.5px solid rgba(242,140,56,0.45)" }
                : { background: "#ffffff", color: "rgba(28,37,38,0.45)", border: "1.5px solid rgba(28,37,38,0.1)" }
              }>
              {pending ? step.emoji : "✓"} {step.label}
              <span style={{ color: pending ? "rgba(242,140,56,0.7)" : "rgba(28,37,38,0.3)" }}>›</span>
            </Link>
          );
        })}
      </div>
    </div>
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
                style={{ color: day.isToday ? "#F28C38" : "rgba(28,37,38,0.4)" }}>
                {day.count}
              </span>
            )}
            {day.count === 0 && <span className="text-[10px]" style={{ color: "transparent" }}>0</span>}
            <div
              className="w-full rounded-lg transition-all"
              style={{
                height: barPx,
                background: day.isToday
                  ? "linear-gradient(180deg, #FF9A45 0%, #F28C38 100%)"
                  : day.count > 0
                  ? "rgba(242,140,56,0.35)"
                  : "rgba(28,37,38,0.07)",
                marginTop: "auto",
              }}
            />
            <span className="text-[10px] font-medium"
              style={{ color: day.isToday ? "#F28C38" : "rgba(28,37,38,0.4)" }}>
              {day.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}


// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label, value, icon, accent = false, danger = false,
}: {
  label: string; value: number; icon: React.ReactNode; accent?: boolean; danger?: boolean;
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
          color: dangerActive ? "#EF4444" : "#F28C38",
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

/** Acciones que solo tienen sentido si el setup REALMENTE sigue incompleto. */
const SETUP_BLOCKING_NBA = new Set([
  "complete_profile",
  "add_menu_items",
  "configure_rewards",
  "set_business_hours",
  "enable_first_purchase_reward",
]);

/**
 * Descarta el consejo del cerebro cuando ya quedo viejo.
 *
 * No adivina nada: si el cerebro pide terminar el setup y el doc vivo dice que
 * ya esta completo, el cerebro se quedo atras. Para un restaurante recien
 * configurado el siguiente paso de verdad siempre es el mismo — su primera
 * visita con puntos sale de la Caja.
 */
function resolveNbaActionCode(
  brainActionCode: string,
  isSetupComplete: boolean,
  setupReasons: string[],
): string {
  if (isSetupComplete && SETUP_BLOCKING_NBA.has(brainActionCode)) return "get_first_scan";
  // Recién nacido (cazado por Ricardo en el primer claim, 26-ago): el
  // cerebro corre con calendario, no al nacer — el día cero decía "estamos
  // preparando recomendaciones" cuando el siguiente paso es OBVIO y está
  // ESCRITO en el readiness. No se adivina: se lee, en el orden del wizard.
  if (!isSetupComplete && setupReasons.length > 0 && !SETUP_BLOCKING_NBA.has(brainActionCode)) {
    if (setupReasons.includes("business_hours")) return "set_business_hours";
    if (setupReasons.includes("menu_items")) return "add_menu_items";
    if (setupReasons.includes("reward_tiers")) return "configure_rewards";
    if (setupReasons.includes("first_purchase_reward")) return "enable_first_purchase_reward";
  }
  return brainActionCode;
}

// El título dice LA acción — el genérico "Siguiente mejor acción" apilado
// bajo el kicker "⚡ Tu siguiente movimiento" era la misma frase dos veces
// (cazado por Ricardo, 26-ago).
function getNbaFallbackTitle(actionCode: string): string {
  switch (actionCode) {
    case "set_business_hours": return "Ponle su horario a tu menú";
    case "add_menu_items": return "Llena tu menú";
    case "configure_rewards": return "Publica tus premios";
    case "enable_first_purchase_reward": return "Prende tu premio de bienvenida";
    case "get_first_scan": return "Tu primera visita con puntos";
    case "set_map_pin": return "Ponte en el mapa";
    default: return "Siguiente mejor acción";
  }
}

function getNbaFallbackBody(actionCode: string): string {
  switch (actionCode) {
    case "set_business_hours": return "Tu menú ya está adentro. Ponle tu horario para que tus clientes sepan cuándo ir — toma 2 minutos.";
    case "complete_profile": return "Completa tu perfil para que tus clientes puedan encontrarte y confiar más rápido en tu negocio.";
    case "add_menu_items": return "Agrega productos a tu menú para que tus clientes vean mejor lo que vendes.";
    case "configure_rewards": return "Crea tu primera recompensa para empezar a motivar visitas recurrentes.";
    case "enable_first_purchase_reward": return "Tu recompensa de bienvenida está apagada, y mientras siga así tu local cuenta como incompleto: no aparece en las búsquedas ni en el feed de la app, y el escáner de puntos y el cobro en línea quedan en pausa. Es el gancho que convierte a un cliente nuevo en uno que regresa — préndela en Recompensas, toma un minuto.";
    case "get_first_scan": return "Tu primera visita con puntos sale de la Caja: cobra y pídele su WhatsApp. El cliente no necesita traer la app.";
    case "review_rewards": return "Revisa tu recompensa. Puede ser una oportunidad para hacerla más atractiva y lograr más redenciones.";
    case "lower_reward_threshold": return "Tu recompensa requiere demasiadas visitas. La mayoría de tus clientes se van antes de ganarla — bajar el umbral puede duplicar tus canjes.";
    case "add_google_review_link": return "Pega tu link de reseñas de Google en el perfil de tu local. Cada vez que un cliente escanee, Comeleal le ofrece dejarte reseña justo cuando acaba de ganar puntos — reseñas de clientes reales, sin que tú hagas nada.";
    case "send_winback": return "Tienes clientes que no han regresado en más de 14 días. Un mensaje personalizado puede traerlos de vuelta.";
    case "grow_phone_capture": return "Comeleal ya está recuperando a tus clientes de la app con notificaciones automáticas. Tu mejor jugada: pide el número de WhatsApp en cada cobro — así los próximos los recuperas tú en persona.";
    case "set_map_pin": return "Tu negocio no aparece en el mapa de Comeleal — los clientes cercanos no te encuentran (tu QR y tu link sí funcionan). Ponte en el mapa: toma 1 minuto y es una sola vez.";
    case "healthy":
    case "keep_going":
    case "stable": return "Tu negocio va avanzando. Pide el número en cada cobro y mantén tu recompensa clara.";
    default: return "Estamos preparando tus recomendaciones. Cuando tengas más actividad, Comeleal te mostrará el siguiente mejor paso.";
  }
}

function getNbaCtaLabel(actionCode: string, atRiskCount: number): string {
  switch (actionCode) {
    case "set_business_hours": return "Poner mi horario — 2 min";
    case "send_winback": return atRiskCount > 0 ? `Ver ${atRiskCount} clientes ahora` : "Ver clientes en riesgo";
    case "add_google_review_link": return "Poner mi link de reseñas";
    case "set_map_pin": return "Ponerme en el mapa — 1 min";
    case "check_ai_draft": return "Revisar borrador de recompensa";
    case "enable_first_purchase_reward": return "Prender recompensa de bienvenida";
    case "grow_phone_capture": return "Cobrar con número en la Caja";
    case "share_with_customers": return "Compartir mi menú";
    case "stable": return "Ver reportes";
    case "complete_profile": return "Completar perfil";
    case "add_menu_items": return "Agregar productos";
    case "lower_reward_threshold":
    case "configure_rewards":
    case "review_rewards": return "Configurar recompensas";
    case "get_first_scan": return "Cobrar con número";
    case "healthy":
    case "keep_going": return "Compartir mi menú";
    default: return "Ver recompensas";
  }
}

function getNbaCtaHref(actionCode: string): string {
  switch (actionCode) {
    case "set_business_hours": return "/vendor/setup/horario";
    case "complete_profile": return "/vendor/configuracion";
    case "add_google_review_link": return "/vendor/configuracion";
    case "set_map_pin": return "/vendor/configuracion";
    case "check_ai_draft": return "/vendor/recompensas";
    case "grow_phone_capture": return "/vendor/pos";
    case "share_with_customers": return "#compartir-qr";
    case "stable": return "/vendor/reportes";
    case "add_menu_items": return "/vendor/menu";
    case "lower_reward_threshold":
    case "configure_rewards":
    case "enable_first_purchase_reward":
    case "review_rewards": return "/vendor/recompensas";
    case "get_first_scan": return "/vendor/pos";
    case "healthy":
    case "keep_going": return "#compartir-qr";
    case "send_winback": return "/vendor/clientes";
    default: return "/vendor/recompensas";
  }
}

function AICoachPreviewCard({
  actionCode,
  nbaTitle,
  nbaBody,
  metrics,
  weeklyBriefText,
}: {
  actionCode: string;
  nbaTitle: string;
  nbaBody: string;
  metrics: NbaMetrics;
  weeklyBriefText?: string;
}) {
  const router = useRouter();

  const displayTitle = nbaTitle || "Siguiente mejor acción";
  const displayBody = nbaBody || getNbaFallbackBody(actionCode);
  const reachableRisk = metrics.atRiskReachableCount;
  const ctaLabel = actionCode === "send_winback" && typeof reachableRisk === "number" && reachableRisk > 0
    ? `Contactar ${reachableRisk} por WhatsApp`
    : getNbaCtaLabel(actionCode, metrics.atRiskCount);
  const ctaHref = getNbaCtaHref(actionCode);

  const parts: string[] = [];
  if (metrics.scans30d > 0) parts.push(`${metrics.scans30d} visitas`);
  if (metrics.redemptions30d > 0) parts.push(`${metrics.redemptions30d} canjes`);
  if (metrics.uniqueCustomers30d > 0) parts.push(`${metrics.uniqueCustomers30d} clientes`);
  const metricsLine = parts.length > 0 ? `Actividad: ${parts.join(" · ")} (últimos 30d)` : null;

  // Only surface a weekly insight when the AI actually produced one — never filler.
  const hasInsight = !!(weeklyBriefText && weeklyBriefText.trim());
  const compactInsight = hasInsight
    ? (weeklyBriefText!.length > 200 ? weeklyBriefText!.substring(0, 200) + "..." : weeklyBriefText!)
    : "";

  return (
    <div className="mb-6 overflow-hidden rounded-2xl"
      style={{
        background: "linear-gradient(135deg, #1C2526 0%, #2A3739 100%)",
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
      }}>
      <div className="p-6 text-white">
        
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-[20px]">🧠</span>
            <div>
              <p className="text-[14px] font-extrabold tracking-tight" style={{ color: "#FF9A45" }}>Comeleal AI</p>
              <p className="text-[11px] text-white/50 font-medium">Tu asistente de negocio con IA</p>
            </div>
          </div>
          <button
            onClick={() => router.push(`${window.location.pathname}?ai=1`)}
            className="rounded-full px-3.5 py-1 text-[11.5px] font-bold text-[#FF9A45] transition hover:bg-white/5"
            style={{ border: "1px solid rgba(255,154,69,0.3)" }}>
            Abrir Comeleal AI →
          </button>
        </div>

        {/* Next best action — the hero, full width, real button */}
        <div className="rounded-xl p-5"
          style={{ background: "rgba(255,154,69,0.06)", border: "1px solid rgba(255,154,69,0.15)" }}>
          <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[#FF9A45]">
            <span>⚡</span> Tu siguiente movimiento
          </p>
          <p className="text-[17px] font-extrabold leading-snug text-white">{displayTitle}</p>
          <p className="mt-2 text-[13px] leading-relaxed text-white/70">{displayBody}</p>

          {metricsLine && (
            <p className="mt-3 flex items-center gap-1.5 text-[11px] text-white/40">
              <span>📊</span> {metricsLine}
            </p>
          )}

          <a href={ctaHref}
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-[12.5px] font-bold text-[#1C2526] transition hover:opacity-90 active:scale-[0.98]"
            style={{ background: "#FF9A45" }}>
            {ctaLabel} <span>→</span>
          </a>
        </div>

        {/* Weekly insight — only when the AI has a real one, never a filler apology */}
        {hasInsight && (
          <div className="mt-3 flex gap-3 rounded-xl p-4"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
            <span className="shrink-0 text-[15px]">💡</span>
            <div>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-white/40">Consejo de la semana</p>
              <p className="text-[12px] leading-relaxed text-white/75">{compactInsight}</p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

/**
 * Free-tier loyalty quota card (docs/PRICING.md "cap honesto").
 * Below the cap: quiet progress counter. At the cap: it's a CELEBRATION with
 * an upgrade CTA — hitting 50 means the loyalty machine is working.
 */
function LoyaltyQuotaCard({ used, limit }: { used: number; limit: number }) {
  const full = used >= limit;
  const pct = Math.min(Math.round((used / Math.max(limit, 1)) * 100), 100);
  return (
    <div
      className="mb-6 rounded-2xl p-5"
      style={{
        background: full ? "rgba(242,140,56,0.08)" : "#ffffff",
        border: full ? "1px solid rgba(242,140,56,0.4)" : "1px solid rgba(28,37,38,0.06)",
        boxShadow: "0 2px 10px rgba(0,0,0,0.02)",
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-bold" style={{ color: "#1C2526" }}>
            {full
              ? `🎉 Lealtad llena — ${limit} visitas este mes`
              : `Lealtad este mes: ${used}/${limit} visitas`}
          </p>
          <p className="mt-0.5 text-[12px]" style={{ color: "rgba(28,37,38,0.5)" }}>
            {full
              ? "Tus clientes siguen guardándose en tu CRM, pero ya no suman puntos. Actívale ilimitado para que ninguno se quede sin premio."
              : "Cada venta con número o escaneo de app usa una visita. Con Pro son ilimitadas."}
          </p>
        </div>
        {full && (
          <Link
            href="/vendor/configuracion"
            className="shrink-0 rounded-xl px-4 py-2.5 text-[12px] font-bold text-[#1C2526] transition hover:opacity-90"
            style={{ background: "#F28C38" }}
          >
            Activar Pro · $299/mes →
          </Link>
        )}
      </div>
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full" style={{ background: "rgba(28,37,38,0.07)" }}>
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${pct}%`,
            background: full ? "#F28C38" : "linear-gradient(90deg, #FF9A45, #F28C38)",
          }}
        />
      </div>
    </div>
  );
}

function OwnerLookbackCard({ metrics }: { metrics: NbaMetrics }) {
  return (
    <div className="mb-5 rounded-2xl p-5"
      style={{
        background: "#ffffff",
        border: "1px solid rgba(28,37,38,0.07)",
        boxShadow: "0 1px 4px rgba(28,37,38,0.05)",
      }}>
      <p className="mb-4 text-[13px] font-bold" style={{ color: "rgba(28,37,38,0.8)" }}>
        Lealtad — últimos 30 días
      </p>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          { label: "Clientes únicos", value: metrics.uniqueCustomers30d },
          { label: "Visitas Comeleal", value: metrics.scans30d },
          { label: "Canjes", value: metrics.redemptions30d },
          { label: "Clientes en riesgo", value: metrics.atRiskCount },
        ].map(({ label, value }) => (
          <div key={label}>
            <p className="text-[11px]" style={{ color: "rgba(28,37,38,0.52)" }}>{label}</p>
            <p className="mt-1 text-[18px] font-bold tabular-nums" style={{ color: "#1C2526" }}>{value}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 flex gap-3">
        <Link href="/vendor/recompensas"
          className="flex-1 rounded-xl border py-2.5 text-center text-[12px] font-semibold transition hover:opacity-85"
          style={{ borderColor: "rgba(217,119,87,0.35)", color: "#F28C38" }}>
          Ver programa
        </Link>
        <Link href="/vendor/pos"
          className="flex-1 rounded-xl py-2.5 text-center text-[12px] font-semibold text-[#1C2526] transition hover:opacity-90"
          style={{ background: "#F28C38" }}>
          Cobrar con número
        </Link>
      </div>
    </div>
  );
}



// ─── Icons ────────────────────────────────────────────────────────────────────

// (AtRiskCustomersCard removed — lives in /vendor/clientes AI CRM)

function Spinner() {
  return (
    <svg className="h-5 w-5 animate-spin" style={{ color: "#F28C38" }} fill="none" viewBox="0 0 24 24">
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
