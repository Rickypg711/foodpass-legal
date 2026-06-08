"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { getFirebaseApp } from "@/lib/firebase";

export function HomeCta() {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);

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
          className="inline-flex items-center gap-2 rounded-full bg-[#F28C38] px-7 py-3.5 text-base font-semibold text-white shadow-lg transition-colors hover:bg-[#e07d30]">
          Ir a mi panel
          <span aria-hidden>→</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-8">
      <Link href="/activar"
        className="inline-flex items-center gap-2 rounded-full bg-[#F28C38] px-7 py-3.5 text-base font-semibold text-white shadow-lg transition-colors hover:bg-[#e07d30]">
        Empieza gratis
        <span aria-hidden>→</span>
      </Link>
    </div>
  );
}
