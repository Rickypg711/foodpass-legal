"use client";

// La franja solo-dueño (§6.10, hallazgo de Ricardo 25-ago): cuando el que
// mira el menú público es EL PROPIO DUEÑO y su horario no existe, se le
// señala la ausencia EXACTAMENTE donde duele — en su vitrina, con los ojos
// de su cliente. Invisible para todos los demás; al cliente jamás se le
// muestra "horario no confirmado" (silencio antes que duda).

import { useEffect, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/auth";
import { parseBusinessHours } from "@/lib/schedule";

export function OwnerHoursStrip({
  rdata,
}: {
  rdata: Record<string, unknown> | null;
}) {
  const [uid, setUid] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(getFirebaseAuth(), (u) => {
      setUid(u && !u.isAnonymous ? u.uid : null);
    });
    return unsub;
  }, []);

  if (!rdata || !uid) return null;
  const ownerId = typeof rdata.ownerId === "string" ? rdata.ownerId : null;
  if (ownerId !== uid) return null;
  if (parseBusinessHours(rdata)) return null; // ya tiene horario → nada

  return (
    <div className="mx-auto mt-3 w-full max-w-2xl px-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl px-4 py-3"
        style={{
          background: "#FFFBEB",
          border: "1px solid rgba(180,83,9,0.3)",
        }}>
        <p className="min-w-0 flex-1 text-[12px] font-semibold leading-snug"
          style={{ color: "#B45309" }}>
          ⏰ Solo tú ves esto: tu menú no muestra horario — tus clientes no
          saben cuándo abres.
        </p>
        <Link
          href="/vendor/setup/horario"
          className="shrink-0 rounded-lg px-3 py-1.5 text-[12px] font-extrabold"
          style={{ background: "#B45309", color: "#fff" }}
        >
          Ponerlo — 2 min
        </Link>
      </div>
    </div>
  );
}
