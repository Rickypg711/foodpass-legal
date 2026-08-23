"use client";

// Conectar Mercado Pago desde el PANEL WEB.
//
// Hasta hoy esto solo existía en la app de Flutter. La web hablaba de "con
// Mercado Pago conectado, el cliente elige entre pagar en línea o al recoger"
// como si se pudiera desde aquí, y no había cómo: un dueño montado 100% en web
// (Spicy & Sweet) no podía cobrar con tarjeta y nadie se lo decía.
//
// La comisión se nombra CON SU NÚMERO antes de conectar, no después. La pantalla
// equivalente de la app la escondía como "Comisión automática para Comeleal" en
// la lista de beneficios, sin cifra — arreglado el mismo día.

import { useState } from "react";
import { getIdToken } from "firebase/auth";

import { getFirebaseAuth } from "@/lib/auth";

/** Lo que Comeleal cobra de un pedido pagado en línea. Igual que la app. */
const COMMISSION_LABEL = "3%";

export function MercadoPagoConnectCard({
  restaurantId,
  connected,
  accountEmail,
}: {
  restaurantId: string;
  connected: boolean;
  accountEmail?: string | null;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function connect() {
    setBusy(true);
    setErr(null);
    try {
      const user = getFirebaseAuth().currentUser;
      if (!user) throw new Error("no_user");
      const res = await fetch("/api/mercado-pago/oauth/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await getIdToken(user)}`,
        },
        body: JSON.stringify({ restaurantId }),
      });
      const data = (await res.json()) as { authorizeUrl?: string; error?: string };
      if (!res.ok || !data.authorizeUrl) throw new Error(data.error || "start_failed");
      window.location.href = data.authorizeUrl;
    } catch (e) {
      console.error("[MercadoPagoConnectCard]", e);
      setErr("No pudimos abrir Mercado Pago. Intenta de nuevo.");
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-[#e8e6dc] bg-white p-5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[#141413]/45">
        Cobrar con tarjeta en línea
      </p>

      {connected ? (
        <div className="mt-3 rounded-xl border border-[#16A34A]/40 bg-[#16A34A]/8 px-4 py-3">
          <p className="text-sm font-bold text-[#16A34A]">✓ Mercado Pago conectado</p>
          {accountEmail ? (
            <p className="mt-0.5 text-xs text-[#141413]/60">Cuenta: {accountEmail}</p>
          ) : null}
          <p className="mt-1 text-xs text-[#141413]/60">
            Tus clientes ya pueden pagar en línea desde tu menú. El dinero llega a tu
            cuenta de Mercado Pago, no a la nuestra.
          </p>
        </div>
      ) : (
        <>
          <p className="mt-1 text-sm text-[#141413]/70">
            Conecta tu cuenta de Mercado Pago y tus clientes podrán pagar con tarjeta
            desde tu menú. Sin conectarla solo puedes recibir pedidos de{" "}
            <b>pagar al recoger</b>.
          </p>

          <div className="mt-3 rounded-xl border border-[#B45309] bg-[#FFFBEB] px-4 py-3">
            <p className="text-xs font-bold text-[#B45309]">Lo que cuesta</p>
            <ul className="mt-1.5 space-y-1 text-xs text-[#141413]/75">
              <li>
                <b>Comeleal te cobra {COMMISSION_LABEL}</b> de cada pedido que te
                paguen en línea. Se descuenta solo, no te llega recibo aparte.
              </li>
              <li>
                <b>Mercado Pago te cobra su tarifa</b> aparte, y va directo a ellos.
                Cambia según tu contrato y en cuántos días te liberan el dinero:
                revísala en tu cuenta de Mercado Pago.
              </li>
              <li>
                <b>Efectivo, pago al recoger y tu terminal: 0%.</b> Siempre.
              </li>
            </ul>
          </div>

          <button
            type="button"
            onClick={connect}
            disabled={busy}
            className="mt-3 w-full rounded-xl bg-[#141413] px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
          >
            {busy ? "Abriendo Mercado Pago…" : "Conectar Mercado Pago"}
          </button>
          {err ? <p className="mt-2 text-xs text-[#B91C1C]">{err}</p> : null}
        </>
      )}
    </section>
  );
}
