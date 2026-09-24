"use client";

/**
 * "¿Te avisamos aquí cuando entre un pedido?" — tarjeta del panel que pide
 * permiso de notificaciones al navegador (24-sep-2026).
 *
 * Por qué: 68 de 76 dueños entran solo por la web. Sin token de navegador
 * ningún push del sistema (pedido nuevo, alerta de las 11 AM, reporte del
 * lunes) les llega. Con un "Sí, avísame" el navegador saca su token y se
 * guarda en users.fcmWebToken (lib/webPush.ts).
 *
 * Reglas: se pide UNA vez y nunca bloquea nada. El permiso solo se pide
 * desde el clic del dueño (jamás al cargar). "Luego" la esconde 7 días en
 * este navegador (localStorage, solo comodidad). Si ya dijo sí antes, no se
 * pinta nada y el token se refresca en silencio. Sin llave VAPID o en un
 * navegador sin push, no existe.
 */
import { useEffect, useState } from "react";
import { waitForAuthReady } from "@/lib/auth";
import { saveWebPushToken, webPushPermission } from "@/lib/webPush";

const LATER_KEY = "comeleal.ownerPushCard.later";
const LATER_MS = 7 * 24 * 60 * 60 * 1000;

export function OwnerPushCard() {
  const [state, setState] = useState<"hidden" | "ask" | "saving" | "done" | "denied">("hidden");
  const [uid, setUid] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const u = await waitForAuthReady();
      if (!u || u.isAnonymous) return;
      const perm = webPushPermission();
      if (perm === "unsupported" || perm === "denied") return;
      if (perm === "granted") {
        // Ya dijo sí en este navegador: refrescar el token sin molestar.
        saveWebPushToken(u.uid, false);
        return;
      }
      try {
        const later = Number(localStorage.getItem(LATER_KEY) || 0);
        if (later && Date.now() - later < LATER_MS) return;
      } catch { /* sin localStorage (privado): se pregunta igual */ }
      if (alive) { setUid(u.uid); setState("ask"); }
    })();
    return () => { alive = false; };
  }, []);

  async function allow() {
    if (!uid) return;
    setState("saving");
    const r = await saveWebPushToken(uid, true);
    if (r === "saved") setState("done");
    else if (r === "denied") setState("denied");
    else setState("hidden");
  }

  function later() {
    try { localStorage.setItem(LATER_KEY, String(Date.now())); } catch { /* nada */ }
    setState("hidden");
  }

  if (state === "hidden") return null;

  if (state === "done") {
    return (
      <div className="mb-5 rounded-2xl px-5 py-4 text-[13px]"
        style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", color: "#166534" }}>
        ✓ Listo. Aquí te avisamos cuando entre un pedido o haya algo que hacer.
      </div>
    );
  }

  if (state === "denied") {
    return (
      <div className="mb-5 rounded-2xl px-5 py-4 text-[13px]"
        style={{ background: "#FAF9F5", border: "1px solid #E8E6DC", color: "rgba(28,37,38,0.7)" }}>
        El navegador no dio permiso. Si cambias de idea, actívalo en el candado de la barra de direcciones.
      </div>
    );
  }

  return (
    <div className="mb-5 rounded-2xl p-5"
      style={{ background: "#FFFFFF", border: "1px solid #E8E6DC" }}>
      <p className="text-[15px] font-semibold leading-[22px]" style={{ color: "#1C2526" }}>
        ¿Te avisamos aquí cuando entre un pedido?
      </p>
      <p className="mt-1 text-[13px] leading-[18px]" style={{ color: "rgba(28,37,38,0.6)" }}>
        Te llega un aviso en esta computadora o celular cuando alguien pide o cuando hay algo que hacer. Lo puedes apagar cuando quieras.
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={allow}
          disabled={state === "saving"}
          className="h-11 rounded-xl px-5 text-[15px] font-semibold text-[#1C2526] transition hover:opacity-90 disabled:opacity-50"
          style={{ background: "#F28C38" }}
        >
          {state === "saving" ? "Un momento…" : "Sí, avísame"}
        </button>
        <button
          type="button"
          onClick={later}
          disabled={state === "saving"}
          className="h-11 rounded-xl px-3 text-[15px] font-semibold"
          style={{ color: "rgba(28,37,38,0.5)" }}
        >
          Luego
        </button>
      </div>
    </div>
  );
}
