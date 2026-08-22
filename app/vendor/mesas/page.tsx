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
 */

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

const INK = "#1C2526";
const ORANGE = "#F28C38";
const MAX_MESAS = 60;

export default function MesasPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [restaurantId, setRestaurantId] = useState("");
  const [restaurantName, setRestaurantName] = useState("");
  const [count, setCount] = useState(8);

  useEffect(() => {
    async function init() {
      const u = await waitForAuthReady();
      if (!u || u.isAnonymous) {
        router.push("/activar");
        return;
      }
      const db = getFirebaseDb();
      const ctx = await resolveVendorContext(db, u.uid);
      if (!ctx) {
        router.push("/activar");
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
    <main className="px-4 pb-16 pt-5 md:px-8 md:pt-7">
      {/* Reglas de impresión: se va todo menos la hoja de QRs. */}
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
        <p
          className="inline-block rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest"
          style={{ background: "rgba(242,140,56,0.1)", color: ORANGE }}
        >
          Pedido desde la mesa
        </p>
        <h1 className="mt-3 text-[28px] font-black leading-tight tracking-tight md:text-[34px]" style={{ color: INK }}>
          Un QR para cada mesa
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed" style={{ color: "rgba(28,37,38,0.6)" }}>
          Imprímelos, pégalos en cada mesa y listo. Tu cliente escanea, ordena
          desde su teléfono y <b>puede pagar ahí mismo</b>. El pedido cae en
          Pedidos con el número de mesa, para que sepas exactamente a dónde
          llevarlo — sin que nadie tenga que ir a tomar la orden.
        </p>

        <div
          className="mt-6 rounded-2xl bg-white p-5"
          style={{ border: "1px solid rgba(28,37,38,0.08)" }}
        >
          <label className="block">
            <span className="text-[14px] font-bold" style={{ color: INK }}>
              ¿Cuántas mesas tienes?
            </span>
            <div className="mt-2 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setCount((c) => Math.max(1, c - 1))}
                className="h-10 w-10 rounded-xl text-[18px] font-black transition hover:opacity-70"
                style={{ background: "rgba(28,37,38,0.06)", color: INK }}
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
                className="w-20 rounded-xl border px-3 py-2 text-center text-[16px] font-bold outline-none"
                style={{ borderColor: "rgba(28,37,38,0.15)", color: INK }}
              />
              <button
                type="button"
                onClick={() => setCount((c) => Math.min(MAX_MESAS, c + 1))}
                className="h-10 w-10 rounded-xl text-[18px] font-black transition hover:opacity-70"
                style={{ background: "rgba(28,37,38,0.06)", color: INK }}
                aria-label="Una mesa más"
              >
                +
              </button>
            </div>
          </label>

          <label className="mt-5 block">
            <span className="text-[14px] font-bold" style={{ color: INK }}>
              ¿O tienen nombre? <span style={{ color: "rgba(28,37,38,0.4)" }}>(opcional)</span>
            </span>
            <span className="mt-1 block text-[12px]" style={{ color: "rgba(28,37,38,0.5)" }}>
              Escribe uno por línea: Barra, Terraza 1, T3… Si lo dejas vacío usamos números.
            </span>
            <textarea
              value={customNames}
              onChange={(e) => setCustomNames(e.target.value)}
              rows={4}
              placeholder={"Barra\nTerraza 1\nTerraza 2\nT3"}
              className="mt-2 w-full rounded-xl border px-3 py-2 text-[14px] outline-none"
              style={{ borderColor: "rgba(28,37,38,0.15)", color: INK }}
            />
            {usingCustomNames && (
              <span className="mt-1 block text-[12px]" style={{ color: ORANGE }}>
                {mesas.length === 0
                  ? "Escribe al menos un nombre válido."
                  : `${mesas.length} ${mesas.length === 1 ? "mesa" : "mesas"} con nombre. Máx ${TABLE_MAX_LENGTH} caracteres cada una; se ignoran repetidas.`}
              </span>
            )}
          </label>

          <button
            type="button"
            onClick={() => window.print()}
            className="mt-5 w-full rounded-2xl px-4 py-3.5 text-[14px] font-extrabold text-white transition hover:opacity-90"
            style={{ background: `linear-gradient(135deg, ${ORANGE} 0%, #FF9A45 100%)` }}
          >
            🖨️ Imprimir los {mesas.length} {mesas.length === 1 ? "QR" : "QRs"} →
          </button>
          <p className="mt-2 text-center text-[11px]" style={{ color: "rgba(28,37,38,0.4)" }}>
            Salen 2 por hoja. Recorta por la línea punteada.
          </p>
        </div>

        <div
          className="mt-4 rounded-2xl p-4"
          style={{ background: "rgba(242,140,56,0.07)", border: "1px solid rgba(242,140,56,0.25)" }}
        >
          <p className="text-[13px] leading-relaxed" style={{ color: "rgba(28,37,38,0.75)" }}>
            <b>Tip:</b> si tus mesas tienen nombre (Barra, Terraza 1, T3),
            escríbelos arriba uno por línea y los QR salen con ese nombre. El
            pedido te llega diciendo exactamente esa mesa.
          </p>
          <Link
            href="/vendor/pedidos"
            className="mt-2 inline-block text-[13px] font-semibold underline underline-offset-4"
            style={{ color: ORANGE }}
          >
            Ver los pedidos que van llegando →
          </Link>
        </div>
      </div>

      {/* ── La hoja imprimible ── */}
      <div className="print-sheet mx-auto grid max-w-3xl grid-cols-2 gap-4 sm:grid-cols-3">
        {mesas.map((mesa) => (
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
              Pide desde tu teléfono y acumula puntos ⭐
            </p>
          </div>
        ))}
      </div>
    </main>
  );
}
