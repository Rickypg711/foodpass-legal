"use client";

/**
 * InternalBrowserMarker (17-sep-2026)
 *
 * En cuanto una cuenta interna de Comeleal (alias comeleal+…, Ricardo) inicia
 * sesión en este navegador, en CUALQUIER página, el navegador queda marcado y
 * ningún evento de Meta sale de aquí (ver lib/meta/internal.ts). Antes la marca
 * solo se ponía al crear un restaurante; si Ricardo abría /demo primero para
 * montar un menú, ese "subió su menú" contaba como conversión.
 *
 * Solo escucha; no renderiza nada y nunca rompe la página.
 */

import { useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/auth";
import { isInternalEmail, markInternalBrowser } from "@/lib/meta/internal";

export function InternalBrowserMarker() {
  useEffect(() => {
    try {
      const unsub = onAuthStateChanged(getFirebaseAuth(), (user) => {
        if (user && isInternalEmail(user.email)) markInternalBrowser();
      });
      return () => unsub();
    } catch {
      return undefined;
    }
  }, []);
  return null;
}
