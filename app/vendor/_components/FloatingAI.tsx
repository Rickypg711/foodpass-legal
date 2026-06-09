"use client";

import { useState, useRef } from "react";
import { httpsCallable } from "firebase/functions";
import { getFirebaseFunctions } from "@/lib/firebase";

const CHIPS = [
  "¿Qué días visitan más mis clientes?",
  "¿Quiénes son mis VIP?",
  "¿Cómo mejorar la retención?",
  "¿Cuándo lanzar una promoción?",
];

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" style={{ color: "#d97757" }} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 12 5.373 12 12H4z" />
    </svg>
  );
}

export default function FloatingAI({ restaurantId }: { restaurantId: string | null }) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function ask(q: string) {
    if (!restaurantId || !q.trim() || asking) return;
    setAsking(true);
    setAnswer(null);
    setError(null);
    setQuestion(q);
    try {
      const fn = httpsCallable<Record<string, unknown>, { answer: string }>(
        getFirebaseFunctions(),
        "queryRestaurantBrain"
      );
      const res = await fn({ restaurantId, question: q.trim() });
      setAnswer(res.data.answer ?? null);
    } catch {
      setError("No pude conectar con Comeleal AI. Intenta de nuevo.");
    } finally {
      setAsking(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    ask(question);
  }

  function handleClose() {
    setOpen(false);
    setAnswer(null);
    setError(null);
    setQuestion("");
  }

  return (
    <>
      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40"
          style={{ background: "rgba(28,37,38,0.25)", backdropFilter: "blur(2px)" }}
          onClick={handleClose}
        />
      )}

      {/* Slide-up panel */}
      {open && (
        <div
          className="fixed bottom-[84px] right-6 z-50 w-full rounded-2xl overflow-hidden shadow-2xl"
          style={{
            maxWidth: 420,
            background: "#ffffff",
            border: "1px solid rgba(28,37,38,0.1)",
            boxShadow: "0 20px 60px rgba(28,37,38,0.18), 0 4px 16px rgba(217,119,87,0.12)",
            animation: "slideUp 0.22s ease-out",
          }}
        >
          {/* Panel header */}
          <div className="flex items-center gap-3 px-5 py-4"
            style={{ borderBottom: "1px solid rgba(28,37,38,0.06)", background: "linear-gradient(135deg, #1C2526 0%, #2d3a3b 100%)" }}>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl text-[15px]"
              style={{ background: "rgba(217,119,87,0.2)" }}>🧠</div>
            <div className="flex-1">
              <p className="text-[14px] font-bold text-white">Comeleal AI</p>
              <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.45)" }}>
                Pregunta sobre tu negocio
              </p>
            </div>
            <span className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide"
              style={{ background: "rgba(217,119,87,0.2)", color: "#FF9A45" }}>Beta</span>
            <button
              onClick={handleClose}
              className="ml-1 flex h-7 w-7 items-center justify-center rounded-lg text-[16px] transition-colors hover:bg-white/10"
              style={{ color: "rgba(255,255,255,0.5)" }}>
              ×
            </button>
          </div>

          <div className="p-4 space-y-3">
            {/* Chips */}
            <div className="flex flex-wrap gap-1.5">
              {CHIPS.map((chip) => (
                <button
                  key={chip}
                  onClick={() => { setQuestion(chip); ask(chip); }}
                  disabled={asking || !restaurantId}
                  className="rounded-full px-3 py-1 text-[11px] font-medium transition-all disabled:opacity-40 hover:scale-[1.02]"
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
                placeholder="Escribe tu pregunta..."
                disabled={asking || !restaurantId}
                className="flex-1 rounded-xl px-3 py-2.5 text-[13px] outline-none disabled:opacity-50"
                style={{ background: "#F5F3EF", border: "1px solid rgba(28,37,38,0.1)", color: "#1C2526" }}
                autoFocus
              />
              <button
                type="submit"
                disabled={!question.trim() || asking || !restaurantId}
                className="rounded-xl px-3.5 py-2.5 text-[12px] font-bold text-white transition-opacity disabled:opacity-40"
                style={{ background: "#d97757" }}>
                {asking ? <Spinner /> : "→"}
              </button>
            </form>

            {/* Loading */}
            {asking && (
              <div className="rounded-xl p-4" style={{ background: "rgba(217,119,87,0.04)", border: "1px solid rgba(217,119,87,0.1)" }}>
                <p className="mb-2 text-[9px] font-bold uppercase tracking-widest" style={{ color: "rgba(217,119,87,0.6)" }}>Analizando…</p>
                <div className="space-y-2">
                  {[100, 82, 65].map((w) => (
                    <div key={w} className="h-2.5 rounded-full animate-pulse" style={{ width: `${w}%`, background: "rgba(28,37,38,0.07)" }} />
                  ))}
                </div>
              </div>
            )}

            {/* Answer */}
            {answer && !asking && (
              <div className="rounded-xl p-4" style={{ background: "rgba(217,119,87,0.05)", border: "1px solid rgba(217,119,87,0.14)" }}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[12px]">🧠</span>
                  <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "rgba(217,119,87,0.7)" }}>Comeleal AI</p>
                </div>
                <p className="text-[13px] leading-relaxed whitespace-pre-wrap" style={{ color: "rgba(28,37,38,0.8)" }}>{answer}</p>
              </div>
            )}

            {/* Error */}
            {error && !asking && (
              <p className="text-center text-[12px] py-1" style={{ color: "rgba(28,37,38,0.4)" }}>{error}</p>
            )}
          </div>
        </div>
      )}

      {/* Floating button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full shadow-xl transition-all hover:scale-105 active:scale-95"
        style={{
          background: open ? "#1C2526" : "linear-gradient(135deg, #d97757 0%, #FF9A45 100%)",
          boxShadow: open
            ? "0 4px 20px rgba(28,37,38,0.4)"
            : "0 4px 20px rgba(217,119,87,0.5), 0 2px 8px rgba(217,119,87,0.3)",
        }}
        title="Comeleal AI"
      >
        <span className="text-[20px]" style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.2))" }}>
          {open ? "×" : "🧠"}
        </span>
      </button>

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(16px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)   scale(1); }
        }
      `}</style>
    </>
  );
}
