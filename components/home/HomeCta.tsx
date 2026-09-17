"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { getFirebaseApp } from "@/lib/firebase";
import { trackVendorCtaClick } from "@/lib/analytics/vendorAcquisition";
import { readAndPersistUtms } from "@/lib/vendorLead/utmStore";

// 17-sep-2026 (Ricardo, paso 1 de la portada contenida): el botón es lo único
// grande en naranja de toda la página, sin emoji. Texto oscuro sobre naranja
// (regla de contraste del 25-ago).
const BUTTON = "inline-flex items-center gap-2 rounded-full bg-[#F28C38] px-6 py-3 text-[15px] font-semibold text-[#1C2526] transition-colors hover:bg-[#E07B2A]";

export function HomeCta({ section = "home_hero" }: { section?: "home_hero" | "home_final" }) {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    getFirebaseApp();
    const unsub = onAuthStateChanged(getAuth(), (user) => {
      // Anónimo ≠ dueño: el prospecto que jugó un demo u ordenó comida trae
      // sesión anónima — a ése le toca el embudo, no "Ir a mi panel".
      setLoggedIn(!!user && !user.isAnonymous);
    });
    return unsub;
  }, []);

  if (loggedIn === true) {
    return (
      <div className="mt-8">
        <Link href="/vendor" className={BUTTON}>
          Ir a mi panel
          <span aria-hidden>→</span>
        </Link>
      </div>
    );
  }

  // La puerta de entrada v2 (STRATEGY_MENU_FIRST §6): dar ANTES de pedir.
  // Un solo CTA: el demo (foto → SU menú, sin cuenta). El "o crea tu cuenta
  // directo" se quitó el 10-sep-2026 (Ricardo): partía la atención y se
  // brincaba la foto. Quien ya tiene cuenta entra por "Entrar" en el header.
  return (
    <div className="mt-8">
      <Link
        href="/demo"
        onClick={() => {
          const utms = readAndPersistUtms(window.location.search);
          trackVendorCtaClick({ cta: "sube_tu_menu", section, ...utms });
        }}
        className={BUTTON}>
        Sube la foto de tu menú
        <span aria-hidden>→</span>
      </Link>
    </div>
  );
}
