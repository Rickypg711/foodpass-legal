"use client";

// ─── Wizard Stepper ───────────────────────────────────────────────────────────
// Shown at the top of each setup page when ?wizard=1 is in the URL.
// Displays a 2-step progress bar: Horario → Menú. (Recompensas salió del
// embudo el 7-sep-2026: es opcional y vive en /vendor/setup/recompensas y en
// el panel; el stepper de esa página se pinta con las dos estaciones hechas.)
//
// Es NAVEGACIÓN, no adorno (cazado por Ricardo, 26-ago: en modo wizard las
// páginas no tenían NINGUNA salida — ni entre pasos ni al panel): cada paso
// es un link a su página y "← Panel" saca al panel. Nada se pierde al
// salir: el borrador de premios vive en Firestore y el menú/horario ya
// guardados también — solo los cambios sin guardar de la pantalla actual
// vuelven a su último estado guardado.

import Link from "next/link";

const STEPS = [
  { key: "horario", label: "Horario", href: "/vendor/setup/horario?wizard=1" },
  { key: "menu",    label: "Menú", href: "/vendor/setup/menu?wizard=1" },
] as const;

type StepKey = (typeof STEPS)[number]["key"];
/** "rewards" se acepta como `current` por compatibilidad: no es estación. */
type CurrentKey = StepKey | "rewards";

export function WizardStepper({
  current,
  doneKeys,
  onPanelClick,
  hidePanelExit,
}: {
  current: CurrentKey;
  /**
   * Pasos REALMENTE completados (del readiness). Sin esto la palomita es
   * posicional (pasos "anteriores" al actual) — y el camino del demo brinca
   * directo a Recompensas, pintando "✓ Horario" a un dueño SIN horario
   * (cazado por Ricardo, 26-ago). La verdad manda cuando está disponible.
   */
  doneKeys?: readonly StepKey[];
  /**
   * La salida al panel SIEMPRE existe (regla de Ricardo, 26-ago: el wizard
   * no puede ser una trampa). Este hook deja que un paso la intercepte UNA
   * vez — p. ej. Recompensas ofrece dejar los premios puestos antes de
   * salir (muro #1 del embudo, 1-sep) — pero la decisión de irse se respeta.
   */
  onPanelClick?: () => void;
  /**
   * Sin salida al panel. Solo para el paso ÚNICO que sigue al claim del
   * demo (horario, born=demo): el dueño acaba de reclamar su menú y le
   * falta un clic; "← Panel" ahí era un letrero de salida antes de la meta
   * (cazado por Ricardo, 8-sep-2026, montando Los Pesados). Guardar es la
   * única puerta — y es un clic con el horario ya puesto.
   */
  hidePanelExit?: boolean;
}) {
  const currentIdx = STEPS.findIndex((s) => s.key === current);

  return (
    // Opción A (23-sep-2026): crema, hairline, paso actual en tinta, hechos con
    // check de trazo, pendientes en inkSoft. El naranja no vive aquí.
    <div className="border-b border-[#E9E3D7] bg-[#FAF9F5] px-5 py-3 sm:px-6">
      <div className="mx-auto flex max-w-lg items-center gap-3">
        {/* Salida al panel — mismo patrón que el "← Volver" de las páginas
            sin wizard (tinta 45% → tinta al hover). */}
        {hidePanelExit ? null : onPanelClick ? (
          <button
            type="button"
            onClick={onPanelClick}
            className="flex h-9 shrink-0 items-center text-[13px] font-semibold text-[#8A4B12] hover:underline"
          >
            Panel
          </button>
        ) : (
        <Link
          href="/vendor"
          className="flex h-9 shrink-0 items-center text-[13px] font-semibold text-[#8A4B12] hover:underline"
        >
          Panel
        </Link>
        )}
        {hidePanelExit ? null : <span className="h-4 w-px bg-[#D9D2C5]" aria-hidden />}
        <div className="flex flex-1 items-center">
          {STEPS.map((step, i) => {
            const done    = doneKeys ? doneKeys.includes(step.key) : i < currentIdx;
            const active  = i === currentIdx;
            const isLast  = i === STEPS.length - 1;

            return (
              <div key={step.key} className={`flex items-center ${!isLast ? "flex-1" : ""}`}>
                {/* Dot + label — link a su paso */}
                <Link
                  href={step.href}
                  aria-current={active ? "step" : undefined}
                  className="flex h-9 items-center gap-2 transition-opacity hover:opacity-75"
                >
                  <div
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold tabular-nums ${
                      active
                        ? "bg-[#1C2526] text-[#FAF9F5]"
                        : done
                          ? "border border-[#1C2526] text-[#1C2526]"
                          : "border border-[#D9D2C5] text-[#5B6366]"
                    }`}
                  >
                    {done ? (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                    ) : (
                      i + 1
                    )}
                  </div>
                  <span
                    className={`text-[13px] ${
                      active  ? "font-semibold text-[#1C2526]"
                      : done  ? "font-medium text-[#1C2526]"
                      : "text-[#5B6366]"
                    }`}
                  >
                    {step.label}
                  </span>
                </Link>

                {/* Connector line */}
                {!isLast && (
                  <div
                    className={`mx-2 h-px flex-1 ${
                      done ? "bg-[#1C2526]" : "bg-[#E9E3D7]"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
