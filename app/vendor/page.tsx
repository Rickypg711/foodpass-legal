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
import { waitForAuthReady } from "@/lib/auth";
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

        todayOrdersSnap.forEach((doc) => {
          const o = doc.data();
          const total = (o.total as number) ?? 0;
          const status = o.status as string;
          const isOpenTab = o.isOpenTab as boolean | undefined;
          const paymentStatus = o.paymentStatus as string | undefined;

          // 1. Ventas hoy: only paid orders from today
          if (paymentStatus === "paid") {
            ventasHoy += total;
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
        const subExp = r.subscriptionAccessExpiresAt as Timestamp | undefined;
        const subActive = !(subExp instanceof Timestamp) || subExp.toDate().getTime() > Date.now();
        const isPro =
          (r.plan === "pro" || r.subscriptionPlan === "pro") && subActive;
        const rawLimit = Number(r.monthlyLimit);
        const loyaltyLimit = Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : 50;
        const lastResetTs = r.lastReset as Timestamp | undefined;
        const lastResetDt = lastResetTs?.toDate?.();
        const nowDt = new Date();
        const inSameMonth =
          !!lastResetDt &&
          lastResetDt.getFullYear() === nowDt.getFullYear() &&
          lastResetDt.getMonth() === nowDt.getMonth();
        const loyaltyUsed = inSameMonth ? Number(r.scanCount ?? 0) || 0 : 0;

        const insMetrics = (ins?.metrics ?? {}) as Record<string, unknown>;
        setData({
          restaurantId: rid,
          restaurantName: (r.name as string) ?? "Mi restaurante",
          scanCountTotal: (r.scanCount as number) ?? 0,
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
          nbaActionCode: (ins?.actionCode as string) ?? "unknown",
          nbaTitle: (ins?.title_es as string) ?? "Siguiente mejor acción",
          nbaBody: (ins?.body_es as string) ?? "",
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
          className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white"
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
            {isLive && (
              <span className="flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold text-green-700"
                style={{ background: "#D1FAE5" }}>
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" />
                En vivo
              </span>
            )}
            <Link href="/vendor/scanner"
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-bold text-white"
              style={{ background: "#F28C38" }}>
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

        {/* ── Page content ── */}
        <main className="flex-1 px-4 pb-16 pt-5 md:px-8 md:pt-7">

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

          {/* ── Setup banner ── */}
          {!data.isSetupComplete && (
            <SetupBanner reasons={data.setupIncompleteReasons} />
          )}

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

          {/* ── Coach Comeleal AI Card ── */}
          <AICoachPreviewCard
            actionCode={data.nbaActionCode}
            nbaTitle={data.nbaTitle}
            nbaBody={data.nbaBody}
            metrics={data.nbaMetrics}
            weeklyBriefText={data.weeklyBriefText}
          />

          {/* ── Resumen de hoy ── */}
          <div className="mb-6">
            <h2 className="mb-3 text-[13px] font-bold uppercase tracking-wider" style={{ color: "rgba(28,37,38,0.4)" }}>
              Resumen de hoy
            </h2>
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

              <Link href="/vendor/scanner" className="group rounded-2xl p-5 transition-all hover:shadow-md hover:scale-[1.01]"
                style={{ background: "#ffffff", border: "1px solid rgba(28,37,38,0.06)", boxShadow: "0 2px 10px rgba(0,0,0,0.02)" }}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[12px] font-bold" style={{ color: "rgba(28,37,38,0.5)" }}>Clientes Comeleal hoy</span>
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl transition-colors group-hover:bg-[#F28C38]/10"
                    style={{ background: "rgba(242,140,56,0.08)", color: "#F28C38" }}>
                    📷
                  </div>
                </div>
                <p className="text-[26px] font-extrabold tracking-tight tabular-nums" style={{ color: "#1C2526" }}>
                  {data.scansToday}
                </p>
                <p className="mt-1 text-[11px] text-[#F28C38] font-semibold group-hover:underline">Escanear →</p>
              </Link>

            </div>
          </div>

          {/* ── Lealtad quota (free tier) — PRICING.md "cap honesto" ── */}
          {!data.isPro && (
            <LoyaltyQuotaCard used={data.loyaltyUsed} limit={data.loyaltyLimit} />
          )}

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
            <div className="mb-6 rounded-2xl p-5 flex flex-wrap items-center gap-x-5 gap-y-2"
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
            </div>
          )}

          {(data.winbackSent > 0 || data.expiryRemindersSent > 0) && (
            <div className="mb-6 rounded-2xl p-5"
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
                  Cliente con la app — suma su visita
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
                <span className="text-[26px]">📷</span>
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
                  Sin visitas aún — escanea tu primer cliente.
                </p>
              </div>
            )}
          </div>

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
            <Atajo href="/vendor/scanner" emoji="📷" label="Escanear" />
            <Atajo href="/vendor/clientes" emoji="👥" label="Clientes" />
            <Atajo href="/vendor?ai=1" emoji="🧠" label="Comeleal AI" />
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
    </>
  );
}

// ─── QR Card ──────────────────────────────────────────────────────────────────

function QrCard({ restaurantId, restaurantName }: { restaurantId: string; restaurantName: string }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const qrUrl = `https://comeleal.com/menu/${restaurantId}`;
  // NOTE: chart.googleapis.com QR API was shut down by Google — use qrserver.com instead.
  const qrImgSrc = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&ecc=M&data=${encodeURIComponent(qrUrl)}`;

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
          .logo{font-size:14px;font-weight:700;letter-spacing:.08em;color:#F28C38;
            margin-bottom:28px;text-transform:uppercase}
          img{width:260px;height:260px}
          h1{margin-top:24px;font-size:22px;font-weight:800;color:#141413;text-align:center}
          p{margin-top:8px;font-size:13px;color:#141413;opacity:.5;text-align:center;
            max-width:220px;line-height:1.5}
          .cta{margin-top:20px;font-size:15px;font-weight:700;color:#F28C38;text-align:center}
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

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(qrUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — the URL is still visible for manual copy */
    }
  }

  async function handleShare() {
    const shareData = {
      title: restaurantName,
      text: `Mira el menú de ${restaurantName} y gana puntos 🍽️`,
      url: qrUrl,
    };
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share(shareData); // native share sheet (WhatsApp, etc.)
      } else {
        await handleCopy(); // desktop / no share API → copy the link instead
      }
    } catch {
      /* user dismissed the share sheet — no-op */
    }
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
          {/* Primary: one-tap share to WhatsApp / anywhere */}
          <button
            onClick={handleShare}
            className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold text-white transition-all hover:opacity-90"
            style={{ background: "#F28C38" }}
          >
            📤 Compartir menú
          </button>
          {/* Secondary: copy link + print, side by side */}
          <div className="flex w-full gap-2">
            <button
              onClick={handleCopy}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition-all hover:bg-[#F28C38]/10"
              style={{ borderColor: "rgba(217,119,87,0.3)", color: "#F28C38", background: "rgba(217,119,87,0.05)" }}
            >
              {copied ? "✅ Copiado" : "🔗 Copiar enlace"}
            </button>
            <button
              onClick={handlePrint}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition-all hover:bg-[#F28C38]/10"
              style={{ borderColor: "rgba(217,119,87,0.3)", color: "#F28C38", background: "rgba(217,119,87,0.05)" }}
            >
              🖨️ Imprimir
            </button>
          </div>
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
        <span style={{ color: "#F28C38", fontSize: 12, fontWeight: 600 }}>Ver →</span>
      </div>

      {/* Progress bar */}
      <div className="mb-3 h-1.5 w-full rounded-full overflow-hidden" style={{ background: "rgba(28,37,38,0.07)" }}>
        <div className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: "linear-gradient(90deg, #FF9A45, #F28C38)" }} />
      </div>

      {/* Step chips */}
      <div className="flex gap-2 flex-wrap">
        {SETUP_STEPS.map((step) => {
          const pending = pendingKeys.has(step.key);
          return (
            <div key={step.key}
              className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
              style={pending
                ? { background: "rgba(217,119,87,0.1)", color: "#F28C38" }
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

function getNbaFallbackBody(actionCode: string): string {
  switch (actionCode) {
    case "complete_profile": return "Completa tu perfil para que tus clientes puedan encontrarte y confiar más rápido en tu negocio.";
    case "add_menu_items": return "Agrega productos a tu menú para que tus clientes vean mejor lo que vendes.";
    case "configure_rewards": return "Crea tu primera recompensa para empezar a motivar visitas recurrentes.";
    case "get_first_scan": return "Comparte tu QR con tus clientes para conseguir tus primeros escaneos.";
    case "review_rewards": return "Revisa tu recompensa. Puede ser una oportunidad para hacerla más atractiva y lograr más redenciones.";
    case "lower_reward_threshold": return "Tu recompensa requiere demasiadas visitas. La mayoría de tus clientes se van antes de ganarla — bajar el umbral puede duplicar tus canjes.";
    case "send_winback": return "Tienes clientes que no han regresado en más de 14 días. Un mensaje personalizado puede traerlos de vuelta.";
    case "grow_phone_capture": return "Comeleal ya está recuperando a tus clientes de la app con notificaciones automáticas. Tu mejor jugada: pide el número de WhatsApp en cada cobro — así los próximos los recuperas tú en persona.";
    case "healthy":
    case "keep_going":
    case "stable": return "Tu negocio va avanzando. Sigue compartiendo tu QR y mantén tus recompensas claras.";
    default: return "Estamos preparando tus recomendaciones. Cuando tengas más actividad, Comeleal te mostrará el siguiente mejor paso.";
  }
}

function getNbaCtaLabel(actionCode: string, atRiskCount: number): string {
  switch (actionCode) {
    case "send_winback": return atRiskCount > 0 ? `Ver ${atRiskCount} clientes ahora` : "Ver clientes en riesgo";
    case "check_ai_draft": return "Revisar borrador de recompensa";
    case "grow_phone_capture": return "Cobrar con número en la Caja";
    case "share_with_customers": return "Compartir mi menú";
    case "stable": return "Ver reportes";
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
    case "check_ai_draft": return "/vendor/recompensas";
    case "grow_phone_capture": return "/vendor/pos";
    case "share_with_customers": return "#compartir-qr";
    case "stable": return "/vendor/reportes";
    case "add_menu_items": return "/vendor/menu";
    case "lower_reward_threshold":
    case "configure_rewards":
    case "review_rewards": return "/vendor/recompensas";
    case "get_first_scan":
    case "healthy":
    case "keep_going": return "/vendor/scanner";
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
            className="shrink-0 rounded-xl px-4 py-2.5 text-[12px] font-bold text-white transition hover:opacity-90"
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
        <Link href="/vendor/scanner"
          className="flex-1 rounded-xl py-2.5 text-center text-[12px] font-semibold text-white transition hover:opacity-90"
          style={{ background: "#F28C38" }}>
          Escanear
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
