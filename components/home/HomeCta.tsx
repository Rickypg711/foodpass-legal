"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { getFirebaseApp } from "@/lib/firebase";
import { ActivarModal } from "@/components/home/ActivarModal";
import { trackVendorCtaClick } from "@/lib/analytics/vendorAcquisition";
import { readAndPersistUtms } from "@/lib/vendorLead/utmStore";

export function HomeCta() {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

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
        <Link href="/vendor"
          className="inline-flex items-center gap-2 rounded-full bg-[#F28C38] px-7 py-3.5 text-base font-semibold text-[#1C2526] shadow-lg transition-colors hover:bg-[#c46644]">
          Ir a mi panel
          <span aria-hidden>→</span>
        </Link>
      </div>
    );
  }

  // La puerta de entrada v2 (STRATEGY_MENU_FIRST §6): dar ANTES de pedir.
  // El CTA primario lleva al demo (foto → SU carta, sin cuenta); el camino
  // directo de siempre queda como secundario discreto para quien ya decidió.
  return (
    <div className="mt-8">
      <Link
        href="/demo"
        onClick={() => {
          const utms = readAndPersistUtms(window.location.search);
          trackVendorCtaClick({ cta: "sube_tu_menu", section: "home_hero", ...utms });
        }}
        className="inline-flex items-center gap-2 rounded-full bg-[#F28C38] px-7 py-3.5 text-base font-semibold text-[#1C2526] shadow-lg transition-colors hover:bg-[#c46644]">
        📸 Sube la foto de tu menú
        <span aria-hidden>→</span>
      </Link>
      <button
        onClick={() => {
          const utms = readAndPersistUtms(window.location.search);
          trackVendorCtaClick({ cta: "empieza_gratis", section: "home_hero", ...utms });
          setModalOpen(true);
        }}
        className="mt-3 block text-sm font-semibold text-white/50 underline-offset-4 hover:text-white/80 hover:underline">
        o crea tu cuenta directo
      </button>
      {modalOpen && <ActivarModal asModal onClose={() => setModalOpen(false)} />}
    </div>
  );
}
