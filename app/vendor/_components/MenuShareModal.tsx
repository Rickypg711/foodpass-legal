"use client";

// Modal de compartir menú — LA experiencia única de compartir en la web,
// paridad 1:1 con el diálogo del app (menu_share_dialog.dart) y los stickers:
// tarjeta de marca (logo, nombre, gancho, QR en tinta de marca, línea de
// puntos, link legible) + UN Compartir + fila de link copiable + Imprimir.
//
// Reglas:
// - El QR SIEMPRE codifica la URL canónica de ID (eterna — los stickers
//   impresos jamás se rompen). El texto visible/copiado/compartido usa el
//   slug bonito cuando existe.
// - QR renderizado LOCAL (qrcode.react) — cero servicios externos (el
//   anterior api.qrserver.com mandaba la URL a un tercero y puede morir
//   igual que murió chart.googleapis.com).
// - Compartir manda LA TARJETA como imagen cuando el navegador puede
//   (navigator.canShare files); si no, share de texto; en desktop sin share:
//   descarga la tarjeta + copia el link con feedback visible.

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { doc, getDoc } from "firebase/firestore";
import { QRCodeSVG } from "qrcode.react";
import { toPng } from "html-to-image";
import { getFirebaseDb } from "@/lib/firebase";
import { getRestaurantImageUrl } from "@/lib/restaurantImage";

const ORANGE = "#F28C38";
const CREAM = "#FAF7F2";
const INK = "#1C2526";

