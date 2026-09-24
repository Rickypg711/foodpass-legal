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
  deleteField,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { getFirebaseDb, getFirebaseFunctions } from "@/lib/firebase";
import { fetchWithBilling } from "@/lib/subscription/billingDoc";
import { waitForAuthReady } from "@/lib/auth";
import { logOwnerAction, shortTarget } from "@/lib/ownerActions";
import { resolveVendorContext, vendorHomeForRole } from "@/lib/vendorContext";
import {
  parseDiscountProfiles,
  discountsEnabled,
  type DiscountProfile,
} from "@/lib/loyalty/discountProfiles";

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
  /** Descuentos especiales (Pro): perfil asignado en phoneCustomers/{phone10}. */
  discountProfileId?: string | null;
  discountProfileName?: string | null;
  /** App user whose phone has a phoneCustomers doc — assignable target. */
  hasPhoneDoc?: boolean;
}

/** First-visit reward claim window — mirrors the app's _firstVisitClaimDays. */
import { FIRST_VISIT_CLAIM_DAYS } from "@/lib/loyalty/rewardCatalog";
import { DEFAULT_PHONE_COUNTRY, phoneCountryOf, waNumber } from "@/lib/phone/phoneCountry";
import { buildWhatsappUrl } from "@/lib/order/formatWhatsappMessage";

// ─── Segment logic ────────────────────────────────────────────────────────────

function computeSegment(visits: number, daysSince: number): Segment {
  if (visits >= 5) return "campeon";
  if (visits === 1) return "nuevo";
  if (daysSince > 30) return "perdido";
  if (daysSince > 14) return "riesgo";
  return "regular";
}

const SEGMENT_META: Record<Segment, { label: string; emoji: string; bg: string; color: string }> = {
  campeon:  { label: "VIP",   emoji: "", bg: "#1C2526", color: "#FAF9F5" },
  regular:  { label: "Regular",   emoji: "", bg: "#F0EBE1", color: "#3F4A4D" },
  riesgo:   { label: "En riesgo", emoji: "", bg: "#FFFBEB", color: "#B45309" },
  perdido:  { label: "Perdido",   emoji: "", bg: "#F0EBE1", color: "#5B6366" },
  nuevo:    { label: "Nuevo",     emoji: "", bg: "#F0EBE1", color: "#1C2526" },
};

