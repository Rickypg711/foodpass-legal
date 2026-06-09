"use client";

import { useState, useRef, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { httpsCallable } from "firebase/functions";
import { getFirebaseFunctions } from "@/lib/firebase";

const CHIPS = [
  "¿Qué días visitan más mis clientes?",
  "¿Quiénes son mis VIP?",
  "¿Cómo mejorar la retención?",
  "¿Cuándo lanzar una promoción?",
];

const PAGE_LABELS: Record<string, string> = {
  "/vendor": "Panel",
  "/vendor/pos": "Caja / POS",
  "/vendor/clientes": "Clientes",
  "/vendor/reportes": "Reportes",
  "/vendor/recompensas": "Recompensas",
  "/vendor/configuracion": "Configuración",
  "/vendor/scanner": "Escanear",
};

interface Message {
  role: "user" | "ai";
  text: string;
}

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin shrink-0" style={{ color: "#d97757" }} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 12 5.373 12 12H4z" />
    </svg>
  );
}

export default function FloatingAI({
  restaurantId,
  open,
  setOpen,
}: {
  restaurantId: string | null;
  open: boolean;
  setOpen: (o: boolean | ((prev: boolean) => boolean)) => void;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const lastSubmittedQuery = useRef<string | null>(null);

  const pageLabel = PAGE_LABELS[pathname] ?? "Panel";

  // Auto-submit URL query parameter ?q=... or open with ?ai=1 on any page
  useEffect(() => {
    if (!restaurantId) return;
    const params = new URLSearchParams(window.location.search);
    const q = params.get("q");
    const ai = params.get("ai");

    let shouldClean = false;
    if (q && q !== lastSubmittedQuery.current) {
      lastSubmittedQuery.current = q;
      setOpen(true);
      shouldClean = true;
      ask(q);
    } else if (ai === "1") {
      setOpen(true);
      shouldClean = true;
    }

    if (shouldClean) {
      // Clean query parameter from URL
      const newUrl = window.location.pathname;
      window.history.replaceState({}, "", newUrl);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId, pathname, searchParams]);


  // Auto-scroll thread to bottom on new message
  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [messages, asking]);

  // Focus input when opened
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 150);
  }, [open]);

  async function ask(q: string) {
    if (!restaurantId || !q.trim() || asking) return;
    const userMsg = q.trim();
    setQuestion("");
    setMessages((prev) => [...prev, { role: "user", text: userMsg }]);
    setAsking(true);
    try {
      const fn = httpsCallable<Record<string, unknown>, { answer: string }>(
        getFirebaseFunctions(),
        "queryRestaurantBrain"
      );
      const res = await fn({ restaurantId, question: userMsg });
      setMessages((prev) => [...prev, { role: "ai", text: res.data.answer ?? "Sin respuesta." }]);
    } catch {
      setMessages((prev) => [...prev, { role: "ai", text: "No pude conectar con Comeleal AI. Intenta de nuevo." }]);
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
  }

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          style={{ background: "rgba(28,37,38,0.4)", backdropFilter: "blur(2px)" }}
          onClick={handleClose}
        />
      )}

      {/* ── Right sidebar ── */}
      <div
        className="fixed top-0 right-0 z-50 flex h-full flex-col"
        style={{
          width: 380,
          maxWidth: "100vw",
          background: "#ffffff",
          borderLeft: "1px solid rgba(28,37,38,0.1)",
          boxShadow: "-8px 0 32px rgba(28,37,38,0.12)",
          transform: open ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.25s cubic-bezier(0.32,0.72,0,1)",
        }}
      >
        {/* Header */}
        <div
          className="flex shrink-0 items-center gap-3 px-5 py-4"
          style={{
            background: "linear-gradient(135deg, #1C2526 0%, #2d3a3b 100%)",
            borderBottom: "1px solid rgba(255,255,255,0.07)",
          }}
        >
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl text-[17px]"
            style={{ background: "rgba(217,119,87,0.2)" }}
          >
            🧠
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-[14px] font-bold text-white">Comeleal AI</p>
              <span
                className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide"
                style={{ background: "rgba(217,119,87,0.2)", color: "#FF9A45" }}
              >
                Beta
              </span>
            </div>
            <p className="text-[11px] truncate" style={{ color: "rgba(255,255,255,0.4)" }}>
              Viendo: {pageLabel}
            </p>
          </div>
          {messages.length > 0 && (
            <button
              onClick={() => setMessages([])}
              className="rounded-lg px-2.5 py-1 text-[10px] font-bold transition-colors hover:bg-white/10"
              style={{ color: "rgba(255,255,255,0.4)" }}
            >
              Limpiar
            </button>
          )}
          <button
            onClick={handleClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[18px] transition-colors hover:bg-white/10"
            style={{ color: "rgba(255,255,255,0.5)" }}
          >
            ×
          </button>
        </div>

        {/* Thread */}
        <div ref={threadRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.length === 0 && !asking && (
            <div className="flex flex-col items-center py-10 text-center">
              <div
                className="flex h-14 w-14 items-center justify-center rounded-2xl text-[26px]"
                style={{ background: "rgba(217,119,87,0.08)" }}
              >
                🧠
              </div>
              <p className="mt-4 text-[15px] font-bold" style={{ color: "#1C2526" }}>
                Pregúntale a Comeleal AI
              </p>
              <p className="mt-1.5 text-[12px] leading-relaxed max-w-[220px]" style={{ color: "rgba(28,37,38,0.45)" }}>
                Analiza tus clientes, ventas y tendencias en segundos.
              </p>

              {/* Chips */}
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {CHIPS.map((chip) => (
                  <button
                    key={chip}
                    onClick={() => ask(chip)}
                    disabled={!restaurantId}
                    className="rounded-full px-3 py-1.5 text-[11px] font-medium transition-all hover:scale-[1.02] disabled:opacity-40"
                    style={{
                      background: "rgba(217,119,87,0.08)",
                      color: "#d97757",
                      border: "1px solid rgba(217,119,87,0.18)",
                    }}
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
              {msg.role === "ai" && (
                <div
                  className="shrink-0 flex h-7 w-7 items-center justify-center rounded-xl text-[13px]"
                  style={{ background: "rgba(217,119,87,0.1)" }}
                >
                  🧠
                </div>
              )}
              <div
                className="rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed whitespace-pre-wrap"
                style={
                  msg.role === "user"
                    ? { background: "#1C2526", color: "#ffffff", maxWidth: "80%", borderBottomRightRadius: 6 }
                    : { background: "rgba(217,119,87,0.07)", color: "#1C2526", maxWidth: "85%", border: "1px solid rgba(217,119,87,0.14)", borderBottomLeftRadius: 6 }
                }
              >
                {msg.text}
              </div>
            </div>
          ))}

          {/* Thinking indicator */}
          {asking && (
            <div className="flex gap-2.5">
              <div
                className="shrink-0 flex h-7 w-7 items-center justify-center rounded-xl text-[13px]"
                style={{ background: "rgba(217,119,87,0.1)" }}
              >
                🧠
              </div>
              <div
                className="flex items-center gap-2 rounded-2xl px-4 py-3"
                style={{ background: "rgba(217,119,87,0.07)", border: "1px solid rgba(217,119,87,0.14)", borderBottomLeftRadius: 6 }}
              >
                <Spinner />
                <span className="text-[12px]" style={{ color: "rgba(28,37,38,0.5)" }}>Analizando…</span>
              </div>
            </div>
          )}

          {/* Chips after first exchange */}
          {messages.length > 0 && !asking && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {CHIPS.filter((c) => !messages.some((m) => m.text === c)).slice(0, 3).map((chip) => (
                <button
                  key={chip}
                  onClick={() => ask(chip)}
                  disabled={!restaurantId}
                  className="rounded-full px-3 py-1 text-[11px] font-medium transition-all hover:scale-[1.02] disabled:opacity-40"
                  style={{
                    background: "rgba(217,119,87,0.06)",
                    color: "#d97757",
                    border: "1px solid rgba(217,119,87,0.14)",
                  }}
                >
                  {chip}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Input */}
        <div
          className="shrink-0 px-4 py-4"
          style={{ borderTop: "1px solid rgba(28,37,38,0.07)", background: "#fafaf9" }}
        >
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Escribe tu pregunta..."
              disabled={asking || !restaurantId}
              className="flex-1 rounded-xl px-4 py-2.5 text-[13px] outline-none disabled:opacity-50"
              style={{
                background: "#ffffff",
                border: "1px solid rgba(28,37,38,0.12)",
                color: "#1C2526",
              }}
            />
            <button
              type="submit"
              disabled={!question.trim() || asking || !restaurantId}
              className="rounded-xl px-4 py-2.5 text-[13px] font-bold text-white transition-opacity disabled:opacity-40"
              style={{ background: "linear-gradient(135deg, #d97757 0%, #FF9A45 100%)" }}
            >
              →
            </button>
          </form>
        </div>
      </div>

      {/* Floating trigger button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-6 right-6 z-[49] flex h-12 w-12 items-center justify-center rounded-full shadow-xl transition-all hover:scale-105 active:scale-95"
        style={{
          background: open ? "#1C2526" : "linear-gradient(135deg, #d97757 0%, #FF9A45 100%)",
          boxShadow: open
            ? "0 4px 20px rgba(28,37,38,0.4)"
            : "0 4px 20px rgba(217,119,87,0.5)",
          right: open ? 392 : 24,
          transition: "right 0.25s cubic-bezier(0.32,0.72,0,1), background 0.2s",
        }}
        title="Comeleal AI"
      >
        <span className="text-[20px]">{open ? "×" : "🧠"}</span>
      </button>
    </>
  );
}
