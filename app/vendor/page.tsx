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
  Timestamp,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import { fetchWithBilling } from "@/lib/subscription/billingDoc";
import { expectedDayProgressPercent } from "@/lib/schedule";
import { entitlementOf, accessExpiresAtMs } from "@/lib/subscription/entitlement";
import { isFounderTestRestaurant } from "@/lib/subscription/founderBypass";
import { trialClockState } from "@/lib/subscription/trialClock";
import { PRO_PRICE_LABEL } from "@/lib/subscription/pricing";
import { businessDayStartDaysAgo } from "@/lib/businessDay";
import { TrialClock } from "@/components/vendor/TrialClock";
import { waitForAuthReady } from "@/lib/auth";
import { resolveVendorContext, vendorHomeForRole } from "@/lib/vendorContext";
import type { User } from "firebase/auth";
import ManualCloseToggle from "./_components/ManualCloseToggle";
import MenuShareModal from "./_components/MenuShareModal";

// ─── Panel en 7 bloques (Ricardo, 9-sep-2026) ─────────────────────────────────
// Mismo orden de ideas que la app (owner_dashboard_screen.dart): "lo diario
// arriba, luego el marcador, luego el consejo, luego lo de vez en cuando".
//   Header + reloj de la prueba + brújula del setup (sin cambios)
//   1 Hoy · 2 Ventas con teléfono · 3 Tu siguiente movimiento ·
//   4 Clientes · últimos 30 días · 5 Pregúntale a Comeleal · 6 Herramientas
// Fuera: "Requieren tu atención" (ahora es UNA línea dentro de Hoy), "Top
// productos" (vive en Reportes), "Acciones rápidas", la gráfica de 7 días,
// "Actividad reciente" (solo listaba escaneos), "Capturas el número",
// Recuperados y los Atajos. Candado: scripts/validate-panel-order.mjs.

// ─── Types ────────────────────────────────────────────────────────────────────

type LoadState = "loading" | "ready" | "error";

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

/** Bloque 4 · Clientes · últimos 30 días. Espejo de OwnerLookbackService
 *  (app): cada cliente es un userId de visitHistory O un teléfono de 10
 *  dígitos de una venta pagada (`phone:<últimos 10>`). */
interface LookbackStats {
  /** Clientes distintos (app + teléfono). */
  withPhone: number;
  /** Con 2 o más visitas / ventas pagadas. */
  returned: number;
  returnRatePercent: number;
  redemptions: number;
  /** Visitas totales (escaneos + ventas con número). */
  visits: number;
}

interface DashboardData {
  restaurantId: string;
  restaurantName: string;
  scansToday: number;
  // Marcador del dueño (métrica dominante 8-sep): ventas pagadas de la semana
  // de negocio (7 jornadas, corte 4 AM) y cuántas traen teléfono.
  weekPaidSales: number;
  weekIdentifiedSales: number;
  weeklyBriefText?: string;
  atRiskCount?: number;
  isSetupComplete: boolean;
  setupIncompleteReasons: string[];
  /** `loyaltyReady` (5-sep): completo pero sin nada que ganar → false. */
  loyaltyReady: boolean;
  // NBA (Next Best Action) from vendorInsights/current
  nbaActionCode: string;
  nbaTitle: string;
  nbaBody: string;
  nbaMetrics: NbaMetrics;
  lookback: LookbackStats;
  // Revenue goal
  dailyGoal: number | null;
  ventasHoy: number;
  pedidosCola: number;
  /** Pedidos esperando (pending/preparing, jamás payment_pending) y la edad
   *  del más viejo — la línea de alerta dentro de Hoy. Espejo de la app. */
  pendingOrdersCount: number;
  oldestPendingMinutes: number;
  readyOrdersCount: number;
  /** Ticket promedio de HOY (ventas pagadas / pedidos pagados); null sin ventas. */
  avgTicketToday: number | null;
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
  isPro: boolean;
  /** El reloj de la prueba (TrialClock): campos canónicos de private/billing
   * leídos vía fetchWithBilling — jamás del doc público. */
  billingStatus: string | null;
  billingPlan: string | null;
  trialEndsAtMs: number | null;
  founderBypass: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Edad de un pedido en palabras llanas — espejo de formatOrderAge (app). */
function formatOrderAge(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h < 24) return m === 0 ? `${h} h` : `${h} h ${m} min`;
  const d = Math.floor(h / 24);
  const rh = h % 24;
  return rh === 0 ? `${d} d` : `${d} d ${rh} h`;
}

/** Últimos 10 dígitos del teléfono: "+52 614…" y "614…" son el MISMO
 *  cliente (canon de países de 10 dígitos). null si trae menos de 10. */
function phoneKeyOf(raw: unknown): string | null {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (digits.length < 10) return null;
  return `phone:${digits.slice(-10)}`;
}

/** Suma cada venta PAGADA con teléfono (≥10 dígitos) como una visita del
 *  cliente `phone:<últimos 10 dígitos>` — espejo de addPhoneSaleVisits en la
 *  app (owner_lookback_service.dart). Sin pagar o sin teléfono no cuenta. */
