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
      setQueryError("No pude conectar con Comeleal AI en este momento. Intenta de nuevo.");
    } finally {
      setAsking(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    ask(question);
  }

  return (
    <>
      <main className="px-4 pb-16 pt-5 md:px-8 md:pt-7">

        {/* Page title */}
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl text-[20px]"
              style={{ background: "linear-gradient(135deg, rgba(217,119,87,0.15) 0%, rgba(217,119,87,0.05) 100%)", border: "1px solid rgba(217,119,87,0.2)" }}>
              🧠
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-[22px] font-extrabold tracking-tight" style={{ color: "#1C2526" }}>Comeleal AI</h1>
                <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                  style={{ background: "rgba(217,119,87,0.1)", color: "#d97757" }}>Beta</span>
              </div>
              <p className="text-[13px]" style={{ color: "rgba(28,37,38,0.45)" }}>
                Tu asistente inteligente con datos reales de tu negocio
              </p>
            </div>
          </div>
        </div>

        {/* ── Desktop 2-col layout ── */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-5">

          {/* LEFT: Brief + capabilities (2/5) */}
          <div className="md:col-span-2 flex flex-col gap-5">

            {/* Weekly Brief */}
            <div className="rounded-2xl overflow-hidden"
              style={{ background: "#ffffff", border: "1px solid rgba(217,119,87,0.16)", boxShadow: "0 1px 6px rgba(28,37,38,0.06)" }}>
              <div className="px-5 pt-5 pb-4 flex items-center gap-3"
                style={{ borderBottom: "1px solid rgba(28,37,38,0.06)" }}>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl text-[16px]"
                  style={{ background: "rgba(217,119,87,0.09)" }}>📈</div>
                <p className="text-[14px] font-bold" style={{ color: "#1C2526" }}>Resumen semanal</p>
                {briefLoading && <div className="ml-auto"><Spinner small /></div>}
                {!briefLoading && (briefText || briefError) && (
                  <button
                    onClick={() => { _briefCache.delete(restaurantId ?? ""); setBriefLoading(true); setBriefError(false); setBriefText(null); setBriefTitle(null); setRestaurantId((r) => r ? r + "" : r); }}
                    className="ml-auto rounded-lg px-2.5 py-1 text-[11px] font-bold transition-colors"
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
                      Aún no hay datos suficientes. Sigue escaneando clientes.
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

            {/* What the brain knows */}
            <div className="rounded-2xl p-5"
              style={{ background: "#ffffff", border: "1px solid rgba(28,37,38,0.06)" }}>
              <p className="mb-4 text-[11px] font-bold uppercase tracking-widest"
                style={{ color: "rgba(28,37,38,0.35)" }}>Qué analiza</p>
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { emoji: "📅", title: "Días pico", desc: "Qué días visitan más tus clientes" },
                  { emoji: "🔁", title: "Retención", desc: "Tasa de clientes que regresan" },
                  { emoji: "👑", title: "Top clientes", desc: "Los más fieles de tu negocio" },
                  { emoji: "⚠️", title: "En riesgo", desc: "Sin visita en 14+ días" },
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
          </div>

          {/* RIGHT: AI Chat (3/5) */}
          <div className="md:col-span-3">
            <div className="rounded-2xl overflow-hidden h-full"
              style={{ background: "#ffffff", border: "1px solid rgba(28,37,38,0.07)", boxShadow: "0 1px 6px rgba(28,37,38,0.05)" }}>

              {/* Chat header */}
              <div className="px-5 pt-5 pb-4" style={{ borderBottom: "1px solid rgba(28,37,38,0.06)" }}>
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl text-[16px]"
                    style={{ background: "linear-gradient(135deg, rgba(217,119,87,0.12), rgba(217,119,87,0.04))" }}>💬</div>
                  <div>
                    <p className="text-[15px] font-bold" style={{ color: "#1C2526" }}>Pregúntale a Comeleal AI</p>
                    <p className="text-[11px]" style={{ color: "rgba(28,37,38,0.4)" }}>
                      Datos reales de tu restaurante, respuestas instantáneas
                    </p>
                  </div>
                </div>
              </div>

              <div className="px-5 py-5 space-y-5">
                {/* Suggestion chips */}
                <div className="flex flex-wrap gap-2">
                  {CHIPS.map((chip) => (
                    <button
                      key={chip}
                      onClick={() => { setQuestion(chip); inputRef.current?.focus(); ask(chip); }}
                      disabled={asking || !restaurantId}
                      className="rounded-full px-3.5 py-1.5 text-[12px] font-medium transition-all disabled:opacity-40 hover:scale-[1.02]"
                      style={{ background: "rgba(217,119,87,0.08)", color: "#d97757", border: "1px solid rgba(217,119,87,0.2)" }}>
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
                    className="flex-1 rounded-xl px-4 py-3 text-[14px] outline-none disabled:opacity-50 transition-all"
                    style={{
                      background: "#F5F3EF",
                      border: "1px solid rgba(28,37,38,0.1)",
                      color: "#1C2526",
                    }}
                  />
                  <button
                    type="submit"
                    disabled={!question.trim() || asking || !restaurantId}
                    className="flex items-center gap-1.5 rounded-xl px-5 py-3 text-[13px] font-bold text-white transition-all disabled:opacity-40 hover:opacity-90"
                    style={{ background: "#d97757" }}>
                    {asking ? <Spinner small /> : "Preguntar →"}
                  </button>
                </form>

                {/* Answer skeleton */}
                {asking && (
                  <div className="rounded-xl p-5" style={{ background: "rgba(217,119,87,0.04)", border: "1px solid rgba(217,119,87,0.1)" }}>
                    <p className="mb-3 text-[10px] font-bold uppercase tracking-widest" style={{ color: "rgba(217,119,87,0.6)" }}>
                      Analizando...
                    </p>
                    <div className="space-y-2.5">
                      {[100, 88, 72, 60].map((w) => (
                        <div key={w} className="h-3 rounded-full animate-pulse" style={{ width: `${w}%`, background: "rgba(28,37,38,0.07)" }} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Answer */}
                {answer && !asking && (
                  <div className="rounded-xl p-5"
                    style={{ background: "rgba(217,119,87,0.04)", border: "1px solid rgba(217,119,87,0.14)" }}>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-[14px]">🧠</span>
                      <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "rgba(217,119,87,0.7)" }}>
                        Comeleal AI
                      </p>
                    </div>
                    <p className="text-[14px] leading-relaxed whitespace-pre-wrap" style={{ color: "rgba(28,37,38,0.8)" }}>
                      {answer}
                    </p>
                  </div>
                )}

                {/* Error */}
                {queryError && !asking && (
                  <div className="rounded-xl px-4 py-3 text-center" style={{ background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.12)" }}>
                    <p className="text-[13px]" style={{ color: "rgba(28,37,38,0.5)" }}>{queryError}</p>
                  </div>
                )}

                {/* Empty state — no question yet */}
                {!answer && !asking && !queryError && (
                  <div className="py-8 text-center">
                    <p className="text-[32px] mb-2">💡</p>
                    <p className="text-[13px] font-medium" style={{ color: "rgba(28,37,38,0.35)" }}>
                      Selecciona una pregunta arriba o escribe la tuya
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      </main>
    </>
  );
}
