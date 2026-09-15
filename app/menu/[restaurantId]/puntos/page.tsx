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
import { phoneCountryOf } from "@/lib/phone/phoneCountry";
import { DEFAULT_FLOW, flowThemeFor } from "@/components/menu/skins/flowTheme";

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
  /** Ropa del flujo según la piel del local; sin piel, el naranja de siempre. */
  const th = flowThemeFor(rdata);

  return (
    <div className={th.rootFlat} style={th.rootFlatStyle}>
      <th.Header page="puntos" restaurantId={restaurantId} restaurantName={restaurantName} logoUrl={logoUrl} title="⭐ Mis puntos" />

      <main className="mx-auto max-w-md space-y-4 px-4 py-6">
        {/* Con piel, el logo ya va en el encabezado de marca. */}
        {logoUrl && th === DEFAULT_FLOW ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt={restaurantName}
            className={`mx-auto h-16 w-16 rounded-2xl object-cover shadow-md ring-1 ${th.ringSoft}`}
          />
        ) : null}

        {!phone ? (
          <div className={`${th.cardFlat} rounded-2xl p-5 text-center`}>
            <p className={`text-base font-bold ${th.ink}`}>
              Consulta tus puntos en {restaurantName}
            </p>
            <p className={`mt-1 text-xs ${th.ink}/60`}>
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
              className={`mt-4 w-full text-center ${th.inputPlain}`}
            />
            <button
              type="button"
              disabled={!valid}
              onClick={() => setPhone(digits)}
              className={`mt-3 inline-flex min-h-11 w-full items-center justify-center ${th.btn}`}
            >
              Continuar
            </button>
            {/* Premios fantasma ANTES de pedir el número (patrón Owner:
                enseñar la comida gratis que te espera = la razón para
                verificar, no un premio por haberlo hecho). */}
            {rdata && hasRewardLadder(rdata) ? (
              <div className={`mt-5 border-t ${th.divider} pt-4 text-left`}>
                <p className={`mb-3 text-sm font-bold ${th.ink}`}>
                  Lo que te puedes ganar aquí 👀
                </p>
                <RewardLadder restaurantData={rdata} />
              </div>
            ) : null}
          </div>
        ) : (
          <>
            <PhonePointsCard
              theme={th}
              restaurantId={restaurantId}
              restaurantName={restaurantName}
              phone={phone}
              phoneCountryCode={phoneCountryOf(rdata)}
            />
            {/* App-as-wallet upsell — post-value moment, same pitch as the
                receipt banner. Never a requirement, always an upgrade. */}
            <div className={th.highlightBox}>
              <p className={`text-sm font-bold ${th.ink}`}>
                Llévate tus puntos contigo 🔔
              </p>
              <p className={`mt-1 text-xs leading-relaxed ${th.ink}/65`}>
                Con la app Comeleal entras con tu número, ves tus puntos de
                todos tus lugares y te avisamos cuando tengas premios.
              </p>
              <a
                href={`/download.html?type=menu&restaurantId=${encodeURIComponent(restaurantId)}`}
                className={`mt-3 inline-flex min-h-11 w-full items-center justify-center ${th.btn}`}
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
              className={`block w-full text-center ${th.linkMuted}`}
            >
              Usar otro número
            </button>
          </>
        )}

        <Link
          href={`/menu/${encodeURIComponent(restaurantId)}`}
          className={`block text-center ${th.linkMuted}`}
        >
          Volver al menú
        </Link>
      </main>
    </div>
  );
}
