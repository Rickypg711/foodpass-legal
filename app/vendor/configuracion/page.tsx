"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import { waitForAuthReady } from "@/lib/auth";

export default function ConfiguracionPage() {
  const router = useRouter();
  const [restaurant, setRestaurant] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      const u = await waitForAuthReady();
      if (!u || u.isAnonymous) { router.push("/activar"); return; }
      const db = getFirebaseDb();
      const userSnap = await getDoc(doc(db, "users", u.uid));
      const rid = userSnap.data()?.ownedRestaurantId as string | undefined;
      if (!rid) { router.push("/activar"); return; }
      const rSnap = await getDoc(doc(db, "restaurants", rid));
      setRestaurant(rSnap.data() ?? null);
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
        <h1 className="text-[15px] font-bold" style={{ color: "#1C2526" }}>Configuración</h1>
      </div>
      <main className="px-4 py-6 md:px-8 max-w-xl">
        {loading ? (
          <div className="flex justify-center py-20">
            <svg className="h-5 w-5 animate-spin" style={{ color: "#d97757" }} fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 12 5.373 12 12H4z" />
            </svg>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Restaurant info */}
            <div className="rounded-2xl p-5"
              style={{ background: "#ffffff", border: "1px solid rgba(28,37,38,0.07)" }}>
              <p className="mb-3 text-[10px] font-bold uppercase tracking-widest"
                style={{ color: "rgba(28,37,38,0.35)" }}>
                Restaurante
              </p>
              <Row label="Nombre" value={restaurant?.name as string ?? "—"} />
              <Row label="Estado" value={restaurant?.status as string ?? "—"} />
              <Row label="Puntos por visita" value={String(restaurant?.pointsPerVisit ?? "1")} />
            </div>

            {/* App links */}
            <div className="rounded-2xl p-5"
              style={{ background: "#ffffff", border: "1px solid rgba(28,37,38,0.07)" }}>
              <p className="mb-3 text-[10px] font-bold uppercase tracking-widest"
                style={{ color: "rgba(28,37,38,0.35)" }}>
                Accesos rápidos
              </p>
              <a href="https://apps.apple.com/mx/app/foodpass/id6745301069"
                target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-between py-2.5"
                style={{ borderBottom: "1px solid rgba(28,37,38,0.05)" }}>
                <span className="text-[13px] font-medium" style={{ color: "#1C2526" }}>
                  📱 App cliente (iOS)
                </span>
                <span className="text-[12px]" style={{ color: "#d97757" }}>Abrir →</span>
              </a>
              <Link href="/para-restaurantes"
                className="flex items-center justify-between py-2.5">
                <span className="text-[13px] font-medium" style={{ color: "#1C2526" }}>
                  ❓ Centro de ayuda
                </span>
                <span className="text-[12px]" style={{ color: "#d97757" }}>Ver →</span>
              </Link>
            </div>

            <p className="text-center text-[11px]" style={{ color: "rgba(28,37,38,0.3)" }}>
              Para cambiar la configuración del restaurante, usa la app móvil.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2.5"
      style={{ borderBottom: "1px solid rgba(28,37,38,0.05)" }}>
      <span className="text-[12px]" style={{ color: "rgba(28,37,38,0.45)" }}>{label}</span>
      <span className="text-[13px] font-semibold" style={{ color: "#1C2526" }}>{value}</span>
    </div>
  );
}
