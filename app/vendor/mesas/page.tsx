"use client";

/**
 * /vendor/mesas — genera e imprime el QR de cada mesa.
 *
 * Robo del teardown de Maspedidos (6 ago 2026): "crea un QR por cada mesa".
 * Nosotros ya teníamos menú QR y pago en línea; lo que faltaba era que el
 * pedido supiera A QUÉ MESA va. Cada QR apunta a /menu/{id}?mesa=N y de ahí
 * el flujo completo lo arrastra hasta la orden (ver lib/order/tableSession.ts).
 *
 * La impresión es CSS puro (@media print) — sin librería de PDF, sin backend.
 *
 * Opción A (30-sep-2026, pasada "Mesas botón por botón" con la app): título
 * en Lora, campos del panel, un solo botón principal, sin degradado ni
 * emoji en la pantalla del dueño. La TARJETA impresa no cambia: ya está
 * pegada en mesas reales y el comensal la reconoce.
 */

import { restaurantPromisesPoints } from "@/lib/readiness/evaluate";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { doc, getDoc } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import { waitForAuthReady } from "@/lib/auth";
import { resolveVendorContext, vendorHomeForRole } from "@/lib/vendorContext";
import {
  tableMenuUrl,
  normalizeTableNumber,
  tableLabel,
  TABLE_MAX_LENGTH,
} from "@/lib/order/tableSession";
import { SITE_URL } from "@/lib/siteMetadata";
import { menuSkinFromRestaurant, type MenuSkinId } from "@/lib/menu/menuSkin";
import { SKIN_QR_INK, SkinTableCard } from "@/components/menu/skins/SkinShareCard";
import { ManantialTableCard } from "@/components/menu/skins/manantial";

const SERIF = "var(--font-lora), Lora, Georgia, serif";
const INK = "#1C2526";
const INK_MUTED = "#3F4A4D";
const INK_SOFT = "#5B6366";
const BORDER = "#D9D2C5";
const TILE = "#F0EBE1";
const LINK = "#8A4B12";
const BRAND = "#F28C38";
const DANGER = "#B91C1C";
const ORANGE = BRAND;
const MAX_MESAS = 60;

