"use client";

// La lista caliente del embudo (§6.2 modo 2): prospectos que subieron su
// menú y no han reclamado. Gemini escribe el nudge leyendo SU menú
// (generateDemoNudge, solo plataforma), Ricardo tap-y-enviar por SU
// WhatsApp, y el envío queda estampado (nudgedAt) — human-in-the-loop
// MEDIDO, con fecha de muerte: la Cloud API post-RFC.
//
// 8-oct-2026 (revisión antes de mandar 7 nudges): el link cosía +52 (Sabor
// Zuliano es de Colombia), contaba el nudge al escribirlo y no al mandarlo,
// y enseñaba como "sin reclamar" a Tortas y Birria González, que ya tenía
// cuenta. Ahora: país del job, estampa al abrir el WhatsApp, cuentas ya
// creadas aparte y un renglón por número (El Molcajete subió 3 veces).

import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  Timestamp,
  where,
} from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getFirebaseApp, getFirebaseDb } from "@/lib/firebase";
import { waitForAuthReady } from "@/lib/auth";
import { buildWhatsappUrl } from "@/lib/order/formatWhatsappMessage";

/** Espejo de PLATFORM_ADMIN_UIDS en functions/menu_demo_ai.js. */
const PLATFORM_ADMIN_UIDS = ["xf69ZR1tWHRJ3z3N7NIolTXKXQF2"];

type Prospect = {
  id: string;
  name: string;
  itemCount: number;
  whatsapp: string | null;
  createdAt: Timestamp | null;
  viewed: boolean;
  played: boolean;
  claimStarted: boolean;
  /** "SMS falló · auth/captcha-check-failed" o null si no hay rastro. */
  trail: string | null;
  converted: boolean;
  nudgeCount: number;
  status: string;
  uid: string | null;
  phoneCountryCode: string;
  expiresAt: Timestamp | null;
  /** Nombre del restaurante si ese dueño (uid o WhatsApp) ya tiene cuenta. */
  hasAccount: string | null;
  /** Cuántas veces subió menú con el mismo WhatsApp. */
  uploads: number;
};

/** "vence hoy", "vence mañana", "vence en 3 días", "venció". */
function expiresLabel(ts: Timestamp | null): string | null {
  if (!ts) return null;
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(ts.toDate()) - startOf(new Date())) / 86400000);
  if (ts.toMillis() < Date.now()) return "venció";
  if (days <= 0) return "vence hoy";
  if (days === 1) return "vence mañana";
  return `vence en ${days} días`;
}

/** Trozos de 30 para los `in` de Firestore. */
function chunks<T>(xs: T[], n = 30): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n));
  return out;
}

