"use client";

// La lista caliente del embudo (§6.2 modo 2): prospectos que subieron su
// menú y no han reclamado. Gemini escribe el nudge leyendo SU menú
// (generateDemoNudge, solo plataforma), Ricardo tap-y-enviar por SU
// WhatsApp, y el envío queda estampado (nudgedAt) — human-in-the-loop
// MEDIDO, con fecha de muerte: la Cloud API post-RFC.

import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  Timestamp,
} from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getFirebaseApp, getFirebaseDb } from "@/lib/firebase";
import { waitForAuthReady } from "@/lib/auth";

/** Espejo de PLATFORM_ADMIN_UIDS en functions/menu_demo_ai.js. */
const PLATFORM_ADMIN_UIDS = ["xf69ZR1tWHRJ3z3N7NIolTXKXQF2"];

type Prospect = {
  id: string;
  name: string;
  itemCount: number;
  whatsapp: string | null;
  createdAt: Timestamp | null;
  viewed: boolean;
  played: boolean;
  claimStarted: boolean;
  converted: boolean;
  nudgeCount: number;
  status: string;
};

function ago(ts: Timestamp | null): string {
  if (!ts) return "—";
  const mins = Math.floor((Date.now() - ts.toMillis()) / 60000);
  if (mins < 60) return `hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 48) return `hace ${hrs} h`;
  return `hace ${Math.floor(hrs / 24)} días`;
}

export default function ProspectosPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [rows, setRows] = useState<Prospect[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ jobId: string; text: string; whatsapp: string | null } | null>(null);

  useEffect(() => {
    waitForAuthReady().then(async (u) => {
      const ok = !!u && PLATFORM_ADMIN_UIDS.includes(u.uid);
      setAllowed(ok);
      if (!ok) return;
      const db = getFirebaseDb();
      const snap = await getDocs(
        query(collection(db, "menuDemoJobs"), orderBy("createdAt", "desc"), limit(100)),
      );
      setRows(
        snap.docs.map((d) => {
          const x = d.data();
          return {
            id: d.id,
            name: x.info?.restaurantName || "(menú sin nombre)",
            itemCount: Array.isArray(x.items) ? x.items.length : 0,
            whatsapp: x.whatsapp || null,
            createdAt: x.createdAt ?? null,
            viewed: !!x.viewedAt,
            played: !!x.playedDemoAt,
            claimStarted: !!x.claimStartedAt,
            converted: !!x.convertedToRestaurantId,
            nudgeCount: x.nudgeCount || 0,
            status: x.status || "?",
          };
        }),
      );
    });
  }, []);

  async function nudge(row: Prospect) {
    if (busy) return;
    setBusy(row.id);
    setMsg(null);
    try {
      const fns = getFunctions(getFirebaseApp(), "us-central1");
      const res = await httpsCallable(fns, "generateDemoNudge")({ jobId: row.id });
      const data = res.data as { text: string; whatsapp: string | null };
      setMsg({ jobId: row.id, text: data.text, whatsapp: data.whatsapp });
      if (data.whatsapp) {
        window.open(
          `https://wa.me/52${data.whatsapp}?text=${encodeURIComponent(data.text)}`,
          "_blank",
        );
      }
    } catch (e) {
      console.error("[prospectos] nudge", e);
      setMsg({ jobId: row.id, text: "No se pudo generar el mensaje.", whatsapp: null });
    } finally {
      setBusy(null);
    }
  }

  if (allowed === null) {
    return <main className="p-8 text-sm opacity-60">Cargando…</main>;
  }
  if (!allowed) {
    return <main className="p-8 text-sm">Esta página es de plataforma.</main>;
  }

  const hot = rows.filter((r) => !r.converted && r.status === "ready");
  const converted = rows.filter((r) => r.converted);

  return (
    <main className="min-h-screen px-5 py-8" style={{ background: "#faf9f5" }}>
      <div className="mx-auto w-full max-w-2xl">
        <h1 className="text-[24px] font-extrabold" style={{ color: "#1C2526" }}>
          🔥 Prospectos del embudo
        </h1>
        <p className="mt-1 text-[13px]" style={{ color: "rgba(28,37,38,0.55)" }}>
          Subieron su menú y no lo han reclamado. Gemini escribe, tú tap-y-enviar.
        </p>

        <p className="mt-6 text-[11px] font-bold uppercase tracking-wide"
          style={{ color: "rgba(28,37,38,0.4)" }}>
          Calientes ({hot.length})
        </p>
        <div className="mt-2 flex flex-col gap-2.5">
          {hot.length === 0 && (
            <p className="text-[13px] opacity-50">Nadie esperando. 🎉</p>
          )}
          {hot.map((r) => (
            <div key={r.id} className="rounded-2xl bg-white p-4 shadow-sm"
              style={{ border: "1px solid rgba(28,37,38,0.07)" }}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[15px] font-extrabold" style={{ color: "#1C2526" }}>
                    {r.name}
                  </p>
                  <p className="mt-0.5 text-[12px]" style={{ color: "rgba(28,37,38,0.5)" }}>
                    {r.itemCount} platillos · {ago(r.createdAt)} ·{" "}
                    {r.claimStarted ? "🟠 empezó a reclamar" : r.played ? "🟡 jugó el demo" : r.viewed ? "👀 vio su carta" : "subió la foto"}
                    {r.nudgeCount > 0 && ` · 📨 ${r.nudgeCount} nudge${r.nudgeCount > 1 ? "s" : ""}`}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <a href={`/demo/${r.id}`} target="_blank"
                    className="rounded-xl border px-3 py-2 text-[12px] font-bold"
                    style={{ borderColor: "rgba(28,37,38,0.15)", color: "#1C2526" }}>
                    Ver demo
                  </a>
                  <button
                    type="button"
                    disabled={!r.whatsapp || busy === r.id}
                    onClick={() => nudge(r)}
                    className="rounded-xl px-3 py-2 text-[12px] font-extrabold disabled:opacity-40"
                    style={{ background: "#F28C38", color: "#1C2526" }}
                    title={r.whatsapp ? `wa.me/52${r.whatsapp}` : "No dejó WhatsApp"}
                  >
                    {busy === r.id ? "Escribiendo…" : r.whatsapp ? "💬 Nudge" : "Sin WhatsApp"}
                  </button>
                </div>
              </div>
              {msg?.jobId === r.id && (
                <p className="mt-3 rounded-xl p-3 text-[12px] leading-relaxed"
                  style={{ background: "rgba(242,140,56,0.08)", color: "#1C2526" }}>
                  {msg.text}
                </p>
              )}
            </div>
          ))}
        </div>

        {converted.length > 0 && (
          <>
            <p className="mt-8 text-[11px] font-bold uppercase tracking-wide"
              style={{ color: "rgba(28,37,38,0.4)" }}>
              Convertidos ({converted.length}) 🎉
            </p>
            <div className="mt-2 flex flex-col gap-1.5">
              {converted.map((r) => (
                <p key={r.id} className="text-[13px]" style={{ color: "rgba(28,37,38,0.6)" }}>
                  ✅ {r.name} · {r.itemCount} platillos · {ago(r.createdAt)}
                </p>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
