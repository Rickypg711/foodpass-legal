"use client";

// CTA principal de las páginas SEO (8-oct-2026): el MISMO destino que el botón
// de la portada (components/home/HomeCta.tsx → /demo: foto → su menú, sin
// cuenta). Antes las páginas SEO mandaban a WhatsApp o a /activar y se
// brincaban la foto. WhatsApp queda como ayuda chica (WhatsAppButton
// variant="link"). Un solo botón naranja por sección.

import Link from "next/link";
import { trackVendorCtaClick } from "@/lib/analytics/vendorAcquisition";
import { readAndPersistUtms } from "@/lib/vendorLead/utmStore";

export const SUBE_MENU_HREF = "/demo";

export function SubeMenuCta({
  section,
  className = "",
}: {
  /** Para la analítica: "<página>_<sección>", p. ej. "pos_hero". */
  section: string;
  className?: string;
}) {
  return (
    <Link
      href={SUBE_MENU_HREF}
      onClick={() => {
        const utms = readAndPersistUtms(window.location.search);
        trackVendorCtaClick({ cta: "sube_tu_menu", section, ...utms });
      }}
      className={`inline-flex items-center justify-center gap-2 rounded-2xl bg-[#F28C38] px-7 py-4 text-[16px] font-bold text-[#1C2526] transition-all hover:bg-[#E07B2A] active:scale-[0.98] ${className}`}
      style={{ boxShadow: "0 6px 24px rgba(242,140,56,0.30)" }}
    >
      Sube la foto de tu menú
      <span aria-hidden>→</span>
    </Link>
  );
}
