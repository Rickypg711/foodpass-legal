"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  computeExpiresAtMs,
  expiryLabel,
  type FreeItemRow,
} from "@/lib/loyalty/freeItems";
import { inviteTextFallback } from "@/lib/referral/referralLink";
import { buildWhatsappShareUrl } from "@/lib/order/formatWhatsappMessage";

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
  /** Para pintar la fecha que VA a quedar (ver `fechaQueVaAQuedar`). */
  bornAt?: number | null;
  seenAt?: number | null;
  referredName?: string;
};

/**
 * La fecha que hay que enseñarle AL COMENSAL, desde el primer dibujo.
 *
 * 22-sep-2026: este bloque arranca el reloj al verse (30 días → 7 desde que se
 * ve). Antes pintaba el `expiresAt` guardado y, un segundo después, recargaba
 * con el nuevo: el comensal alcanzaba a leer "22 de octubre" y se le cambiaba
 * a "29 de septiembre" enfrente. Correcto por dentro, y por fuera parecía que
 * el local le acortaba el premio mientras lo miraba.
 *
 * Como VERLO es justo lo que arranca el reloj, la única fecha honesta en el
 * momento en que la lee es la de después. Se pinta desde el principio y ya no
 * se mueve: cuando el servidor confirma, escribe exactamente la misma.
 */
function fechaQueVaAQuedar(t: ApiItem, nowMs: number): number | null {
  if (t.seenAt) return t.expiresAt; // ya corría: lo guardado manda
  if (!t.bornAt) return t.expiresAt; // sin ancla no se inventa nada
  return computeExpiresAtMs(t.bornAt, nowMs);
}

