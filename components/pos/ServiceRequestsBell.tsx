"use client";

// Robo #5, lado del DUEÑO: la campana de la Caja. Escucha en vivo las
// peticiones de servicio de las mesas ("llamar al mesero" / "pedir la
// cuenta"), suena visualmente cuando hay pendientes, y "Atendido" las apaga.
// Sin composite index a propósito: filtra por status y ordena en cliente —
// las pendientes de un local son unidades, no miles.

import { useEffect, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getFirebaseApp, getFirebaseDb } from "@/lib/firebase";

type ServiceRequest = {
  id: string;
  type: string;
  tableNumber: string;
  createdAtMs: number;
};

const TYPE_LABEL: Record<string, string> = {
  call_waiter: "🛎️ Llama al mesero",
  ask_bill: "🧾 Pide la cuenta",
};

function agoLabel(ms: number): string {
  const mins = Math.floor((Date.now() - ms) / 60000);
  if (mins < 1) return "ahora";
  if (mins === 1) return "hace 1 min";
  return `hace ${mins} min`;
}

export function ServiceRequestsBell({ restaurantId }: { restaurantId: string }) {
  const [pending, setPending] = useState<ServiceRequest[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!restaurantId) return;
    const db = getFirebaseDb();
    const q = query(
      collection(db, "restaurants", restaurantId, "serviceRequests"),
      where("status", "==", "pending"),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows: ServiceRequest[] = snap.docs.map((d) => {
          const data = d.data();
          const created = data.createdAt;
          return {
            id: d.id,
            type: String(data.type || ""),
            tableNumber: String(data.tableNumber || ""),
            createdAtMs: created?.toMillis ? created.toMillis() : Date.now(),
          };
        });
        rows.sort((a, b) => a.createdAtMs - b.createdAtMs);
        setPending(rows);
      },
      () => setPending([]),
    );
    return () => unsub();
  }, [restaurantId]);

  async function attend(id: string) {
    setBusy(id);
    try {
      const db = getFirebaseDb();
      await updateDoc(doc(db, "restaurants", restaurantId, "serviceRequests", id), {
        status: "attended",
        attendedAt: serverTimestamp(),
        attendedBy: getAuth(getFirebaseApp()).currentUser?.uid ?? null,
      });
    } catch (e) {
      console.error("[serviceRequests] attend failed", e);
    } finally {
      setBusy(null);
    }
  }

  if (pending.length === 0 && !open) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`${pending.length} peticiones de mesa pendientes`}
        className="fixed bottom-24 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full text-[20px] shadow-lg transition-transform hover:scale-105"
        style={{
          background: pending.length > 0 ? "#F28C38" : "rgba(28,37,38,0.85)",
          color: "#1C2526",
        }}
      >
        🛎️
        {pending.length > 0 && (
          <span
            className="absolute -right-1 -top-1 flex h-5 w-5 animate-pulse items-center justify-center rounded-full text-[10px] font-bold text-white"
            style={{ background: "#DC2626" }}
          >
            {pending.length}
          </span>
        )}
      </button>

      {open && (
        <div
          className="fixed bottom-40 right-4 z-40 w-72 overflow-hidden rounded-2xl bg-white shadow-2xl"
          style={{ border: "1px solid rgba(28,37,38,0.1)" }}
        >
          <div className="px-4 py-3" style={{ borderBottom: "1px solid rgba(28,37,38,0.07)" }}>
            <p className="text-[13px] font-extrabold text-[#1C2526]">Mesas llamando</p>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {pending.length === 0 ? (
              <p className="px-4 py-5 text-center text-[12px] text-[#1C2526]/45">
                Todo atendido. 🙌
              </p>
            ) : (
              pending.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between gap-2 px-4 py-2.5"
                  style={{ borderBottom: "1px solid rgba(28,37,38,0.05)" }}
                >
                  <div>
                    <p className="text-[13px] font-bold text-[#1C2526]">
                      Mesa {r.tableNumber}
                    </p>
                    <p className="text-[11px] text-[#1C2526]/55">
                      {TYPE_LABEL[r.type] ?? r.type} · {agoLabel(r.createdAtMs)}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={busy === r.id}
                    onClick={() => attend(r.id)}
                    className="rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-[#1C2526] transition-all disabled:opacity-50"
                    style={{ background: "#F28C38" }}
                  >
                    Atendido
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </>
  );
}
