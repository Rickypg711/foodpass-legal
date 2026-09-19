"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Avisa UNA sola vez cuando lo que envuelve se DIBUJA de verdad en la pantalla
 * (60% visible). Es la definición de "visto" del reloj del taco
 * (docs/REFERIDOS_POR_TELEFONO.md §7): no basta con cargar la página — un
 * preview o una pestaña de fondo no cuentan.
 */
export default function SeenOnScreen({
  onSeen,
  children,
  className,
}: {
  onSeen: () => void;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const done = useRef(false);
  // La última versión del callback, sin re-armar el observador en cada render.
  const cb = useRef(onSeen);
  useEffect(() => {
    cb.current = onSeen;
  }, [onSeen]);

  useEffect(() => {
    const el = ref.current;
    if (!el || done.current || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (done.current || !entries.some((e) => e.isIntersecting)) return;
        done.current = true;
        obs.disconnect();
        cb.current();
      },
      { threshold: 0.6 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
