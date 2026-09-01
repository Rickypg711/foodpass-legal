"use client";

/**
 * Horario del negocio.
 *
 * QUE CAMBIÓ Y POR QUÉ (23 ago 2026). La versión anterior eran 7 filas
 * idénticas con 14 `<input type="time">`. Tres problemas, todos con víctimas
 * reales:
 *
 * 1. Casi ningún negocio tiene 7 horarios distintos. Se pedían 14 datos para
 *    capturar dos. Ahora se captura UN patrón y solo se escriben las
 *    excepciones.
 * 2. El input nativo dejaba guardar "11:00 a.m. → 12:55 p.m." sin decir nada.
 *    Un restaurante real lleva 18 días anunciando que cierra a la una de la
 *    tarde por eso. Ahora la hora se elige de una lista anclada, con la
 *    duración a la vista.
 * 3. Nada te decía qué iba a ver tu cliente. Ahora la pantalla enseña, en
 *    vivo y con la MISMA función que corre el menú (`isOpenNow`), el letrero
 *    que va a salir en tu página. Se edita viendo el resultado, no el dato.
 */

import { useEffect, useMemo, useState, useSyncExternalStore, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { WizardStepper } from "@/components/vendor/WizardStepper";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import { waitForAuthReady } from "@/lib/auth";
import { persistReadiness, wizardDoneKeys } from "@/lib/vendorReadiness";
import { isOpenNow } from "@/lib/schedule";
import {
  TimeSelect, formatoHora, formatoDuracion, duracionVentana, type HM,
} from "@/components/vendor/TimeSelect";

// ─── Modelo ───────────────────────────────────────────────────────────────────

interface DayHours {
  isClosed: boolean;
  openingTime: HM;
  closingTime: HM;
}
type WeekHours = Record<string, DayHours>;

const DAYS = [
  { key: "Monday", label: "Lunes", corto: "L" },
  { key: "Tuesday", label: "Martes", corto: "M" },
  { key: "Wednesday", label: "Miércoles", corto: "M" },
  { key: "Thursday", label: "Jueves", corto: "J" },
  { key: "Friday", label: "Viernes", corto: "V" },
  { key: "Saturday", label: "Sábado", corto: "S" },
  { key: "Sunday", label: "Domingo", corto: "D" },
] as const;

const PATRON_INICIAL: DayHours = {
  isClosed: false,
  openingTime: { hour: 13, minute: 0 },
  closingTime: { hour: 22, minute: 0 },
};

const mismaHora = (a: HM, b: HM) => a.hour === b.hour && a.minute === b.minute;
const mismoHorario = (a: DayHours, b: DayHours) =>
  mismaHora(a.openingTime, b.openingTime) && mismaHora(a.closingTime, b.closingTime);

function hoursFromFirestore(raw: Record<string, unknown>): WeekHours {
  const out: WeekHours = {};
  for (const { key } of DAYS) {
    const d = raw?.[key] as Record<string, unknown> | undefined;
    const open = d?.openingTime as Record<string, number> | undefined;
    const close = d?.closingTime as Record<string, number> | undefined;
    out[key] = {
      isClosed: d?.isClosed === true,
      openingTime: open ? { hour: Number(open.hour), minute: Number(open.minute) } : PATRON_INICIAL.openingTime,
      closingTime: close ? { hour: Number(close.hour), minute: Number(close.minute) } : PATRON_INICIAL.closingTime,
    };
  }
  return out;
}

/** El horario que más se repite entre los días abiertos: ese es "el patrón". */
function patronDe(hours: WeekHours): DayHours {
  const abiertos = DAYS.map(({ key }) => hours[key]).filter((d) => d && !d.isClosed);
  if (abiertos.length === 0) return PATRON_INICIAL;
  let mejor = abiertos[0], mejorN = 0;
  for (const cand of abiertos) {
    const n = abiertos.filter((d) => mismoHorario(d, cand)).length;
    if (n > mejorN) { mejor = cand; mejorN = n; }
  }
  return { isClosed: false, openingTime: mejor.openingTime, closingTime: mejor.closingTime };
}

// ─── Reloj ────────────────────────────────────────────────────────────────────

let relojMs = 0;
function suscribirReloj(avisar: () => void) {
  const id = setInterval(() => { relojMs = Date.now(); avisar(); }, 30_000);
  return () => clearInterval(id);
}
function leerReloj() {
  if (relojMs === 0) relojMs = Date.now();
  return relojMs;
}

// ─── Página ───────────────────────────────────────────────────────────────────

function HorarioSetupPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isWizard = searchParams.get("wizard") === "1";

  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [stepperDone, setStepperDone] = useState<Array<"horario" | "menu" | "rewards"> | undefined>(undefined);
  const [patron, setPatron] = useState<DayHours>(PATRON_INICIAL);
  const [cerrados, setCerrados] = useState<Set<string>>(new Set());
  const [propios, setPropios] = useState<Record<string, DayHours>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // El servidor entrega 0 ("Calculando…") y el cliente lo llena: así el
  // letrero en vivo no desincroniza la hidratación.
  const ms = useSyncExternalStore(suscribirReloj, leerReloj, () => 0);
  const ahora = ms === 0 ? null : new Date(ms);

  useEffect(() => {
    async function init() {
      const u = await waitForAuthReady();
      if (!u || u.isAnonymous) { router.push("/activar"); return; }
      const db = getFirebaseDb();
      const uSnap = await getDoc(doc(db, "users", u.uid));
      const rid = uSnap.data()?.ownedRestaurantId as string | undefined;
      if (!rid) { router.push("/activar"); return; }
      const rSnap = await getDoc(doc(db, "restaurants", rid));
      setStepperDone(wizardDoneKeys(rSnap.data()?.setupIncompleteReasons));
      const raw = rSnap.data()?.businessHours as Record<string, unknown> | undefined;
      if (raw) {
        const semana = hoursFromFirestore(raw);
        const p = patronDe(semana);
        setPatron(p);
        setCerrados(new Set(DAYS.filter(({ key }) => semana[key].isClosed).map(({ key }) => key)));
        setPropios(
          Object.fromEntries(
            DAYS.filter(({ key }) => !semana[key].isClosed && !mismoHorario(semana[key], p))
              .map(({ key }) => [key, semana[key]]),
          ),
        );
      }
      setRestaurantId(rid);
      setLoading(false);
    }
    init().catch(() => setLoading(false));
  }, [router]);


  const semana: WeekHours = useMemo(() => Object.fromEntries(
    DAYS.map(({ key }) => [
      key,
      cerrados.has(key)
        ? { ...patron, isClosed: true }
        : { ...(propios[key] ?? patron), isClosed: false },
    ]),
  ), [patron, cerrados, propios]);

  const abiertos = DAYS.filter(({ key }) => !cerrados.has(key));
  const estado = ahora ? isOpenNow({ businessHours: semana }, ahora) : null;

  /**
   * Ventanas raras: no bloquean, pero se ven. Es lo que faltaba.
   * Se agrupan por caso: siete renglones diciendo lo mismo es un regaño, no
   * una ayuda. Si todos los días abiertos comparten el problema, va uno solo.
   */
  const avisos = useMemo(() => {
    const porCaso = new Map<string, string[]>();
    for (const { key, label } of DAYS) {
      if (cerrados.has(key)) continue;
      const d = semana[key];
      const min = duracionVentana(d.openingTime, d.closingTime);
      const caso =
        min < 180 ? `abre solo ${formatoDuracion(min)}`
        : min > 20 * 60 ? `abre ${formatoDuracion(min)} seguidas`
        : null;
      if (!caso) continue;
      porCaso.set(caso, [...(porCaso.get(caso) ?? []), label]);
    }
    const totalAbiertos = DAYS.filter(({ key }) => !cerrados.has(key)).length;
    const plural = (c: string) => c.replace(/^abre\b/, "abren");
    return [...porCaso.entries()].map(([caso, dias]) =>
      dias.length === totalAbiertos && totalAbiertos > 1
        ? `Todos los días ${plural(caso)}`
        : `${dias.join(", ")} ${dias.length > 1 ? plural(caso) : caso}`,
    );
  }, [semana, cerrados]);

  function ponerPropio(key: string, parche: Partial<DayHours>) {
    setPropios((p) => ({ ...p, [key]: { ...(p[key] ?? patron), isClosed: false, ...parche } }));
  }

  async function handleSave() {
    if (!restaurantId) return;
    setSaving(true);
    setError(null);
    try {
      const db = getFirebaseDb();
      await updateDoc(doc(db, "restaurants", restaurantId), {
        businessHours: semana,
        hoursConfirmed: true,
        lastUpdated: serverTimestamp(),
      });
      const readiness = await persistReadiness(restaurantId);
      setSaved(true);
      // El wizard salta al primer paso PENDIENTE: los nacidos del embudo ya
      // traen el menú hecho — mandarlos a Menú era un brinco muerto camino
      // a Recompensas (cazado por Ricardo, 26-ago). Y si con este horario
      // TODO quedó completo (el demo-born que puso premios primero y volvió
      // por su horario), el siguiente paso es el festejo — ganado (1-sep).
      const nextWizardStep = readiness?.isComplete
        ? "/vendor/setup/done"
        : stepperDone?.includes("menu")
        ? "/vendor/setup/recompensas?wizard=1"
        : "/vendor/setup/menu?wizard=1";
      setTimeout(
        () => router.push(isWizard ? nextWizardStep : "/vendor/configuracion"),
        800,
      );
    } catch (e) {
      console.error(e);
      setError("No pudimos guardar. Intenta de nuevo.");
      setSaving(false);
    }
  }

  if (loading) return <Spinner />;

  const duracionPatron = duracionVentana(patron.openingTime, patron.closingTime);
  const cruzaMedianoche = duracionVentana(patron.openingTime, patron.closingTime) >
    (patron.closingTime.hour * 60 + patron.closingTime.minute);

  return (
    <div className="min-h-screen" style={{ background: "#faf9f5" }}>
      <div className="sticky top-0 z-20 bg-white shadow-sm">
        {isWizard ? (
          <WizardStepper current="horario" doneKeys={stepperDone} />
        ) : (
          <div className="border-b px-4 py-4 sm:px-6" style={{ borderColor: "rgba(20,20,19,0.08)" }}>
            <div className="mx-auto flex max-w-lg items-center gap-3">
              <Link href="/vendor/configuracion" className="text-sm text-[#1C2526]/45 transition-colors hover:text-[#1C2526]">
                ← Volver
              </Link>
              <span className="text-[#1C2526]/20">/</span>
              <h1 className="text-sm font-semibold text-[#1C2526]">Horario</h1>
            </div>
          </div>
        )}
      </div>

      <main className="mx-auto max-w-lg px-4 pb-28 pt-6 sm:px-6">
        <h2 className="text-[22px] font-bold tracking-tight text-[#1C2526]">¿Cuándo abres?</h2>

        {/* El resultado, no el dato: el letrero que ve el cliente, en vivo. */}
        <div
          className="mt-3 flex items-center gap-2.5 rounded-xl px-3.5 py-3"
          style={{ background: "#ffffff", border: "1px solid rgba(28,37,38,0.08)" }}
          aria-live="polite"
        >
          {estado === null ? (
            <span className="text-[13px] text-[#1C2526]/40">Calculando…</span>
          ) : (
            <>
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: estado ? "#16A34A" : "#B91C1C" }}
              />
              {/* Preview VIVO de lo que estás componiendo (pickers sin
                  guardar) — el label viejo "Tu página dice ahora mismo"
                  afirmaba presente sobre un horario aún no guardado. */}
              <span className="text-[13px] text-[#1C2526]/60">
                Con este horario, ahora mismo estarías:{" "}
                <strong className="font-bold text-[#1C2526]">{estado ? "Abierto" : "Cerrado"}</strong>
              </span>
            </>
          )}
        </div>

        {error && (
          <div className="mt-4 rounded-xl px-4 py-3 text-sm" style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#B91C1C" }}>
            {error}
          </div>
        )}

        {/* ── El patrón: dos datos, no catorce ── */}
        <section className="mt-6">
          <h3 className="mb-2.5 text-[13px] font-bold text-[#1C2526]">Tu horario de siempre</h3>
          <div className="rounded-2xl bg-white p-4" style={{ border: "1px solid rgba(28,37,38,0.08)" }}>
            <div className="flex items-end gap-3">
              <TimeSelect
                label="Abre"
                value={patron.openingTime}
                onChange={(v) => setPatron((p) => ({ ...p, openingTime: v }))}
              />
              <span className="pb-3.5 text-[#1C2526]/25">→</span>
              <TimeSelect
                label="Cierra"
                value={patron.closingTime}
                anchor={patron.openingTime}
                onChange={(v) => setPatron((p) => ({ ...p, closingTime: v }))}
              />
            </div>
            <p className="mt-3 text-[12.5px] text-[#1C2526]/55">
              {formatoDuracion(duracionPatron)} al día
              {cruzaMedianoche && (
                <span className="text-[#8B6F47]">
                  {" · "}cierras a las {formatoHora(patron.closingTime)} del día siguiente
                </span>
              )}
            </p>
          </div>
        </section>

        {/* ── Los días ── */}
        <section className="mt-6">
          <h3 className="mb-1 text-[13px] font-bold text-[#1C2526]">Días que abres</h3>
          <p className="mb-2.5 text-[12.5px] text-[#1C2526]/50">Toca un día para cerrarlo.</p>
          <div className="flex gap-1.5">
            {DAYS.map(({ key, label, corto }) => {
              const cerrado = cerrados.has(key);
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={!cerrado}
                  aria-label={`${label}: ${cerrado ? "cerrado" : "abierto"}`}
                  onClick={() =>
                    setCerrados((s) => {
                      const n = new Set(s);
                      if (n.has(key)) n.delete(key); else { n.add(key); }
                      return n;
                    })
                  }
                  className="flex h-11 flex-1 items-center justify-center rounded-xl text-[14px] font-bold transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F28C38] focus-visible:ring-offset-2 active:scale-95"
                  style={
                    cerrado
                      ? { background: "#ffffff", border: "1px solid rgba(28,37,38,0.1)", color: "rgba(28,37,38,0.3)" }
                      : { background: "#F28C38", border: "1px solid #F28C38", color: "#1C2526" }
                  }
                >
                  {corto}
                </button>
              );
            })}
          </div>
          <p className="mt-2.5 text-[12.5px] text-[#1C2526]/55">
            {abiertos.length === 7
              ? "Abres los 7 días."
              : abiertos.length === 0
                ? "No abres ningún día — tus clientes no van a poder ordenar."
                : `Cierras ${DAYS.filter(({ key }) => cerrados.has(key)).map((d) => d.label.toLowerCase()).join(", ")}.`}
          </p>
        </section>

        {/* ── Excepciones: solo lo que de verdad es distinto ── */}
        <section className="mt-6">
          <h3 className="mb-1 text-[13px] font-bold text-[#1C2526]">¿Algún día distinto?</h3>
          <p className="mb-2.5 text-[12.5px] text-[#1C2526]/50">
            Como el sábado que cierras más tarde. Los demás siguen tu horario de siempre.
          </p>

          <div className="flex flex-col gap-2">
            {DAYS.filter(({ key }) => propios[key] && !cerrados.has(key)).map(({ key, label }) => {
              const d = propios[key];
              return (
                <div key={key} className="rounded-2xl bg-white p-4" style={{ border: "1px solid rgba(242,140,56,0.35)" }}>
                  <div className="mb-2.5 flex items-center justify-between">
                    <span className="text-[13px] font-bold text-[#1C2526]">{label}</span>
                    <button
                      type="button"
                      onClick={() => setPropios((p) => { const n = { ...p }; delete n[key]; return n; })}
                      className="rounded-lg px-2 py-1 text-[12px] font-semibold text-[#1C2526]/50 transition-colors hover:bg-[#1C2526]/5 hover:text-[#1C2526]"
                    >
                      Usar el de siempre
                    </button>
                  </div>
                  <div className="flex items-end gap-3">
                    <TimeSelect label="Abre" value={d.openingTime} onChange={(v) => ponerPropio(key, { openingTime: v })} />
                    <span className="pb-3.5 text-[#1C2526]/25">→</span>
                    <TimeSelect label="Cierra" value={d.closingTime} anchor={d.openingTime} onChange={(v) => ponerPropio(key, { closingTime: v })} />
                  </div>
                  <p className="mt-3 text-[12.5px] text-[#1C2526]/55">
                    {formatoDuracion(duracionVentana(d.openingTime, d.closingTime))} ese día
                  </p>
                </div>
              );
            })}
          </div>

          <div className="mt-2 flex flex-wrap gap-1.5">
            {DAYS.filter(({ key }) => !propios[key] && !cerrados.has(key)).map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setPropios((p) => ({ ...p, [key]: { ...patron } }))}
                className="rounded-lg bg-white px-2.5 py-1.5 text-[12.5px] font-semibold text-[#1C2526]/65 transition-colors hover:border-[#F28C38] hover:text-[#1C2526]"
                style={{ border: "1px dashed rgba(28,37,38,0.2)" }}
              >
                + {label}
              </button>
            ))}
          </div>
        </section>

        {/* ── Lo que se veía venir y nadie avisaba ── */}
        {avisos.length > 0 && (
          <div
            className="mt-6 rounded-xl px-4 py-3"
            style={{ background: "#FFFBEB", border: "1px solid #FDE68A" }}
            role="status"
          >
            <p className="text-[12.5px] font-bold text-[#92400E]">Revisa esto antes de guardar</p>
            <ul className="mt-1 space-y-0.5">
              {avisos.map((a) => (
                <li key={a} className="text-[12.5px] text-[#92400E]/85">· {a}</li>
              ))}
            </ul>
            <p className="mt-1.5 text-[12px] text-[#92400E]/70">
              Si así es, guárdalo sin problema. Solo que fuera de esas horas tu página dice cerrado.
            </p>
          </div>
        )}
      </main>

      {/* Guardar siempre a la mano — se edita con el pulgar, en el celular. */}
      <div
        className="fixed inset-x-0 bottom-0 z-30 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:px-6"
        style={{ background: "rgba(250,249,245,0.92)", backdropFilter: "blur(8px)", borderTop: "1px solid rgba(28,37,38,0.07)" }}
      >
        <button
          onClick={handleSave}
          disabled={saving || saved}
          className="mx-auto flex w-full max-w-lg items-center justify-center gap-2 rounded-xl px-6 py-4 text-[15px] font-bold transition-all duration-150 hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1C2526] focus-visible:ring-offset-2 active:scale-[0.99] disabled:opacity-60"
          style={{ background: "#F28C38", color: "#1C2526" }}
        >
          {saved ? "✓ Guardado" : saving ? <><Spin />Guardando…</> : "Guardar horario"}
        </button>
      </div>
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
    <div className="flex min-h-screen items-center justify-center" style={{ background: "#faf9f5" }}>
      <svg className="h-6 w-6 animate-spin text-[#F28C38]" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 12 5.373 12 12H4z" />
      </svg>
    </div>
  );
}

function Spin() {
  return (
    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 12 5.373 12 12H4z" />
    </svg>
  );
}
