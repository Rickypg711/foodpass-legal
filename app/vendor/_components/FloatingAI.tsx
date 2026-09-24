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

// Día cero (cazado por Ricardo, 26-ago): "¿Quiénes son mis VIP?" a un dueño
// sin una sola venta garantiza un "no tienes datos" — su PRIMERA plática
// con nuestra IA sería una decepción. El primer día se sugiere lo que la
// IA sí puede clavar hoy.
const DAY_ZERO_CHIPS = [
  "¿Cómo funcionan los puntos para mis clientes?",
  "¿Qué premio de bienvenida me conviene?",
  "¿Cómo imprimo y comparto mi QR?",
  "¿Cómo me llegan los pedidos?",
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
    <svg className="h-4 w-4 animate-spin shrink-0" style={{ color: "#F28C38" }} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 12 5.373 12 12H4z" />
    </svg>
  );
}

export default function FloatingAI({
  restaurantId,
  open,
  setOpen,
  setupIncomplete = false,
}: {
  restaurantId: string | null;
  open: boolean;
  setOpen: (o: boolean | ((prev: boolean) => boolean)) => void;
  setupIncomplete?: boolean;
}) {
  const chips = setupIncomplete ? DAY_ZERO_CHIPS : CHIPS;
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
    // Snapshot the conversation so far (before adding this question) so the
    // brain has context for follow-ups like "¿y por qué?".
    const priorHistory = messages.slice(-6).map((m) => ({ role: m.role, text: m.text }));
    setMessages((prev) => [...prev, { role: "user", text: userMsg }]);
    setAsking(true);
    try {
      const fn = httpsCallable<Record<string, unknown>, { answer: string }>(
        getFirebaseFunctions(),
        "queryRestaurantBrain"
      );
      const res = await fn({ restaurantId, question: userMsg, history: priorHistory });
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
          background: "#FFFFFF",
          borderLeft: "1px solid #D9D2C5",
          transform: open ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.25s cubic-bezier(0.32,0.72,0,1)",
        }}
      >
        {/* Header */}
        {/* Opción A (24-sep-2026): cabecera crema con título en Lora, sin
            cerebro ni "Beta"; el contexto va como caption. */}
        <div
          className="flex shrink-0 items-center gap-3 px-5 py-4"
          style={{ background: "#FAF9F5", borderBottom: "1px solid #E9E3D7" }}
        >
          <div className="flex-1 min-w-0">
            <p className="text-[17px] font-semibold leading-[22px]" style={{ color: "#1C2526", fontFamily: "var(--font-lora), Lora, Georgia, serif" }}>
              Pregúntale a Comeleal
            </p>
            <p className="truncate text-[13px] leading-4" style={{ color: "#5B6366" }}>
              Sobre {pageLabel}
            </p>
          </div>
          {messages.length > 0 && (
            <button
              type="button"
              onClick={() => setMessages([])}
              className="flex h-11 items-center px-2 text-[14px] font-semibold hover:underline"
              style={{ color: "#8A4B12" }}
            >
              Limpiar
            </button>
          )}
          <button
            type="button"
            onClick={handleClose}
            aria-label="Cerrar"
            className="flex h-11 w-11 items-center justify-center rounded-xl transition hover:bg-[#F0EBE1]"
            style={{ color: "#1C2526" }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>

        {/* Thread */}
        <div ref={threadRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.length === 0 && !asking && (
            <div className="flex flex-col items-center py-10 text-center">
              <div
                className="flex h-14 w-14 items-center justify-center rounded-full"
                style={{ background: "#F0EBE1", color: "#5B6366" }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M21 12a8 8 0 0 1-11.6 7.2L4 21l1.8-4.6A8 8 0 1 1 21 12z" /></svg>
              </div>
              <p className="mt-4 text-[17px] font-semibold" style={{ color: "#1C2526", fontFamily: "var(--font-lora), Lora, Georgia, serif" }}>
                ¿Qué quieres saber de tu negocio?
              </p>
              <p className="mt-1.5 max-w-[240px] text-[14px] leading-[20px]" style={{ color: "#3F4A4D" }}>
                {setupIncomplete
                  ? "Te ayudo a arrancar: puntos, premios, tu QR y tus pedidos."
                  : "Analiza tus clientes, ventas y tendencias en segundos."}
              </p>

              {/* Chips */}
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {chips.map((chip) => (
                  <button
                    key={chip}
                    onClick={() => ask(chip)}
                    disabled={!restaurantId}
                    className="flex h-9 items-center rounded-full bg-white px-3.5 text-[14px] transition hover:bg-[#F0EBE1] disabled:opacity-40"
                    style={{ color: "#1C2526", border: "1px solid #D9D2C5" }}
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
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold"
                  style={{ background: "#F0EBE1", color: "#1C2526" }}
                  aria-hidden
                >
                  C
                </div>
              )}
              <div
                className="whitespace-pre-wrap rounded-xl px-4 py-2.5 text-[14px] leading-[20px]"
                style={
                  msg.role === "user"
                    ? { background: "#1C2526", color: "#FAF9F5", maxWidth: "80%", borderBottomRightRadius: 4 }
                    : { background: "#F0EBE1", color: "#1C2526", maxWidth: "85%", borderBottomLeftRadius: 4 }
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
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold"
                style={{ background: "#F0EBE1", color: "#1C2526" }}
                aria-hidden
              >
                C
              </div>
              <div
                className="flex items-center gap-2 rounded-xl px-4 py-3"
                style={{ background: "#F0EBE1", borderBottomLeftRadius: 4 }}
              >
                <Spinner />
                <span className="text-[13px]" style={{ color: "#3F4A4D" }}>Revisando tus números…</span>
              </div>
            </div>
          )}

          {/* Chips after first exchange */}
          {messages.length > 0 && !asking && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {chips.filter((c) => !messages.some((m) => m.text === c)).slice(0, 3).map((chip) => (
                <button
                  key={chip}
                  onClick={() => ask(chip)}
                  disabled={!restaurantId}
                  className="flex h-9 items-center rounded-full bg-white px-3.5 text-[14px] transition hover:bg-[#F0EBE1] disabled:opacity-40"
                  style={{ color: "#1C2526", border: "1px solid #D9D2C5" }}
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
          style={{ borderTop: "1px solid #E9E3D7", background: "#FAF9F5" }}
        >
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Escribe tu pregunta"
              aria-label="Tu pregunta"
              disabled={asking || !restaurantId}
              className="h-12 min-w-0 flex-1 rounded-xl px-4 text-[16px] outline-none placeholder:text-[#5B6366] focus:border-[#1C2526] disabled:opacity-50"
              style={{ background: "#FFFFFF", border: "1px solid #D9D2C5", color: "#1C2526" }}
            />
            <button
              type="submit"
              disabled={!question.trim() || asking || !restaurantId}
              aria-label="Enviar pregunta"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition hover:opacity-90 disabled:opacity-40"
              style={{ background: "#F28C38", color: "#1C2526" }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            </button>
          </form>
        </div>
      </div>

      {/* Floating trigger — oculto en el Panel: ahí la tarjeta grande de
          Comeleal AI ya es la puerta (el 🧠 salía TRES veces en una sola
          pantalla — poda de Ricardo, 26-ago). En Caja/Pedidos/etc. la
          burbuja sigue siendo la única entrada. Si el chat ya está abierto,
          el botón se queda para poder cerrarlo. */}
      {(open || pathname !== "/vendor") && (
      <button
        onClick={() => setOpen((o) => !o)}
        className={`fixed bottom-[88px] right-4 z-[29] flex h-12 w-12 items-center justify-center rounded-full shadow-xl transition-all hover:scale-105 active:scale-95 md:right-6 md:z-[49] ${pathname === "/vendor/pos" ? "md:bottom-24" : "md:bottom-6"}`}
        style={{
          background: "#1C2526",
          color: "#FAF9F5",
          boxShadow: "0 4px 16px rgba(28,37,38,0.25)",
          right: open ? 392 : 24,
          transition: "right 0.25s cubic-bezier(0.32,0.72,0,1)",
        }}
        title="Pregúntale a Comeleal"
        aria-label={open ? "Cerrar Comeleal AI" : "Pregúntale a Comeleal"}
      >
        {open ? (
          <span className="text-[20px] leading-none">×</span>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 1-13.3 7.9L3 21l1.1-4.7A9 9 0 1 1 21 12z" /><path d="M8 12h.01M12 12h.01M16 12h.01" /></svg>
        )}
      </button>
      )}
    </>
  );
}
