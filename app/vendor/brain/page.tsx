"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { getFirebaseDb, getFirebaseFunctions } from "@/lib/firebase";
import { waitForAuthReady } from "@/lib/auth";

// ─── 24h module-level brief cache (same strategy as dashboard WeeklyGrowthBriefCard) ──
interface BriefCache {
  briefTitle: string;
  text: string;
  ts: number;
}
const _briefCache = new Map<string, BriefCache>();
const BRIEF_TTL = 24 * 60 * 60 * 1000;

const CHIPS = [
  "¿Qué días visitan más mis clientes?",
  "¿Cómo puedo mejorar la retención?",
  "¿Quiénes son mis clientes más fieles?",
  "¿Cuándo debería lanzar una promoción?",
];

function Spinner({ small = false }: { small?: boolean }) {
  const s = small ? "h-4 w-4" : "h-5 w-5";
  return (
    <svg className={`${s} animate-spin`} style={{ color: "#d97757" }} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 12 5.373 12 12H4z" />
    </svg>
  );
}

export default function BrainPage() {
  const router = useRouter();
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [restaurantName, setRestaurantName] = useState<string>("");

  // Weekly brief state
  const [briefLoading, setBriefLoading] = useState(true);
  const [briefTitle, setBriefTitle] = useState<string | null>(null);
  const [briefText, setBriefText] = useState<string | null>(null);
  const [briefError, setBriefError] = useState(false);

  // Brain query state
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [queryError, setQueryError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Auth + init ──────────────────────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      const u = await waitForAuthReady();
      if (!u || u.isAnonymous) { router.push("/activar"); return; }
      const db = getFirebaseDb();
      const userSnap = await getDoc(doc(db, "users", u.uid));
      const rid = userSnap.data()?.ownedRestaurantId as string | undefined;
      if (!rid) { router.push("/activar"); return; }
      setRestaurantId(rid);

      const restSnap = await getDoc(doc(db, "restaurants", rid));
      setRestaurantName((restSnap.data()?.name as string | undefined) ?? "");
    }
    init().catch(() => {});
  }, [router]);

  // ── Weekly brief ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!restaurantId) return;
    async function loadBrief() {
      setBriefLoading(true);
      setBriefError(false);
      try {
        const cached = _briefCache.get(restaurantId!);
        if (cached && Date.now() - cached.ts < BRIEF_TTL) {
          setBriefTitle(cached.briefTitle);
          setBriefText(cached.text);
          setBriefLoading(false);
          return;
        }
        // Need visitHistory 30d + redemptions 30d counts for the CF call
        const { getDocs, collection, query, where, Timestamp } = await import("firebase/firestore");
        const db = getFirebaseDb();
        const cutoff = Timestamp.fromDate(new Date(Date.now() - 30 * 86400000));
        const [visitSnap, redemSnap] = await Promise.all([
          getDocs(query(collection(db, "restaurants", restaurantId!, "visitHistory"), where("timestamp", ">=", cutoff))),
          getDocs(query(collection(db, "restaurants", restaurantId!, "redemptions"), where("timestamp", ">=", cutoff))),
        ]);
        const uniqueUsers = new Set<string>();
        let totalVisits = 0;
        visitSnap.docs.forEach((d) => { const uid = d.data().userId as string; if (uid) { uniqueUsers.add(uid); totalVisits++; } });

        const fn = httpsCallable<Record<string, unknown>, { briefTitle?: string; growthBriefText_es?: string }>(
          getFirebaseFunctions(),
          "generateWeeklyGrowthBrief"
        );
        const res = await fn({
          restaurantId,
          restaurantName,
          totalVisits30d: totalVisits,
          uniqueCustomers30d: uniqueUsers.size,
          redemptions30d: redemSnap.size,
        });
        const title = res.data.briefTitle ?? "Resumen semanal";
        const text = res.data.growthBriefText_es ?? null;
        if (text) {
          _briefCache.set(restaurantId!, { briefTitle: title, text, ts: Date.now() });
          setBriefTitle(title);
          setBriefText(text);
        } else {
          setBriefError(true);
        }
      } catch {
        setBriefError(true);
      } finally {
        setBriefLoading(false);
      }
    }
    loadBrief();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId]);

  // ── Brain query ──────────────────────────────────────────────────────────────
  async function ask(q: string) {
    if (!restaurantId || !q.trim() || asking) return;
    setQuestion(q);
    setAsking(true);
    setAnswer(null);
    setQueryError(null);
    try {
      const fn = httpsCallable<Record<string, unknown>, { answer: string }>(
        getFirebaseFunctions(),
        "queryRestaurantBrain"
      );
      const res = await fn({ restaurantId, question: q.trim() });
      setAnswer(res.data.answer ?? null);
    } catch {
      setQueryError("No pude conectar con el Brain en este momento. Intenta de nuevo.");
    } finally {
      setAsking(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    ask(question);
  }

  return (
    <div className="min-h-screen" style={{ background: "#F5F3EF" }}>
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center gap-3 px-6 py-4"
        style={{ background: "#ffffff", borderBottom: "1px solid rgba(28,37,38,0.07)" }}>
        <Link href="/vendor" className="text-[13px] font-medium" style={{ color: "rgba(28,37,38,0.45)" }}>
          ← Panel
        </Link>
        <span style={{ color: "rgba(28,37,38,0.2)" }}>/</span>
        <div className="flex items-center gap-2">
          <span className="text-[16px]">🧠</span>
          <h1 className="text-[15px] font-bold" style={{ color: "#1C2526" }}>Brain AI</h1>
        </div>
        <span className="ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
          style={{ background: "rgba(217,119,87,0.1)", color: "#d97757" }}>Beta</span>
      </div>

      <main className="px-4 py-6 md:px-8 max-w-2xl mx-auto space-y-5">

        {/* ── Weekly Brief ── */}
        <div className="rounded-2xl overflow-hidden"
          style={{ background: "#ffffff", border: "1px solid rgba(217,119,87,0.16)", boxShadow: "0 1px 4px rgba(28,37,38,0.06)" }}>
          <div className="px-5 pt-5 pb-4 flex items-center gap-3"
            style={{ borderBottom: "1px solid rgba(28,37,38,0.06)" }}>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl text-[16px]"
              style={{ background: "rgba(217,119,87,0.09)" }}>📈</div>
            <p className="text-[14px] font-bold" style={{ color: "#1C2526" }}>Resumen semanal</p>
            {briefLoading && <div className="ml-auto"><Spinner small /></div>}
            {!briefLoading && (briefText || briefError) && (
              <button
                onClick={() => { _briefCache.delete(restaurantId ?? ""); setBriefLoading(true); setBriefError(false); setBriefText(null); setBriefTitle(null); /* re-trigger */ setRestaurantId((r) => r ? r + "" : r); }}
                className="ml-auto rounded-lg px-2.5 py-1 text-[11px] font-bold"
                style={{ background: "#F5F3EF", color: "rgba(28,37,38,0.5)" }}>
                ↻ Actualizar
              </button>
            )}
          </div>
          <div className="px-5 py-4">
            {briefLoading ? (
              <div className="space-y-2.5">
                {[100, 85, 70].map((w) => (
                  <div key={w} className="h-3 rounded-full animate-pulse" style={{ width: `${w}%`, background: "rgba(28,37,38,0.07)" }} />
                ))}
              </div>
            ) : briefError ? (
              <div className="text-center py-4">
                <p className="text-[13px]" style={{ color: "rgba(28,37,38,0.45)" }}>
                  Aún no hay datos suficientes para generar el resumen. Sigue escaneando clientes.
                </p>
                <Link href="/vendor/scanner"
                  className="mt-3 inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-[12px] font-bold text-white"
                  style={{ background: "#d97757" }}>
                  📷 Escanear cliente
                </Link>
              </div>
            ) : (
              <>
                {briefTitle && (
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-widest" style={{ color: "rgba(217,119,87,0.75)" }}>
                    {briefTitle}
                  </p>
                )}
                <p className="text-[14px] leading-relaxed" style={{ color: "rgba(28,37,38,0.75)" }}>
                  {briefText}
                </p>
              </>
            )}
          </div>
        </div>

        {/* ── Brain Query ── */}
        <div className="rounded-2xl overflow-hidden"
          style={{ background: "#ffffff", border: "1px solid rgba(28,37,38,0.07)", boxShadow: "0 1px 4px rgba(28,37,38,0.05)" }}>
          <div className="px-5 pt-5 pb-4" style={{ borderBottom: "1px solid rgba(28,37,38,0.06)" }}>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl text-[16px]"
                style={{ background: "rgba(28,37,38,0.05)" }}>💬</div>
              <div>
                <p className="text-[14px] font-bold" style={{ color: "#1C2526" }}>Pregúntale al Brain</p>
                <p className="text-[11px]" style={{ color: "rgba(28,37,38,0.4)" }}>
                  Analiza los datos de tu restaurante en tiempo real
                </p>
              </div>
            </div>
          </div>

          <div className="px-5 py-4 space-y-4">
            {/* Suggestion chips */}
            <div className="flex flex-wrap gap-2">
              {CHIPS.map((chip) => (
                <button
                  key={chip}
                  onClick={() => { setQuestion(chip); inputRef.current?.focus(); ask(chip); }}
                  disabled={asking || !restaurantId}
                  className="rounded-full px-3 py-1.5 text-[12px] font-medium transition-opacity disabled:opacity-40"
                  style={{ background: "rgba(217,119,87,0.08)", color: "#d97757", border: "1px solid rgba(217,119,87,0.18)" }}>
                  {chip}
                </button>
              ))}
            </div>

            {/* Input */}
            <form onSubmit={handleSubmit} className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Escribe tu pregunta sobre tu negocio..."
                disabled={asking || !restaurantId}
                className="flex-1 rounded-xl px-4 py-2.5 text-[14px] outline-none disabled:opacity-50"
                style={{
                  background: "#F5F3EF",
                  border: "1px solid rgba(28,37,38,0.1)",
                  color: "#1C2526",
                }}
              />
              <button
                type="submit"
                disabled={!question.trim() || asking || !restaurantId}
                className="flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-[13px] font-bold text-white transition-opacity disabled:opacity-40"
                style={{ background: "#d97757" }}>
                {asking ? <Spinner small /> : "Preguntar"}
              </button>
            </form>

            {/* Answer */}
            {asking && (
              <div className="space-y-2 pt-1">
                {[100, 88, 72].map((w) => (
                  <div key={w} className="h-3 rounded-full animate-pulse" style={{ width: `${w}%`, background: "rgba(28,37,38,0.07)" }} />
                ))}
              </div>
            )}
            {answer && !asking && (
              <div className="rounded-xl p-4"
                style={{ background: "rgba(217,119,87,0.05)", border: "1px solid rgba(217,119,87,0.14)" }}>
                <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest" style={{ color: "rgba(217,119,87,0.7)" }}>
                  Brain AI
                </p>
                <p className="text-[14px] leading-relaxed whitespace-pre-wrap" style={{ color: "rgba(28,37,38,0.75)" }}>
                  {answer}
                </p>
              </div>
            )}
            {queryError && !asking && (
              <p className="text-[13px] text-center py-1" style={{ color: "rgba(28,37,38,0.4)" }}>
                {queryError}
              </p>
            )}
          </div>
        </div>

        {/* ── What the brain knows ── */}
        <div className="rounded-2xl p-5"
          style={{ background: "#ffffff", border: "1px solid rgba(28,37,38,0.06)" }}>
          <p className="mb-3 text-[11px] font-bold uppercase tracking-widest"
            style={{ color: "rgba(28,37,38,0.35)" }}>El Brain analiza</p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { emoji: "📅", title: "Días pico", desc: "Qué días visitan más tus clientes" },
              { emoji: "🔁", title: "Retención", desc: "Tasa de clientes que regresan" },
              { emoji: "👑", title: "Top clientes", desc: "Los más fieles de tu negocio" },
              { emoji: "⚠️", title: "En riesgo", desc: "Quién no ha regresado en 14+ días" },
            ].map((f) => (
              <div key={f.title} className="rounded-xl p-3.5"
                style={{ background: "#F5F3EF", border: "1px solid rgba(28,37,38,0.06)" }}>
                <span className="text-[18px]">{f.emoji}</span>
                <p className="mt-2 text-[13px] font-semibold" style={{ color: "#1C2526" }}>{f.title}</p>
                <p className="mt-0.5 text-[11px] leading-snug" style={{ color: "rgba(28,37,38,0.4)" }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>

      </main>
    </div>
  );
}
