"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import { waitForAuthReady } from "@/lib/auth";

export default function BrainPage() {
  const router = useRouter();
  const [brief, setBrief] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      const u = await waitForAuthReady();
      if (!u || u.isAnonymous) { router.push("/activar"); return; }
      const db = getFirebaseDb();
      const userSnap = await getDoc(doc(db, "users", u.uid));
      const rid = userSnap.data()?.ownedRestaurantId as string | undefined;
      if (!rid) { router.push("/activar"); return; }
      const insSnap = await getDoc(doc(db, "restaurants", rid, "vendorInsights", "current"));
      setBrief(insSnap.data()?.weeklyBriefText as string ?? null);
      setLoading(false);
    }
    init().catch(() => setLoading(false));
  }, [router]);

  return (
    <div className="min-h-screen" style={{ background: "#F5F3EF" }}>
      <div className="sticky top-0 z-10 flex items-center gap-3 px-6 py-4"
        style={{ background: "#ffffff", borderBottom: "1px solid rgba(28,37,38,0.07)" }}>
        <Link href="/vendor" className="text-[13px] font-medium" style={{ color: "rgba(28,37,38,0.45)" }}>
          ← Panel
        </Link>
        <span style={{ color: "rgba(28,37,38,0.2)" }}>/</span>
        <h1 className="text-[15px] font-bold" style={{ color: "#1C2526" }}>Brain AI</h1>
      </div>
      <main className="px-4 py-8 md:px-8 md:py-12 max-w-2xl">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl text-[22px]"
            style={{ background: "rgba(242,140,56,0.1)" }}>🧠</div>
          <div>
            <p className="text-[18px] font-bold" style={{ color: "#1C2526" }}>Comeleal Brain</p>
            <p className="text-[12px]" style={{ color: "rgba(28,37,38,0.4)" }}>
              IA nativa para tu restaurante
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <svg className="h-5 w-5 animate-spin" style={{ color: "#F28C38" }} fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 12 5.373 12 12H4z" />
            </svg>
          </div>
        ) : brief ? (
          <div className="rounded-2xl p-6"
            style={{ background: "#ffffff", border: "1px solid rgba(242,140,56,0.16)", boxShadow: "0 1px 4px rgba(28,37,38,0.06)" }}>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest" style={{ color: "rgba(242,140,56,0.7)" }}>
              Resumen semanal
            </p>
            <p className="text-[14px] leading-relaxed" style={{ color: "rgba(28,37,38,0.7)" }}>
              {brief}
            </p>
          </div>
        ) : (
          <div className="rounded-2xl p-8 text-center"
            style={{ background: "#ffffff", border: "1px dashed rgba(242,140,56,0.22)", boxShadow: "0 1px 4px rgba(28,37,38,0.05)" }}>
            <p className="text-[32px] mb-3">⏳</p>
            <p className="text-[15px] font-semibold" style={{ color: "rgba(28,37,38,0.55)" }}>
              Acumulando datos
            </p>
            <p className="mt-2 text-[13px] leading-relaxed" style={{ color: "rgba(28,37,38,0.38)" }}>
              El Brain analiza los patrones de visita de tus clientes y genera un resumen semanal
              automáticamente. Escanea más clientes para activarlo.
            </p>
            <Link href="/vendor/scanner"
              className="mt-5 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-[13px] font-bold text-white"
              style={{ background: "#F28C38" }}>
              Escanear cliente
            </Link>
          </div>
        )}

        <div className="mt-6 grid grid-cols-2 gap-3">
          {[
            { emoji: "📅", title: "Días pico", desc: "Qué días visitan más tus clientes" },
            { emoji: "🔁", title: "Retención", desc: "Tasa de clientes que regresan" },
            { emoji: "👑", title: "Top clientes", desc: "Los más fieles de tu negocio" },
            { emoji: "⚠️", title: "En riesgo", desc: "Quién no ha regresado en 14+ días" },
          ].map((f) => (
            <div key={f.title} className="rounded-2xl p-4"
              style={{ background: "#ffffff", border: "1px solid rgba(28,37,38,0.07)" }}>
              <span className="text-[18px]">{f.emoji}</span>
              <p className="mt-2 text-[13px] font-semibold" style={{ color: "#1C2526" }}>{f.title}</p>
              <p className="mt-0.5 text-[11px]" style={{ color: "rgba(28,37,38,0.38)" }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
