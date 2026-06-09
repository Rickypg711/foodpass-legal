"use client";

// ─── Wizard Stepper ───────────────────────────────────────────────────────────
// Shown at the top of each setup page when ?wizard=1 is in the URL.
// Displays a 3-step progress bar: Horario → Menú → Recompensas.

const STEPS = [
  { key: "horario", label: "Horario" },
  { key: "menu",    label: "Menú" },
  { key: "rewards", label: "Recompensas" },
] as const;

type StepKey = (typeof STEPS)[number]["key"];

export function WizardStepper({ current }: { current: StepKey }) {
  const currentIdx = STEPS.findIndex((s) => s.key === current);

  return (
    <div className="border-b border-[#141413]/8 bg-white px-4 py-3.5 sm:px-6">
      <div className="mx-auto max-w-lg">
        <div className="flex items-center">
          {STEPS.map((step, i) => {
            const done    = i < currentIdx;
            const active  = i === currentIdx;
            const pending = i > currentIdx;
            const isLast  = i === STEPS.length - 1;

            return (
              <div key={step.key} className={`flex items-center ${!isLast ? "flex-1" : ""}`}>
                {/* Dot + label */}
                <div className="flex items-center gap-1.5">
                  <div
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold transition-all ${
                      done
                        ? "bg-[#d97757] text-white"
                        : active
                        ? "bg-[#d97757] text-white ring-4 ring-[#d97757]/15"
                        : "bg-[#141413]/10 text-[#141413]/35"
                    }`}
                  >
                    {done ? "✓" : i + 1}
                  </div>
                  <span
                    className={`text-xs font-semibold ${
                      active  ? "text-[#141413]"
                      : done  ? "text-[#d97757]"
                      : "text-[#141413]/30"
                    }`}
                  >
                    {step.label}
                  </span>
                </div>

                {/* Connector line */}
                {!isLast && (
                  <div
                    className={`mx-2 flex-1 h-px transition-all ${
                      done ? "bg-[#d97757]" : "bg-[#141413]/10"
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
