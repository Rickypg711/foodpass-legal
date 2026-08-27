"use client";

/**
 * Selector de hora para horarios de negocio.
 *
 * POR QUE NO ES UN <input type="time">: el nativo es un stepper de tres
 * segmentos con a.m./p.m. separado. Un dueño que quiere poner "medianoche"
 * teclea 12 y aterriza en las 12:55 P.M. sin darse cuenta — eso exactamente
 * pasó en "Taco caliente", que lleva desde el 5 de agosto anunciando que
 * cierra a la 1 de la tarde. El control no avisaba nada.
 *
 * Aquí la hora se ELIGE de una lista, no se teclea. Y la lista de cierre está
 * anclada a la de apertura: arranca media hora después de que abres y corre
 * hacia adelante ATRAVESANDO la medianoche, con su separador y todo. Cerrar de
 * madrugada deja de ser una trampa y pasa a ser una opción que se ve.
 *
 * Cada opción de cierre trae su duración ("1:00 a.m. · 12 h"), así que una
 * ventana de dos horas se ve de dos horas ANTES de escogerla.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

export type HM = { hour: number; minute: number };

const PASO_MIN = 30;
const MIN_DIA = 24 * 60;

const toMin = (t: HM) => t.hour * 60 + t.minute;
const fromMin = (m: number): HM => ({
  hour: Math.floor((((m % MIN_DIA) + MIN_DIA) % MIN_DIA) / 60),
  minute: (((m % MIN_DIA) + MIN_DIA) % MIN_DIA) % 60,
});

/** "1:00 p.m." — formato mexicano, con nota en las dos horas que confunden. */
export function formatoHora(t: HM): string {
  const h24 = t.hour;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const sufijo = h24 < 12 ? "a.m." : "p.m.";
  return `${h12}:${String(t.minute).padStart(2, "0")} ${sufijo}`;
}

function notaHora(t: HM): string | null {
  if (t.hour === 0 && t.minute === 0) return "medianoche";
  if (t.hour === 12 && t.minute === 0) return "mediodía";
  return null;
}

