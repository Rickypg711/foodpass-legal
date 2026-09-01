"use client";

// ─── Wizard Stepper ───────────────────────────────────────────────────────────
// Shown at the top of each setup page when ?wizard=1 is in the URL.
// Displays a 3-step progress bar: Horario → Menú → Recompensas.
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
  { key: "rewards", label: "Recompensas", href: "/vendor/setup/recompensas?wizard=1" },
] as const;

type StepKey = (typeof STEPS)[number]["key"];

export function WizardStepper({
  current,
  doneKeys,
  onPanelClick,
}: {
  current: StepKey;
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
}) {
  const currentIdx = STEPS.findIndex((s) => s.key === current);

  return (
    <div className="border-b border-[#141413]/8 bg-white px-4 py-3.5 sm:px-6">
      <div className="mx-auto flex max-w-lg items-center gap-3">
        {/* Salida al panel — mismo patrón que el "← Volver" de las páginas
            sin wizard (tinta 45% → tinta al hover). */}
        {onPanelClick ? (
          <button
            type="button"
            onClick={onPanelClick}
            className="shrink-0 text-xs font-semibold text-[#1C2526]/45 transition-colors hover:text-[#1C2526]"
          >
            ← Panel
          </button>
        ) : (
        <Link
          href="/vendor"
          className="shrink-0 text-xs font-semibold text-[#1C2526]/45 transition-colors hover:text-[#1C2526]"
        >
          ← Panel
        </Link>
        )}
        <span className="text-[#1C2526]/15">/</span>
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
                  className="flex items-center gap-1.5 transition-opacity hover:opacity-75"
                >
                  <div
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold transition-all ${
                      done || active
                        ? "bg-[#F28C38] text-[#1C2526]"
                        : "bg-[#141413]/10 text-[#141413]/35"
                    } ${active ? "ring-4 ring-[#F28C38]/15" : ""}`}
                  >
                    {done ? "✓" : i + 1}
                  </div>
                  <span
                    className={`text-xs font-semibold ${
                      active  ? "text-[#141413]"
                      : done  ? "text-[#F28C38]"
                      : "text-[#141413]/30"
                    }`}
                  >
                    {step.label}
                  </span>
                </Link>

                {/* Connector line */}
                {!isLast && (
                  <div
                    className={`mx-2 flex-1 h-px transition-all ${
                      done ? "bg-[#F28C38]" : "bg-[#141413]/10"
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
