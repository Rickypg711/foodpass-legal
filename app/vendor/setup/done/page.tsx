"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import { waitForAuthReady } from "@/lib/auth";

export default function SetupDonePage() {
  const router = useRouter();
  const [restaurantName, setRestaurantName] = useState("Tu restaurante");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      const u = await waitForAuthReady();
      if (!u || u.isAnonymous) { router.push("/activar"); return; }
      const db = getFirebaseDb();
      const uSnap = await getDoc(doc(db, "users", u.uid));
      const rid = uSnap.data()?.ownedRestaurantId as string | undefined;
      if (!rid) { router.push("/activar"); return; }
      const rSnap = await getDoc(doc(db, "restaurants", rid));
      const name = (rSnap.data()?.name as string | undefined)?.trim();
      if (name) setRestaurantName(name);
      setLoading(false);
    }
    init().catch(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#faf9f5]">
        <svg className="h-6 w-6 animate-spin text-[#d97757]" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 12 5.373 12 12H4z"/>
        </svg>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#faf9f5] px-4">
      <div className="mx-auto w-full max-w-sm text-center">

        {/* Celebration icon */}
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[#d97757]/10">
          <span className="text-4xl" role="img" aria-label="confetti">🎉</span>
        </div>

        {/* Headline */}
        <h1 className="text-2xl font-bold tracking-tight text-[#141413]">
          ¡{restaurantName} está listo!
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-[#141413]/55">
          Ya tienes horario, menú y recompensas configurados.
          Tus clientes pueden escanearte y ganar puntos desde ahora.
        </p>

        {/* Divider */}
        <div className="my-8 h-px w-full bg-[#141413]/8" />

        {/* QR callout */}
        <div className="rounded-2xl border border-[#d97757]/20 bg-[#d97757]/5 px-4 py-4">
          <p className="text-sm font-semibold text-[#d97757]">Siguiente paso</p>
          <p className="mt-1 text-sm text-[#141413]/65">
            Imprime tu QR y ponlo en caja para que los clientes escaneen.
          </p>
        </div>

        {/* CTA */}
        <button
          onClick={() => router.push("/vendor")}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[#d97757] px-6 py-4 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#c46644]"
        >
          Ver mi panel →
        </button>

        <button
          onClick={() => router.push("/vendor/setup")}
          className="mt-3 w-full text-xs text-[#141413]/35 hover:text-[#141413]/60 transition-colors"
        >
          Revisar configuración
        </button>
      </div>
    </div>
  );
}