function addPhoneSaleVisits(
  visitCounts: Map<string, number>,
  paidOrders: Iterable<Record<string, unknown>>,
): void {
  for (const o of paidOrders) {
    if (o.paymentStatus !== "paid") continue;
    const key = phoneKeyOf(o.customerPhone);
    if (!key) continue;
    visitCounts.set(key, (visitCounts.get(key) ?? 0) + 1);
  }
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
      if (!u || u.isAnonymous) { router.push("/activar?modo=entrar"); return; }
      setUser(u);

      try {
        const db = getFirebaseDb();
        // Staff-aware: panel es de dueño/manager; empleado aterriza en la caja.
        const ctx = await resolveVendorContext(db, u.uid);
        if (!ctx) { router.push("/activar?modo=entrar"); return; }
        if (ctx.role === "employee") { router.push(vendorHomeForRole(ctx.role)); return; }

        const rid = ctx.restaurantId;

        const todayStart = (() => {
          const d = new Date(); d.setHours(0, 0, 0, 0);
          return Timestamp.fromDate(d);
        })();

        const thirtyDaysAgo = (() => {
          const d = new Date(); d.setDate(d.getDate() - 30); d.setHours(0, 0, 0, 0);
          return Timestamp.fromDate(d);
        })();

        // Cuatro lecturas y ya (9-sep): restaurante, consejo, pedidos de hoy y
        // pedidos de 30 días, más visitHistory de 30 días (de ahí salen los
        // escaneos de hoy Y el bloque de Clientes — antes eran tres queries a
        // visitHistory). Se fueron con sus secciones: reEngagementStats,
        // phoneCustomers (bienvenidas por vencer / win-back manual) y la
        // búsqueda de nombres en `users` para "Actividad reciente".
        const [restaurantSnap, insightsSnap, visits30dSnap, todayOrdersSnap, monthOrdersSnap] =
          await Promise.all([
            getDoc(doc(db, "restaurants", rid)),
            getDoc(doc(db, "restaurants", rid, "vendorInsights", "current")),
            getDocs(query(
              collection(db, "restaurants", rid, "visitHistory"),
              where("timestamp", ">=", thirtyDaysAgo)
            )),
            getDocs(query(
              collection(db, "restaurants", rid, "orders"),
              where("createdAt", ">=", todayStart)
            )),
            // 30d orders → marcador de la semana + Clientes 30 días.
            getDocs(query(
              collection(db, "restaurants", rid, "orders"),
              where("createdAt", ">=", thirtyDaysAgo)
            )).catch(() => null),
          ]);

        const r = restaurantSnap.data() ?? {};
        const ins = insightsSnap.exists() ? insightsSnap.data() : {};

        // ── Escaneos: hoy (badge "En vivo") y por cliente (Clientes 30 días) ──
        const todayStartMs = todayStart.toMillis();
        let scansToday = 0;
        const visitCounts = new Map<string, number>();
        visits30dSnap.forEach((d) => {
          const v = d.data();
          const ms = (v.timestamp as Timestamp | undefined)?.toMillis?.() ?? 0;
          if (ms >= todayStartMs) scansToday++;
          const userId = v.userId as string | undefined;
          if (!userId) return;
          visitCounts.set(userId, (visitCounts.get(userId) ?? 0) + 1);
        });

        // Calculate operational stats
        let ventasHoy = 0;
        let pedidosCola = 0;
        let cuentasAbiertas = 0;
        let paidCountToday = 0;
        let phoneSalesToday = 0;
        // Alerta de UNA línea dentro de Hoy (espejo de la app): pedidos
        // esperando = pending/preparing (nunca payment_pending); listos sin
        // entregar = ready.
        let pendingOrdersCount = 0;
        let oldestPendingMinutes = 0;
        let readyOrdersCount = 0;
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
          const createdMs = (o.createdAt as Timestamp | undefined)?.toMillis?.() ?? 0;

          // 1. Ventas hoy: only paid orders from today
          if (paymentStatus === "paid") {
            ventasHoy += total;
            paidCountToday++;
            if (phoneKeyOf(o.customerPhone)) phoneSalesToday++;
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
          if (status === "pending" || status === "preparing") {
            pendingOrdersCount++;
            const age = createdMs > 0 ? Math.max(0, Math.floor((ahora - createdMs) / 60000)) : 0;
            if (age > oldestPendingMinutes) oldestPendingMinutes = age;
          } else if (status === "ready") {
            readyOrdersCount++;
          }

          // 3. Cuentas abiertas: isOpenTab === true, status in ['pending', 'preparing', 'ready'], and paymentStatus !== 'paid'
          if (isOpenTab === true && ["pending", "preparing", "ready"].includes(status) && paymentStatus !== "paid") {
            cuentasAbiertas++;
          }
        });
        const avgTicketToday = paidCountToday > 0 ? ventasHoy / paidCountToday : null;

        // ── Marcador del dueño: ventas con teléfono ESTA SEMANA ──────────────
        // Misma regla que scripts/ventasIdentificadasReadOnly.js (FOODPASS) y
        // que la tarjeta espejo de la app: pagada + customerPhone de 10 dígitos,
        // dentro de las últimas 7 jornadas (corte 4 AM, businessDayStartDaysAgo).
        const weekStartMs = businessDayStartDaysAgo(6).getTime();
        let weekPaidSales = 0, weekIdentifiedSales = 0;
        monthOrdersSnap?.forEach((d) => {
          const o = d.data();
          if (o.paymentStatus !== "paid") return;
          const t = o.createdAt?.toMillis?.() ?? 0;
          if (t < weekStartMs) return;
          weekPaidSales++;
          const ph = String(o.customerPhone ?? "").replace(/\D/g, "");
          if (ph.length >= 10) weekIdentifiedSales++;
        });

        // ── Clientes · últimos 30 días (espejo de OwnerLookbackService) ──────
        // Cada venta PAGADA con teléfono de 10 dígitos es una visita del
        // cliente `phone:<últimos 10>`; los escaneos de la app ya están en
        // visitCounts por userId. Sin doble conteo: un cliente con app no
        // deja su número en la Caja y viceversa.
        const monthOrders: Record<string, unknown>[] = [];
        let phoneRedemptions30d = 0;
        monthOrdersSnap?.forEach((d) => {
          const o = d.data() as Record<string, unknown>;
          monthOrders.push(o);
          if (o.redemptionResult === "applied") phoneRedemptions30d++;
        });
        addPhoneSaleVisits(visitCounts, monthOrders);
        let returnedCustomers = 0;
        let visits30d = 0;
        visitCounts.forEach((count) => {
          visits30d += count;
          if (count >= 2) returnedCustomers++;
        });
        const uniqueCustomers30d = visitCounts.size;
        // ── Plan (sin tope de lealtad desde el 8-sep) ─────────────────────────
        // private/billing (plan) y private/usage (scanCount) mandan desde la
        // migración 24-ago — el doc público ya no trae ni el plan ni la
        // estadística. El contador de visitas ya NO es una cuota: la reja de
        // Pro vive en la Caja (historial, 2° cajero, mesas) — PRICING.md v2.0.
        const rTruth = await fetchWithBilling(db, rid, r as Record<string, unknown>);
        const isPro = entitlementOf(rTruth).isPro;
        const billingStatus = (rTruth.subscriptionAccessStatus as string | undefined) ?? null;
        const billingPlan = (rTruth.subscriptionPlan as string | undefined) ?? null;
        const trialEndsAtMs = accessExpiresAtMs(rTruth.subscriptionTrialEndsAt);
        const founderBypass = isFounderTestRestaurant(rid);

        const insMetrics = (ins?.metrics ?? {}) as Record<string, unknown>;

        // El consejo lo calcula restaurant_brain y se guarda en Firestore; solo
        // se recalcula en el refresco DIARIO o al aplicar un borrador de
        // recompensas — nunca al terminar el setup. O sea que un dueño que acaba
        // de completar su perfil sigue leyendo "Completa tu perfil" hasta 24
        // horas, y el panel parece roto justo el dia que se dio de alta. Aqui
        // manda el doc VIVO del restaurante, que si esta al dia.
        const brainActionCode = (ins?.actionCode as string) ?? "unknown";
        // La fecha VIVA de la prueba manda sobre el consejo guardado (9-sep):
        // el cerebro escribe "termina el viernes" en el refresco de las 4 AM y
        // la franja de arriba ya decía "terminó" — dos voces en un panel.
        const trialState = trialClockState({
          status: billingStatus,
          plan: billingPlan,
          trialEndsAt: trialEndsAtMs,
          now: Date.now(),
          founder: founderBypass,
        }).state;
        const nbaCode = resolveNbaActionCode(
            brainActionCode,
            (r.isSetupComplete as boolean) ?? true,
            (r.setupIncompleteReasons as string[]) ?? [],
            r.loyaltyReady !== false,
            trialState,
        );
        const nbaOverridden = nbaCode !== brainActionCode;

        const lookback: LookbackStats = {
          withPhone: uniqueCustomers30d,
          returned: returnedCustomers,
          returnRatePercent: uniqueCustomers30d > 0 ? (returnedCustomers / uniqueCustomers30d) * 100 : 0,
          redemptions: ((insMetrics.redemptions30d as number) ?? 0) + phoneRedemptions30d,
          visits: visits30d,
        };

        setData({
          restaurantId: rid,
          restaurantName: (r.name as string) ?? "Mi restaurante",
          // Visitas hoy = app scans + ventas pagadas con número (badge "En vivo").
          scansToday: scansToday + phoneSalesToday,
          weekPaidSales,
          weekIdentifiedSales,
          weeklyBriefText: ins?.weeklyBriefText as string | undefined,
          atRiskCount: (insMetrics.atRiskCount as number | undefined) ?? (ins?.atRiskCount as number | undefined),
          isSetupComplete: (r.isSetupComplete as boolean) ?? true,
          setupIncompleteReasons: (r.setupIncompleteReasons as string[]) ?? [],
          loyaltyReady: r.loyaltyReady !== false,
          nbaActionCode: nbaCode,
          nbaTitle: nbaOverridden
            ? getNbaFallbackTitle(nbaCode)
            : ((ins?.title_es as string) ?? getNbaFallbackTitle(nbaCode)),
          // Si el codigo se corrigio, el texto guardado por el cerebro habla de
          // OTRA accion: dejarlo pone "Completa tu perfil" arriba de un boton que
          // dice "Cobrar con numero". El texto tiene que venir del codigo que se
          // esta mostrando, no del que el cerebro creia.
          nbaBody: nbaOverridden
            ? getNbaFallbackBody(nbaCode, r.loyaltyReady !== false)
            : ((ins?.body_es as string) ?? ""),
          nbaMetrics: {
            atRiskCount: (insMetrics.atRiskCount as number) ?? 0,
            atRiskReachableCount: (insMetrics.atRiskReachableCount as number | null | undefined) ?? null,
            atRiskTotalCount: (insMetrics.atRiskTotalCount as number | null | undefined) ?? null,
            // Los mismos números que el bloque de Clientes (escaneos + ventas
            // con número, contados aquí, no por el cerebro): una sola verdad.
            scans30d: lookback.visits,
            redemptions30d: lookback.redemptions,
            uniqueCustomers30d: lookback.withPhone,
            menuItemCount: (insMetrics.menuItemCount as number) ?? 0,
            rewardCount: (insMetrics.rewardCount as number) ?? 0,
          },
          lookback,
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
          pendingOrdersCount,
          oldestPendingMinutes,
          readyOrdersCount,
          avgTicketToday,
          cuentasAbiertas,
          isPro,
          billingStatus,
          billingPlan,
          trialEndsAtMs,
          founderBypass,
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

        {/* ── El reloj de la prueba (9-sep): franja bajo el header, nunca modal.
            Lee private/billing (fetchWithBilling) — counting / endingSoon /
            ended; oculto para quien paga Pro y para el bypass de fundador. */}
        <TrialClock
          restaurantId={data.restaurantId}
          status={data.billingStatus}
          plan={data.billingPlan}
          trialEndsAt={data.trialEndsAtMs}
          founder={data.founderBypass}
        />

        {/* ── Page content ── (día cero: columna con tope — en monitor ancho
            las tarjetas full-width se volvían salchichas de un metro) */}
        <main className={`flex-1 px-4 pb-16 pt-5 md:px-8 md:pt-7${firstDay ? " mx-auto w-full max-w-3xl" : ""}`}>

          {/* Día cero: la brújula VA PRIMERO — la acción principal de un
              restaurante sin terminar de nacer es terminar de nacer, no
              "Nueva venta" (cazado por Ricardo en el primer claim). */}
          {!data.isSetupComplete && (
            <SetupBanner reasons={data.setupIncompleteReasons} />
          )}

          {/* Mobile primary CTA — la venta ES el loop. En teléfono el header
              solo trae el pill "Cobrar"; este es el "Nueva venta" del header
              en versión móvil. */}
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

          {/* ── 1 · Hoy (oculto el primer día: puro cero) ── */}
          {!firstDay && (
            <TodayCard
              ventasHoy={data.ventasHoy}
              dailyRevenueGoal={data.dailyRevenueGoal}
              metaPaceLabel={data.metaPaceLabel}
              pedidosCola={data.pedidosCola}
              cuentasAbiertas={data.cuentasAbiertas}
              avgTicketToday={data.avgTicketToday}
              pulseLastHourCount={data.pulseLastHourCount}
              pulseLastHourRevenue={data.pulseLastHourRevenue}
              pulsePrevHourCount={data.pulsePrevHourCount}
              pendingOrdersCount={data.pendingOrdersCount}
              oldestPendingMinutes={data.oldestPendingMinutes}
              readyOrdersCount={data.readyOrdersCount}
            />
          )}

          {/* ── 2 · Ventas con teléfono — el marcador (métrica dominante 8-sep) ── */}
          {!firstDay && <IdentifiedSalesCard data={data} />}

          {/* ── 3 · Tu siguiente movimiento ── */}
          <AICoachPreviewCard
            actionCode={data.nbaActionCode}
            nbaTitle={data.nbaTitle}
            nbaBody={data.nbaBody}
            metrics={data.nbaMetrics}
            weeklyBriefText={data.weeklyBriefText}
          />

          {/* ── 4 · Clientes · últimos 30 días ── */}
          {!firstDay && (
            <OwnerLookbackCard stats={data.lookback} atRiskCount={data.atRiskCount ?? 0} />
          )}

          {/* ── 5 · Pregúntale a Comeleal (compacto) ── */}
          <AskComelealCard setupIncomplete={!data.isSetupComplete} />

          {/* ── 6 · Herramientas — lo de vez en cuando ── */}
          <ToolsGrid restaurantId={data.restaurantId} />
        </main>
    </>
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
  loyaltyReady = true,
  trialState: "counting" | "endingSoon" | "ended" | "hidden" = "hidden",
): string {
  // Consejos de la prueba: el cerebro los guarda en el refresco DIARIO y la
  // fecha de fin se lee en vivo. Si ya venció, "termina el viernes" es mentira
  // → se vuelve "terminó"; si ya no hay prueba (compró Pro, o pasaron los 7
  // días), el consejo de prueba se descarta. Espejo de la app (NBA card).
  if (brainActionCode === "trial_ending_soon" && trialState !== "counting" && trialState !== "endingSoon") {
    return trialState === "ended" ? "trial_ended" : "keep_going";
  }
  if (brainActionCode === "trial_ended" && trialState !== "ended") return "keep_going";
  // Completo pero SIN nada que ganar (premios apagados a propósito, 5-sep):
  // el escáner está en pausa, así que "tu primera visita con puntos" sería
  // mentira. El único siguiente paso de lealtad es ponerle un premio — y el
  // cerebro lo argumenta con sus números. Espejo de la app (NBA card).
  if (isSetupComplete && !loyaltyReady) {
    if (brainActionCode === "configure_rewards" || brainActionCode === "enable_first_purchase_reward") {
      return brainActionCode;
    }
    if (SETUP_BLOCKING_NBA.has(brainActionCode) || brainActionCode === "get_first_scan" || brainActionCode === "unknown") {
      return "configure_rewards";
    }
    return brainActionCode;
  }
  if (isSetupComplete && SETUP_BLOCKING_NBA.has(brainActionCode)) return "get_first_scan";
  // check_ai_draft es MÁS específico que el fallback del readiness: el cerebro
  // ya sabe que hay una propuesta esperando. Sobrescribirlo por
  // "configure_rewards" borraba la mención del borrador justo para el dueño
  // atorado que más la necesita (muro #1 del embudo, cazado 1-sep).
  if (brainActionCode === "check_ai_draft") return brainActionCode;
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
    // 7-sep: premios sin ser pared — el cerebro pide en orden venta → número → premio.
    case "ring_first_sale": return "Cobra tu primera venta";
    // 10-sep: pedidos del link que el dueño cobró por WhatsApp pero nunca marcó.
    case "charge_web_orders": return "Tienes pedidos del link sin cobrar";
    case "grow_phone_capture": return "Pide el número en cada venta";
    case "set_map_pin": return "Ponte en el mapa";
    case "check_ai_draft": return "Tus premios ya están armados";
    case "trial_ending_soon": return "Tu prueba de Pro está por terminar";
    case "trial_ended": return "Tu prueba de Pro terminó";
    default: return "Siguiente mejor acción";
  }
}

function getNbaFallbackBody(actionCode: string, loyaltyReady = true): string {
  // Completo pero sin nada que ganar (5-sep): la consecuencia real es el
  // escáner en pausa y no salir en la app de puntos — no "incompleto".
  if (actionCode === "configure_rewards" && !loyaltyReady) {
    return "Tu local ya está completo. Sin un premio, el escáner queda en pausa y no sales en la app de puntos; tu Caja, tu menú y tu QR siguen igual. Ponle un premio: la IA te lo arma con tu menú en 30 segundos.";
  }
  switch (actionCode) {
    case "set_business_hours": return "Tu menú ya está adentro. Ponle tu horario para que tus clientes sepan cuándo ir — toma 2 minutos.";
    case "complete_profile": return "Completa tu perfil para que tus clientes puedan encontrarte y confiar más rápido en tu negocio.";
    case "add_menu_items": return "Agrega productos a tu menú para que tus clientes vean mejor lo que vendes.";
    case "configure_rewards": return "Tus clientes ya pueden juntar puntos contigo, pero hoy no ganan nada. Ponles un premio: la IA te lo arma con tu menú en 30 segundos.";
    case "enable_first_purchase_reward": return "Tu bienvenida está apagada. Es el regalo que se gana en la primera visita y se cobra en la segunda: la razón para volver. Préndela en Recompensas, toma un minuto.";
    case "get_first_scan": return "Tu primera visita con puntos sale de la Caja: cobra y pídele su WhatsApp. El cliente no necesita traer la app.";
    case "ring_first_sale": return "Tu menú, tu horario y tu QR ya están listos. Cobra tu siguiente venta en la Caja: llevas tus ventas del día y, si pides el número, empiezas tu lista de clientes. Toma 10 segundos.";
    case "charge_web_orders": return "Te llegaron pedidos por tu link que siguen sin cobrar en Comeleal. Si ya te pagaron, entra a Pedidos y toca con qué te pagaron: queda cobrado y entregado en un toque, y el cliente recibe sus puntos.";
    case "review_rewards": return "Revisa tu recompensa. Puede ser una oportunidad para hacerla más atractiva y lograr más redenciones.";
    case "lower_reward_threshold": return "Tu recompensa requiere demasiadas visitas. La mayoría de tus clientes se van antes de ganarla — bajar el umbral puede duplicar tus canjes.";
    case "add_google_review_link": return "Pega tu link de reseñas de Google en el perfil de tu local. Cada vez que un cliente escanee, Comeleal le ofrece dejarte reseña justo cuando acaba de ganar puntos — reseñas de clientes reales, sin que tú hagas nada.";
    case "send_winback": return "Tienes clientes que no han regresado en más de 14 días. Un mensaje personalizado puede traerlos de vuelta.";
    case "grow_phone_capture":
      // Sin premio no se prometen puntos: el número es para SU lista.
      if (!loyaltyReady) return "Ya cobras en la Caja, pero sin pedir el número tu lista de clientes está vacía. Pídelo en cada cobro (\"¿tu número, para avisarte de promos?\"): cada número es un cliente al que puedes escribirle cuando quieras.";
      return "Comeleal ya está recuperando a tus clientes de la app con notificaciones automáticas. Tu mejor jugada: pide el número de WhatsApp en cada cobro — así los próximos los recuperas tú en persona.";
    case "set_map_pin": return "Tu negocio no aparece en el mapa de Comeleal — los clientes cercanos no te encuentran (tu QR y tu link sí funcionan). Ponte en el mapa: toma 1 minuto y es una sola vez.";
    case "check_ai_draft": return "Comeleal ya te armó una propuesta de premios con tu propio menú: bienvenida y niveles con números que cuidan tu margen. Revísala y actívala con un toque — es lo único que falta para prender tu escáner de puntos.";
    case "trial_ending_soon": return `Tu prueba de Pro termina pronto. Al terminar se cierran las mesas y el segundo PIN; cobras igual. Sigue con Pro por ${PRO_PRICE_LABEL} al mes para no perderlo.`;
    case "trial_ended": return `Tu prueba terminó y se cerraron las mesas y el segundo PIN. Cobras igual. Volver a Pro son ${PRO_PRICE_LABEL} al mes.`;
    case "healthy":
    case "keep_going":
    case "stable":
      if (!loyaltyReady) return "Tu negocio va avanzando. Sigue cobrando en la Caja y pidiendo el número; cuando quieras que tus clientes vuelvan por algo, ponles un premio.";
      return "Tu negocio va avanzando. Pide el número en cada cobro y mantén tu recompensa clara.";
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
    case "ring_first_sale": return "Abrir la Caja";
    case "charge_web_orders": return "Cobrarlos en Pedidos";
    case "share_with_customers": return "Compartir mi menú";
    case "stable": return "Ver reportes";
    case "complete_profile": return "Completar perfil";
    case "add_menu_items": return "Agregar productos";
    case "lower_reward_threshold":
    case "configure_rewards":
    case "review_rewards": return "Configurar recompensas";
    case "get_first_scan": return "Cobrar con número";
    case "trial_ending_soon": return "Seguir con Pro";
    case "trial_ended": return "Volver a Pro";
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
    case "ring_first_sale": return "/vendor/pos";
    case "charge_web_orders": return "/vendor/pedidos";
    case "share_with_customers": return "#compartir-qr";
    case "stable": return "/vendor/reportes";
    case "add_menu_items": return "/vendor/menu"; // 9-sep: el editor dentro del panel
    case "lower_reward_threshold":
    case "configure_rewards":
    case "enable_first_purchase_reward":
    case "review_rewards": return "/vendor/recompensas";
    case "get_first_scan": return "/vendor/pos";
    case "healthy":
    case "keep_going": return "#compartir-qr";
    case "send_winback": return "/vendor/clientes";
    case "trial_ending_soon":
    case "trial_ended": return "/vendor/plan";
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

// ─── Bloques del panel (9-sep-2026) ───────────────────────────────────────────

const CARD_STYLE: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid rgba(28,37,38,0.07)",
  boxShadow: "0 1px 4px rgba(28,37,38,0.05)",
};

function SectionKicker({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 text-[13px] font-bold uppercase tracking-wider" style={{ color: "rgba(28,37,38,0.4)" }}>
      {children}
    </h2>
  );
}

/** 1 · Hoy — $ del día, meta, pedidos en cola, cuentas abiertas, ticket, y
 *  UNA línea de alerta de pedidos esperando (→ Pedidos). Espejo de
 *  TodayOverviewCard (app). */
function TodayCard({
  ventasHoy, dailyRevenueGoal, metaPaceLabel, pedidosCola, cuentasAbiertas, avgTicketToday,
  pulseLastHourCount, pulseLastHourRevenue, pulsePrevHourCount,
  pendingOrdersCount, oldestPendingMinutes, readyOrdersCount,
}: {
  ventasHoy: number;
  dailyRevenueGoal: number | null;
  metaPaceLabel: string | null;
  pedidosCola: number;
  cuentasAbiertas: number;
  avgTicketToday: number | null;
  pulseLastHourCount: number;
  pulseLastHourRevenue: number;
  pulsePrevHourCount: number;
  pendingOrdersCount: number;
  oldestPendingMinutes: number;
  readyOrdersCount: number;
}) {
  const money = (n: number) =>
    `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const metaPct = dailyRevenueGoal ? Math.round((ventasHoy / dailyRevenueGoal) * 100) : null;

  // La alerta: pedidos esperando (o listos sin entregar cuando no hay
  // pendientes). Rojo cuando el más viejo pasa de 20 min.
  const alert = pendingOrdersCount > 0
    ? {
        text: `${pendingOrdersCount} pedido${pendingOrdersCount !== 1 ? "s" : ""} esperando · el más viejo ${formatOrderAge(oldestPendingMinutes)}`,
        severe: oldestPendingMinutes > 20,
      }
    : readyOrdersCount > 0
    ? { text: `${readyOrdersCount} listo${readyOrdersCount !== 1 ? "s" : ""} sin entregar`, severe: false }
    : null;

  return (
    <section className="mb-6">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <SectionKicker>Hoy</SectionKicker>
        {/* Pulso en vivo — joya robada de la app: última hora + tendencia */}
        <p className="mb-3 text-[11px] font-semibold" style={{ color: "rgba(28,37,38,0.45)" }}>
          ⚡ Última hora: {pulseLastHourCount} pedido{pulseLastHourCount === 1 ? "" : "s"}
          {pulseLastHourCount > 0 ? ` · $${pulseLastHourRevenue.toLocaleString("es-MX")}` : ""}
          {pulseLastHourCount > pulsePrevHourCount ? " ↑" : pulseLastHourCount < pulsePrevHourCount ? " ↓" : ""}
        </p>
      </div>
      <div className="rounded-2xl p-5" style={CARD_STYLE}>
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div className="min-w-0">
            <p className="text-[12px] font-bold" style={{ color: "rgba(28,37,38,0.5)" }}>Ventas hoy</p>
            <p className="mt-1 text-[30px] font-extrabold leading-none tracking-tight tabular-nums" style={{ color: "#1C2526" }}>
              {money(ventasHoy)}
            </p>
            {dailyRevenueGoal ? (
              <p className="mt-2 text-[12px] font-semibold" style={{ color: "rgba(28,37,38,0.5)" }}>
                Meta: ${dailyRevenueGoal.toLocaleString("es-MX")} · <span style={{ color: "#1C2526" }}>{metaPct}%</span>
                {metaPaceLabel ? (
                  <>
                    {" · "}
                    <span style={{ color: metaPaceLabel === "Atrasado" ? "#DC2626" : metaPaceLabel === "En camino" ? "rgba(28,37,38,0.45)" : "#16A34A" }}>
                      {metaPaceLabel}
                    </span>
                  </>
                ) : null}
              </p>
            ) : (
              <Link href="/vendor/reportes" className="mt-2 inline-block text-[11px] font-semibold text-[#F28C38] hover:underline">
                Ver reportes →
              </Link>
            )}
          </div>
          <div className="grid grid-cols-3 gap-x-5 gap-y-1">
            <Link href="/vendor/pedidos" className="group">
              <p className="text-[11px] font-medium" style={{ color: "rgba(28,37,38,0.52)" }}>Pedidos en cola</p>
              <p className="mt-1 text-[16px] font-bold tabular-nums group-hover:underline" style={{ color: "#1C2526" }}>{pedidosCola}</p>
            </Link>
            <Link href="/vendor/pos" className="group">
              <p className="text-[11px] font-medium" style={{ color: "rgba(28,37,38,0.52)" }}>Cuentas abiertas</p>
              <p className="mt-1 text-[16px] font-bold tabular-nums group-hover:underline" style={{ color: "#1C2526" }}>{cuentasAbiertas}</p>
            </Link>
            <div>
              <p className="text-[11px] font-medium" style={{ color: "rgba(28,37,38,0.52)" }}>Ticket promedio</p>
              <p className="mt-1 text-[16px] font-bold tabular-nums" style={{ color: "#1C2526" }}>
                {avgTicketToday !== null ? money(avgTicketToday) : "—"}
              </p>
            </div>
          </div>
        </div>

        {alert && (
          <Link href="/vendor/pedidos"
            className="mt-4 flex items-center gap-2.5 rounded-xl px-3 py-2.5 transition hover:opacity-90"
            style={{
              background: alert.severe ? "rgba(220,38,38,0.08)" : "rgba(242,140,56,0.10)",
              color: "#1C2526",
            }}>
            <span className="text-[15px]">⏳</span>
            <span className="min-w-0 flex-1 text-[12.5px] font-semibold">{alert.text}</span>
            <span className="shrink-0 text-[12.5px] font-bold" style={{ color: alert.severe ? "#B91C1C" : "#E07830" }}>
              Ver →
            </span>
          </Link>
        )}
      </div>
    </section>
  );
}

/** 2 · Ventas con teléfono — el marcador (métrica dominante 8-sep): cuántas
 *  ventas de la semana de negocio sabe quién las hizo. Espejo de
 *  IdentifiedSalesCard (app). Candado: validate-identified-sales-card. */
function IdentifiedSalesCard({ data }: { data: Pick<DashboardData, "weekPaidSales" | "weekIdentifiedSales"> }) {
  const pct = data.weekPaidSales > 0 && data.weekIdentifiedSales > 0
    ? Math.round((100 * data.weekIdentifiedSales) / data.weekPaidSales)
    : null;
  return (
    <section className="mb-6">
      <Link href="/vendor/pos"
        className="group flex items-center gap-4 rounded-2xl p-5 transition-all hover:shadow-md"
        style={{ ...CARD_STYLE, border: "1px solid rgba(242,140,56,0.35)" }}>
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-[22px]"
          style={{ background: "rgba(242,140,56,0.12)" }}>
          🎯
        </div>
        <div className="min-w-0 flex-1">
          <span className="text-[12px] font-bold" style={{ color: "rgba(28,37,38,0.6)" }}>Ventas con teléfono</span>
          <div className="mt-0.5 flex items-end gap-2">
            <p className="text-[30px] font-extrabold leading-none tracking-tight tabular-nums"
              style={{ color: data.weekIdentifiedSales > 0 ? "#F28C38" : "#1C2526" }}>
              {data.weekIdentifiedSales}
            </p>
            {pct !== null && (
              <span className="mb-0.5 rounded-lg px-2 py-0.5 text-[11px] font-bold"
                style={{ background: "rgba(242,140,56,0.12)", color: "#E07830" }}>
                {pct}%
              </span>
            )}
          </div>
          <p className="mt-1.5 text-[12px] font-semibold" style={{ color: "rgba(28,37,38,0.55)" }}>
            {data.weekPaidSales > 0
              ? `esta semana · ${data.weekIdentifiedSales} de ${data.weekPaidSales}`
              : "Aún ninguna esta semana · pídelo al cobrar"}
          </p>
        </div>
        <span className="shrink-0 text-[12px] font-bold text-[#F28C38] group-hover:underline">Cobrar con número →</span>
      </Link>
    </section>
  );
}

/** 4 · Clientes · últimos 30 días — espejo de OwnerLookbackCard (app):
 *  Con teléfono · Volvieron · % que volvió · Premios canjeados. Sin escáner
 *  ni promesa de puntos: "Cada venta con número suma aquí." */
function OwnerLookbackCard({ stats, atRiskCount }: { stats: LookbackStats; atRiskCount: number }) {
  const lowSample = stats.withPhone < 5;
  return (
    <section className="mb-6">
      <SectionKicker>Clientes · últimos 30 días</SectionKicker>
      <div className="rounded-2xl p-5" style={CARD_STYLE}>
        {lowSample && (
          <p className="mb-4 text-[12px]" style={{ color: "rgba(28,37,38,0.6)" }}>
            Cada venta con número suma aquí.
          </p>
        )}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            { label: "Con teléfono", value: `${stats.withPhone}` },
            { label: "Volvieron", value: `${stats.returned}` },
            { label: "% que volvió", value: stats.withPhone > 0 ? `${Math.round(stats.returnRatePercent)}%` : "—" },
            { label: "Premios canjeados", value: `${stats.redemptions}` },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-[11px]" style={{ color: "rgba(28,37,38,0.52)" }}>{label}</p>
              <p className="mt-1 text-[18px] font-bold tabular-nums" style={{ color: "#1C2526" }}>{value}</p>
            </div>
          ))}
        </div>
        {/* En riesgo: solo cuando el consejo trae el dato (send_winback lo cubre). */}
        {atRiskCount > 0 && (
          <Link href="/vendor/clientes?segmento=riesgo"
            className="mt-4 flex items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-bold transition hover:opacity-90"
            style={{ background: "rgba(242,140,56,0.06)", border: "1px solid rgba(242,140,56,0.12)", color: "#E07830" }}>
            ⚠️ {atRiskCount} cliente{atRiskCount !== 1 ? "s" : ""} sin regresar en 14 días
            <span className="ml-auto">›</span>
          </Link>
        )}
        <div className="mt-4 flex gap-3">
          <Link href="/vendor/clientes"
            className="flex-1 rounded-xl py-2.5 text-center text-[12px] font-semibold text-[#1C2526] transition hover:opacity-90"
            style={{ background: "#F28C38" }}>
            Ver clientes
          </Link>
          <Link href="/vendor/recompensas"
            className="flex-1 rounded-xl border py-2.5 text-center text-[12px] font-semibold transition hover:opacity-85"
            style={{ borderColor: "rgba(217,119,87,0.35)", color: "#F28C38" }}>
            Recompensas
          </Link>
        </div>
      </div>
    </section>
  );
}

/** 5 · Pregúntale a Comeleal — compacto: campo + 2 preguntas. No es un chat
 *  nuevo: manda la pregunta a Comeleal AI (FloatingAI) por `?q=`, que ya
 *  la responde con datos reales. */
function AskComelealCard({ setupIncomplete }: { setupIncomplete: boolean }) {
  const router = useRouter();
  const [question, setQuestion] = useState("");
  // Día cero: "mejores clientes" a un local sin ventas garantiza un "no
  // tienes datos" (Ricardo, 26-ago) — se sugiere lo que la IA sí clava hoy.
  const chips = setupIncomplete
    ? ["¿Qué debo hacer esta semana?", "¿Cómo me llegan los pedidos?"]
    : ["¿Qué debo hacer esta semana?", "¿Cuáles son mis mejores clientes?"];

  const ask = (q: string) => {
    const clean = q.trim();
    if (!clean) return;
    router.push(`${window.location.pathname}?q=${encodeURIComponent(clean)}`);
  };

  return (
    <section className="mb-6">
      <div className="rounded-2xl p-5" style={CARD_STYLE}>
        <div className="flex items-center gap-2.5">
          <span className="text-[18px]">💬</span>
          <div>
            <p className="text-[14px] font-bold" style={{ color: "#1C2526" }}>Pregúntale a Comeleal</p>
            <p className="text-[11px]" style={{ color: "rgba(28,37,38,0.45)" }}>Responde con datos reales de tu negocio</p>
          </div>
        </div>
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => { e.preventDefault(); ask(question); }}>
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Escribe tu pregunta…"
            aria-label="Pregúntale a Comeleal"
            className="min-w-0 flex-1 rounded-xl px-3.5 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-[#F28C38]/40"
            style={{ background: "#F5F3EF", color: "#1C2526", border: "1px solid rgba(28,37,38,0.08)" }}
          />
          <button type="submit"
            className="shrink-0 rounded-xl px-4 py-2.5 text-[12.5px] font-bold text-[#1C2526] transition hover:opacity-90 active:scale-[0.98]"
            style={{ background: "#F28C38" }}>
            Preguntar
          </button>
        </form>
        <div className="mt-3 flex flex-wrap gap-2">
          {chips.map((c) => (
            <button key={c} type="button" onClick={() => ask(c)}
              className="rounded-full px-3 py-1.5 text-[12px] font-semibold transition hover:bg-[#F5F3EF]"
              style={{ border: "1px solid rgba(28,37,38,0.12)", color: "#1C2526" }}>
              {c}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

/** 6 · Herramientas — 2×2 (4 en fila en escritorio): Menú · Reportes ·
 *  Equipo · Tu QR. Debajo, en chico, "Ver mi menú" y "Ver mi página". */
function ToolsGrid({ restaurantId }: { restaurantId: string }) {
  // Tu QR abre el modal ÚNICO de compartir (MenuShareModal — tarjeta de
  // marca, QR local, link bonito, imprimir). `#compartir-qr` es el destino
  // de los consejos share_with_customers / healthy / keep_going.
  const [shareOpen, setShareOpen] = useState(false);
  const tileClass = "flex flex-col items-center justify-center gap-2 rounded-2xl px-2 py-5 text-center transition hover:bg-[#faf9f5] hover:shadow-md active:scale-[0.97]";
  const tiles: { emoji: string; label: string; href?: string; onClick?: () => void }[] = [
    { emoji: "🍽️", label: "Menú", href: "/vendor/menu" },
    { emoji: "📊", label: "Reportes", href: "/vendor/reportes" },
    { emoji: "👥", label: "Equipo", href: "/vendor/configuracion#equipo" },
    { emoji: "📲", label: "Tu QR", onClick: () => setShareOpen(true) },
  ];

  return (
    <section className="mb-6" id="compartir-qr">
      <SectionKicker>Herramientas</SectionKicker>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {tiles.map((t) => {
          const inner = (
            <>
              <span className="text-[24px]">{t.emoji}</span>
              <span className="text-[12px] font-semibold" style={{ color: "#1C2526" }}>{t.label}</span>
            </>
          );
          return t.href ? (
            <Link key={t.label} href={t.href} className={tileClass} style={CARD_STYLE}>{inner}</Link>
          ) : (
            <button key={t.label} type="button" onClick={t.onClick} className={tileClass} style={CARD_STYLE}>{inner}</button>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 px-1">
        {/* Ver el menú como lo ve el cliente, y la página pública /r/ (la
            que sale en Google; acepta el ID y redirige sola al slug). */}
        <a href={`/menu/${restaurantId}`} target="_blank" rel="noopener noreferrer"
          className="text-[12px] font-semibold text-[#F28C38] hover:underline">
          Ver mi menú ↗
        </a>
        <a href={`/r/${restaurantId}`} target="_blank" rel="noopener noreferrer"
          className="text-[12px] font-semibold text-[#F28C38] hover:underline">
          Ver mi página ↗
        </a>
      </div>
      <MenuShareModal
        restaurantId={restaurantId}
        open={shareOpen}
        onClose={() => setShareOpen(false)}
      />
    </section>
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