export default function ReceiptRewardsBlock({
  restaurantId,
  orderId,
  restaurantName,
  className,
  onInviteAvailable,
}: {
  restaurantId: string;
  orderId: string;
  restaurantName: string;
  className?: string;
  /**
   * 25-sep-2026: la página necesita saber si la barra fija de invitar está
   * puesta, para dejarle aire abajo (si no, tapa "Volver al menú").
   */
  onInviteAvailable?: (ready: boolean) => void;
}) {
  const [items, setItems] = useState<ApiItem[] | null>(null);
  /** La frase que escribió la IA (§8). null = se usa el texto fijo. */
  const [inviteText, setInviteText] = useState<string | null>(null);
  const [invite, setInvite] = useState<{ link: string } | null>(null);
  const seenSent = useRef(false);
  const boxRef = useRef<HTMLDivElement | null>(null);
  /** El botón de la tarjeta: mientras NO se vea, lo suple la barra fija. */
  const cardBtnRef = useRef<HTMLAnchorElement | null>(null);
  const [cardBtnVisible, setCardBtnVisible] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const r = await fetch("/api/free-items/list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId, orderId }),
      });
      const j = (await r.json()) as { items?: ApiItem[]; inviteText?: string };
      setItems(Array.isArray(j.items) ? j.items : []);
      setInviteText(typeof j.inviteText === "string" ? j.inviteText : null);
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
        const j = (await r.json()) as { items?: ApiItem[]; inviteText?: string };
        if (cancelado) return;
        setItems(Array.isArray(j.items) ? j.items : []);
        setInviteText(typeof j.inviteText === "string" ? j.inviteText : null);
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

  useEffect(() => {
    onInviteAvailable?.(!!invite);
  }, [invite, onInviteAvailable]);

  // 25-sep: una sola pieza a la vista. El botón está en la tarjeta; la barra
  // fija solo lo suple mientras la tarjeta queda fuera de la pantalla.
  useEffect(() => {
    const el = cardBtnRef.current;
    if (!el || !invite || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(
      (entries) => setCardBtnVisible(entries.some((e) => e.isIntersecting)),
      { threshold: 0.9 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [invite]);

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
  // Un solo "ahora" para toda la lista: si cada taco leyera su propio reloj,
  // dos tacos nacidos igual podrían pintar días distintos. Se fija al montar
  // (lint de pureza: un render no lee el reloj).
  const [ahora] = useState(() => Date.now());
  if (tacos.length === 0 && !invite) return null;

  const primero = tacos[0];
  // La frase de la IA si la hay; si no, el texto fijo. El LINK lo pega el
  // sistema, nunca el modelo (§8: por eso el candado rechaza URLs).
  const texto = invite
    ? inviteText
      ? `${inviteText} ${invite.link}`
      : inviteTextFallback({
          itemName: primero?.itemName || "taco",
          restaurantName,
          link: invite.link,
        })
    : "";
  // Lo que se enseña en la tarjeta: el mismo mensaje, sin el link.
  // Sin el link queda "Entra con este link:" colgando; se le quita el ":" final.
  const textoSinLink = invite
    ? texto.replace(invite.link, "").replace(/\s+/g, " ").trim().replace(/[:\s]+$/, "")
    : "";

  // Primera medida del embudo del referido (§10): el mismo toque desde la
  // tarjeta o desde la barra.
  const marcarToque = () => {
    fetch("/api/referral-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restaurantId, orderId, tapped: true }),
    }).catch(() => {});
  };
  const BTN =
    "mt-3 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[#25D366] px-4 py-2.5 text-[15px] font-semibold text-[#1C2526] transition-colors hover:bg-[#1ebe5b]";

  return (
    <div ref={boxRef} className={className}>
      {tacos.length > 0 ? (
        <div className="rounded-2xl border border-[#F28C38]/30 bg-[#F28C38]/10 px-4 py-3">
          <p className="text-[15px] font-bold text-[#1C2526]">
            {tacos.length === 1 ? "Tienes un" : `Tienes ${tacos.length}`}{" "}
            {tacos.length === 1 ? primero.itemName : "premios"} gratis
          </p>
          <ul className="mt-1.5 space-y-1">
            {tacos.map((t) => (
              <li key={t.id} className="text-[12px] leading-snug text-[#1C2526]/70">
                {t.itemName}
                {t.source === "referral"
                  ? t.referredName
                    ? `, porque ${t.referredName} vino por tu link`
                    : ", porque tu amigo vino por tu link"
                  : ""}
                {(() => {
                  const vence = fechaQueVaAQuedar(t, ahora);
                  return vence
                    ? ` · ${expiryLabel({ id: t.id, source: t.source, itemName: t.itemName, expiresAt: vence })}`
                    : "";
                })()}
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-[12px] font-semibold text-[#1C2526]/80">
            Pídelo en tu próxima visita: da tu número al pagar.
          </p>
        </div>
      ) : null}

      {invite ? (
        <>
          {/* 25-sep-2026 (Opción 2 del lienzo "Recibo Suadero: invitar
              primero"): la tarjeta explica, enseña el mensaje y trae el
              botón. La barra fija de abajo es el MISMO botón, y solo aparece
              mientras el de la tarjeta no está a la vista: antes el botón
              era el sexto bloque de la página (10 recibos abiertos, 0 toques). */}
          <div className="mt-3 rounded-2xl border border-[#1C2526]/10 bg-white px-4 py-3">
            <p className="text-[15px] font-bold text-[#1C2526]">
              Invita a un amigo y los dos ganan
            </p>
            <p className="mt-1 text-[12px] leading-snug text-[#1C2526]/70">
              Con su primer pedido tu amigo se gana un{" "}
              {primero?.itemName || "premio"} para su siguiente visita, y tú te
              ganas otro cuando él pague.
            </p>
            {/* Ver el mensaje antes de mandarlo quita el miedo de "¿qué le va
                a llegar?". Sin el link: el link lo pega el sistema al mandar. */}
            <div className="mt-2.5 rounded-xl bg-[#F0EBE1] px-3 py-2">
              <p className="text-[12px] text-[#1C2526]/60">Lo que le llega a tu amigo</p>
              <p className="mt-0.5 text-[13px] leading-snug text-[#1C2526]">{textoSinLink}</p>
            </div>
            <a
              ref={cardBtnRef}
              href={buildWhatsappShareUrl(texto)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={marcarToque}
              className={BTN}
            >
              Mandar mi link por WhatsApp
            </a>
          </div>

          {cardBtnVisible ? null : (
            <div
              className="fixed inset-x-0 bottom-0 z-30 border-t border-[#E9E3D7] bg-white"
              style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
              data-testid="receipt-invite-bar"
            >
              <div className="mx-auto max-w-md px-4 pt-3">
                <a
                  href={buildWhatsappShareUrl(texto)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={marcarToque}
                  className={BTN}
                >
                  Mandar mi link por WhatsApp
                </a>
              </div>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
