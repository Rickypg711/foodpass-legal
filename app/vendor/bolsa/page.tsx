"use client";

/**
 * /vendor/bolsa — tarjetas para meter en la bolsa de los pedidos de Rappi, DiDi y Uber.
 *
 * 8-oct-2026, copiado del plan de Rebellion Pizza: las apps se llevan entre 25 y 30 %
 * de cada pedido y el cliente ni sabe que el local tiene su propio menú. Una tarjeta en
 * la bolsa con el QR de SU menú convierte al cliente de la app en cliente del local, con
 * teléfono (la métrica dominante: ventas identificadas).
 *
 * Mismo molde que /vendor/mesas: CSS de impresión puro, QR con SITE_URL (nunca el
 * origin del navegador: esto se imprime y se reparte), y sin premios prendidos la
 * tarjeta no promete puntos. El QR lleva utm_source=bolsa para saber cuántos llegan así.
 */

import { restaurantPromisesPoints } from "@/lib/readiness/evaluate";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { doc, getDoc } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import { waitForAuthReady } from "@/lib/auth";
import { resolveVendorContext, vendorHomeForRole } from "@/lib/vendorContext";
import { SITE_URL } from "@/lib/siteMetadata";
import { bagCardUrl, bagCardLines, BAG_CARD_COUNTS } from "@/lib/order/bagCard";

const SERIF = "var(--font-lora), Lora, Georgia, serif";
const INK = "#1C2526";
const INK_MUTED = "#3F4A4D";
const INK_SOFT = "#5B6366";
const BORDER = "#D9D2C5";
const TILE = "#F0EBE1";
const LINK = "#8A4B12";
const BRAND = "#F28C38";

export default function BolsaPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [restaurantId, setRestaurantId] = useState("");
  const [restaurantName, setRestaurantName] = useState("");
  const [loyaltyLive, setLoyaltyLive] = useState(true);
  const [count, setCount] = useState<number>(BAG_CARD_COUNTS[0]);

  useEffect(() => {
    async function init() {
      const u = await waitForAuthReady();
      if (!u || u.isAnonymous) {
        router.push("/activar?modo=entrar");
        return;
      }
      const db = getFirebaseDb();
      const ctx = await resolveVendorContext(db, u.uid);
      if (!ctx) {
        router.push("/activar?modo=entrar");
        return;
      }
      if (ctx.role !== "owner" && ctx.role !== "manager") {
        router.push(vendorHomeForRole(ctx.role));
        return;
      }
      setRestaurantId(ctx.restaurantId);
      const snap = await getDoc(doc(db, "restaurants", ctx.restaurantId));
      setRestaurantName((snap.data()?.name as string) ?? "Tu restaurante");
      setLoyaltyLive(restaurantPromisesPoints(snap.data()));
      setLoading(false);
    }
    init().catch(() => setLoading(false));
  }, [router]);

  if (loading) {
    return <main className="flex justify-center px-4 py-20 text-[14px]" style={{ color: INK_SOFT }}>Cargando…</main>;
  }

  const url = bagCardUrl(SITE_URL, restaurantId);
  const lines = bagCardLines(loyaltyLive);

  return (
    <main className="px-5 pb-24 pt-5 md:px-8 md:pt-7">
      <style>{`
        @media print {
          body { background: #fff !important; }
          .no-print { display: none !important; }
          .print-sheet { display: grid !important; grid-template-columns: repeat(2, 1fr) !important; gap: 0 !important; }
          .print-card { break-inside: avoid; page-break-inside: avoid; border: 1px dashed #bbb !important; box-shadow: none !important; }
          nav, header, aside, footer { display: none !important; }
        }
      `}</style>

      <div className="no-print mx-auto mb-7 max-w-3xl">
        <div className="mb-5 flex items-end justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <h1 className="text-[22px] font-semibold leading-[26px] md:text-[24px] md:leading-7" style={{ color: INK, fontFamily: SERIF }}>
              Tarjeta para la bolsa
            </h1>
            <p className="truncate text-[13px] leading-4" style={{ color: INK_SOFT }}>{restaurantName}</p>
          </div>
          <Link href="/vendor" className="shrink-0 text-[14px] font-semibold hover:underline" style={{ color: LINK }}>
            Panel
          </Link>
        </div>

        <h2 className="text-[17px] font-semibold leading-[22px]" style={{ color: INK, fontFamily: SERIF }}>
          Que el cliente de Rappi o DiDi te pida directo
        </h2>
        <p className="mt-1 text-[14px] leading-5" style={{ color: INK_MUTED }}>
          Las apps se quedan con una parte de cada pedido y tu cliente ni sabe que tienes tu
          propio menú. Mete una de estas en cada bolsa. La próxima vez te pide por tu link,
          te queda su teléfono y le puedes avisar cuando quieras que regrese.
        </p>

        <div className="mt-5 rounded-xl bg-white p-4" style={{ border: `1px solid ${BORDER}` }}>
          <span className="text-[13px] font-semibold leading-4" style={{ color: INK }}>¿Cuántas imprimes?</span>
          <div className="mt-2 flex gap-2">
            {BAG_CARD_COUNTS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setCount(n)}
                className="h-11 flex-1 rounded-xl text-[15px] font-semibold"
                style={n === count ? { background: INK, color: "#fff" } : { background: TILE, color: INK }}
              >
                {n}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            className="mt-5 flex h-12 w-full items-center justify-center rounded-xl text-[15px] font-semibold"
            style={{ background: BRAND, color: INK }}
          >
            Imprimir {count} tarjetas
          </button>
          <p className="mt-2 text-center text-[13px] leading-4" style={{ color: INK_SOFT }}>
            Salen 8 por hoja. Recorta por la línea punteada.
          </p>
        </div>
      </div>

      <div className="print-sheet mx-auto grid max-w-3xl grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: count }, (_, i) => (
          <div
            key={i}
            className="print-card flex flex-col items-center rounded-2xl bg-white px-3 py-4 text-center"
            style={{ border: "1px solid rgba(28,37,38,0.1)" }}
          >
            <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "rgba(28,37,38,0.45)" }}>
              {restaurantName}
            </p>
            <p className="mt-1 text-[17px] font-black leading-tight" style={{ color: INK }}>
              {lines.title}
            </p>
            <div className="mt-2.5 rounded-xl bg-white p-1.5" style={{ border: "1px solid rgba(28,37,38,0.08)" }}>
              <QRCodeSVG value={url} size={104} fgColor={INK} bgColor="#FFFFFF" />
            </div>
            <p className="mt-2.5 text-[12px] font-bold leading-snug" style={{ color: BRAND }}>
              {lines.cta}
            </p>
          </div>
        ))}
      </div>
    </main>
  );
}
