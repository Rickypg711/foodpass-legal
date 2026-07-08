"use client";

// Mis puntos — standalone balance check for phone-points customers (§4 v2).
// Anyone types their number → SMS verification (PhonePointsCard) → balance at
// THIS restaurant. No order link needed, no app, no account.

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import { PhonePointsCard } from "@/components/loyalty/PhonePointsCard";

export default function PuntosPage() {
  const params = useParams();
  const restaurantId =
    typeof params.restaurantId === "string" ? params.restaurantId : "";
  const [restaurantName, setRestaurantName] = useState("este lugar");
  const [phoneInput, setPhoneInput] = useState("");
  const [phone, setPhone] = useState<string | null>(null);

  useEffect(() => {
    if (!restaurantId) return;
    getDoc(doc(getFirebaseDb(), "restaurants", restaurantId))
      .then((snap) => {
        const n = (snap.data()?.name as string | undefined)?.trim();
        if (n) setRestaurantName(n);
      })
      .catch(() => {});
  }, [restaurantId]);

  const digits = phoneInput.replace(/\D/g, "");
  const valid = digits.length >= 10;

  return (
    <div
      className="min-h-screen text-[#1C2526]"
      style={{ backgroundColor: "#F0E3D2" }}
    >
      <header className="px-4 py-3 shadow-sm" style={{ backgroundColor: "#F28C38" }}>
        <div className="mx-auto flex max-w-md items-center gap-3">
          <Link
            href={`/menu/${encodeURIComponent(restaurantId)}`}
            aria-label="Volver al menú"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-lg text-white"
          >
            ←
          </Link>
          <h1 className="text-lg font-bold text-white">⭐ Mis puntos</h1>
        </div>
      </header>

      <main className="mx-auto max-w-md space-y-4 px-4 py-6">
        {!phone ? (
          <div className="rounded-2xl bg-white p-5 text-center">
            <p className="text-base font-bold">
              Consulta tus puntos en {restaurantName}
            </p>
            <p className="mt-1 text-xs text-[#1C2526]/60">
              Escribe el número con el que has comprado — te mandamos un código
              por SMS para verificar que eres tú.
            </p>
            <input
              type="tel"
              inputMode="numeric"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              placeholder="Ej. 614 123 4567"
              maxLength={16}
              className="mt-4 w-full rounded-xl border border-[#1C2526]/12 bg-[#FAF7F2] px-3.5 py-3 text-center text-[15px] outline-none focus:border-[#F28C38]"
            />
            <button
              type="button"
              disabled={!valid}
              onClick={() => setPhone(digits)}
              className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[#F28C38] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
            >
              Continuar
            </button>
          </div>
        ) : (
          <>
            <PhonePointsCard
              restaurantId={restaurantId}
              restaurantName={restaurantName}
              phone={phone}
            />
            <button
              type="button"
              onClick={() => {
                setPhone(null);
                setPhoneInput("");
              }}
              className="block w-full text-center text-sm text-[#1C2526]/60 underline"
            >
              Usar otro número
            </button>
          </>
        )}

        <Link
          href={`/menu/${encodeURIComponent(restaurantId)}`}
          className="block text-center text-sm text-[#1C2526]/70 underline"
        >
          Volver al menú
        </Link>
      </main>
    </div>
  );
}
