"use client";

// Cierre manual "por hoy" — el switch de pánico del dueño.
// Escribe restaurants/{id}.manualCloseUntil hasta el corte del día comercial
// (4 AM): auto-expira, imposible quedar cerrado para siempre por olvido.
// Reabrir borra el campo y el horario normal vuelve a mandar. El app, el
// menú web, el checkout y la landing leen el mismo campo vía
// lib/schedule.ts — un solo punto de verdad.

import React, { useEffect, useState } from "react";
import { doc, onSnapshot, updateDoc, Timestamp, deleteField } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import {
  scheduleStatus,
  manuallyClosedNow,
  manuallyOpenNow,
  type ScheduleStatus,
} from "@/lib/schedule";
import { businessDayStart } from "@/lib/businessDay";

export default function ManualCloseToggle({ restaurantId }: { restaurantId: string }) {
  const [rdata, setRdata] = useState<Record<string, unknown> | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    const db = getFirebaseDb();
    const unsub = onSnapshot(doc(db, "restaurants", restaurantId), (snap) => {
      setRdata((snap.data() as Record<string, unknown>) ?? null);
    });
    return unsub;
  }, [restaurantId]);

  if (!rdata) return null;
  const status: ScheduleStatus | null = scheduleStatus(rdata);
  if (!status) return null; // sin horario ni overrides: nada que mostrar
  // SIEMPRE ofrecemos lo contrario del estado EFECTIVO: abierto → cerrar;
  // cerrado (por horario O manual) → abrir. Con override activo, además
  // "Usar mi horario normal". Nunca ofrecemos "cerrar" a quien ya está
  // cerrado — eso no tenía sentido.
  const effectivelyOpen = status.open;
  const hasOverride = manuallyClosedNow(rdata) || manuallyOpenNow(rdata);

  async function write(action: "close" | "open" | "schedule") {
    if (busy) return;
    setBusy(true);
    try {
      const db = getFirebaseDb();
      const ref = doc(db, "restaurants", restaurantId);
      // Próximo corte del día comercial (4 AM): a la 1 AM afecta lo que
      // queda del turno de anoche, no 23 horas de mañana.
      const until = new Date(businessDayStart().getTime() + 24 * 60 * 60 * 1000);
      if (action === "close") {
        await updateDoc(ref, {
          manualCloseUntil: Timestamp.fromDate(until),
          manualOpenUntil: deleteField(),
        });
      } else if (action === "open") {
        await updateDoc(ref, {
          manualOpenUntil: Timestamp.fromDate(until),
          manualCloseUntil: deleteField(),
        });
      } else {
        await updateDoc(ref, {
          manualCloseUntil: deleteField(),
          manualOpenUntil: deleteField(),
        });
      }
      setConfirming(false);
    } catch (e) {
      console.error("[manual_close] write failed", e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setConfirming((v) => !v)}
        className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-bold"
        style={
          status.open
            ? { borderColor: "#BBF7D0", background: "#F0FDF4", color: "#15803D" }
            : { borderColor: "#FECACA", background: "#FEF2F2", color: "#B91C1C" }
        }
        title="Abrir o cerrar tu negocio ahora"
      >
        <span
          className="inline-block h-2 w-2 rounded-full"
          style={{ background: status.open ? "#22C55E" : "#EF4444" }}
        />
        {status.label}
      </button>

      {confirming && (
        <div
          className="absolute right-0 top-full z-30 mt-2 w-64 rounded-xl border bg-white p-3 shadow-lg"
          style={{ borderColor: "rgba(28,37,38,0.1)" }}
        >
          <p className="text-[12px]" style={{ color: "rgba(28,37,38,0.7)" }}>
            {effectivelyOpen
              ? "Tus clientes verán “Cerrado por hoy” y no podrán ordenar. Mañana se reabre solo con tu horario normal."
              : "Abres fuera de tu horario. Tus clientes podrán ordenar ya; al corte del día (4 AM) vuelve tu horario normal."}
          </p>
          <button
            type="button"
            onClick={() => write(effectivelyOpen ? "close" : "open")}
            disabled={busy}
            className="mt-2 w-full rounded-lg px-3 py-2 text-[13px] font-bold text-white disabled:opacity-60"
            style={{ background: effectivelyOpen ? "#C62828" : "#F28C38" }}
          >
            {busy ? "…" : effectivelyOpen ? "Cerrar por hoy" : "Abrir ahora"}
          </button>
          {hasOverride && (
            <button
              type="button"
              onClick={() => write("schedule")}
              disabled={busy}
              className="mt-1.5 w-full rounded-lg px-3 py-1.5 text-[12px] font-bold disabled:opacity-60"
              style={{ color: "#F28C38" }}
            >
              Usar mi horario normal
            </button>
          )}
        </div>
      )}
    </div>
  );
}
