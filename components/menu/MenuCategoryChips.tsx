"use client";

/**
 * Chips de categorías arriba del menú (10-sep-2026). Paridad con la app
 * (CustomerMenuScreen ya tenía "Todos · Tacos · Bebidas…"); en la web faltaban
 * y un menú de 78 platillos era puro scroll.
 *
 * No FILTRAN, saltan: tocar "Postres" baja a la sección (los IDs
 * `menu-cat-{i}` ya existen en las dos pieles) y el chip activo sigue al scroll.
 * Esconder secciones rompería "la categoría fuera de hora se ve y dice cuándo
 * vuelve" (lib/menu/categoryWindows.ts). Barra pegajosa; en móvil se desliza.
 */

import { useEffect, useRef, useState } from "react";
import type { MenuSkinId } from "@/lib/menu/menuSkin";
import { pecadoCategoryLabel } from "@/components/menu/skins/pecado";

export type MenuChip = { category: string; index: number; closed?: boolean };

/** Reloj del candado del chip tocado. Fuera del componente: la regla de pureza de React no deja leer la hora adentro. */
const nowMs = () => Date.now();

export function MenuCategoryChips({ chips, skin = null }: { chips: MenuChip[]; skin?: MenuSkinId | null }) {
  const [active, setActive] = useState(0);
  const barRef = useRef<HTMLDivElement | null>(null);
  /**
   * El chip que se TOCÓ manda mientras dura el salto (11-sep, Ricardo con LasPic: tocaba "Postres" y no se quedaba,
   * porque su título nunca llega a la barra). Se suelta con la rueda, el dedo o el teclado, o con cualquier scroll
   * pasado 1.5 s (arrastrar la barra de scroll no dispara rueda ni dedo).
   */
  const pinned = useRef<{ index: number; until: number } | null>(null);

  useEffect(() => {
    const release = () => {
      pinned.current = null;
    };
    window.addEventListener("wheel", release, { passive: true });
    window.addEventListener("touchstart", release, { passive: true });
    window.addEventListener("keydown", release);
    return () => {
      window.removeEventListener("wheel", release);
      window.removeEventListener("touchstart", release);
      window.removeEventListener("keydown", release);
    };
  }, []);

  // El chip activo = la sección que cruza la línea bajo la barra, en orden de lectura (con dos columnas gana la de
  // la izquierda, que se lee primero). En un hueco entre secciones, la última cuyo título ya pasó la barra. Hasta
  // abajo de la página, la última sección aunque su título nunca alcance la barra (Postres al final).
  useEffect(() => {
    if (chips.length < 2) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const pin = pinned.current;
        if (pin) {
          if (nowMs() < pin.until) {
            setActive(pin.index);
            return;
          }
          pinned.current = null;
        }
        if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
          setActive(chips[chips.length - 1]!.index);
          return;
        }
        const line = (barRef.current?.getBoundingClientRect().bottom ?? 0) + 24;
        let cur = chips[0]!.index;
        let crossing: number | null = null;
        for (const c of chips) {
          const el = document.getElementById(`menu-cat-${c.index}`);
          if (!el) continue;
          const head = el.getBoundingClientRect().top;
          if (head > line) continue;
          cur = c.index;
          if (crossing === null && (el.closest("section") ?? el).getBoundingClientRect().bottom > line) crossing = c.index;
        }
        setActive(crossing ?? cur);
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [chips]);

  // El chip activo se mantiene a la vista dentro de la barra. A mano
  // (scrollLeft), no con scrollIntoView: ese también mueve la página y pelea
  // con el salto suave a la sección.
  useEffect(() => {
    const bar = barRef.current?.firstElementChild as HTMLElement | null;
    const el = bar?.querySelector<HTMLElement>(`[data-chip="${active}"]`);
    if (!bar || !el) return;
    const target = el.offsetLeft - (bar.clientWidth - el.offsetWidth) / 2;
    bar.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
  }, [active]);

  if (chips.length < 2) return null;
  const tercera = skin === "tercera";
  const pecado = skin === "pecado";
  const nb = skin === "negroblanco";
  const bl = skin === "blooms";
  const mx = skin === "mixteco";
  const lp = skin === "laspic";
  const tp = skin === "tortasperras";

  const jump = (index: number) => {
    const el = document.getElementById(`menu-cat-${index}`);
    if (!el) return;
    pinned.current = { index, until: nowMs() + 1500 };
    setActive(index);
    const top = el.getBoundingClientRect().top + window.scrollY - ((barRef.current?.offsetHeight ?? 56) + 16);
    window.scrollTo({ top, behavior: "smooth" });
  };

  return (
    <div
      ref={barRef}
      className={
        "sticky top-0 z-30 -mx-4 mb-4 px-4 py-2 sm:-mx-6 sm:px-6 " +
        (tercera
          ? "bg-[#f9b699]/95 backdrop-blur-sm"
          : pecado
            ? "bg-[#c03427]/95 backdrop-blur-sm"
            : nb
              ? "bg-[#f4f3ef]/88 py-2.5 backdrop-blur-md"
              : bl
                ? "bg-[#fff6f4]/90 py-2.5 backdrop-blur-md"
                : mx
                  ? "bg-[#234933]/95 py-2.5 shadow-[0_12px_24px_-18px_rgba(0,0,0,0.7)] backdrop-blur-md"
                  : lp
                    ? "bg-[#fbf8f2]/95 py-2.5 shadow-[0_10px_20px_-18px_rgba(0,0,0,0.6)] backdrop-blur-md"
                    : tp
                      ? "bg-[#e9e7e2]/95 py-2.5 shadow-[0_10px_20px_-18px_rgba(80,5,10,0.6)] backdrop-blur-md"
              : "bg-[#FAF7F2]/92 shadow-[0_6px_16px_-12px_rgba(28,37,38,0.35)] backdrop-blur-md")
      }
      role="navigation"
      aria-label="Secciones del menú"
    >
      <div className="flex gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {chips.map((c) => {
          const on = c.index === active;
          const base = tercera
            ? "[font-family:var(--tz-pixel),monospace] text-[11px] uppercase tracking-tight border-2 border-[#1a1a1a] " +
              (on ? "bg-[#1a1a1a] text-[#fbddd5]" : "bg-transparent text-[#1a1a1a] hover:bg-[#1a1a1a]/10")
            : pecado
              ? "[font-family:var(--pc-name),'Arial_Narrow',sans-serif] text-[13px] font-extrabold uppercase tracking-wide border-2 border-[#ffeecf] " +
                (on ? "bg-[#ffeecf] text-[#a61c21]" : "bg-transparent text-[#ffeecf] hover:bg-[#ffeecf]/15")
            : bl
              ? "text-[11px] font-extrabold uppercase tracking-[0.12em] border-2 " +
                (on
                  ? "border-[#ff5c9a] bg-[#ff5c9a] text-white shadow-[0_6px_16px_-8px_rgba(255,92,154,0.9)]"
                  : "border-[#ff5c9a]/30 bg-white text-[#1c1a1b] hover:border-[#ff5c9a]")
            : lp
              ? "[font-family:var(--lp-sans),Jost,sans-serif] text-[11px] font-semibold uppercase tracking-[0.14em] border-[1.5px] " +
                (on
                  ? "border-[#141414] bg-[#141414] text-[#fbf8f2]"
                  : "border-[#141414]/35 bg-transparent text-[#141414] hover:border-[#141414]")
            : tp
              ? "[font-family:var(--tp-display),'Arial_Narrow',sans-serif] text-[13px] uppercase tracking-[0.06em] border-[1.5px] " +
                (on
                  ? "border-[#cf1225] bg-[#cf1225] text-[#f4f1ea]"
                  : "border-[#cf1225]/35 bg-transparent text-[#cf1225] hover:border-[#cf1225]")
            : mx
              ? "[font-family:var(--mx-display),Impact,sans-serif] text-[11px] uppercase tracking-[0.12em] border-2 " +
                (on
                  ? "border-[#f6f5e0] bg-[#f6f5e0] text-[#234933]"
                  : "border-[#f6f5e0]/30 bg-transparent text-[#f6f5e0]/90 hover:border-[#f6f5e0]/70")
            : nb
              ? "[font-family:var(--nb-mono),ui-monospace,monospace] text-[11px] uppercase tracking-[0.14em] border " +
                (on
                  ? "border-[#0b0b0b] bg-[#0b0b0b] text-white"
                  : "border-[#0b0b0b]/15 bg-white/70 text-[#0b0b0b]/70 hover:border-[#0b0b0b]/50 hover:text-[#0b0b0b]")
            : "text-[13px] font-semibold border " +
              (on
                ? "border-[#F28C38] bg-[#F28C38] text-white shadow-sm"
                : "border-[#1C2526]/10 bg-white text-[#1C2526]/80 hover:border-[#F28C38]/50");
          return (
            <button
              key={`${c.category}-${c.index}`}
              type="button"
              data-chip={c.index}
              onClick={() => jump(c.index)}
              aria-current={on ? "true" : undefined}
              className={`shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 transition-colors ${nb || bl || mx || lp || tp ? "" : "capitalize"} ${base} ${c.closed ? "opacity-55" : ""}`}
            >
              {c.closed ? "🕒 " : ""}
              {tercera || mx || lp || tp ? c.category : pecado ? pecadoCategoryLabel(c.category) : c.category.toLowerCase()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
