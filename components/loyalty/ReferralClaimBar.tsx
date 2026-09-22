"use client";

import { useState, useSyncExternalStore } from "react";
import { clearStoredRef, isMyReferralCode } from "@/lib/referral/refSession";

/** El almacenamiento del navegador no cambia por fuera: no hay a qué suscribirse. */
const subscribeNada = () => () => {};
const claimedKey = (restaurantId: string) => `comeleal_ref_claimed_${restaurantId}`;

/**
 * La barra del AMIGO (docs/REFERIDOS_POR_TELEFONO.md §4 y §9).
 *
 * El amigo abrió el link del que lo invitó (/menu/{rid}?ref=ACDEFG). Aquí pone
 * su número y su taco "queda apuntado". Es el camino de MOSTRADOR: en Suadero
 * casi todo se pide en la ventanilla, así que sin esto el referido solo
 * funcionaría para quien pide en línea.
 *
 * Sin SMS a propósito: aquí no se entrega nada, solo se apunta. El premio lo
 * otorga el servidor cuando el amigo PAGA, y ahí viven los cuatro candados
 * (§5). Lo peor que puede hacer un curioso es apuntar algo que después se
 * rechaza.
 *
 * El copy no promete de más (19-sep): el taco del amigo NO se entrega en su
 * primera compra — con su primer pedido pagado se lo GANA, para su SIGUIENTE
 * visita (así funciona la bienvenida). Y dice "si es tu primera vez", porque un teléfono
 * que ya le compró al local no califica y no se le va a mentir.
 */
export default function ReferralClaimBar({
  restaurantId,
  refCode,
  itemName,
}: {
  restaurantId: string;
  refCode: string;
  itemName: string | null;
}) {
  const [phone, setPhone] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");

  // Si este navegador ya lo apuntó, la barra no vuelve a insistir. Se lee con
  // useSyncExternalStore y no en un efecto: en el servidor no hay
  // localStorage, así que la primera pintada es la misma en los dos lados y no
  // hay parpadeo ni queja de hidratación.
  const yaApuntado = useSyncExternalStore(
    subscribeNada,
    () => {
      try {
        return window.localStorage.getItem(claimedKey(restaurantId));
      } catch {
        return null;
      }
    },
    () => null,
  );
  const hidden = yaApuntado === refCode && refCode !== "";
  // 22-sep: si el código es el SUYO (lo vio en su recibo en este navegador),
  // esta barra le mentiría: "un amigo te invitó" — a él, que es el que invita.
  // Y si se apuntara, el grant lo rechaza dos veces. No se pinta.
  const esMio = useSyncExternalStore(
    subscribeNada,
    () => isMyReferralCode(restaurantId, refCode),
    () => false,
  );

  // Sin código no hay invitación, y sin premio con nombre no hay nada que
  // prometer: en los dos casos la barra no existe.
  // OJO (19-sep, cazado probando en producción): al apuntar se guarda en el
  // navegador que "ya se apuntó", y eso vuelve `hidden` verdadero en ESE mismo
  // render. Si se escondiera aquí, la barra desaparecería en vez de enseñar
  // "Ya quedó apuntado" y el amigo no sabría si funcionó. Solo se esconde en
  // una visita POSTERIOR, nunca justo después de apuntar.
  if (!refCode || !itemName || esMio || (hidden && state !== "done")) return null;

  const digits = phone.replace(/\D/g, "").slice(-10);
  const listo = digits.length === 10;

  async function apuntar() {
    if (!listo || state !== "idle") return;
    setState("sending");
    try {
      await fetch("/api/referral-claims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId, code: refCode, phone: digits }),
      });
    } catch {
      // El endpoint contesta 204 siempre y no hay nada que reintentar aquí:
      // si se cayó la red, el amigo puede pedir en línea con el link y el
      // código viaja igual en el pedido.
    }
    try {
      window.localStorage.setItem(claimedKey(restaurantId), refCode);
    } catch {
      // sin almacenamiento: solo se pierde que no vuelva a aparecer
    }
    // El código ya cumplió: se olvida para que no se pegue a pedidos futuros.
    clearStoredRef(restaurantId);
    setState("done");
  }

  return (
    <div className="px-4 pt-3 sm:px-6" role="status">
      <div
        className="mx-auto max-w-3xl rounded-2xl px-4 py-3 lg:max-w-4xl"
        style={{
          background: "rgba(242,140,56,0.1)",
          border: "1px solid rgba(242,140,56,0.3)",
        }}
      >
        {state === "done" ? (
          <div className="flex items-start gap-2">
            <span className="text-[18px]">✅</span>
            {/* 22-sep: el servidor contesta 204 SIEMPRE (a propósito: decir
                "no" revelaría si ese número ya compró aquí). Así que esta
                confirmación no puede prometer en firme. Lleva la misma
                condición que ya decía la letra chica antes de apuntar: "si es
                tu primera vez". Un número que ya compró no se lleva nada, y
                aquí no se le dice lo contrario. */}
            <p className="text-[13px] font-semibold text-[#1C2526]">
              Listo. Si es tu primera vez aquí, con tu primer pedido pagado con
              este número te ganas un{" "}
              <span className="text-[#F28C38]">{itemName}</span> gratis para tu
              siguiente visita.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-start gap-2">
              <span className="text-[18px]">🎁</span>
              <p className="text-[13px] font-semibold text-[#1C2526]">
                Un amigo te invitó. Con tu primer pedido te ganas un{" "}
                <span className="text-[#F28C38]">{itemName}</span> gratis para tu
                siguiente visita.
              </p>
            </div>
            <div className="mt-2 flex gap-2">
              <input
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="10 dígitos"
                aria-label="Tu WhatsApp, 10 dígitos"
                className="min-h-11 flex-1 rounded-xl border border-[#1C2526]/15 bg-white px-3 text-[14px] text-[#1C2526] outline-none focus:border-[#F28C38]"
              />
              <button
                type="button"
                onClick={apuntar}
                disabled={!listo || state === "sending"}
                className="min-h-11 rounded-xl bg-[#F28C38] px-4 text-[14px] font-bold text-white transition-opacity disabled:opacity-40"
              >
                {state === "sending" ? "..." : "Apuntar"}
              </button>
            </div>
            <p className="mt-1.5 text-[11px] leading-snug text-[#1C2526]/60">
              Pon tu WhatsApp y te lo apuntamos. Solo cuenta si es tu primera vez
              aquí. No te mandamos mensajes.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
