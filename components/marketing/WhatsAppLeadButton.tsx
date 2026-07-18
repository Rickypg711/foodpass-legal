"use client";

// Lead-capture WhatsApp CTA (Ricardo-approved design, lead_capture_design.md):
// click → "¿Cuál es tu número?" modal → save to activationLeads → open wa.me.
// Number captured even if they never send the WhatsApp message.
// Escape hatch link opens WhatsApp directly (no number) — don't lose the impatient.

import { useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import { PUBLIC_WHATSAPP_WA_ME_ACTIVATE } from "@/lib/contactEmail";

export function WhatsAppButton({ label = "💬 Háblanos por WhatsApp" }: { label?: string }) {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);

  function openWa() {
    window.open(PUBLIC_WHATSAPP_WA_ME_ACTIVATE, "_blank", "noopener,noreferrer");
    setOpen(false);
    setBusy(false);
    setPhone("");
  }

  async function saveAndGo() {
    const digits = phone.replace(/\D/g, "").slice(-10);
    if (digits.length !== 10) {
      openWa();
      return;
    }
    setBusy(true);
    try {
      await addDoc(collection(getFirebaseDb(), "activationLeads"), {
        phone: digits,
        source: typeof window !== "undefined" ? window.location.pathname : "",
        createdAt: serverTimestamp(),
      });
    } catch {
      // lead capture is best-effort — never block the WhatsApp open
    }
    openWa();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center gap-2 rounded-2xl px-7 py-4 text-[16px] font-bold text-white transition-all hover:opacity-90 active:scale-[0.98]"
        style={{ background: "#25D366", boxShadow: "0 6px 24px rgba(37,211,102,0.35)" }}
      >
        {label}
      </button>
      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-5"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-3xl bg-white p-6 text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-[17px] font-bold text-[#1C2526]">¿Cuál es tu número de WhatsApp?</p>
            <p className="mt-1 text-[13px] text-[#1C2526]/60">
              Para escribirte nosotros si se corta la conversación. Solo eso.
            </p>
            <input
              type="tel"
              inputMode="numeric"
              maxLength={10}
              autoFocus
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
              placeholder="614 123 4567"
              className="mt-4 w-full rounded-xl px-4 py-3 text-[16px] font-semibold outline-none"
              style={{ border: "1px solid rgba(28,37,38,0.2)", color: "#1C2526" }}
            />
            <button
              type="button"
              disabled={busy}
              onClick={saveAndGo}
              className="mt-3 w-full rounded-xl px-4 py-3 text-[15px] font-bold text-white disabled:opacity-50"
              style={{ background: "#25D366" }}
            >
              {busy ? "Abriendo…" : "Continuar a WhatsApp →"}
            </button>
            <button
              type="button"
              onClick={openWa}
              className="mt-2 w-full text-center text-[12px] underline underline-offset-2"
              style={{ color: "rgba(28,37,38,0.45)" }}
            >
              abrir WhatsApp directo sin dejar número
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