export default function MesasPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [restaurantId, setRestaurantId] = useState("");
  const [restaurantName, setRestaurantName] = useState("");
  /** Premios apagados (5-sep): el letrero de mesa no promete puntos. */
  const [loyaltyLive, setLoyaltyLive] = useState(true);
  const [count, setCount] = useState(8);
  /** 7-oct-2026: un local con piel imprime sus mesas con SU ropa; sin piel, la tarjeta de siempre. */
  const [skin, setSkin] = useState<MenuSkinId | null>(null);

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
      // Imprimir los QR de las mesas es configuración del negocio: dueño o gerente.
      if (ctx.role !== "owner" && ctx.role !== "manager") {
        router.push(vendorHomeForRole(ctx.role));
        return;
      }
      setRestaurantId(ctx.restaurantId);
      const snap = await getDoc(doc(db, "restaurants", ctx.restaurantId));
      setRestaurantName((snap.data()?.name as string) ?? "Tu restaurante");
      setLoyaltyLive(restaurantPromisesPoints(snap.data()));
      setSkin(menuSkinFromRestaurant(snap.data()));
      setLoading(false);
    }
    init().catch(() => setLoading(false));
  }, [router]);

  /** Nombres personalizados, uno por linea. Vacio = numeros 1..count.
   *  Existe porque en la vida real las mesas se llaman "Barra", "Terraza 2"
   *  o "T3", no siempre 1,2,3 — y el backend ya lo soporta
   *  (normalizeTableNumber acepta letras). Antes el tip prometia nombres y
   *  la pantalla solo daba numeros. */
  const [customNames, setCustomNames] = useState("");
  const usingCustomNames = customNames.trim().length > 0;

  const mesas = useMemo(() => {
    if (!usingCustomNames) {
      return Array.from({ length: count }, (_, i) => String(i + 1));
    }
    const seen = new Set<string>();
    const parsed: string[] = [];
    for (const raw of customNames.split(/[\n,]/)) {
      // MISMA normalizacion que el QR y el checkout: lo que se imprime es
      // exactamente lo que va a llegar en tableNumber. Cero sorpresas.
      const name = normalizeTableNumber(raw);
      if (!name || seen.has(name.toLowerCase())) continue;
      seen.add(name.toLowerCase());
      parsed.push(name);
      if (parsed.length >= MAX_MESAS) break;
    }
    return parsed;
  }, [count, customNames, usingCustomNames]);


  if (loading) {
    return (
      <main className="flex justify-center px-4 py-20">
        <svg
          className="h-6 w-6 animate-spin"
          style={{ color: ORANGE }}
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 12 5.373 12 12H4z" />
        </svg>
      </main>
    );
  }

  return (
    <main className="px-5 pb-24 pt-5 md:px-8 md:pt-7">
      {/* Reglas de impresión: se va todo menos la hoja de QRs. */}
      <style>{`
        @media print {
          body { background: #fff !important; }
          .no-print { display: none !important; }
          .print-sheet { display: grid !important; grid-template-columns: repeat(2, 1fr) !important; gap: 0 !important; }
          .print-card { break-inside: avoid; page-break-inside: avoid; border: 1px dashed #bbb !important; box-shadow: none !important; }
          /* Las tarjetas con piel llevan fondo de color: que la impresora sí lo pinte. */
          .print-card, .print-card * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          nav, header, aside, footer { display: none !important; }
        }
      `}</style>

      <div className="no-print mx-auto mb-7 max-w-3xl">
        <div className="mb-5 flex items-end justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <h1 className="text-[22px] font-semibold leading-[26px] md:text-[24px] md:leading-7" style={{ color: INK, fontFamily: SERIF }}>
              Mesas y códigos QR
            </h1>
            <p className="truncate text-[13px] leading-4" style={{ color: INK_SOFT }}>{restaurantName}</p>
          </div>
          <Link href="/vendor" className="shrink-0 text-[14px] font-semibold hover:underline" style={{ color: LINK }}>
            Panel
          </Link>
        </div>

        <h2 className="text-[17px] font-semibold leading-[22px]" style={{ color: INK, fontFamily: SERIF }}>
          Un QR para cada mesa
        </h2>
        <p className="mt-1 text-[14px] leading-5" style={{ color: INK_MUTED }}>
          Imprímelos, pégalos en cada mesa y listo. Tu cliente escanea, ordena
          desde su teléfono y puede pagar ahí mismo. El pedido te llega con el
          número de mesa, para que sepas a dónde llevarlo, sin que nadie vaya a
          tomar la orden.
        </p>

        <div className="mt-5 rounded-xl bg-white p-4" style={{ border: `1px solid ${BORDER}` }}>
          <label className="block">
            <span className="text-[13px] font-semibold leading-4" style={{ color: INK }}>
              ¿Cuántas mesas tienes?
            </span>
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCount((c) => Math.max(1, c - 1))}
                className="flex h-11 w-11 items-center justify-center rounded-xl text-[18px] font-semibold"
                style={{ background: TILE, color: INK }}
                aria-label="Una mesa menos"
              >
                −
              </button>
              <input
                type="number"
                min={1}
                max={MAX_MESAS}
                value={count}
                onChange={(e) => {
                  const n = Number.parseInt(e.target.value, 10);
                  setCount(Number.isFinite(n) ? Math.min(MAX_MESAS, Math.max(1, n)) : 1);
                }}
                className="w-20 rounded-xl border bg-white px-3 py-2.5 text-center text-[16px] font-semibold tabular-nums outline-none focus:border-[#1C2526]"
                style={{ borderColor: BORDER, color: INK }}
              />
              <button
                type="button"
                onClick={() => setCount((c) => Math.min(MAX_MESAS, c + 1))}
                className="flex h-11 w-11 items-center justify-center rounded-xl text-[18px] font-semibold"
                style={{ background: TILE, color: INK }}
                aria-label="Una mesa más"
              >
                +
              </button>
            </div>
          </label>

          <label className="mt-5 block">
            <span className="text-[13px] font-semibold leading-4" style={{ color: INK }}>
              ¿O tienen nombre? <span style={{ color: INK_SOFT, fontWeight: 400 }}>(opcional)</span>
            </span>
            <span className="mt-1 block text-[13px] leading-4" style={{ color: INK_SOFT }}>
              Escribe uno por línea: Barra, Terraza 1, T3… Si lo dejas vacío usamos números.
            </span>
            <textarea
              value={customNames}
              onChange={(e) => setCustomNames(e.target.value)}
              rows={4}
              placeholder={"Barra\nTerraza 1\nTerraza 2\nT3"}
              className="mt-2 w-full rounded-xl border bg-white px-3.5 py-3 text-[16px] leading-5 outline-none focus:border-[#1C2526]"
              style={{ borderColor: BORDER, color: INK }}
            />
            {usingCustomNames && (
              <span
                className="mt-1 block text-[13px] leading-4"
                style={{ color: mesas.length === 0 ? DANGER : INK_SOFT }}
              >
                {mesas.length === 0
                  ? "Escribe al menos un nombre válido."
                  : `${mesas.length} ${mesas.length === 1 ? "mesa" : "mesas"} con nombre. Máx ${TABLE_MAX_LENGTH} caracteres cada una; se ignoran repetidas.`}
              </span>
            )}
          </label>

          <button
            type="button"
            onClick={() => window.print()}
            disabled={mesas.length === 0}
            className="mt-5 flex h-12 w-full items-center justify-center rounded-xl text-[15px] font-semibold disabled:opacity-40"
            style={{ background: BRAND, color: INK }}
          >
            Imprimir {mesas.length} {mesas.length === 1 ? "código" : "códigos"}
          </button>
          <p className="mt-2 text-center text-[13px] leading-4" style={{ color: INK_SOFT }}>
            Salen 2 por hoja. Recorta por la línea punteada.
          </p>
        </div>

        <p className="mt-4 text-[13px] leading-4" style={{ color: INK_SOFT }}>
          El pedido cae en{" "}
          <Link href="/vendor/pedidos" className="font-semibold underline underline-offset-2" style={{ color: LINK }}>
            Pedidos
          </Link>{" "}
          diciendo la mesa exacta.
        </p>
      </div>

      {/* ── La hoja imprimible: NO cambia, ya está pegada en mesas reales ── */}
      <div className="print-sheet mx-auto grid max-w-3xl grid-cols-2 gap-4 sm:grid-cols-3">
        {skin
          ? mesas.map((mesa) => {
              const qr = <QRCodeSVG value={tableMenuUrl(SITE_URL, restaurantId, mesa)} size={132} fgColor={SKIN_QR_INK[skin] ?? INK} bgColor="#FFFFFF" />;
              return (
                <div key={mesa} className="print-card rounded-2xl">
                  {skin === "manantial" ? (
                    <ManantialTableCard name={restaurantName} mesa={tableLabel(mesa)} qr={qr} loyaltyLive={loyaltyLive} />
                  ) : (
                    <SkinTableCard skin={skin} name={restaurantName} mesa={tableLabel(mesa)} qr={qr} loyaltyLive={loyaltyLive} />
                  )}
                </div>
              );
            })
          : mesas.map((mesa) => (
          <div
            key={mesa}
            className="print-card flex flex-col items-center rounded-2xl bg-white px-4 py-5 text-center"
            style={{ border: "1px solid rgba(28,37,38,0.1)" }}
          >
            <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "rgba(28,37,38,0.4)" }}>
              {restaurantName}
            </p>
            <p className="mt-1 text-[26px] font-black leading-none" style={{ color: INK }}>
              {tableLabel(mesa)}
            </p>
            <div className="mt-3 rounded-xl bg-white p-2" style={{ border: "1px solid rgba(28,37,38,0.08)" }}>
              {/* SITE_URL y NO window.location.origin: estos QR se imprimen y
                  se pegan en la mesa para siempre. Si se generaran con el
                  origin del navegador, imprimir desde un preview de Vercel o
                  desde localhost dejaría ese dominio pegado en la mesa. */}
              <QRCodeSVG
                value={tableMenuUrl(SITE_URL, restaurantId, mesa)}
                size={132}
                fgColor={INK}
                bgColor="#FFFFFF"
              />
            </div>
            <p className="mt-3 text-[13px] font-black" style={{ color: ORANGE }}>
              Escanea y ordena
            </p>
            <p className="mt-0.5 text-[11px] leading-snug" style={{ color: "rgba(28,37,38,0.55)" }}>
              {loyaltyLive ? "Pide desde tu teléfono y acumula puntos ⭐" : "Pide desde tu teléfono"}
            </p>
          </div>
        ))}
      </div>
    </main>
  );
}
