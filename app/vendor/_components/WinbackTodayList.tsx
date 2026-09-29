"use client";
// "Escríbele hoy" (29-sep-2026): los 3 clientes en riesgo que más valen, con
// nombre, dentro de "Tu siguiente movimiento". El cerebro los elige cada
// noche (vendorInsights/current.winbackToday); el mensaje lo escribe la IA al
// tocar y el dueño lo manda desde su WhatsApp. Espejo de
// FOODPASS .../dashboard/widgets/winback_today_list.dart.

import { useState } from "react";
import { buildWhatsappUrl } from "@/lib/order/formatWhatsappMessage";
import { logOwnerAction, shortTarget } from "@/lib/ownerActions";
import { writePhoneWinback } from "@/lib/vendor/winbackMessage";

export type WinbackTodayRow = {
  phone10: string;
  name: string;
  visits: number;
  daysSince: number;
  usualLabel: string;
  recentItem: string | null;
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
  const [written, setWritten] = useState<Record<string, string>>({});

  if (rows.length === 0) return null;

  async function tap(r: WinbackTodayRow) {
    setBusy(r.phone10);
    try {
      logOwnerAction(restaurantId, "winback_send", { target: shortTarget(r.phone10) });
      const m = await writePhoneWinback({
        restaurantId,
        restaurantName,
        phone10: r.phone10,
        firstName: r.name ? r.name.split(" ")[0] : "Hola",
      });
      setWritten((w) => ({ ...w, [r.phone10]: m.message }));
      window.open(buildWhatsappUrl(r.phone10, m.message, phoneCountry), "_blank");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-3">
      <p className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: INK_SOFT }}>Escríbele hoy</p>
      {rows.map((r) => {
        const detail = [
          `${r.visits} visita${r.visits === 1 ? "" : "s"}`,
          `${r.daysSince} días sin venir`,
          r.usualLabel || null,
        ].filter(Boolean).join(" · ");
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
                {busy === r.phone10 ? "Escribiendo" : written[r.phone10] ? "Abrir" : "WhatsApp"}
              </button>
            </div>
            {written[r.phone10] && (
              <div className="mt-2 rounded-lg px-3 py-2.5 text-[13px] leading-[18px]" style={{ background: TILE, color: INK }}>
                <p className="mb-1 text-[12px]" style={{ color: INK_SOFT }}>Mensaje sugerido</p>
                {written[r.phone10]}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
