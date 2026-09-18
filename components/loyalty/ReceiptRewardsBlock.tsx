"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { expiryLabel, type FreeItemRow } from "@/lib/loyalty/freeItems";
import { inviteTextFallback } from "@/lib/referral/referralLink";

/**
 * Lo que el comensal ve en su recibo (docs/REFERIDOS_POR_TELEFONO.md §3, §7, §9):
 *
 *   1. Sus tacos vivos, con hasta cuándo puede pedirlos.
 *   2. El botón de invitar a un amigo.
 *
 * Aquí ARRANCA EL RELOJ: cuando este bloque se dibuja de verdad en su pantalla
 * se marca "visto" y el taco pasa a vivir 7 días desde ese momento (§7). Por
 * eso el aviso va por IntersectionObserver y no en el GET: el preview de
 * WhatsApp hace el fetch del link pero no corre scripts, y no debe contar como
 * visto. El tap del dueño en "Enviar recibo" tampoco cuenta.
 *
 * Todo pasa por endpoints con la llave del pedido: el comensal en mostrador no
 * tiene sesión y su doc de teléfono no lo puede leer sin verificar su número.
 *
 * Si el local no está en esto, o no hay tacos ni invitación posible, el
 * componente no pinta NADA.
 */

type ApiItem = Pick<FreeItemRow, "id" | "source" | "itemName"> & {
  expiresAt: number | null;
  referredName?: string;
};

export default function ReceiptRewardsBlock({
  restaurantId,
  orderId,
  restaurantName,
  className,
}: {
  restaurantId: string;
  orderId: string;
  restaurantName: string;
  className?: string;
}) {
  const [items, setItems] = useState<ApiItem[] | null>(null);
  const [invite, setInvite] = useState<{ link: string } | null>(null);
  const seenSent = useRef(false);
  const boxRef = useRef<HTMLDivElement | null>(null);

  const cargar = useCallback(async () => {
    try {
      const r = await fetch("/api/free-items/list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId, orderId }),
      });
      const j = (await r.json()) as { items?: ApiItem[] };
      setItems(Array.isArray(j.items) ? j.items : []);
    } catch {
      setItems([]);
    }
  }, [restaurantId, orderId]);

  // La primera carga va en un async de una vez, con bandera de cancelado: así
  // no se toca el estado de un componente que ya se desmontó.
  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const r = await fetch("/api/free-items/list", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ restaurantId, orderId }),
        });
        const j = (await r.json()) as { items?: ApiItem[] };
        if (!cancelado) setItems(Array.isArray(j.items) ? j.items : []);
      } catch {
        if (!cancelado) setItems([]);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [restaurantId, orderId]);

  // El código de invitación se acuña en el servidor la primera vez que se pide.
  // 204 = este teléfono todavía no puede invitar (o el local no está en esto).
  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const r = await fetch("/api/referral-code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ restaurantId, orderId }),
        });
        if (r.status !== 200) return;
        const j = (await r.json()) as { link?: string };
        if (!cancelado && typeof j.link === "string" && j.link) setInvite({ link: j.link });
      } catch {
        // sin invitación: el recibo sigue siendo recibo
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [restaurantId, orderId]);

  // "Visto" = se dibujó en SU pantalla. Una sola vez, y luego se recarga la
  // lista para que la fecha que se muestra ya sea la del reloj corriendo.
  useEffect(() => {
    const el = boxRef.current;
    if (!el || seenSent.current || !items || items.length === 0) return;
    if (typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting) || seenSent.current) return;
        seenSent.current = true;
        obs.disconnect();
        fetch("/api/free-items/seen", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ restaurantId, orderId }),
        })
          .then(() => cargar())
          .catch(() => {});
      },
      { threshold: 0.6 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [items, restaurantId, orderId, cargar]);

  const tacos = items ?? [];
  if (tacos.length === 0 && !invite) return null;

  const primero = tacos[0];
  const inviteText = invite
    ? inviteTextFallback({
        itemName: primero?.itemName || "taco",
        restaurantName,
        link: invite.link,
      })
    : "";

  return (
    <div ref={boxRef} className={className}>
      {tacos.length > 0 ? (
        <div className="rounded-2xl border border-[#F28C38]/30 bg-[#F28C38]/10 px-4 py-3">
          <p className="text-[15px] font-bold text-[#1C2526]">
            🌮 {tacos.length === 1 ? "Tienes un" : `Tienes ${tacos.length}`}{" "}
            {tacos.length === 1 ? primero.itemName : "premios"} gratis
          </p>
          <ul className="mt-1.5 space-y-1">
            {tacos.map((t) => (
              <li key={t.id} className="text-[12px] leading-snug text-[#1C2526]/70">
                {t.itemName}
                {t.source === "referral"
                  ? t.referredName
                    ? ` — porque ${t.referredName} vino por tu link`
                    : " — porque tu amigo vino por tu link"
                  : ""}
                {t.expiresAt
                  ? ` · ${expiryLabel({ id: t.id, source: t.source, itemName: t.itemName, expiresAt: t.expiresAt })}`
                  : ""}
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-[12px] font-semibold text-[#1C2526]/80">
            Pídelo en tu próxima visita: da tu número al pagar.
          </p>
        </div>
      ) : null}

      {invite ? (
        <div className="mt-3 rounded-2xl border border-[#1C2526]/10 bg-white px-4 py-3">
          <p className="text-[15px] font-bold text-[#1C2526]">
            Invita a un amigo y los dos ganan
          </p>
          <p className="mt-1 text-[12px] leading-snug text-[#1C2526]/70">
            Él se lleva un {primero?.itemName || "premio"} en su primera compra,
            y tú otro para tu siguiente visita.
          </p>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(inviteText)}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => {
              // Primera medida del embudo del referido (§10).
              fetch("/api/referral-code", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ restaurantId, orderId, tapped: true }),
              }).catch(() => {});
            }}
            className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#1ebe5b]"
          >
            Mandar mi link por WhatsApp
          </a>
        </div>
      ) : null}
    </div>
  );
}
