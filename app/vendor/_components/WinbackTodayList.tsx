"use client";
// "Escríbele hoy" (29-sep-2026): los 3 clientes en riesgo que más valen, con
// nombre, dentro de "Tu siguiente movimiento". El cerebro los elige cada
// noche (vendorInsights/current.winbackToday); el mensaje lo escribe la IA al
// tocar y el dueño lo manda desde su WhatsApp. Espejo de
// FOODPASS .../dashboard/widgets/winback_today_list.dart.

import { useState } from "react";
import { buildWhatsappUrl } from "@/lib/order/formatWhatsappMessage";
import { logOwnerAction, shortTarget } from "@/lib/ownerActions";
import { stampWinbackSent, writePhoneWinback, type WinbackMessage } from "@/lib/vendor/winbackMessage";

export type WinbackTodayRow = {
  phone10: string;
  name: string;
  visits: number;
  daysSince: number;
  usualLabel: string;
  recentItem: string | null;
  /** 'riesgo' (14–29 d) o 'perdido' (30–90 d). */
  segment: "riesgo" | "perdido";
  /** Mensaje YA escrito por la IA anoche (null = se escribe al tocar). */
  message: string | null;
  hook: string | null;
  /** "viernes en la tarde": un rato antes de cuando suele venir. */
  bestSendLabel: string;
};

export function parseWinbackToday(raw: unknown): WinbackTodayRow[] {
  if (!Array.isArray(raw)) return [];
  const out: WinbackTodayRow[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const phone10 = String(o.phone10 ?? "").trim();
    if (phone10.length !== 10) continue;
    out.push({
      phone10,
      name: typeof o.name === "string" ? o.name.trim() : "",
      visits: Number(o.visits) || 0,
      daysSince: Number(o.daysSince) || 0,
      usualLabel: typeof o.usualLabel === "string" ? o.usualLabel : "",
      recentItem: typeof o.recentItem === "string" ? o.recentItem : null,
      segment: o.segment === "perdido" ? "perdido" : "riesgo",
      message: typeof o.message === "string" && o.message.trim() ? o.message.trim() : null,
      hook: typeof o.hook === "string" ? o.hook : null,
      bestSendLabel: typeof o.bestSendLabel === "string" ? o.bestSendLabel : "",
    });
    if (out.length >= 3) break;
  }
  return out;
}

const INK = "#1C2526";
const INK_SOFT = "#5B6366";
const TILE = "#F0EBE1";

export function WinbackTodayList({
  restaurantId,
  restaurantName,
  phoneCountry,
  rows,
}: {
  restaurantId: string;
  restaurantName: string;
  phoneCountry: string;
  rows: WinbackTodayRow[];
}) {
  const [busy, setBusy] = useState<string | null>(null);
  // Mensaje por cliente: el que dejó la IA anoche o el que se escribió al
  // tocar. Se LEE antes de mandar; "Enviar" es aprobar.
  const [written, setWritten] = useState<Record<string, WinbackMessage>>({});
  const [sent, setSent] = useState<Record<string, true>>({});

  if (rows.length === 0) return null;

  const messageFor = (r: WinbackTodayRow): WinbackMessage | null =>
    written[r.phone10] ?? (r.message ? { message: r.message, hook: r.hook ?? "unknown", fromAi: true } : null);

  async function tap(r: WinbackTodayRow) {
    setBusy(r.phone10);
    try {
      const m = messageFor(r);
      if (!m) {
        const w = await writePhoneWinback({
          restaurantId,
          restaurantName,
          phone10: r.phone10,
          firstName: r.name ? r.name.split(" ")[0] : "Hola",
        });
        setWritten((prev) => ({ ...prev, [r.phone10]: w }));
        return; // primero se lee; el siguiente clic manda
      }
      logOwnerAction(restaurantId, "winback_send", { target: shortTarget(r.phone10) });
      await stampWinbackSent(restaurantId, r.phone10, m.hook);
      setSent((prev) => ({ ...prev, [r.phone10]: true }));
      window.open(buildWhatsappUrl(r.phone10, m.message, phoneCountry), "_blank");
    } finally {
      setBusy(null);
    }
  }

  const anyWritten = rows.some((r) => messageFor(r) !== null);

  return (
    <div className="mt-3">
      <p className="text-[13px] leading-4" style={{ color: INK_SOFT }}>
        {anyWritten ? "Ya te escribimos el mensaje. Léelo y mándalo si te gusta." : "Escríbele hoy"}
      </p>
      {rows.map((r) => {
        const detail = [
          `${r.visits} visita${r.visits === 1 ? "" : "s"}`,
          r.segment === "perdido" ? `perdido · ${r.daysSince} días sin venir` : `${r.daysSince} días sin venir`,
          r.usualLabel || null,
          r.bestSendLabel ? `mejor mandarlo el ${r.bestSendLabel}` : null,
        ].filter(Boolean).join(" · ");
        const m = messageFor(r);
        const name = r.name || `…${r.phone10.slice(-4)}`;
        return (
          <div key={r.phone10} className="mt-2.5">
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold leading-5" style={{ color: INK }}>{name}</p>
                <p className="text-[13px] leading-4" style={{ color: INK_SOFT }}>{detail}</p>
              </div>
              <button
                type="button"
                onClick={() => tap(r)}
                disabled={busy !== null}
                className="h-10 shrink-0 rounded-xl bg-white px-3.5 text-[14px] font-semibold transition hover:opacity-90 disabled:opacity-60"
                style={{ border: `1px solid ${INK}`, color: INK }}>
                {busy === r.phone10 ? (m ? "Abriendo" : "Escribiendo") : sent[r.phone10] ? "Enviado" : m ? "Enviar" : "Escribir"}
              </button>
            </div>
            {m && (
              <div className="mt-2 rounded-lg px-3 py-2.5 text-[13px] leading-[18px]" style={{ background: TILE, color: INK }}>
                <p className="mb-1 text-[12px]" style={{ color: INK_SOFT }}>Tu mensaje</p>
                {m.message}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