function ago(ts: Timestamp | null): string {
  if (!ts) return "—";
  const mins = Math.floor((Date.now() - ts.toMillis()) / 60000);
  if (mins < 60) return `hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 48) return `hace ${hrs} h`;
  return `hace ${Math.floor(hrs / 24)} días`;
}

/** Rastro del claim en cristiano (30-sep-2026): el último paso y, si falló, su código. */
const CLAIM_STEP_LABEL: Record<string, string> = {
  phoneChosen: "eligió número",
  googleChosen: "eligió Google",
  emailChosen: "mandó correo",
  smsRequested: "pidió el SMS",
  phoneSocialAccount: "su número ya tenía cuenta Google/correo",
  smsSent: "SMS enviado, sin código",
  smsFailed: "SMS falló",
  codeEntered: "tecleó el código",
  codeFailed: "código falló",
  accountCreated: "cuenta creada, sin formulario",
  accountFailed: "cuenta falló",
  formOpened: "vio el formulario",
  createRequested: "tocó crear",
  createFailed: "crear falló",
  closed: "cerró el modal",
};
export function claimTrailLabel(trail: unknown): string | null {
  if (!trail || typeof trail !== "object") return null;
  const t = trail as Record<string, unknown>;
  const last = typeof t.lastStep === "string" ? t.lastStep : null;
  if (!last) return null;
  const label = CLAIM_STEP_LABEL[last] ?? last;
  const code = t[`${last}Code`];
  return typeof code === "string" && code ? `${label} · ${code}` : label;
}

export default function ProspectosPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [rows, setRows] = useState<Prospect[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{
    jobId: string;
    text: string;
    whatsapp: string | null;
    countryCode: string;
    sent: boolean;
  } | null>(null);

  useEffect(() => {
    waitForAuthReady().then(async (u) => {
      const ok = !!u && PLATFORM_ADMIN_UIDS.includes(u.uid);
      setAllowed(ok);
      if (!ok) return;
      const db = getFirebaseDb();
      const snap = await getDocs(
        query(collection(db, "menuDemoJobs"), orderBy("createdAt", "desc"), limit(100)),
      );
      const base = snap.docs.map((d) => {
          const x = d.data();
          return {
            id: d.id,
            name: x.info?.restaurantName || "(menú sin nombre)",
            itemCount: Array.isArray(x.items) ? x.items.length : 0,
            whatsapp: x.whatsapp || null,
            createdAt: x.createdAt ?? null,
            viewed: !!x.viewedAt,
            played: !!x.playedDemoAt,
            claimStarted: !!x.claimStartedAt,
            // El rastro del claim (30-sep): en qué paso se quedó y el código.
            trail: claimTrailLabel(x.claimTrail),
            converted: !!x.convertedToRestaurantId,
            nudgeCount: x.nudgeCount || 0,
            status: x.status || "?",
            uid: typeof x.uid === "string" ? x.uid : null,
            phoneCountryCode: typeof x.phoneCountryCode === "string" ? x.phoneCountryCode : "52",
            expiresAt: x.expiresAt ?? null,
            hasAccount: null as string | null,
            uploads: 1,
          };
        });

      // ¿Ya tiene cuenta por otro camino? Restaurante con su uid de dueño o
      // con su WhatsApp. restaurants se lee público (reglas: read if true).
      const pending = base.filter((r) => !r.converted && r.status === "ready");
      const byUid = new Map<string, string>();
      const byPhone = new Map<string, string>();
      const uids = [...new Set(pending.map((r) => r.uid).filter((u): u is string => !!u))];
      const phones = [...new Set(pending.map((r) => r.whatsapp).filter((p): p is string => !!p))];
      try {
        for (const part of chunks(uids)) {
          const rs = await getDocs(query(collection(db, "restaurants"), where("ownerId", "in", part)));
          rs.forEach((d) => byUid.set(String(d.data().ownerId), String(d.data().name || "su restaurante")));
        }
        for (const part of chunks(phones)) {
          const rs = await getDocs(query(collection(db, "restaurants"), where("whatsapp", "in", part)));
          rs.forEach((d) => byPhone.set(String(d.data().whatsapp), String(d.data().name || "su restaurante")));
        }
      } catch (e) {
        console.error("[prospectos] cuentas", e);
      }
      for (const r of base) {
        r.hasAccount = (r.uid && byUid.get(r.uid)) || (r.whatsapp && byPhone.get(r.whatsapp)) || null;
      }

      // Un renglón por WhatsApp: el más nuevo se queda y cuenta las subidas.
      const seen = new Map<string, (typeof base)[number]>();
      const rowsOut: typeof base = [];
      for (const r of base) {
        const open = !r.converted && r.status === "ready";
        if (open && r.whatsapp) {
          const first = seen.get(r.whatsapp);
          if (first) { first.uploads += 1; continue; }
          seen.set(r.whatsapp, r);
        }
        rowsOut.push(r);
      }
      setRows(rowsOut);
    });
  }, []);

  async function nudge(row: Prospect) {
    if (busy) return;
    setBusy(row.id);
    setMsg(null);
    try {
      const fns = getFunctions(getFirebaseApp(), "us-central1");
      const res = await httpsCallable(fns, "generateDemoNudge")({ jobId: row.id });
      const data = res.data as { text: string; whatsapp: string | null; phoneCountryCode?: string | null };
      setMsg({
        jobId: row.id,
        text: data.text,
        whatsapp: data.whatsapp,
        countryCode: data.phoneCountryCode || row.phoneCountryCode,
        sent: false,
      });
    } catch (e) {
      console.error("[prospectos] nudge", e);
      setMsg({ jobId: row.id, text: "No se pudo generar el mensaje.", whatsapp: null, countryCode: row.phoneCountryCode, sent: false });
    } finally {
      setBusy(null);
    }
  }

  // Cuenta como mandado cuando Ricardo abre el WhatsApp, no al escribirlo.
  async function markSent(jobId: string) {
    setMsg((m) => (m && m.jobId === jobId ? { ...m, sent: true } : m));
    setRows((rs) => rs.map((r) => (r.id === jobId ? { ...r, nudgeCount: r.nudgeCount + 1 } : r)));
    try {
      const fns = getFunctions(getFirebaseApp(), "us-central1");
      await httpsCallable(fns, "generateDemoNudge")({ jobId, markSent: true });
    } catch (e) {
      console.error("[prospectos] markSent", e);
    }
  }

  if (allowed === null) {
    return <main className="p-8 text-sm opacity-60">Cargando…</main>;
  }
  if (!allowed) {
    return <main className="p-8 text-sm">Esta página es de plataforma.</main>;
  }

  const hot = rows.filter((r) => !r.converted && r.status === "ready" && !r.hasAccount);
  const withAccount = rows.filter((r) => !r.converted && r.status === "ready" && r.hasAccount);
  const converted = rows.filter((r) => r.converted);

  return (
    <main className="min-h-screen px-5 py-8" style={{ background: "#faf9f5" }}>
      <div className="mx-auto w-full max-w-2xl">
        <h1 className="text-[24px] font-extrabold" style={{ color: "#1C2526" }}>
          🔥 Prospectos del embudo
        </h1>
        <p className="mt-1 text-[13px]" style={{ color: "rgba(28,37,38,0.55)" }}>
          Subieron su menú y no lo han reclamado. Gemini escribe, tú tap-y-enviar.
        </p>

        <p className="mt-6 text-[11px] font-bold uppercase tracking-wide"
          style={{ color: "rgba(28,37,38,0.4)" }}>
          Calientes ({hot.length})
        </p>
        <div className="mt-2 flex flex-col gap-2.5">
          {hot.length === 0 && (
            <p className="text-[13px] opacity-50">Nadie esperando. 🎉</p>
          )}
          {hot.map((r) => (
            <div key={r.id} className="rounded-2xl bg-white p-4 shadow-sm"
              style={{ border: "1px solid rgba(28,37,38,0.07)" }}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[15px] font-extrabold" style={{ color: "#1C2526" }}>
                    {r.name}
                  </p>
                  <p className="mt-0.5 text-[12px]" style={{ color: "rgba(28,37,38,0.5)" }}>
                    {r.itemCount} platillos · {ago(r.createdAt)} ·{" "}
                    {r.claimStarted ? "🟠 empezó a reclamar" : r.played ? "🟡 jugó el demo" : r.viewed ? "👀 vio su menú" : "subió la foto"}
                    {r.trail && ` · se quedó en: ${r.trail}`}
                    {r.uploads > 1 && ` · subió ${r.uploads} veces`}
                    {expiresLabel(r.expiresAt) && ` · ${expiresLabel(r.expiresAt)}`}
                    {r.phoneCountryCode !== "52" && ` · +${r.phoneCountryCode}`}
                    {r.nudgeCount > 0 && ` · 📨 ${r.nudgeCount} nudge${r.nudgeCount > 1 ? "s" : ""}`}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <a href={`/demo/${r.id}`} target="_blank"
                    className="rounded-xl border px-3 py-2 text-[12px] font-bold"
                    style={{ borderColor: "rgba(28,37,38,0.15)", color: "#1C2526" }}>
                    Ver demo
                  </a>
                  <button
                    type="button"
                    disabled={!r.whatsapp || busy === r.id}
                    onClick={() => nudge(r)}
                    className="rounded-xl px-3 py-2 text-[12px] font-extrabold disabled:opacity-40"
                    style={{ background: "#F28C38", color: "#1C2526" }}
                    title={r.whatsapp ? `+${r.phoneCountryCode} ${r.whatsapp}` : "No dejó WhatsApp"}
                  >
                    {busy === r.id ? "Escribiendo…" : r.whatsapp ? "💬 Nudge" : "Sin WhatsApp"}
                  </button>
                </div>
              </div>
              {msg?.jobId === r.id && (
                <div className="mt-3 rounded-xl p-3"
                  style={{ background: "rgba(242,140,56,0.08)" }}>
                  <textarea
                    value={msg.text}
                    onChange={(e) => setMsg({ ...msg, text: e.target.value })}
                    rows={4}
                    className="w-full resize-y rounded-lg bg-white p-2 text-[13px] leading-relaxed"
                    style={{ color: "#1C2526", border: "1px solid rgba(28,37,38,0.1)" }}
                  />
                  {msg.whatsapp && (
                    <a
                      href={buildWhatsappUrl(msg.whatsapp, msg.text, msg.countryCode)}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => { if (!msg.sent) markSent(msg.jobId); }}
                      className="mt-2 inline-block rounded-xl px-3 py-2 text-[12px] font-extrabold"
                      style={{ background: "#25D366", color: "#fff" }}
                    >
                      {msg.sent ? "✓ Abierto en WhatsApp" : `Mandar a +${msg.countryCode} ${msg.whatsapp}`}
                    </a>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {withAccount.length > 0 && (
          <>
            <p className="mt-8 text-[11px] font-bold uppercase tracking-wide"
              style={{ color: "rgba(28,37,38,0.4)" }}>
              Ya tienen cuenta por otro lado ({withAccount.length})
            </p>
            <div className="mt-2 flex flex-col gap-1.5">
              {withAccount.map((r) => (
                <p key={r.id} className="text-[13px]" style={{ color: "rgba(28,37,38,0.6)" }}>
                  🟢 {r.name} · cuenta: {r.hasAccount} · su demo trae {r.itemCount} platillos
                </p>
              ))}
            </div>
          </>
        )}

        {converted.length > 0 && (
          <>
            <p className="mt-8 text-[11px] font-bold uppercase tracking-wide"
              style={{ color: "rgba(28,37,38,0.4)" }}>
              Convertidos ({converted.length}) 🎉
            </p>
            <div className="mt-2 flex flex-col gap-1.5">
              {converted.map((r) => (
                <p key={r.id} className="text-[13px]" style={{ color: "rgba(28,37,38,0.6)" }}>
                  ✅ {r.name} · {r.itemCount} platillos · {ago(r.createdAt)}
                </p>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