export default function MenuShareModal({
  restaurantId,
  open,
  onClose,
}: {
  restaurantId: string;
  open: boolean;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [slug, setSlug] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !restaurantId) return;
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(doc(getFirebaseDb(), "restaurants", restaurantId));
        const d = (snap.data() as Record<string, unknown>) ?? {};
        if (cancelled) return;
        setName(typeof d.name === "string" ? d.name : "");
        setLogoUrl(getRestaurantImageUrl(d));
        const s = d.slug;
        setSlug(
          typeof s === "string" && s.length >= 3 && /^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(s)
            ? s
            : null,
        );
      } catch {
        // sin doc: la tarjeta funciona igual con el link de ID
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, restaurantId]);

  if (!open) return null;

  // Dos trabajos distintos, dos ligas distintas.
  //
  // LA TARJETA es un objeto fisico: vive en el mostrador o en la mesa. Quien la
  // usa YA esta ahi, asi que va derecho a la carta para ordenar con los menos
  // toques posibles. El QR codifica el ID —que nunca cambia— para que una
  // tarjeta impresa hoy siga sirviendo aunque el restaurante se renombre; el
  // texto impreso usa el slug porque es el que un humano puede teclear. Si el
  // slug cambiara se rompe el texto, no el QR: el camino principal sobrevive.
  const qrUrl = `https://comeleal.com/menu/${restaurantId}`;
  const cardUrl = `https://comeleal.com/menu/${slug ?? restaurantId}`;
  const cardText = cardUrl.replace(/^https?:\/\/(www\.)?/, "");

  // LA LIGA QUE MANDAS va a la portada (/r), no a la carta. Quien la recibe por
  // WhatsApp o la abre desde una bio TODAVIA NO LLEGA: necesita saber donde
  // estas, si abriste y como llamarte. La portada trae todo eso y su boton
  // principal es "Ver menu y ordenar", asi que no pierde el menu, gana el resto.
  const shareUrl = `https://comeleal.com/r/${slug ?? restaurantId}`;
  const shareText = `Mira el menú de ${name || "nuestro restaurante"}, pide en línea y junta puntos 🍽️ ${shareUrl}`;

  async function cardPngFile(): Promise<File | null> {
    if (!cardRef.current) return null;
    try {
      const dataUrl = await toPng(cardRef.current, { pixelRatio: 3, cacheBust: true });
      const blob = await (await fetch(dataUrl)).blob();
      return new File([blob], `menu-${slug ?? restaurantId}.png`, { type: "image/png" });
    } catch {
      return null;
    }
  }

  function flash(msg: string) {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 2500);
  }

  async function handleShare() {
    if (busy) return;
    setBusy(true);
    try {
      const file = await cardPngFile();
      if (
        file &&
        typeof navigator !== "undefined" &&
        navigator.canShare?.({ files: [file] })
      ) {
        await navigator.share({ files: [file], title: name || "Comeleal", text: shareText });
        return;
      }
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: name || "Comeleal", text: shareText, url: shareUrl });
        return;
      }
      // Desktop sin Web Share: la tarjeta se descarga y el link queda copiado.
      if (file) {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(file);
        a.download = file.name;
        a.click();
        URL.revokeObjectURL(a.href);
      }
      await navigator.clipboard.writeText(shareUrl);
      flash(file ? "Tarjeta descargada y link copiado ✅" : "Link copiado ✅");
    } catch {
      // share sheet cerrado por el usuario — no-op
    } finally {
      setBusy(false);
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      flash("Link copiado ✅");
    } catch {
      // clipboard bloqueado — el link queda visible para copiar a mano
    }
  }

  async function handlePrint() {
    if (!cardRef.current || busy) return;
    setBusy(true);
    try {
      const dataUrl = await toPng(cardRef.current, { pixelRatio: 3, cacheBust: true });
      const win = window.open("", "_blank");
      if (!win) return;
      win.document.write(`
        <!DOCTYPE html><html><head><title>Menú — ${name || "Comeleal"}</title>
        <style>*{margin:0;padding:0}body{display:flex;align-items:center;justify-content:center;min-height:100vh;background:#fff}img{width:340px}</style>
        </head><body><img src="${dataUrl}" alt="" onload="window.print()" /></body></html>
      `);
      win.document.close();
    } catch {
      // sin imagen no hay nada que imprimir — no-op
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
        style={{ maxHeight: "92vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[15px] font-extrabold" style={{ color: INK }}>
            Compartir menú
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-full px-2 text-[18px]"
            style={{ color: "rgba(28,37,38,0.5)" }}
          >
            ✕
          </button>
        </div>

        {/* La tarjeta de marca — lo que se comparte/imprime es EXACTAMENTE esto. */}
        <div
          ref={cardRef}
          className="flex flex-col items-center text-center"
          style={{
            background: CREAM,
            border: `3px solid ${ORANGE}`,
            borderRadius: 20,
            padding: "20px 18px 16px",
          }}
        >
          {logoUrl ? (
            // next/image = URL same-origin (/_next/image) → se ve en el modal
            // Y entra al PNG de la tarjeta sin CORS. priority: cargado antes
            // de que alguien alcance a tocar Compartir/Imprimir.
            <Image
              src={logoUrl}
              alt=""
              width={56}
              height={56}
              priority
              className="h-14 w-14 rounded-full object-cover"
            />
          ) : (
            <div
              className="flex h-14 w-14 items-center justify-center rounded-full text-[22px]"
              style={{ background: "rgba(28,37,38,0.08)" }}
            >
              🏪
            </div>
          )}
          <p className="mt-2 text-[20px] font-extrabold leading-tight" style={{ color: INK }}>
            {name || " "}
          </p>
          <div className="mt-1.5 h-1 w-14 rounded-full" style={{ background: ORANGE }} />
          <p className="mt-2.5 text-[14px] font-bold" style={{ color: INK }}>
            Pide en línea y junta puntos
          </p>
          <div className="mt-3 rounded-[14px] bg-white p-2.5">
            <QRCodeSVG value={qrUrl} size={180} fgColor={INK} bgColor="#FFFFFF" />
          </div>
          <p className="mt-2.5 text-[12px] font-semibold" style={{ color: "rgba(28,37,38,0.75)" }}>
            Escanea para ver el menú
          </p>
          <p className="mt-1 text-[12px] font-bold" style={{ color: ORANGE }}>
            Cada compra suma puntos — canjéalos por platillos gratis
          </p>
          <p className="mt-2 text-[12px] font-bold" style={{ color: "rgba(28,37,38,0.45)" }}>
            {cardText}
          </p>
        </div>

        {/* Fila de link: tocar copia. Lleva su propia linea de contexto porque
            NO es la misma liga que imprime la tarjeta, y sin decirlo eso se
            lee como un error. Dice lo que recibe el que la abre. */}
        {/* 0.65, no 0.45: a 11px el token muteado de la tarjeta da 2.74:1 y el
            piso es 4.5:1. La jerarquia la carga el tamaño —la liga de abajo va
            a 13px y es lo accionable—, no el gris. Un gris clarito "elegante"
            aqui solo lo vuelve ilegible. */}
        <p className="mt-3 text-center text-[11px] font-semibold" style={{ color: "rgba(28,37,38,0.65)" }}>
          La liga que mandas lleva tu menú, tu teléfono y tu ubicación
        </p>
        <button
          type="button"
          onClick={handleCopy}
          aria-label={`Copiar mi liga: ${shareUrl}`}
          className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-[13px] font-semibold"
          style={{ color: "rgba(28,37,38,0.65)" }}
        >
          <span className="truncate">{shareUrl.replace(/^https?:\/\/(www\.)?/, "")}</span>
          <span style={{ color: ORANGE }} aria-hidden>⧉</span>
        </button>

        <button
          type="button"
          onClick={handleShare}
          disabled={busy}
          className="mt-1 w-full rounded-2xl py-3.5 text-[15px] font-extrabold text-white disabled:opacity-60"
          style={{ background: ORANGE }}
        >
          {busy ? "…" : "📤 Compartir"}
        </button>
        <button
          type="button"
          onClick={handlePrint}
          disabled={busy}
          className="mt-2 w-full rounded-2xl border py-3 text-[14px] font-bold disabled:opacity-60"
          style={{ borderColor: "rgba(242,140,56,0.35)", color: ORANGE }}
        >
          🖨️ Imprimir tarjeta
        </button>

        {feedback && (
          <p className="mt-2 text-center text-[12px] font-bold" style={{ color: "#15803D" }}>
            {feedback}
          </p>
        )}
      </div>
    </div>
  );
}
