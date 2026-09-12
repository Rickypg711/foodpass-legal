"use client";

/**
 * AttributionCapture — guarda de dónde llegó la visita en CUALQUIER página
 * (12-sep-2026). Antes sólo se leía al tocar el botón de la portada: quien
 * llegaba del anuncio y entraba por "Entrar" o directo a /demo se perdía.
 *
 * El alta (ActivarModal) lo escribe en restaurants/{id}/private/acquisition.
 * Renderiza null.
 */

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { captureAttribution } from "@/lib/vendorLead/utmStore";

export function AttributionCapture() {
  const pathname = usePathname();
  useEffect(() => {
    captureAttribution(window.location.search);
  }, [pathname]);
  return null;
}
