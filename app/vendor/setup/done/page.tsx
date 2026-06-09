"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import { waitForAuthReady } from "@/lib/auth";

export default function SetupDonePage() {
  const router = useRouter();
  const [restaurantName, setRestaurantName] = useState("Tu restaurante");
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
      setRestaurantId(rid);
      setLoading(false);
    }
    init().catch(() => setLoading(false));
  }, [router]);

  const qrUrl = restaurantId
    ? `https://comeleal.com/menu/${restaurantId}`
    : null;

  // Google Charts QR API — no extra dep, reliable, produces crisp PNG
  const qrImageSrc = qrUrl
    ? `https://chart.googleapis.com/chart?cht=qr&chs=400x400&chl=${encodeURIComponent(qrUrl)}&choe=UTF-8&chld=M|1`
    : null;

  function handlePrint() {
    if (!qrImageSrc || !restaurantName) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>QR — ${restaurantName}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
              display: flex; flex-direction: column; align-items: center;
              justify-content: center; min-height: 100vh; padding: 40px;
              background: #fff;
            }
            .logo { font-size: 14px; font-weight: 700; letter-spacing: 0.08em;
              color: #d97757; margin-bottom: 28px; text-transform: uppercase; }
            img { width: 260px; height: 260px; }
            h1 { margin-top: 24px; font-size: 22px; font-weight: 800; color: #141413;
              text-align: center; }
            p { margin-top: 8px; font-size: 13px; color: #141413; opacity: 0.5;
              text-align: center; max-width: 220px; line-height: 1.5; }
            .cta { margin-top: 20px; font-size: 15px; font-weight: 700;
              color: #d97757; text-align: center; }
          </style>
        </head>
        <body>
          <span class="logo">Comeleal</span>
          <img src="${qrImageSrc}" alt="QR" />
          <h1>${restaurantName}</h1>
          <p>Escanea para ver nuestro menú en la app Comeleal</p>
          <p>Descarga la app Comeleal y únete al programa de lealtad</p>
          <script>window.onload = () => { window.print(); }<\/script>
        </body>
      </html>
    `);
    win.document.close();
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#faf9f5]">
        <svg className="h-6 w-6 animate-spin text-[#d97757]" fill="none" viewBox="0 0 24 24">
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
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[#d97757]/10">
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

        {/* QR Code block */}
        {qrImageSrc && (
          <div className="mt-8 rounded-2xl border border-[#141413]/8 bg-white p-6">
            <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-[#d97757]">
              Tu código QR de menú
            </p>
            <p className="mb-4 text-xs text-[#141413]/50">
              Ponlo en tu mesa o caja para que los clientes vean tu menú y te encuentren en la app
            </p>

            {/* QR image */}
            <div className="mx-auto flex h-48 w-48 items-center justify-center rounded-xl bg-white p-2 shadow-sm ring-1 ring-[#141413]/8">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrImageSrc}
                alt="QR de tu restaurante"
                className="h-full w-full"
              />
            </div>

            <p className="mt-3 text-[10px] text-[#141413]/30 font-mono break-all">
              comeleal.com/menu/{restaurantId}
            </p>

            {/* Print button */}
            <button
              onClick={handlePrint}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-[#d97757]/30 bg-[#d97757]/5 px-4 py-3 text-sm font-semibold text-[#d97757] hover:bg-[#d97757]/10 transition-all"
            >
              🖨️ Imprimir QR
            </button>
          </div>
        )}

        {/* CTA */}
        <button
          onClick={() => router.push("/vendor")}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[#d97757] px-6 py-4 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#c46644]"
        >
          Ver mi panel →
        </button>

        <button
          onClick={() => router.push("/vendor/setup")}
          className="mt-3 w-full text-xs text-[#141413]/35 hover:text-[#141413]/60 transition-colors"
        >
          Revisar configuración
        </button>
      </div>
    </div>
  );
}
