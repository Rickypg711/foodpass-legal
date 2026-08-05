"use client";

// Mis puntos — standalone balance check for phone-points customers (§4 v2).
// Anyone types their number → SMS verification (PhonePointsCard) → balance at
// THIS restaurant. No order link needed, no app, no account.

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import { getRestaurantImageUrl } from "@/lib/restaurantImage";
import { PhonePointsCard } from "@/components/loyalty/PhonePointsCard";
import { RewardLadder, hasRewardLadder } from "@/components/loyalty/RewardLadder";

export default function PuntosPage() {
  const params = useParams();
  const restaurantId =
    typeof params.restaurantId === "string" ? params.restaurantId : "";
  const [restaurantName, setRestaurantName] = useState("este lugar");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [phoneInput, setPhoneInput] = useState("");
  const [phone, setPhone] = useState<string | null>(null);
  /** Doc del restaurante — alimenta la escalera de premios fantasma. */
  const [rdata, setRdata] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (!restaurantId) return;
    getDoc(doc(getFirebaseDb(), "restaurants", restaurantId))
      .then((snap) => {
        const data = snap.data() as Record<string, unknown> | undefined;
        const n = (data?.name as string | undefined)?.trim();
        if (n) setRestaurantName(n);
        setLogoUrl(getRestaurantImageUrl(data));
        if (data) setRdata(data);
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
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt={restaurantName}
            className="mx-auto h-16 w-16 rounded-2xl object-cover shadow-md ring-1 ring-[#1C2526]/10"
          />
        ) : null}

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
            {/* Premios fantasma ANTES de pedir el número (patrón Owner:
                enseñar la comida gratis que te espera = la razón para
                verificar, no un premio por haberlo hecho). */}
            {rdata && hasRewardLadder(rdata) ? (
              <div className="mt-5 border-t border-[#1C2526]/8 pt-4 text-left">
                <p className="mb-3 text-sm font-bold text-[#1C2526]">
                  Lo que te puedes ganar aquí 👀
                </p>
                <RewardLadder restaurantData={rdata} />
              </div>
            ) : null}
          </div>
        ) : (
          <>
            <PhonePointsCard
              restaurantId={restaurantId}
              restaurantName={restaurantName}
              phone={phone}
            />
            {/* App-as-wallet upsell — post-value moment, same pitch as the
                receipt banner. Never a requirement, always an upgrade. */}
            <div className="rounded-2xl border border-[#F28C38]/35 bg-[#FFF3E8] p-4 text-center">
              <p className="text-sm font-bold text-[#1C2526]">
                Llévate tus puntos contigo 🔔
              </p>
              <p className="mt-1 text-xs leading-relaxed text-[#1C2526]/65">
                Con la app Comeleal entras con tu número, ves tus puntos de
                todos tus lugares y te avisamos cuando tengas premios.
              </p>
              <a
                href={`/download.html?type=menu&restaurantId=${encodeURIComponent(restaurantId)}`}
                className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[#F28C38] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#d67428]"
              >
                Descargar Comeleal
              </a>
            </div>
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
