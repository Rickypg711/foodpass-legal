"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { WizardStepper } from "@/components/vendor/WizardStepper";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import { waitForAuthReady } from "@/lib/auth";
import { persistReadiness } from "@/lib/vendorReadiness";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DayHours {
  isClosed: boolean;
  openingTime: { hour: number; minute: number };
  closingTime: { hour: number; minute: number };
}

type WeekHours = Record<string, DayHours>;

const DAYS = [
  { key: "Monday", label: "Lunes" },
  { key: "Tuesday", label: "Martes" },
  { key: "Wednesday", label: "Miércoles" },
  { key: "Thursday", label: "Jueves" },
  { key: "Friday", label: "Viernes" },
  { key: "Saturday", label: "Sábado" },
  { key: "Sunday", label: "Domingo" },
] as const;

const DEFAULT_HOURS: WeekHours = Object.fromEntries(
  DAYS.map(({ key }) => [
    key,
    { isClosed: false, openingTime: { hour: 9, minute: 0 }, closingTime: { hour: 20, minute: 0 } },
  ])
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtTime(h: number, m: number) {
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function parseTimeStr(val: string): { hour: number; minute: number } {
  const [h, m] = val.split(":").map(Number);
  return { hour: h ?? 0, minute: m ?? 0 };
}

function hoursFromFirestore(raw: Record<string, unknown>): WeekHours {
  const result = { ...DEFAULT_HOURS };
  for (const { key } of DAYS) {
    const d = raw[key] as Record<string, unknown> | undefined;
    if (!d) continue;
    const open = d.openingTime as Record<string, number> | undefined;
    const close = d.closingTime as Record<string, number> | undefined;
    result[key] = {
      isClosed: d.isClosed === true,
      openingTime: open ? { hour: Number(open.hour), minute: Number(open.minute) } : { hour: 9, minute: 0 },
      closingTime: close ? { hour: Number(close.hour), minute: Number(close.minute) } : { hour: 20, minute: 0 },
    };
  }
  return result;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function HorarioSetupPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isWizard = searchParams.get("wizard") === "1";
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [hours, setHours] = useState<WeekHours>(DEFAULT_HOURS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      if (data?.businessHours) {
        setHours(hoursFromFirestore(data.businessHours as Record<string, unknown>));
      }
      setRestaurantId(rid);
      setLoading(false);
    }
    init().catch(() => setLoading(false));
  }, [router]);

  function setDayHours(dayKey: string, patch: Partial<DayHours>) {
    setHours((prev) => ({ ...prev, [dayKey]: { ...prev[dayKey], ...patch } }));
  }

  async function handleSave() {
    if (!restaurantId) return;
    setSaving(true);
    setError(null);
    try {
      const db = getFirebaseDb();
      await updateDoc(doc(db, "restaurants", restaurantId), {
        businessHours: hours,
        hoursConfirmed: true,
        lastUpdated: serverTimestamp(),
      });
      await persistReadiness(restaurantId);
      setSaved(true);
      setTimeout(() => router.push(isWizard ? "/vendor/setup/menu?wizard=1" : "/vendor/setup"), 800);
    } catch (e) {
      console.error(e);
      setError("No pudimos guardar. Intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Spinner />;

  return (
    <div className="min-h-screen bg-[#faf9f5]">
      {/* Nav */}
      <div className="sticky top-0 z-10 bg-white shadow-sm">
        {isWizard ? (
          <WizardStepper current="horario" />
        ) : (
          <div className="border-b border-[#141413]/8 px-4 py-4 sm:px-6">
            <div className="mx-auto flex max-w-lg items-center gap-3">
              <Link href="/vendor/setup" className="text-sm text-[#141413]/45 hover:text-[#141413] transition-colors">← Volver</Link>
              <span className="text-[#141413]/20">/</span>
              <h1 className="text-sm font-semibold text-[#141413]">Horario</h1>
            </div>
          </div>
        )}
      </div>

      <main className="mx-auto max-w-lg px-4 py-6 sm:px-6">
        <div className="mb-6">
          <h2 className="text-lg font-bold text-[#141413]">¿Cuándo estás abierto?</h2>
          <p className="mt-1 text-sm text-[#141413]/50">
            Los clientes ven este horario en tu perfil. Puedes cambiarlo después.
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
        )}

        <div className="flex flex-col gap-2">
          {DAYS.map(({ key, label }) => {
            const day = hours[key];
            return (
              <div key={key} className={`rounded-2xl border px-4 py-4 transition-all ${
                day.isClosed ? "border-[#141413]/8 bg-white opacity-60" : "border-[#141413]/8 bg-white"
              }`}>
                <div className="flex items-center justify-between gap-4">
                  <span className="w-24 text-sm font-semibold text-[#141413]">{label}</span>

                  {/* Closed toggle */}
                  <button
                    type="button"
                    onClick={() => setDayHours(key, { isClosed: !day.isClosed })}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${
                      day.isClosed ? "bg-[#141413]/20" : "bg-[#F28C38]"
                    }`}
                  >
                    <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                      day.isClosed ? "translate-x-0" : "translate-x-4"
                    }`} />
                  </button>

                  {/* Time pickers */}
                  {!day.isClosed ? (
                    <div className="flex items-center gap-2 text-sm">
                      <input
                        type="time"
                        value={fmtTime(day.openingTime.hour, day.openingTime.minute)}
                        onChange={(e) => setDayHours(key, { openingTime: parseTimeStr(e.target.value) })}
                        className="rounded-lg border border-[#141413]/12 bg-[#faf9f5] px-2 py-1.5 text-sm text-[#141413] focus:border-[#F28C38] focus:outline-none"
                      />
                      <span className="text-[#141413]/30">—</span>
                      <input
                        type="time"
                        value={fmtTime(day.closingTime.hour, day.closingTime.minute)}
                        onChange={(e) => setDayHours(key, { closingTime: parseTimeStr(e.target.value) })}
                        className="rounded-lg border border-[#141413]/12 bg-[#faf9f5] px-2 py-1.5 text-sm text-[#141413] focus:border-[#F28C38] focus:outline-none"
                      />
                    </div>
                  ) : (
                    <span className="text-xs text-[#141413]/35 ml-auto">Cerrado</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <button
          onClick={handleSave}
          disabled={saving || saved}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[#F28C38] px-6 py-4 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#c46644] disabled:opacity-60"
        >
          {saved ? "✓ Guardado" : saving ? <><Spin />Guardando…</> : "Guardar horario →"}
        </button>
      </main>
    </div>
  );
}

export default function HorarioSetupPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <HorarioSetupPageInner />
    </Suspense>
  );
}

function Spinner() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#faf9f5]">
      <svg className="h-6 w-6 animate-spin text-[#F28C38]" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 12 5.373 12 12H4z"/>
      </svg>
    </div>
  );
}

function Spin() {
  return (
    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 12 5.373 12 12H4z"/>
    </svg>
  );
}
