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
      setLoggedIn(!!user);
    });
    return unsub;
  }, []);

  if (loggedIn === true) {
    return (
      <div className="mt-8">
        <Link href="/vendor"
          className="inline-flex items-center gap-2 rounded-full bg-[#F28C38] px-7 py-3.5 text-base font-semibold text-white shadow-lg transition-colors hover:bg-[#c46644]">
          Ir a mi panel
          <span aria-hidden>→</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-8">
      <button
        onClick={() => {
          // Funnel step 2: landing → CTA click (UTMs persisted for attribution).
          const utms = readAndPersistUtms(window.location.search);
          trackVendorCtaClick({ cta: "empieza_gratis", section: "home_hero", ...utms });
          setModalOpen(true);
        }}
        className="inline-flex items-center gap-2 rounded-full bg-[#F28C38] px-7 py-3.5 text-base font-semibold text-white shadow-lg transition-colors hover:bg-[#c46644]">
        Empieza gratis
        <span aria-hidden>→</span>
      </button>
      {modalOpen && <ActivarModal asModal onClose={() => setModalOpen(false)} />}
    </div>
  );
}
