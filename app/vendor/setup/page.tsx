"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import { waitForAuthReady } from "@/lib/auth";
import { completedStepCount, stepGroupFromReasons } from "@/lib/vendorReadiness";

// ─── Step definitions ─────────────────────────────────────────────────────────

const STEPS = [
  {
    key: "hours" as const,
    icon: "🕐",
    title: "Horario",
    description: "Configura cuándo estás abierto",
    href: "/vendor/setup/horario",
    doneLabel: "Horario confirmado",
  },
  {
    key: "menu" as const,
    icon: "🍽️",
    title: "Menú",
    description: "Agrega tus platillos — foto o manual",
    href: "/vendor/setup/menu",
    doneLabel: "Menú listo",
  },
  {
    key: "rewards" as const,
    icon: "🎁",
    title: "Recompensas",
    description: "Diseña tu programa de lealtad con IA",
    href: "/vendor/setup/recompensas",
    doneLabel: "Recompensas activas",
  },
] as const;

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SetupPage() {
  const router = useRouter();
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [reasons, setReasons] = useState<string[]>([]);
  const [restaurantName, setRestaurantName] = useState("");
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
      const data = rSnap.data();
      if (data?.isSetupComplete) { router.push("/vendor"); return; }
      setRestaurantId(rid);
      setReasons((data?.setupIncompleteReasons as string[]) ?? ["business_hours","menu_items","reward_tiers","first_purchase_reward"]);
      setRestaurantName((data?.name as string) ?? "Tu restaurante");
      setLoading(false);
    }
    init().catch(() => setLoading(false));
  }, [router]);

  if (loading) return <LoadingScreen />;

  const pending = stepGroupFromReasons(reasons);
  const done = completedStepCount(reasons);
  const total = 3; // hours, menu, rewards (business captured at signup)
  const donePct = Math.round((done / total) * 100);

  return (
    <div className="min-h-screen bg-[#faf9f5]">
      {/* Header */}
      <div className="border-b border-[#141413]/8 bg-white px-4 py-4 sm:px-6">
        <div className="mx-auto max-w-lg">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#d97757]">Configuración inicial</p>
          <h1 className="mt-1 text-xl font-bold text-[#141413]">
            Activa {restaurantName}
          </h1>
          <p className="mt-1 text-sm text-[#141413]/50">
            Completa los pasos para empezar a escanear clientes
          </p>

          {/* Progress bar */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-[#141413]/45 mb-1.5">
              <span>{done} de {total} pasos completados</span>
              <span className="font-medium text-[#d97757]">{donePct}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-[#141413]/8 overflow-hidden">
              <div
                className="h-full rounded-full bg-[#d97757] transition-all duration-500"
                style={{ width: `${donePct}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Steps */}
      <main className="mx-auto max-w-lg px-4 py-6 sm:px-6">
        <div className="flex flex-col gap-3">
          {STEPS.map((step) => {
            const isDone = !pending[step.key];
            return (
              <Link
                key={step.key}
                href={step.href}
                className={`group flex items-center gap-4 rounded-2xl border p-5 transition-all ${
                  isDone
                    ? "border-[#d97757]/20 bg-[#d97757]/5"
                    : "border-[#141413]/8 bg-white hover:border-[#d97757]/40 hover:shadow-sm"
                }`}
              >
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-xl ${
                  isDone ? "bg-[#d97757]/15" : "bg-[#141413]/5 group-hover:bg-[#d97757]/10"
                }`}>
                  {isDone ? "✓" : step.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${isDone ? "text-[#d97757]" : "text-[#141413]"}`}>
                    {isDone ? step.doneLabel : step.title}
                  </p>
                  <p className="mt-0.5 text-xs text-[#141413]/45 truncate">
                    {isDone ? "Listo ✓" : step.description}
                  </p>
                </div>
                {!isDone && (
                  <svg className="h-5 w-5 shrink-0 text-[#141413]/25 group-hover:text-[#d97757] transition-colors" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                )}
              </Link>
            );
          })}
        </div>

        {/* Skip to dashboard */}
        <div className="mt-6 text-center">
          <Link href="/vendor" className="text-sm text-[#141413]/35 hover:text-[#141413]/60 transition-colors">
            Ir al panel sin completar →
          </Link>
        </div>
      </main>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#faf9f5]">
      <svg className="h-6 w-6 animate-spin text-[#d97757]" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 12 5.373 12 12H4z" />
      </svg>
    </div>
  );
}
