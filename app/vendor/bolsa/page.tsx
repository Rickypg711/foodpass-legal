"use client";

/**
 * /vendor/bolsa — "Tarjeta para tus pedidos": tarjeta o sticker para meter en los pedidos de Rappi, DiDi y Uber.
 *
 * 8-oct-2026, copiado del plan de Rebellion Pizza: las apps se llevan entre 25 y 30 % de cada pedido y el cliente ni
 * sabe que el local tiene su propio menú. Una tarjeta en la bolsa (o un sticker en la caja, el vaso o el contenedor)
 * con el QR de SU menú convierte al cliente de la app en cliente del local, con teléfono (ventas identificadas).
 *
 * Mismo molde que /vendor/mesas: CSS de impresión puro, QR con SITE_URL (nunca el origin del navegador: esto se
 * imprime y se reparte), con la ropa de la piel si el local tiene piel, y sin premios prendidos no promete puntos.
 *
 * El resultado se ve aquí mismo (lib/order/entrySource.ts): cuántos escanearon (private/stats.linkVisits.bolsa) y
 * cuántos pidieron por ella (pedidos con entrySource "bolsa", últimos 30 días). Sin ese número el dueño imprime a
 * ciegas y deja de usarla.
 */

import { restaurantPromisesPoints } from "@/lib/readiness/evaluate";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { collection, doc, getDoc, getDocs, query, Timestamp, where } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import { waitForAuthReady } from "@/lib/auth";
import { resolveVendorContext, vendorHomeForRole } from "@/lib/vendorContext";
import { SITE_URL } from "@/lib/siteMetadata";
import { menuSkinFromRestaurant, type MenuSkinId } from "@/lib/menu/menuSkin";
import { SKIN_QR_INK, SkinTableCard } from "@/components/menu/skins/SkinShareCard";
import { ManantialTableCard } from "@/components/menu/skins/manantial";
import {
  BAG_CARD_COUNTS,
  STICKER_COUNTS,
  BAG_PAGE_CAPTION,
  BAG_PAGE_TITLE,
  PER_SHEET,
  bagCardLines,
  bagCardUrl,
  bagStatsLine,
  type BagFormat,
} from "@/lib/order/bagCard";

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
  const [skin, setSkin] = useState<MenuSkinId | null>(null);
  const [format, setFormat] = useState<BagFormat>("tarjeta");
  const [count, setCount] = useState<number>(BAG_CARD_COUNTS[0]);
  const [stats, setStats] = useState<{ scans: number; orders: number } | null>(null);

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
      const rid = ctx.restaurantId;
      setRestaurantId(rid);
      const snap = await getDoc(doc(db, "restaurants", rid));
      setRestaurantName((snap.data()?.name as string) ?? "Tu restaurante");
      setLoyaltyLive(restaurantPromisesPoints(snap.data()));
      setSkin(menuSkinFromRestaurant(snap.data()));
      setLoading(false);

      // El resultado: escaneos (contador del servidor) y pedidos que llegaron por la tarjeta.
      try {
        const st = await getDoc(doc(db, "restaurants", rid, "private", "stats"));
        const lv = st.data()?.linkVisits as Record<string, unknown> | undefined;
        const scans = typeof lv?.bolsa === "number" ? (lv.bolsa as number) : 0;
        const since = Timestamp.fromMillis(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const orders = await getDocs(query(collection(db, "restaurants", rid, "orders"), where("createdAt", ">=", since)));
        let n = 0;
        orders.forEach((d) => {
          const o = d.data();
          if (o.entrySource === "bolsa" && o.status !== "cancelled") n++;
        });
        setStats({ scans, orders: n });
      } catch {
        /* sin permiso o sin red: no se enseña número (jamás uno inventado) */
      }
    }
    init().catch(() => setLoading(false));
  }, [router]);

  if (loading) {
    return <main className="flex justify-center px-4 py-20 text-[14px]" style={{ color: INK_SOFT }}>Cargando…</main>;
  }

  const url = bagCardUrl(SITE_URL, restaurantId);
  const lines = bagCardLines(loyaltyLive);
  const ink = (skin && SKIN_QR_INK[skin]) || INK;
  const perSheet = PER_SHEET[format];

  return (
    <main className="px-5 pb-24 pt-5 md:px-8 md:pt-7">
      <style>{`
        @media print {
          body { background: #fff !important; }
          .no-print { display: none !important; }
          .print-sheet { display: grid !important; gap: 0 !important; }
          .print-sheet.tarjeta { grid-template-columns: repeat(2, 1fr) !important; }
          .print-sheet.sticker { grid-template-columns: repeat(3, 1fr) !important; gap: 10px !important; }
          .print-card { break-inside: avoid; page-break-inside: avoid; border: 1px dashed #bbb !important; box-shadow: none !important; }
          .print-card, .print-card * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          nav, header, aside, footer { display: none !important; }
        }
      `}</style>

      <div className="no-print mx-auto mb-7 max-w-3xl">
        <div className="mb-5 flex items-end justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <h1 className="text-[22px] font-semibold leading-[26px] md:text-[24px] md:leading-7" style={{ color: INK, fontFamily: SERIF }}>
              {BAG_PAGE_TITLE}
            </h1>
            <p className="truncate text-[13px] leading-4" style={{ color: INK_SOFT }}>{restaurantName}</p>
          </div>
          <Link href="/vendor" className="shrink-0 text-[14px] font-semibold hover:underline" style={{ color: LINK }}>
            Panel
          </Link>
        </div>

        {stats ? (
          <div className="mb-5 rounded-xl px-4 py-3 text-[14px] font-semibold leading-5" style={{ background: TILE, color: INK }}>
            {bagStatsLine(stats.scans, stats.orders)}
          </div>
        ) : null}

        <h2 className="text-[17px] font-semibold leading-[22px]" style={{ color: INK, fontFamily: SERIF }}>
          Que el cliente de Rappi o DiDi te pida directo
        </h2>
        <p className="mt-1 text-[14px] leading-5" style={{ color: INK_MUTED }}>
          {BAG_PAGE_CAPTION}. Las apps se quedan con una parte de cada pedido y tu cliente ni sabe que tienes tu
          propio menú. La próxima vez te pide por tu link, te queda su teléfono y le puedes avisar cuando quieras que regrese.
        </p>

        <div className="mt-5 rounded-xl bg-white p-4" style={{ border: `1px solid ${BORDER}` }}>
          <span className="text-[13px] font-semibold leading-4" style={{ color: INK }}>¿Cuál quieres?</span>
          <div className="mt-2 flex gap-2">
            {(["tarjeta", "sticker"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => { setFormat(f); setCount(f === "tarjeta" ? BAG_CARD_COUNTS[0] : STICKER_COUNTS[0]); }}
                className="h-11 flex-1 rounded-xl text-[15px] font-semibold"
                style={f === format ? { background: INK, color: "#fff" } : { background: TILE, color: INK }}
              >
                {f === "tarjeta" ? "Tarjeta (bolsa)" : "Sticker (caja o vaso)"}
              </button>
            ))}
          </div>

          <span className="mt-5 block text-[13px] font-semibold leading-4" style={{ color: INK }}>¿Cuántas imprimes?</span>
          <div className="mt-2 flex gap-2">
            {(format === "tarjeta" ? BAG_CARD_COUNTS : STICKER_COUNTS).map((n) => (
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
            Imprimir {count} {format === "tarjeta" ? "tarjetas" : "stickers"}
          </button>
          <p className="mt-2 text-center text-[13px] leading-4" style={{ color: INK_SOFT }}>
            {format === "tarjeta"
              ? `Salen ${perSheet} por hoja. Recorta por la línea punteada.`
              : `Salen ${perSheet} por hoja. Imprímelos en papel adhesivo y recórtalos.`}
          </p>
        </div>
      </div>

      <div className={`print-sheet ${format} mx-auto grid max-w-3xl gap-4 ${format === "tarjeta" ? (skin ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2 sm:grid-cols-4") : "grid-cols-3 sm:grid-cols-4"}`}>
        {Array.from({ length: count }, (_, i) => {
          if (format === "sticker") {
            return (
              <div
                key={i}
                className="print-card mx-auto flex aspect-square w-full max-w-[180px] flex-col items-center justify-center rounded-full bg-white p-3 text-center"
                style={{ border: `3px solid ${ink}` }}
              >
                <p className="max-w-[80%] truncate text-[9px] font-bold uppercase tracking-widest" style={{ color: ink, opacity: 0.6 }}>
                  {restaurantName}
                </p>
                <div className="my-1.5">
                  <QRCodeSVG value={url} size={86} fgColor={ink} bgColor="#FFFFFF" />
                </div>
                <p className="text-[12px] font-black leading-none" style={{ color: ink }}>{lines.sticker}</p>
              </div>
            );
          }
          const qr = <QRCodeSVG value={url} size={104} fgColor={ink} bgColor="#FFFFFF" />;
          if (skin === "manantial") {
            return (
              <div key={i} className="print-card rounded-2xl">
                <ManantialTableCard name={restaurantName} mesa="Pídenos directo" qr={qr} loyaltyLive={loyaltyLive} ctaLead="Escanea" ctaTail="y pide" sub={lines.skinSub} />
              </div>
            );
          }
          if (skin) {
            return (
              <div key={i} className="print-card rounded-2xl">
                <SkinTableCard skin={skin} name={restaurantName} mesa="Pídenos directo" qr={qr} loyaltyLive={loyaltyLive} cta="Escanea y pide" wrapTitle sub={lines.skinSub} />
              </div>
            );
          }
          return (
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
                {qr}
              </div>
              <p className="mt-2.5 text-[12px] font-bold leading-snug" style={{ color: BRAND }}>
                {lines.cta}
              </p>
            </div>
          );
        })}
      </div>
    </main>
  );
}
