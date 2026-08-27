"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import { waitForAuthReady } from "@/lib/auth";
import { pixelCompleteRegistration } from "@/lib/meta/pixel";
import { generateEventId } from "@/lib/meta/eventId";
import { sendBrowserCapiEvents } from "@/lib/meta/capiBrowser";
import { trackVendorOnboardingCompleted } from "@/lib/analytics/vendorAcquisition";
import MenuShareModal from "../../_components/MenuShareModal";

/**
 * Fire CompleteRegistration (Pixel + CAPI) + GA4 once per restaurant.
 * localStorage guard prevents refires when the vendor revisits this page.
 */
function fireOnboardingCompletedOnce(restaurantId: string) {
  try {
    const guardKey = `cml_onboarding_done_${restaurantId}`;
    if (localStorage.getItem(guardKey)) return;
    localStorage.setItem(guardKey, "1");

    const eventId = generateEventId();
    pixelCompleteRegistration(eventId);
    sendBrowserCapiEvents([
      {
        event_name: "CompleteRegistration",
        event_id: eventId,
        event_source_url: window.location.href,
      },
    ]);
    trackVendorOnboardingCompleted();
  } catch {
    // Tracking must never break the page.
  }
}

export default function SetupDonePage() {
  const router = useRouter();
  const [restaurantName, setRestaurantName] = useState("Tu restaurante");
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [restaurantWhatsapp, setRestaurantWhatsapp] = useState<string | null>(null);
  const [slug, setSlug] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [shareOpen, setShareOpen] = useState(false);

  useEffect(() => {
    async function init() {
      const u = await waitForAuthReady();
      if (!u || u.isAnonymous) { router.push("/activar"); return; }
      const db = getFirebaseDb();
      const uSnap = await getDoc(doc(db, "users", u.uid));
      const rid = uSnap.data()?.ownedRestaurantId as string | undefined;
      if (!rid) { router.push("/activar"); return; }
      const rSnap = await getDoc(doc(db, "restaurants", rid));
      const name = (rSnap.data()?.name as string | undefined)?.trim();
      if (name) setRestaurantName(name);
      const wa = String(rSnap.data()?.whatsapp ?? "").replace(/\D/g, "");
      if (wa.length >= 10) setRestaurantWhatsapp(wa.slice(-10));
      setRestaurantId(rid);
      setLoading(false);
      fireOnboardingCompletedOnce(rid);
    }
    init().catch(() => setLoading(false));
  }, [router]);

  const qrUrl = restaurantId
    ? `https://comeleal.com/menu/${restaurantId}`
    : null;


  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#faf9f5]">
        <svg className="h-6 w-6 animate-spin text-[#F28C38]" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 12 5.373 12 12H4z"/>
        </svg>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#faf9f5] px-4">
      <div className="mx-auto w-full max-w-sm text-center">

        {/* Celebration icon */}
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[#F28C38]/10">
          <span className="text-4xl" role="img" aria-label="confetti">🎉</span>
        </div>

        {/* Headline */}
        <h1 className="text-2xl font-bold tracking-tight text-[#141413]">
          ¡{restaurantName} está listo!
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-[#141413]/55">
          Ya tienes horario, menú y recompensas configurados.
          Tus clientes pueden escanearte y ganar puntos desde ahora.
        </p>

        {/* Momento QR — MISMO modal de marca que el panel (paridad, cazada
            por Ricardo 26-ago): tarjeta con logo, QR local nítido, link
            bonito e imprimir. Aquí vivía el "antes" que el panel ya enterró
            (QR de api.qrserver.com + link de ID pelón + imprimir casero). */}
        {restaurantId && (
          <div className="mt-8 rounded-2xl border border-[#141413]/8 bg-white p-6">
            <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-[#F28C38]">
              Tu código QR de menú
            </p>
            <p className="mb-4 text-xs text-[#141413]/50">
              Ponlo en tu mesa o en tu caja — tus clientes escanean, ven tu menú y ganan puntos
            </p>
            <button
              onClick={() => setShareOpen(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#F28C38] px-4 py-3.5 text-sm font-bold text-[#1C2526] shadow-sm transition-all hover:opacity-90 active:scale-[0.98]"
            >
              Ver, imprimir y compartir mi QR →
            </button>
            {restaurantWhatsapp && qrUrl && (
              <a
                href={`https://wa.me/52${restaurantWhatsapp}?text=${encodeURIComponent(
                  `🎉 Mi menú digital ya está VIVO\n\n📌 Link de mi QR (este va impreso en mesas y caja):\n${qrUrl}\n\n📣 Link para mandar a mis clientes (lleva mi menú, teléfono y ubicación):\nhttps://comeleal.com/r/${slug ?? restaurantId}\n\nEl QR lo imprimo desde mi panel — o en cualquier papelería.`,
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-[#25D366]/40 bg-[#25D366]/5 px-4 py-3 text-sm font-semibold text-[#128C4B] hover:bg-[#25D366]/10 transition-all"
              >
                📲 Mandármelo a mi WhatsApp
              </a>
            )}
          </div>
        )}

        {restaurantId && (
          <MenuShareModal
            restaurantId={restaurantId}
            open={shareOpen}
            onClose={() => setShareOpen(false)}
          />
        )}

        {/* CTA */}
        <button
          onClick={() => router.push("/vendor")}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-[#141413]/15 bg-white px-6 py-4 text-sm font-semibold text-[#1C2526] transition-all hover:border-[#F28C38]/50 hover:text-[#B45309]"
        >
          Ver mi panel →
        </button>

      </div>
    </div>
  );
}