/** "12 h" · "2 h 30 min" · "45 min" */
export function formatoDuracion(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

/** Minutos que dura la ventana, cruzando medianoche si hace falta. */
export function duracionVentana(abre: HM, cierra: HM): number {
  const d = toMin(cierra) - toMin(abre);
  return d > 0 ? d : d + MIN_DIA;
}

type Opcion =
  | { tipo: "hora"; min: number; valor: HM; diaSiguiente: boolean; duracion: number | null }
  | { tipo: "separador"; etiqueta: string };

function construirOpciones(anclaMin: number | null): Opcion[] {
  const out: Opcion[] = [];
  if (anclaMin === null) {
    // Apertura: el día completo, sin trucos.
    for (let m = 0; m < MIN_DIA; m += PASO_MIN) {
      out.push({ tipo: "hora", min: m, valor: fromMin(m), diaSiguiente: false, duracion: null });
    }
    return out;
  }
  // Cierre: arranca media hora después de abrir y corre 24 h hacia adelante.
  let cruzado = false;
  for (let paso = PASO_MIN; paso <= MIN_DIA; paso += PASO_MIN) {
    const abs = anclaMin + paso;
    const diaSiguiente = abs >= MIN_DIA;
    if (diaSiguiente && !cruzado) {
      cruzado = true;
      out.push({ tipo: "separador", etiqueta: "Ya es el día siguiente" });
    }
    out.push({
      tipo: "hora",
      min: abs % MIN_DIA,
      valor: fromMin(abs),
      diaSiguiente,
      duracion: paso,
    });
  }
  return out;
}

export function TimeSelect({
  value,
  onChange,
  label,
  anchor = null,
  disabled = false,
}: {
  value: HM;
  onChange: (v: HM) => void;
  label: string;
  /** Presente en el campo de CIERRE: la hora de apertura a la que se ancla. */
  anchor?: HM | null;
  disabled?: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(0);
  const botonRef = useRef<HTMLButtonElement>(null);
  const listaRef = useRef<HTMLDivElement>(null);
  const [caja, setCaja] = useState<{ top: number; left: number; width: number; arriba: boolean } | null>(null);

  const anclaMin = anchor ? toMin(anchor) : null;
  const opciones = construirOpciones(anclaMin);
  const horas = opciones.filter((o) => o.tipo === "hora") as Extract<Opcion, { tipo: "hora" }>[];
  const idxSeleccion = Math.max(
    0,
    horas.findIndex((o) => o.min === toMin(value)),
  );

  const colocar = useCallback(() => {
    const b = botonRef.current;
    if (!b) return;
    const r = b.getBoundingClientRect();
    // 420 y no 320: en Mac el scroll inercial aventaba 48 opciones por un
    // panel chaparro — más filas visibles = menos viaje (Ricardo, 26-ago).
    const alto = Math.min(420, window.innerHeight * 0.6);
    const cabeAbajo = window.innerHeight - r.bottom > alto + 16;
    setCaja({
      top: cabeAbajo ? r.bottom + 6 : Math.max(8, r.top - alto - 6),
      left: r.left,
      width: Math.max(r.width, 208),
      arriba: !cabeAbajo,
    });
  }, []);

  useLayoutEffect(() => {
    if (!abierto) return;
    colocar();
    // El popover va en position:fixed para no morir recortado dentro de un
    // contenedor con overflow (regla vieja, se paga cara).
    // El listener va en captura para atrapar scrolls de CUALQUIER contenedor
    // de la página… pero eso incluía los scrolls DE ADENTRO de la lista:
    // cada scrollcito recolocaba el popover (caja nueva) y peleaba contra el
    // dedo del usuario (segundo bucle del bug de Mac, 26-ago).
    const colocarSiEsDeAfuera = (e: Event) => {
      if (listaRef.current?.contains(e.target as Node)) return;
      colocar();
    };
    window.addEventListener("resize", colocar);
    window.addEventListener("scroll", colocarSiEsDeAfuera, true);
    return () => {
      window.removeEventListener("resize", colocar);
      window.removeEventListener("scroll", colocarSiEsDeAfuera, true);
    };
  }, [abierto, colocar]);

  // Al abrir, la lista aterriza UNA sola vez en la hora que YA está elegida —
  // si no, un cierre de madrugada arranca a 20 opciones de distancia. Va tras
  // `caja` y dentro de un rAF: antes de que el popover esté colocado y
  // pintado, scrollIntoView no tiene a dónde llevar nada.
  //
  // OJO (bug cazado por Ricardo en su Mac, 26-ago: "se mueve solo, rapidísimo"):
  // este efecto llevaba `activo` en las dependencias y `activo` cambia con el
  // HOVER — pasar el mouse re-centraba la lista, la lista se movía bajo el
  // cursor, otro hover, otro re-centrado: bucle infinito. El aterrizaje es a
  // la hora ELEGIDA y solo al abrir; el flag corta cualquier re-disparo.
  const aterrizado = useRef(false);
  useEffect(() => {
    if (!abierto) {
      aterrizado.current = false;
      return;
    }
    if (!caja || aterrizado.current) return;
    const id = requestAnimationFrame(() => {
      const el = listaRef.current?.querySelector<HTMLElement>(`[data-idx="${idxSeleccion}"]`);
      el?.scrollIntoView({ block: "center" });
      aterrizado.current = true;
    });
    return () => cancelAnimationFrame(id);
  }, [abierto, caja, idxSeleccion]);

  useEffect(() => {
    if (!abierto) return;
    function fuera(e: MouseEvent) {
      if (botonRef.current?.contains(e.target as Node)) return;
      if (listaRef.current?.contains(e.target as Node)) return;
      setAbierto(false);
    }
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, [abierto]);

  function abrir() {
    setActivo(idxSeleccion);
    setAbierto(true);
  }

  function elegir(i: number) {
    const o = horas[i];
    if (!o) return;
    onChange(o.valor);
    setAbierto(false);
    botonRef.current?.focus();
  }

  function teclas(e: React.KeyboardEvent) {
    if (!abierto) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        abrir();
      }
      return;
    }
    if (e.key === "Escape") { e.preventDefault(); setAbierto(false); botonRef.current?.focus(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setActivo((i) => Math.min(i + 1, horas.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActivo((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Home") { e.preventDefault(); setActivo(0); }
    else if (e.key === "End") { e.preventDefault(); setActivo(horas.length - 1); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); elegir(activo); }
  }

  const nota = notaHora(value);
  const idListbox = `horas-${label.replace(/\s/g, "")}`;

  return (
    <div className="min-w-0 flex-1">
      <span className="mb-1.5 block text-[12px] font-semibold text-[#1C2526]/55">{label}</span>
      <button
        ref={botonRef}
        type="button"
        disabled={disabled}
        onClick={() => (abierto ? setAbierto(false) : abrir())}
        onKeyDown={teclas}
        aria-haspopup="listbox"
        aria-expanded={abierto}
        aria-controls={abierto ? idListbox : undefined}
        className="flex h-12 w-full items-center justify-between gap-2 rounded-xl border bg-white px-3.5 text-left transition-colors duration-150 hover:border-[#1C2526]/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F28C38] focus-visible:ring-offset-2 disabled:opacity-45"
        style={{ borderColor: abierto ? "#F28C38" : "rgba(28,37,38,0.14)" }}
      >
        <span className="min-w-0 truncate">
          <span className="text-[15px] font-semibold tabular-nums text-[#1C2526]">{formatoHora(value)}</span>
          {nota && <span className="ml-1.5 text-[11px] text-[#8B6F47]">{nota}</span>}
        </span>
        <svg
          width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"
          className="shrink-0 transition-transform duration-150"
          style={{ transform: abierto ? "rotate(180deg)" : "none", color: "rgba(28,37,38,0.35)" }}
        >
          <path d="M2 4.5 6 8.5 10 4.5" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {abierto && caja && (
        <div
          ref={listaRef}
          id={idListbox}
          role="listbox"
          aria-label={label}
          tabIndex={-1}
          onKeyDown={teclas}
          className="fixed z-50 overflow-y-auto overscroll-contain rounded-xl border bg-white py-1 shadow-xl motion-safe:animate-[timeselect-in_140ms_cubic-bezier(0.16,1,0.3,1)]"
          style={{
            top: caja.top, left: caja.left, width: caja.width,
            maxHeight: Math.min(420, window.innerHeight * 0.6),
            borderColor: "rgba(28,37,38,0.12)",
            transformOrigin: caja.arriba ? "bottom center" : "top center",
            // El imán: el aventón inercial de Mac ATERRIZA en una fila, no
            // entre dos ("se mueve demasiado rápido" — Ricardo, 26-ago).
            scrollSnapType: "y proximity",
          }}
        >
          {opciones.map((o, i) => {
            if (o.tipo === "separador") {
              return (
                <div
                  key={`sep-${i}`}
                  role="presentation"
                  className="my-1 flex items-center gap-2 px-3 py-1.5"
                >
                  <span className="h-px flex-1" style={{ background: "rgba(28,37,38,0.1)" }} />
                  <span className="text-[10.5px] font-semibold tracking-wide text-[#8B6F47]">{o.etiqueta}</span>
                  <span className="h-px flex-1" style={{ background: "rgba(28,37,38,0.1)" }} />
                </div>
              );
            }
            const idx = horas.indexOf(o);
            const sel = idx === idxSeleccion;
            const act = idx === activo;
            const n = notaHora(o.valor);
            return (
              <div
                key={`h-${o.min}-${o.diaSiguiente}`}
                data-idx={idx}
                role="option"
                aria-selected={sel}
                onMouseEnter={() => setActivo(idx)}
                onClick={() => elegir(idx)}
                className="mx-1 flex cursor-pointer items-baseline justify-between gap-3 rounded-lg px-2.5 py-2 transition-colors duration-100"
                style={{
                  background: sel ? "rgba(242,140,56,0.14)" : act ? "rgba(28,37,38,0.05)" : "transparent",
                  scrollSnapAlign: "start",
                }}
              >
                <span className="text-[14px] tabular-nums" style={{ color: "#1C2526", fontWeight: sel ? 700 : 500 }}>
                  {formatoHora(o.valor)}
                  {n && <span className="ml-1.5 text-[11px] font-normal text-[#8B6F47]">{n}</span>}
                </span>
                {o.duracion !== null && (
                  <span className="shrink-0 text-[11px] tabular-nums text-[#1C2526]/45">
                    {formatoDuracion(o.duracion)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
