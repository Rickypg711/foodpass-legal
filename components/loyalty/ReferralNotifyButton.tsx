"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import { buildWhatsappUrl } from "@/lib/order/formatWhatsappMessage";
import { notifyTextFallback } from "@/lib/referral/referralLink";

/**
 * "Avísale" (docs/REFERIDOS_POR_TELEFONO.md §9).
 *
 * El amigo acaba de pagar y el servidor ya le dio su taco a quien lo invitó.
 * Esa persona no está aquí y no se va a enterar sola: el local le manda un
 * WhatsApp, a mano, con el texto ya escrito.
 *
 * MANUAL A PROPÓSITO. No se manda solo y nunca se dice que sea automático:
 * un número no puede estar en la app de WhatsApp y en el API a la vez
 * (memoria whatsapp-winback-es-manual-y-gratis), así que desde el número del
 * local esto SOLO puede ser una persona tocando un botón.
 *
 * El grant lo escribe un trigger, así que tarda un segundo en aparecer: se
 * escucha el doc y el botón sale cuando existe. Si no llega, no se pinta nada
 * y el cobro sigue su vida.
 */
export default function ReferralNotifyButton({
  restaurantId,
  orderId,
  restaurantName,
  friendName,
  phoneCountryCode,
}: {
  restaurantId: string;
  orderId: string;
  restaurantName: string;
  friendName?: string;
  phoneCountryCode?: string;
}) {
  const [grant, setGrant] = useState<{
    referrerPhone: string;
    itemName: string;
    notified: boolean;
  } | null>(null);

  useEffect(() => {
    if (!restaurantId || !orderId) return;
    const ref = doc(getFirebaseDb(), "restaurants", restaurantId, "referrals", orderId);
    const stop = onSnapshot(
      ref,
      (snap) => {
        const d = snap.data();
        if (!d) return;
        const phone = String(d.referrerPhone ?? "").replace(/\D/g, "");
        if (phone.length < 10) return;
        setGrant({
          referrerPhone: phone,
          itemName: String(d.itemName ?? "premio"),
          notified: !!d.notifiedAt,
        });
      },
      () => {
        // sin permiso o sin red: no hay botón, y ya
      },
    );
    return () => stop();
  }, [restaurantId, orderId]);

  if (!grant || grant.notified) return null;

  const texto = notifyTextFallback({
    itemName: grant.itemName,
    restaurantName,
    friendName,
  });

  return (
    <button
      onClick={() => {
        window.open(
          buildWhatsappUrl(grant.referrerPhone, texto, phoneCountryCode),
          "_blank",
          "noopener,noreferrer",
        );
        // Queda marcado para no volver a ofrecerlo y para medir el loop (§10).
        void setDoc(
          doc(getFirebaseDb(), "restaurants", restaurantId, "referrals", orderId),
          { notifiedAt: new Date() },
          { merge: true },
        ).catch(() => {});
        setGrant({ ...grant, notified: true });
      }}
      className="w-full rounded-2xl py-3 text-[14px] font-bold text-white"
      style={{ background: "#128C7E" }}
    >
      🎁 Avísale a quien lo invitó — se ganó un {grant.itemName}
    </button>
  );
}
