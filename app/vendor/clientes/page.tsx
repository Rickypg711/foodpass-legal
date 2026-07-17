"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { getFirebaseDb, getFirebaseFunctions } from "@/lib/firebase";
import { waitForAuthReady } from "@/lib/auth";

// ─── Types ────────────────────────────────────────────────────────────────────

type Segment = "campeon" | "regular" | "riesgo" | "perdido" | "nuevo";

interface Customer {
  userId: string;
  name: string;
  phone: string | null;
  totalVisits: number;
  totalPoints: number;
  lastVisit: Timestamp | null;
  daysSince: number;
  segment: Segment;
  /** Phone Points v1: phone-keyed account (no app) — restaurants/{rid}/phoneCustomers. */
  isPhoneOnly?: boolean;
  /** First-visit reward unlocked and not yet redeemed — the winback hook. */
  rewardUnlocked?: boolean;
  /** Days left in the 7-day claim window (mirrors the app's rule). */
  rewardDaysLeft?: number;
  /** Cancelled unpaid pay-at-pickup orders — repeat offenders flagged. */
  noShowCount?: number;
}

/** First-visit reward claim window — mirrors the app's _firstVisitClaimDays. */
const FIRST_VISIT_CLAIM_DAYS = 7;

// ─── Segment logic ────────────────────────────────────────────────────────────

function computeSegment(visits: number, daysSince: number): Segment {
  if (visits >= 5) return "campeon";
  if (visits === 1) return "nuevo";
  if (daysSince > 30) return "perdido";
  if (daysSince > 14) return "riesgo";
  return "regular";
}

const SEGMENT_META: Record<Segment, { label: string; emoji: string; bg: string; color: string }> = {
  campeon:  { label: "VIP",   emoji: "👑", bg: "rgba(255,180,0,0.1)",    color: "#b8860b" },
  regular:  { label: "Regular",   emoji: "🔁", bg: "rgba(59,130,246,0.1)",   color: "#2563eb" },
  riesgo:   { label: "En riesgo", emoji: "⚠️", bg: "rgba(239,68,68,0.1)",    color: "#dc2626" },
  perdido:  { label: "Perdido",   emoji: "💤", bg: "rgba(107,114,128,0.1)",  color: "#6b7280" },
  nuevo:    { label: "Nuevo",     emoji: "✨", bg: "rgba(217,119,87,0.1)",   color: "#F28C38" },
};