const TABS: { key: Segment | "todos"; label: string; emoji: string }[] = [
  { key: "todos",   label: "Todos",      emoji: "👥" },
  { key: "riesgo",  label: "En riesgo",  emoji: "" },
  { key: "perdido", label: "Perdidos",   emoji: "" },
  { key: "campeon", label: "VIP",  emoji: "" },
  { key: "regular", label: "Regulares",  emoji: "" },
  { key: "nuevo",   label: "Nuevos",     emoji: "" },
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

// Opción A (23-sep-2026, lienzo "Sistema Comeleal"): mismos tokens que el
// Panel, Pedidos y Caja. Los estados se dicen con palabra y punto.
const SERIF = "var(--font-lora), Lora, Georgia, serif";
const INK = "#1C2526";
const INK_MUTED = "#3F4A4D";
const INK_SOFT = "#5B6366";
const HAIRLINE = "#E9E3D7";
const BORDER = "#D9D2C5";
const LINK = "#8A4B12";
const BRAND = "#F28C38";
const TILE = "#F0EBE1";
const WARN = "#B45309";
const WARN_SURFACE = "#FFFBEB";
const ICON = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
function IconWhatsapp() { return <svg {...ICON}><path d="M21 12a9 9 0 0 1-13.3 7.9L3 21l1.1-4.7A9 9 0 1 1 21 12z" /></svg>; }
function IconSearch() { return <svg {...ICON} stroke="#5B6366"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>; }
function IconTag() { return <svg {...ICON} width={16} height={16}><path d="M20 12l-8 8-9-9V3h8l9 9z" /><circle cx="7.5" cy="7.5" r="1.5" /></svg>; }
function IconPeople() { return <svg {...ICON} width={22} height={22} stroke="#5B6366"><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-4.5-6.2" /></svg>; }

function Pill({ bg, color, dot, children, title }: { bg: string; color: string; dot?: string; children: React.ReactNode; title?: string }) {
  return (
    <span className="inline-flex h-[24px] items-center gap-1.5 rounded-full px-2.5 text-[12px] font-semibold" style={{ background: bg, color }} title={title}>
      {dot && <span className="h-1.5 w-1.5 rounded-full" style={{ background: dot }} />}
      {children}
    </span>
  );
}

function SegmentBadge({ segment }: { segment: Segment }) {
  const m = SEGMENT_META[segment];
  return <Pill bg={m.bg} color={m.color} dot={segment === "riesgo" ? WARN : undefined}>{m.label}</Pill>;
}

// ─── Customer card ────────────────────────────────────────────────────────────

function CustomerCard({
  customer,
  restaurantId,
  restaurantName,
  phoneCountry = DEFAULT_PHONE_COUNTRY,
  isActuaHoy = false,
  discountProfiles = [],
  discountsOn = false,
  onDiscountChange,
}: {
  customer: Customer;
  restaurantId: string;
  restaurantName: string;
  /** País del teléfono del local (5-sep): el win-back marca como él. */
  phoneCountry?: string;
  isActuaHoy?: boolean;
  /** Descuentos especiales (Pro): perfiles disponibles para asignar. */
  discountProfiles?: DiscountProfile[];
  discountsOn?: boolean;
  onDiscountChange?: (userId: string, profile: DiscountProfile | null) => void;
}) {
  const [msgLoading, setMsgLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [msgError, setMsgError] = useState(false);
  const [discOpen, setDiscOpen] = useState(false);
  const [discBusy, setDiscBusy] = useState(false);
  const [discError, setDiscError] = useState(false);

  /** Descuentos especiales: escribe la asignación en phoneCustomers/{phone10}
   * — el mismo doc que el POS lee al cobrar (web y app comparten esquema). */
  const discPhone10 = (customer.phone ?? "").replace(/\D/g, "").slice(-10);
  const canAssignDiscount =
    discountsOn &&
    discountProfiles.length > 0 &&
    discPhone10.length === 10 &&
    (customer.isPhoneOnly === true || customer.hasPhoneDoc === true);

  async function assignDiscount(p: DiscountProfile | null) {
    setDiscBusy(true);
    setDiscError(false);
    try {
      await updateDoc(
        doc(getFirebaseDb(), "restaurants", restaurantId, "phoneCustomers", discPhone10),
        p
          ? { discountProfileId: p.id, discountProfileName: p.name }
          : { discountProfileId: deleteField(), discountProfileName: deleteField() },
      );
      onDiscountChange?.(customer.userId, p);
      setDiscOpen(false);
    } catch (e) {
      console.error("[clientes/assignDiscount]", e);
      setDiscError(true);
    } finally {
      setDiscBusy(false);
    }
  }

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
    // Rastro del toque (24-sep): el dueño quiso escribirle a este cliente.
    // Se anota antes de abrir WhatsApp, en los tres caminos de abajo.
    logOwnerAction(restaurantId, "winback_send", { target: shortTarget(phone10) });
    if (msg) {
      const waUrl = buildWhatsappUrl(customer.phone, msg, phoneCountry);
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
      const waUrl = buildWhatsappUrl(phone10, generated, phoneCountry);
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
      const waUrl = buildWhatsappUrl(customer.phone, generated, phoneCountry);
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
    <div className="rounded-xl bg-white p-3.5" style={{ border: `1px solid ${isActuaHoy ? WARN : BORDER}` }}>
      <div className="flex items-start gap-3">
        {/* Avatar: iniciales en tinta sobre tostado */}
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[14px] font-bold" style={{ background: TILE, color: INK }}>
          {initials}
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold leading-5" style={{ color: INK }}>{customer.name}</p>
          <p className="mt-0.5 text-[13px] leading-4 tabular-nums" style={{ color: INK_SOFT }}>
            {customer.totalVisits} visita{customer.totalVisits !== 1 ? "s" : ""} · {customer.totalPoints} pts · {timeAgo(customer.lastVisit)}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <SegmentBadge segment={customer.segment} />
            {customer.isPhoneOnly && <Pill bg={TILE} color={INK_MUTED}>Con teléfono</Pill>}
            {customer.rewardUnlocked && (
              (customer.rewardDaysLeft ?? 9) <= 2
                ? <Pill bg={WARN_SURFACE} color={WARN} dot={WARN}>{`Premio vence ${customer.rewardDaysLeft === 0 ? "hoy" : customer.rewardDaysLeft === 1 ? "mañana" : "en 2 días"}`}</Pill>
                : <Pill bg={TILE} color={INK_MUTED}>Premio sin usar</Pill>
            )}
            {(customer.noShowCount ?? 0) >= 2 && (
              <Pill bg={WARN_SURFACE} color={WARN} dot={WARN} title="Pedidos 'pagar al recoger' cancelados sin pagar">{customer.noShowCount} veces no llegó</Pill>
            )}
            {customer.discountProfileName && (
              <Pill bg={TILE} color={INK_MUTED} title="Descuento especial: la Caja lo aplica al cobrar">{customer.discountProfileName}</Pill>
            )}
          </div>
        </div>
      </div>

      {/* Mensaje sugerido (solo en "Escríbeles hoy") */}
      {isActuaHoy && msg && (
        <div className="mt-3 rounded-lg px-3 py-2.5 text-[13px] leading-[18px]" style={{ background: TILE, color: INK }}>
          <p className="mb-1 text-[12px]" style={{ color: INK_SOFT }}>Mensaje sugerido</p>
          {msg}
        </div>
      )}

      {/* CTA */}
      <div className="mt-3 flex items-center gap-2">
        {customer.phone ? (
          <button
            type="button"
            onClick={generateAndOpen}
            disabled={msgLoading}
            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-white text-[14px] font-semibold transition hover:opacity-90 disabled:opacity-60"
            style={{ border: `1px solid ${INK}`, color: INK }}>
            {msgLoading ? <Spinner small /> : <IconWhatsapp />}
            {msgLoading ? "Escribiendo el mensaje" : msg ? "Abrir WhatsApp" : "Escribirle por WhatsApp"}
          </button>
        ) : (
          <span className="text-[13px]" style={{ color: INK_SOFT }}>Sin número registrado</span>
        )}
        {msgError && (
          <span className="text-[13px]" style={{ color: "#B91C1C" }}>No se pudo, intenta de nuevo</span>
        )}
      </div>

      {/* ── Descuento especial (Pro, solo dueño) ── */}
      {canAssignDiscount && (
        <div className="mt-2">
          {!discOpen ? (
            <button
              type="button"
              onClick={() => setDiscOpen(true)}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-white text-[13px] font-semibold transition hover:opacity-90"
              style={{ border: `1px solid ${BORDER}`, color: INK }}
            >
              <IconTag />
              {customer.discountProfileName
                ? `${customer.discountProfileName} · cambiar o quitar`
                : "Asignar descuento especial"}
            </button>
          ) : (
            <div
              className="space-y-1.5 rounded-xl p-2.5"
              style={{ background: TILE }}
            >
              {discountProfiles.map((dp) => {
                const active = customer.discountProfileId === dp.id;
                const pcts =
                  dp.type === "total"
                    ? `${dp.totalPct ?? 0}% en toda la cuenta`
                    : `${dp.bebidasPct ?? 0}% bebidas · ${dp.alimentosPct ?? 0}% alimentos`;
                return (
                  <button
                    key={dp.id}
                    type="button"
                    disabled={discBusy || active}
                    onClick={() => assignDiscount(dp)}
                    className="flex h-10 w-full items-center justify-between rounded-lg px-3 text-left text-[13px] font-semibold transition hover:opacity-90 disabled:opacity-60"
                    style={active ? { background: INK, color: "#FAF9F5" } : { background: "#FFFFFF", border: `1px solid ${BORDER}`, color: INK }}
                  >
                    <span>{dp.name}</span>
                    <span className="font-normal" style={{ opacity: 0.8 }}>{active ? "asignado" : pcts}</span>
                  </button>
                );
              })}
              <div className="flex gap-1.5 pt-0.5">
                {customer.discountProfileId && (
                  <button
                    type="button"
                    disabled={discBusy}
                    onClick={() => assignDiscount(null)}
                    className="flex-1 rounded-lg px-3 py-2 text-[13px] font-semibold hover:underline disabled:opacity-60"
                    style={{ color: LINK }}
                  >
                    Quitar descuento
                  </button>
                )}
                <button
                  type="button"
                  disabled={discBusy}
                  onClick={() => setDiscOpen(false)}
                  className="flex-1 rounded-lg px-3 py-2 text-[13px] font-semibold hover:underline"
                  style={{ color: LINK }}
                >
                  Cerrar
                </button>
              </div>
              {discBusy && (
                <p className="text-center text-[12px]" style={{ color: INK_SOFT }}>Guardando…</p>
              )}
              {discError && (
                <p className="text-center text-[12px] font-semibold" style={{ color: "#B91C1C" }}>
                  No se guardó, intenta de nuevo
                </p>
              )}
            </div>
          )}
        </div>
      )}

    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ClientesPage() {
  const router = useRouter();
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [restaurantName, setRestaurantName] = useState<string>("");
  const [phoneCountry, setPhoneCountry] = useState(DEFAULT_PHONE_COUNTRY);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [winbackSent, setWinbackSent] = useState<number>(0);
  const [winbackReturned, setWinbackReturned] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<Segment | "todos">("todos");
  const [search, setSearch] = useState("");

  // Los marcadores del Panel llegan aquí YA filtrados (?segmento=riesgo).
  // window.location en efecto (no useSearchParams) para no exigir Suspense.
  useEffect(() => {
    const seg = new URLSearchParams(window.location.search).get("segmento");
    if (seg === "riesgo" || seg === "perdido" || seg === "nuevo" ||
        seg === "regular" || seg === "campeon") {
      setActiveTab(seg);
    }
  }, []);
  /** Descuentos especiales (Pro) — perfiles creados en Configuración. */
  const [discountProfiles, setDiscountProfiles] = useState<DiscountProfile[]>([]);
  const [discountsOn, setDiscountsOn] = useState(false);
  /** Filtro por perfil de descuento — auditoría "¿quién tiene Staff?". */
  const [discountFilter, setDiscountFilter] = useState<string | null>(null);

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
      // phone10 → app customer, so deduped rows still surface their wallet's
      // discount profile (assignment lives on phoneCustomers/{phone10}).
      const byPhone = new Map<string, Customer>();
      result.forEach((c) => {
        const p10 = (c.phone ?? "").replace(/\D/g, "").slice(-10);
        if (p10.length === 10) byPhone.set(p10, c);
      });
      phoneSnap.docs.forEach((d) => {
        const phone10 = d.id;
        const data = d.data();
        if (appPhones.has(phone10)) {
          const appC = byPhone.get(phone10);
          if (appC) {
            appC.hasPhoneDoc = true;
            appC.discountProfileId = (data.discountProfileId as string) ?? null;
            appC.discountProfileName = (data.discountProfileName as string) ?? null;
          }
          return;
        }
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
          discountProfileId: (data.discountProfileId as string) ?? null,
          discountProfileName: (data.discountProfileName as string) ?? null,
          hasPhoneDoc: true,
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
      if (!u || u.isAnonymous) { router.push("/activar?modo=entrar"); return; }
      const db = getFirebaseDb();
      // Staff-aware: CRM es de dueño/manager (canViewAnalytics del app);
      // empleado va a la caja. Asignar descuentos sigue siendo SOLO dueño.
      const ctx = await resolveVendorContext(db, u.uid);
      if (!ctx) { router.push("/activar?modo=entrar"); return; }
      if (ctx.role === "employee") { router.push(vendorHomeForRole(ctx.role)); return; }
      const rid = ctx.restaurantId;
      const isOwner = ctx.role === "owner";
      const [restSnap, statsSnap] = await Promise.all([
        getDoc(doc(db, "restaurants", rid)),
        getDoc(doc(db, "restaurants", rid, "reEngagementStats", "current")).catch(() => null)
      ]);
      const stats = statsSnap?.exists() ? statsSnap.data() ?? {} : {};
      setWinbackSent(typeof stats.totalSent === "number" ? stats.totalSent : 0);
      setWinbackReturned(typeof stats.returned === "number" ? stats.returned : 0);
      setRestaurantId(rid);
      const rdata = restSnap.data() ?? {};
      setRestaurantName((rdata.name as string | undefined) ?? "");
      setPhoneCountry(phoneCountryOf(rdata));
      // Owner-only rule: el manager ve chips de descuento asignados pero no
      // puede asignar/quitar ni filtrar (profiles vacíos = UI de asignación oculta).
      setDiscountProfiles(isOwner ? parseDiscountProfiles(rdata.discountProfiles) : []);
      // Gate Pro con private/billing (migración 24-ago).
      setDiscountsOn(
        isOwner &&
          discountsEnabled(await fetchWithBilling(db, rid, rdata as Record<string, unknown>), rid),
      );
      await loadCustomers(rid);
    }
    init().catch(() => setLoading(false));
  }, [router, loadCustomers]);

  /** Sincroniza la lista tras asignar/quitar un descuento en un card. */
  function handleDiscountChange(userId: string, profile: DiscountProfile | null) {
    setCustomers((prev) =>
      prev.map((c) =>
        c.userId === userId
          ? {
              ...c,
              discountProfileId: profile?.id ?? null,
              discountProfileName: profile?.name ?? null,
            }
          : c,
      ),
    );
  }

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
  const bySearch = !searchText
    ? bySegment
    : bySegment.filter((c) => {
        const nameHit = c.name.toLowerCase().includes(searchText);
        const phoneHit =
          searchDigits.length >= 2 &&
          (c.phone ?? "").replace(/\D/g, "").includes(searchDigits);
        return nameHit || phoneHit;
      });
  const filtered = discountFilter
    ? bySearch.filter((c) => c.discountProfileId === discountFilter)
    : bySearch;

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
      <main className="px-5 pb-24 pt-5 md:px-8 md:pt-7">

        {/* Título en Lora + qué hay debajo */}
        <div className="mb-4 flex items-end justify-between">
          <div className="flex flex-col gap-0.5">
            <h1 className="text-[22px] font-semibold leading-[26px] md:text-[24px] md:leading-7" style={{ color: INK, fontFamily: SERIF }}>Clientes</h1>
            {!loading && customers.length > 0 && (
              <p className="text-[13px] leading-4" style={{ color: INK_SOFT }}>
                {customers.length} con teléfono
                {(winbackSent > 0 || winbackReturned > 0) && (
                  <> · {winbackSent} mensajes enviados · {winbackReturned} regresaron</>
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
            <div className="flex h-14 w-14 items-center justify-center rounded-full" style={{ background: TILE }}><IconPeople /></div>
            <p className="mt-4 text-[16px] font-semibold" style={{ color: INK }}>Todavía no hay clientes</p>
            <p className="mt-1 text-[14px]" style={{ color: INK_SOFT }}>
              Pide el número de WhatsApp en tu próximo cobro y aparece aquí.
            </p>
            <Link href="/vendor/pos"
              className="mt-5 flex h-12 items-center rounded-xl px-6 text-[15px] font-semibold text-[#1C2526]"
              style={{ background: BRAND }}>
              Ir a la Caja
            </Link>
          </div>
        ) : (
          <>
            {/* ── Cuatro cifras en una fila con líneas finas (como en el Panel) ── */}
            <div className="grid grid-cols-4 py-3" style={{ borderTop: `1px solid ${HAIRLINE}`, borderBottom: `1px solid ${HAIRLINE}` }}>
              {[
                { label: "VIP", value: counts.campeon },
                { label: "regulares", value: counts.regular },
                { label: "en riesgo", value: counts.riesgo },
                { label: "perdidos", value: counts.perdido },
              ].map((m, i) => (
                <div key={m.label} className="flex flex-col items-center gap-0.5 px-1 text-center" style={i > 0 ? { borderLeft: `1px solid ${HAIRLINE}` } : undefined}>
                  <p className="text-[22px] font-bold leading-[26px] tabular-nums" style={{ color: INK }}>{m.value}</p>
                  <p className="text-[12px] leading-[14px]" style={{ color: INK_MUTED }}>{m.label}</p>
                </div>
              ))}
            </div>

            {/* ── Actúa hoy ── */}
            {actuaHoy.length > 0 && (
              <section>
                <div className="mb-3 flex items-baseline justify-between gap-3">
                  <h2 className="text-[17px] font-semibold leading-[22px]" style={{ color: INK, fontFamily: SERIF }}>Escríbeles hoy</h2>
                  <span className="text-[13px] leading-4" style={{ color: INK_SOFT }}>
                    {actuaHoy.length} cliente{actuaHoy.length !== 1 ? "s" : ""} · el mensaje ya está escrito
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {actuaHoy.map((c) => (
                    <CustomerCard
                      phoneCountry={phoneCountry}
                      key={c.userId}
                      customer={c}
                      restaurantId={restaurantId!}
                      restaurantName={restaurantName}
                      isActuaHoy
                      discountProfiles={discountProfiles}
                      discountsOn={discountsOn}
                      onDiscountChange={handleDiscountChange}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* ── Búsqueda: 48px, letra de 16 (sin zoom en iPhone) ── */}
            <label className="flex h-12 items-center gap-2.5 rounded-xl bg-white px-3.5" style={{ border: `1px solid ${BORDER}` }}>
              <IconSearch />
              <span className="sr-only">Buscar por nombre o teléfono</span>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nombre o teléfono"
                className="min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-[#5B6366]"
                style={{ color: INK }}
              />
            </label>

            {/* ── Segment tabs ── */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {TABS.map((t) => {
                const count = counts[t.key as keyof typeof counts];
                const active = activeTab === t.key;
                return (
                  <button
                    key={t.key}
                    onClick={() => setActiveTab(t.key as Segment | "todos")}
                    className="flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[14px] transition-all"
                    style={active
                      ? { background: INK, color: "#FAF9F5", border: `1px solid ${INK}`, fontWeight: 600 }
                      : { background: "#FFFFFF", color: INK, border: `1px solid ${BORDER}` }}>
                    <span>{t.label}</span>
                    {count > 0 && (
                      <span className="text-[13px] tabular-nums" style={{ color: active ? "#E6E0D6" : INK_SOFT }}>{count}</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* ── Filtro por descuento (Pro): ¿quién tiene Staff? ── */}
            {discountsOn && discountProfiles.length > 0 && (
              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                {discountProfiles.map((dp) => {
                  const count = customers.filter((c) => c.discountProfileId === dp.id).length;
                  const active = discountFilter === dp.id;
                  return (
                    <button
                      key={dp.id}
                      onClick={() => setDiscountFilter(active ? null : dp.id)}
                      className="flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[14px] transition-all"
                      style={active
                        ? { background: INK, color: "#FAF9F5", border: `1px solid ${INK}`, fontWeight: 600 }
                        : { background: "#FFFFFF", color: INK, border: `1px solid ${BORDER}` }}>
                      <IconTag />
                      <span>{dp.name}</span>
                      <span className="text-[13px] tabular-nums" style={{ color: active ? "#E6E0D6" : INK_SOFT }}>{count}</span>
                    </button>
                  );
                })}
                {discountFilter && (
                  <button
                    onClick={() => setDiscountFilter(null)}
                    className="h-9 shrink-0 rounded-full px-3 text-[14px] font-semibold hover:underline"
                    style={{ color: LINK }}>
                    Quitar filtro
                  </button>
                )}
              </div>
            )}

            {/* ── Customer list ── */}
            {filtered.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-[14px]" style={{ color: INK_SOFT }}>
                  {discountFilter
                    ? "Nadie tiene este descuento asignado todavía"
                    : "No hay clientes en este segmento"}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filtered.map((c) => (
                  <CustomerCard
                      phoneCountry={phoneCountry}
                    key={c.userId}
                    customer={c}
                    restaurantId={restaurantId!}
                    restaurantName={restaurantName}
                    discountProfiles={discountProfiles}
                    discountsOn={discountsOn}
                    onDiscountChange={handleDiscountChange}
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
