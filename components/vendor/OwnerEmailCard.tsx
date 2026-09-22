"use client";

/**
 * "¿A qué correo te mandamos tus avisos?" — tarjeta del panel para el dueño
 * que entró SOLO con su número (22-sep-2026).
 *
 * Por qué: desde hoy el alta acepta teléfono por SMS y muchos dueños no
 * traen correo. Sin correo, los avisos de activación (activation_emails.js
 * en functions: link en la bio, primer pedido, etc.) no tienen a dónde ir;
 * ownerEmail() lee users/{uid}.email primero, así que con guardar eso basta.
 *
 * Reglas: se pide UNA vez y nunca bloquea nada. "Luego" la esconde 7 días
 * en este navegador (localStorage, solo comodidad). Solo escribe `email` en
 * users/{uid} (campo auto-editable por las reglas de Firestore). No toca la
 * cuenta de Auth: no es un login, es un dato de contacto.
 */
import { useEffect, useState } from "react";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import { waitForAuthReady } from "@/lib/auth";

const LATER_KEY = "comeleal.ownerEmailCard.later";
const LATER_MS = 7 * 24 * 60 * 60 * 1000;

export function OwnerEmailCard() {
  const [state, setState] = useState<"hidden" | "ask" | "saving" | "done">("hidden");
  const [uid, setUid] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const u = await waitForAuthReady();
      // Con correo en la cuenta (Google o correo+contraseña) no hay nada que pedir.
      if (!u || u.isAnonymous || u.email) return;
      try {
        const later = Number(localStorage.getItem(LATER_KEY) || 0);
        if (later && Date.now() - later < LATER_MS) return;
      } catch { /* sin localStorage (privado): se pregunta igual */ }
      const snap = await getDoc(doc(getFirebaseDb(), "users", u.uid)).catch(() => null);
      if (snap?.data()?.email) return;
      if (alive) { setUid(u.uid); setState("ask"); }
    })();
    return () => { alive = false; };
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!uid) return;
    const clean = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(clean)) {
      setError("Ese correo no se ve bien. Revísalo.");
      return;
    }
    setError(null);
    setState("saving");
    try {
      await updateDoc(doc(getFirebaseDb(), "users", uid), { email: clean });
      setState("done");
    } catch (err) {
      console.error("[OwnerEmailCard] no se guardó:", err);
      setError("No se pudo guardar. Intenta de nuevo.");
      setState("ask");
    }
  }

  function later() {
    try { localStorage.setItem(LATER_KEY, String(Date.now())); } catch { /* nada */ }
    setState("hidden");
  }

  if (state === "hidden") return null;

  if (state === "done") {
    return (
      <div className="mb-5 rounded-2xl px-5 py-4 text-[13px]"
        style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", color: "#166534" }}>
        ✓ Listo. Ahí te avisamos cuando pase algo con tu menú.
      </div>
    );
  }

  return (
    <div className="mb-5 rounded-2xl p-5"
      style={{
        background: "linear-gradient(135deg, #fff8f5 0%, #ffffff 100%)",
        border: "1px solid rgba(217,119,87,0.22)",
        boxShadow: "0 2px 12px rgba(217,119,87,0.08)",
      }}>
      <p className="text-[13px] font-bold" style={{ color: "#1C2526" }}>
        ¿A qué correo te mandamos tus avisos?
      </p>
      <p className="mt-1 text-[12px]" style={{ color: "rgba(28,37,38,0.55)" }}>
        Entraste con tu número, así que no tenemos tu correo. Es para avisarte de tu menú y de tus clientes. Sin spam.
      </p>
      <form onSubmit={save} className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="tu@correo.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={state === "saving"}
          required
          className="w-full flex-1 rounded-xl border border-[#e8e6dc] bg-white px-4 py-2.5 text-sm text-[#141413] outline-none placeholder:text-[#141413]/30 focus:border-[#F28C38]"
        />
        <button
          type="submit"
          disabled={state === "saving"}
          className="rounded-xl bg-[#F28C38] px-5 py-2.5 text-sm font-bold text-[#1C2526] shadow-sm transition hover:opacity-90 disabled:opacity-50"
        >
          {state === "saving" ? "Guardando…" : "Guardar"}
        </button>
        <button
          type="button"
          onClick={later}
          disabled={state === "saving"}
          className="rounded-xl px-3 py-2.5 text-sm font-semibold"
          style={{ color: "rgba(28,37,38,0.5)" }}
        >
          Luego
        </button>
      </form>
      {error && <p className="mt-2 text-[12px] text-red-600">{error}</p>}
    </div>
  );
}