const TABS: { key: Segment | "todos"; label: string; emoji: string }[] = [
  { key: "todos",   label: "Todos",      emoji: "👥" },
  { key: "riesgo",  label: "En riesgo",  emoji: "⚠️" },
  { key: "perdido", label: "Perdidos",   emoji: "💤" },
  { key: "campeon", label: "VIP",  emoji: "👑" },
  { key: "regular", label: "Regulares",  emoji: "🔁" },
  { key: "nuevo",   label: "Nuevos",     emoji: "✨" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(ts: Timestamp | null): string {
  if (!ts) return "—";
  const diff = Math.floor((Date.now() - ts.toMillis()) / 1000);
  if (diff < 86400) return "hoy";
  if (diff < 604800) return `hace ${Math.floor(diff / 86400)}d`;
  if (diff < 2592000) return `hace ${Math.floor(diff / 604800)}sem`;
  return `hace ${Math.floor(diff / 2592000)}mes`;
}

function Spinner({ small = false }: { small?: boolean }) {
  const s = small ? "h-3.5 w-3.5" : "h-5 w-5";
  return (
    <svg className={`${s} animate-spin`} style={{ color: "#F28C38" }} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 12 5.373 12 12H4z" />
    </svg>
  );
}

function SegmentBadge({ segment }: { segment: Segment }) {
  const m = SEGMENT_META[segment];
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold"
      style={{ background: m.bg, color: m.color }}>
      {m.emoji} {m.label}
    </span>
  );
}

// ─── Customer card ────────────────────────────────────────────────────────────

function CustomerCard({
  customer,
  restaurantId,
  restaurantName,
  isActuaHoy = false,
}: {
  customer: Customer;
  restaurantId: string;
  restaurantName: string;
  isActuaHoy?: boolean;
}) {
  const [msgLoading, setMsgLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [msgError, setMsgError] = useState(false);

  /** Marks the winback tap on the phoneCustomer doc (closes the measure leg
   * of the loop — AI_NATIVE_CLOSED_LOOPS §3.1). Fire-and-forget. */
  function logPhoneWinbackTap(phone10: string) {
    updateDoc(
      doc(getFirebaseDb(), "restaurants", restaurantId, "phoneCustomers", phone10),
      { lastWinbackAt: serverTimestamp() },
    ).catch(() => {});
  }

  async function generateAndOpen() {
    if (!customer.phone) return;
    const phone10 = customer.phone.replace(/\D/g, "").slice(-10);
    if (msg) {
      const waUrl = `https://wa.me/${customer.phone.length === 10 ? `52${customer.phone}` : customer.phone.replace(/\D/g, "")}?text=${encodeURIComponent(msg)}`;
      window.open(waUrl, "_blank");
      return;
    }

    // Phone-only customers: no app user for the Gemini fn — build the message
    // locally from what we know (points + unclaimed reward = the hook).
    if (customer.isPhoneOnly) {
      const d = customer.rewardDaysLeft;
      const rewardLine = customer.rewardUnlocked
        ? d !== undefined && d <= 2
          ? ` Y tu premio de bienvenida vence ${d === 0 ? "HOY" : d === 1 ? "mañana" : "en 2 días"} 🎁⏰`
          : " Y tienes un premio de bienvenida sin usar 🎁"
        : "";
      const generated =
        `¡Hola${customer.name && !customer.name.startsWith("··") ? ` ${customer.name}` : ""}! ` +
        `Te extrañamos en ${restaurantName}. ` +
        `Tienes ${customer.totalPoints} punto${customer.totalPoints === 1 ? "" : "s"} guardados en tu número ⭐${rewardLine} ` +
        `¡Te esperamos pronto!`;
      setMsg(generated);
      logPhoneWinbackTap(phone10);
      const waUrl = `https://wa.me/52${phone10}?text=${encodeURIComponent(generated)}`;
      window.open(waUrl, "_blank");
      return;
    }

    setMsgLoading(true);
    setMsgError(false);
    try {
      const fn = httpsCallable<Record<string, unknown>, { message: string }>(
        getFirebaseFunctions(),
        "generateWinBackMessage"
      );
      const res = await fn({
        restaurantId,
        restaurantName,
        userId: customer.userId,
        customerName: customer.name,
        daysSinceVisit: customer.daysSince,
        daysSinceLastVisit: customer.daysSince,
        totalVisits: customer.totalVisits,
        pointsAvailable: customer.totalPoints,
      });
      const generated = res.data.message;
      setMsg(generated);
      const phone = customer.phone.replace(/\D/g, "");
      const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(generated)}`;
      window.open(waUrl, "_blank");
    } catch {
      setMsgError(true);
    } finally {
      setMsgLoading(false);
    }
  }

  const initials = (customer.name[0] ?? "C").toUpperCase();
  const m = SEGMENT_META[customer.segment];

  return (
    <div className={`rounded-2xl p-4 ${isActuaHoy ? "border-2" : "border"}`}
      style={{
        background: "#ffffff",
        borderColor: isActuaHoy ? "rgba(217,119,87,0.25)" : "rgba(28,37,38,0.07)",
        boxShadow: "0 1px 4px rgba(28,37,38,0.05)",
      }}>
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[14px] font-bold"
          style={{ background: m.bg, color: m.color }}>
          {initials}
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-[14px] font-bold truncate" style={{ color: "#1C2526" }}>
              {customer.name}
            </p>
            <SegmentBadge segment={customer.segment} />
            {customer.isPhoneOnly && (
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold"
                style={{ background: "rgba(37,211,102,0.12)", color: "#128C7E" }}>
                📱 Tel
              </span>
            )}
            {customer.rewardUnlocked && (
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold"
                style={
                  (customer.rewardDaysLeft ?? 9) <= 2
                    ? { background: "rgba(239,68,68,0.12)", color: "#dc2626" }
                    : { background: "rgba(255,180,0,0.12)", color: "#b8860b" }
                }>
                🎁 {(customer.rewardDaysLeft ?? 9) <= 2
                  ? `Premio vence ${customer.rewardDaysLeft === 0 ? "HOY" : customer.rewardDaysLeft === 1 ? "mañana" : "en 2d"}`
                  : "Premio sin usar"}
              </span>
            )}
            {(customer.noShowCount ?? 0) >= 2 && (
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold"
                style={{ background: "rgba(239,68,68,0.12)", color: "#dc2626" }}
                title="Pedidos 'pagar al recoger' cancelados sin pagar">
                ⚠️ {customer.noShowCount} no-shows
              </span>
            )}
          </div>
          <div className="mt-1 flex items-center gap-3 text-[11px]" style={{ color: "rgba(28,37,38,0.45)" }}>
            <span>{customer.totalVisits} visita{customer.totalVisits !== 1 ? "s" : ""}</span>
            <span>·</span>
            <span style={{ color: "#F28C38", fontWeight: 600 }}>{customer.totalPoints} pts</span>
            <span>·</span>
            <span>{timeAgo(customer.lastVisit)}</span>
          </div>
        </div>
      </div>

      {/* AI message preview (only for actúa hoy) */}
      {isActuaHoy && msg && (
        <div className="mt-3 rounded-xl p-3 text-[12px] leading-relaxed"
          style={{ background: "rgba(217,119,87,0.05)", border: "1px solid rgba(217,119,87,0.15)", color: "rgba(28,37,38,0.65)" }}>
          <p className="mb-1 text-[9px] font-bold uppercase tracking-widest" style={{ color: "rgba(217,119,87,0.7)" }}>
            Mensaje generado por AI
          </p>
          {msg}
        </div>
      )}

      {/* CTA */}
      <div className="mt-3 flex items-center gap-2">
        {customer.phone ? (
          <button
            onClick={generateAndOpen}
            disabled={msgLoading}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl py-2 text-[12px] font-bold text-white disabled:opacity-60"
            style={{ background: "#25D366" }}>
            {msgLoading ? <Spinner small /> : "📲"}
            {msgLoading ? "Generando mensaje..." : msg ? "Abrir WhatsApp" : "Contactar via WhatsApp"}
          </button>
        ) : (
          <span className="text-[11px]" style={{ color: "rgba(28,37,38,0.35)" }}>
            Sin número registrado
          </span>
        )}
        {msgError && (
          <span className="text-[11px]" style={{ color: "#dc2626" }}>Error, intenta de nuevo</span>
        )}
      </div>

    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ClientesPage() {
  const router = useRouter();
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [restaurantName, setRestaurantName] = useState<string>("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [winbackSent, setWinbackSent] = useState<number>(0);
  const [winbackReturned, setWinbackReturned] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<Segment | "todos">("todos");
  const [search, setSearch] = useState("");

  const loadCustomers = useCallback(async (rid: string) => {
    const db = getFirebaseDb();
    const cutoff = Timestamp.fromDate(new Date(Date.now() - 90 * 86400000));
    const visitSnap = await getDocs(
      query(
        collection(db, "restaurants", rid, "visitHistory"),
        where("timestamp", ">=", cutoff)
      )
    );

    // Aggregate by userId
    const map: Record<string, { visits: number; points: number; lastVisit: Timestamp | null }> = {};
    visitSnap.docs.forEach((d) => {
      const uid = d.data().userId as string;
      if (!uid) return;
      const pts = (d.data().pointsAwarded as number) ?? 0;
      const ts = (d.data().timestamp as Timestamp) ?? null;
      if (!map[uid]) map[uid] = { visits: 0, points: 0, lastVisit: null };
      map[uid].visits++;
      map[uid].points += pts;
      if (ts && (!map[uid].lastVisit || ts.toMillis() > map[uid].lastVisit!.toMillis())) {
        map[uid].lastVisit = ts;
      }
    });

    // Resolve user docs in parallel
    const uids = Object.keys(map);
    const userDocs = await Promise.all(
      uids.map((uid) => getDoc(doc(db, "users", uid)).catch(() => null))
    );

    const now = Date.now();
    const result: Customer[] = uids.map((uid, i) => {
      const uData = userDocs[i]?.data();
      const displayName = (uData?.displayName as string | undefined)?.trim().split(" ")[0];
      const email = uData?.email as string | undefined;
      const phone = (uData?.phone as string | undefined) ?? null;
      const name = displayName ?? email?.split("@")[0] ?? `#${uid.slice(-4).toUpperCase()}`;

      const lastVisit = map[uid].lastVisit;
      const daysSince = lastVisit
        ? Math.floor((now - lastVisit.toMillis()) / 86400000)
        : 999;

      const segment = computeSegment(map[uid].visits, daysSince);

      return {
        userId: uid,
        name,
        phone,
        totalVisits: map[uid].visits,
        totalPoints: map[uid].points,
        lastVisit,
        daysSince,
        segment,
      };
    });

    // Phone Points v1: merge phone-keyed loyalty accounts (customers with NO
    // app — web orders / POS captures). Dedupe by last-10 phone: an app user
    // with the same number wins (richer profile).
    try {
      const phoneSnap = await getDocs(
        collection(db, "restaurants", rid, "phoneCustomers")
      );
      const appPhones = new Set(
        result
          .map((c) => (c.phone ?? "").replace(/\D/g, "").slice(-10))
          .filter((p) => p.length === 10)
      );
      phoneSnap.docs.forEach((d) => {
        const phone10 = d.id;
        if (appPhones.has(phone10)) return;
        const data = d.data();
        const lastVisit = (data.lastVisitAt as Timestamp) ?? null;
        const daysSince = lastVisit
          ? Math.floor((now - lastVisit.toMillis()) / 86400000)
          : 999;
        const visits = (data.visits as number) ?? 0;
        const name =
          ((data.name as string) ?? "").trim().split(" ")[0] ||
          `··${phone10.slice(-4)}`;
        // 7-day claim window anchored on the unlock (first credit), same rule
        // as the app. Expired → no longer a hook, don't promise it.
        const createdAt = (data.createdAt as Timestamp) ?? null;
        const rewardAgeDays = createdAt
          ? Math.floor((now - createdAt.toMillis()) / 86400000)
          : null;
        const rewardDaysLeft =
          rewardAgeDays === null
            ? FIRST_VISIT_CLAIM_DAYS
            : FIRST_VISIT_CLAIM_DAYS - rewardAgeDays;
        const rewardUnlocked =
          data.firstVisitRewardUnlocked === true && rewardDaysLeft >= 0;
        result.push({
          userId: `tel:${phone10}`,
          name,
          phone: phone10,
          totalVisits: visits,
          totalPoints: (data.points as number) ?? 0,
          lastVisit,
          daysSince,
          segment: computeSegment(visits, daysSince),
          isPhoneOnly: true,
          rewardUnlocked,
          rewardDaysLeft: rewardUnlocked ? rewardDaysLeft : undefined,
          noShowCount: (data.noShowCount as number) ?? 0,
        });
      });
    } catch {
      /* phoneCustomers unavailable → app-user list still renders */
    }

    // Sort: at-risk + lost first (by days desc), then by visits desc
    result.sort((a, b) => {
      const urgencyOrder = ["riesgo", "perdido", "nuevo", "regular", "campeon"];
      const aU = urgencyOrder.indexOf(a.segment);
      const bU = urgencyOrder.indexOf(b.segment);
      if (aU !== bU) return aU - bU;
      return b.daysSince - a.daysSince;
    });

    setCustomers(result);
    setLoading(false);
  }, []);

  useEffect(() => {
    async function init() {
      const u = await waitForAuthReady();
      if (!u || u.isAnonymous) { router.push("/activar"); return; }
      const db = getFirebaseDb();
      const userSnap = await getDoc(doc(db, "users", u.uid));
      const rid = userSnap.data()?.ownedRestaurantId as string | undefined;
      if (!rid) { router.push("/activar"); return; }
      const [restSnap, statsSnap] = await Promise.all([
        getDoc(doc(db, "restaurants", rid)),
        getDoc(doc(db, "restaurants", rid, "reEngagementStats", "current")).catch(() => null)
      ]);
      const stats = statsSnap?.exists() ? statsSnap.data() ?? {} : {};
      setWinbackSent(typeof stats.totalSent === "number" ? stats.totalSent : 0);
      setWinbackReturned(typeof stats.returned === "number" ? stats.returned : 0);
      setRestaurantId(rid);
      setRestaurantName((restSnap.data()?.name as string | undefined) ?? "");
      await loadCustomers(rid);
    }
    init().catch(() => setLoading(false));
  }, [router, loadCustomers]);

  // Derived
  const actuaHoy = customers.filter(
    (c) =>
      c.phone &&
      (c.segment === "riesgo" ||
        c.segment === "perdido" ||
        // Reward about to expire (≤2 days) = today's most urgent nudge,
        // regardless of segment — the day-5-of-7 reminder moment.
        (c.rewardUnlocked === true && (c.rewardDaysLeft ?? 9) <= 2))
  ).slice(0, 5);

  // Search by name or phone (digits match anywhere in the number).
  const searchDigits = search.replace(/\D/g, "");
  const searchText = search.trim().toLowerCase();
  const bySegment = activeTab === "todos"
    ? customers
    : customers.filter((c) => c.segment === activeTab);
  const filtered = !searchText
    ? bySegment
    : bySegment.filter((c) => {
        const nameHit = c.name.toLowerCase().includes(searchText);
        const phoneHit =
          searchDigits.length >= 2 &&
          (c.phone ?? "").replace(/\D/g, "").includes(searchDigits);
        return nameHit || phoneHit;
      });

  const counts = {
    todos: customers.length,
    campeon: customers.filter((c) => c.segment === "campeon").length,
    regular: customers.filter((c) => c.segment === "regular").length,
    riesgo: customers.filter((c) => c.segment === "riesgo").length,
    perdido: customers.filter((c) => c.segment === "perdido").length,
    nuevo: customers.filter((c) => c.segment === "nuevo").length,
  };

  return (
    <>
      <main className="px-4 pb-16 pt-5 md:px-8 md:pt-7">

        {/* Page title */}
        <div className="mb-5 flex items-end justify-between">
          <div>
            <h1 className="text-[22px] font-extrabold tracking-tight" style={{ color: "#1C2526" }}>Clientes</h1>
            {!loading && customers.length > 0 && (
              <p className="mt-0.5 text-[13px]" style={{ color: "rgba(28,37,38,0.45)" }}>
                {customers.length} cliente{customers.length !== 1 ? "s" : ""} registrados
                {(winbackSent > 0 || winbackReturned > 0) && (
                  <> · 📨 {winbackSent} mensajes enviados · {winbackReturned} clientes recuperados</>
                )}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-5">
        {loading ? (
          <div className="flex justify-center py-20"><Spinner /></div>
        ) : customers.length === 0 ? (
          <div className="flex flex-col items-center py-20 text-center">
            <span className="text-[48px]">👥</span>
            <p className="mt-4 text-[16px] font-bold" style={{ color: "#1C2526" }}>Sin clientes aún</p>
            <p className="mt-1 text-[13px]" style={{ color: "rgba(28,37,38,0.4)" }}>
              Escanea tu primer cliente para verlos aquí.
            </p>
            <Link href="/vendor/scanner"
              className="mt-5 rounded-xl px-5 py-2.5 text-[13px] font-bold text-white"
              style={{ background: "#F28C38" }}>
              Ir al escáner →
            </Link>
          </div>
        ) : (
          <>
            {/* ── Metrics strip ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "VIP",       value: counts.campeon, color: "#b8860b", emoji: "👑" },
                { label: "Regulares", value: counts.regular, color: "#2563eb", emoji: "🔁" },
                { label: "En riesgo", value: counts.riesgo,  color: "#dc2626", emoji: "⚠️" },
                { label: "Perdidos",  value: counts.perdido, color: "#6b7280", emoji: "💤" },
              ].map((m) => (
                <div key={m.label} className="rounded-2xl p-4 text-center"
                  style={{ background: "#ffffff", border: "1px solid rgba(28,37,38,0.07)" }}>
                  <p className="text-[22px]">{m.emoji}</p>
                  <p className="mt-1 font-mono text-[24px] font-bold leading-none" style={{ color: m.color }}>
                    {m.value}
                  </p>
                  <p className="mt-1 text-[11px] font-medium"
                    style={{ color: "rgba(28,37,38,0.45)" }}>
                    {m.label}
                  </p>
                </div>
              ))}
            </div>

            {/* ── Actúa hoy ── */}
            {actuaHoy.length > 0 && (
              <div className="rounded-2xl overflow-hidden"
                style={{ background: "#fff8f5", border: "2px solid rgba(217,119,87,0.2)" }}>
                <div className="px-5 pt-5 pb-3 flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl text-[16px]"
                    style={{ background: "rgba(217,119,87,0.12)" }}>🎯</div>
                  <div>
                    <p className="text-[14px] font-bold" style={{ color: "#1C2526" }}>
                      Actúa hoy
                    </p>
                    <p className="text-[11px]" style={{ color: "rgba(28,37,38,0.45)" }}>
                      {actuaHoy.length} cliente{actuaHoy.length !== 1 ? "s" : ""} que necesitan atención — el Brain escribe el mensaje
                    </p>
                  </div>
                </div>
                <div className="px-4 pb-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                  {actuaHoy.map((c) => (
                    <CustomerCard
                      key={c.userId}
                      customer={c}
                      restaurantId={restaurantId!}
                      restaurantName={restaurantName}
                      isActuaHoy
                    />
                  ))}
                </div>
              </div>
            )}

            {/* ── Search ── */}
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="🔍 Buscar por nombre o teléfono…"
              className="w-full rounded-xl px-4 py-2.5 text-[13px] outline-none"
              style={{
                background: "#ffffff",
                border: "1px solid rgba(28,37,38,0.1)",
                color: "#1C2526",
              }}
            />

            {/* ── Segment tabs ── */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {TABS.map((t) => {
                const count = counts[t.key as keyof typeof counts];
                const active = activeTab === t.key;
                return (
                  <button
                    key={t.key}
                    onClick={() => setActiveTab(t.key as Segment | "todos")}
                    className="flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-all"
                    style={{
                      background: active ? "#1C2526" : "#ffffff",
                      color: active ? "#ffffff" : "rgba(28,37,38,0.55)",
                      border: active ? "1px solid #1C2526" : "1px solid rgba(28,37,38,0.1)",
                    }}>
                    <span>{t.emoji}</span>
                    <span>{t.label}</span>
                    {count > 0 && (
                      <span className="rounded-full px-1.5 py-0.5 text-[10px] font-bold"
                        style={{
                          background: active ? "rgba(255,255,255,0.2)" : "rgba(28,37,38,0.07)",
                          color: active ? "#ffffff" : "rgba(28,37,38,0.5)",
                        }}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* ── Customer list ── */}
            {filtered.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-[14px]" style={{ color: "rgba(28,37,38,0.4)" }}>
                  No hay clientes en este segmento
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filtered.map((c) => (
                  <CustomerCard
                    key={c.userId}
                    customer={c}
                    restaurantId={restaurantId!}
                    restaurantName={restaurantName}
                  />
                ))}
              </div>
            )}
          </>
        )}
        </div>
      </main>
    </>
  );
}
