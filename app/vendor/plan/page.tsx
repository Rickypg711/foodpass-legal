"use client";

// /vendor/plan — la página del plan: UN solo escenario para vender Pro.
// Todos los upsells del producto (gates de features, banners de tope, chip del
// sidebar) apuntan AQUÍ. Configuración conserva la gestión ("tu plan actual");
// esta página hace la venta. Espejo del rol que cumple la pantalla de
// Suscripción (IAP) en la app.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import { waitForAuthReady } from "@/lib/auth";
import { resolveVendorContext, vendorHomeForRole } from "@/lib/vendorContext";
import type { User } from "firebase/auth";

const FREE_INCLUDES = [
  "Menú digital QR + tu página en Google",
  "Caja / POS completa: cobro, cuentas, equipo con PIN y propinas",
  "Pedidos en línea sin comisiones de reparto",
  "Tus clientes guardados con su número — CRM y reportes",
  "Lealtad: hasta 50 visitas de clientes al mes",
];

const PRO_INCLUDES = [
  "Lealtad ilimitada — ningún cliente se queda sin sus puntos",
  "Recuperación automática por WhatsApp: si un cliente deja de venir, le llega un mensaje para que regrese",
  "Descuentos especiales (staff y familia) — la caja los aplica sola",
  "Cuentas con acceso propio para tu equipo, cada quien con su rol",
  "Comeleal AI sin límite: tus ventas, tus VIP, cuándo lanzar promos",
  "Soporte directo — te contesta una persona",
];

export default function PlanPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isPro, setIsPro] = useState(false);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      const u = await waitForAuthReady();
      if (!u || u.isAnonymous) { router.push("/activar"); return; }
      setUser(u);
      const db = getFirebaseDb();
      // Plan page = billing → solo dueño (matrix del app: canManageBilling).
      const ctx = await resolveVendorContext(db, u.uid);
      if (!ctx) { router.push("/activar"); return; }
      if (ctx.role !== "owner") { router.push(vendorHomeForRole(ctx.role)); return; }
      const rid = ctx.restaurantId;
      setRestaurantId(rid);

      const rSnap = await getDoc(doc(db, "restaurants", rid));
      const data = rSnap.data() ?? {};
      // Detección canónica (SIN founder-test: aquí se muestra el plan REAL).
      const accessStatus = data.subscriptionAccessStatus as string | undefined;
      const expiresAtRaw = data.subscriptionAccessExpiresAt as
        | { toMillis?: () => number }
        | undefined;
      const expiresMs = expiresAtRaw?.toMillis?.() ?? null;
      const canonicalPro =
        data.subscriptionPlan === "pro" &&
        (accessStatus === "active" || accessStatus === "trialing") &&
        expiresMs != null &&
        expiresMs > Date.now();
      setIsPro(canonicalPro || data.plan === "pro");
      setLoading(false);
    }
    init().catch(() => setLoading(false));
  }, [router]);

  /** Mismo checkout MP que Configuración — una sola vía de pago web. */
  async function handleActivatePro() {
    if (!restaurantId || !user || activating) return;
    setActivating(true);
    setError(null);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/mercado-pago/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ restaurantId }),
      });
      const json = (await res.json().catch(() => ({}))) as { initPoint?: string };
      if (!res.ok || !json.initPoint) throw new Error("checkout_unavailable");
      window.location.href = json.initPoint;
    } catch {
      setError(
        "No pudimos iniciar el pago con Mercado Pago. Intenta de nuevo o activa Pro desde la app.",
      );
      setActivating(false);
    }
  }

  return (
    <main className="px-4 pb-16 pt-5 md:px-8 md:pt-7">
      <div className="mx-auto mb-8 max-w-2xl text-center">
        <p
          className="inline-block rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest"
          style={{ background: "rgba(242,140,56,0.1)", color: "#F28C38" }}
        >
          Tu plan
        </p>
        <h1
          className="mt-3 text-[28px] font-black leading-tight tracking-tight md:text-[34px]"
          style={{ color: "#1C2526" }}
        >
          Opera gratis.{" "}
          <span
            style={{
              background: "linear-gradient(90deg, #F28C38, #FF9A45)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Crece con Pro.
          </span>
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed" style={{ color: "rgba(28,37,38,0.55)" }}>
          Todo lo que necesitas para operar tu restaurante es gratis, siempre.
          Pro es la máquina que trabaja de noche: encuentra a los clientes que
          están dejando de venir y los trae de vuelta — solita.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <svg className="h-6 w-6 animate-spin" style={{ color: "#F28C38" }} fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 12 5.373 12 12H4z" />
          </svg>
        </div>
      ) : (
        <div className="mx-auto grid max-w-4xl grid-cols-1 items-start gap-4 md:grid-cols-2">
          {/* ── Gratis ── */}
          <div
            className="rounded-3xl p-6"
            style={{ background: "#ffffff", border: "1px solid rgba(28,37,38,0.08)" }}
          >
            <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "rgba(28,37,38,0.4)" }}>
              Gratis — para operar
            </p>
            <p className="mt-1 text-[28px] font-black" style={{ color: "#1C2526" }}>
              $0 <span className="text-[13px] font-semibold" style={{ color: "rgba(28,37,38,0.4)" }}>/ siempre</span>
            </p>
            <ul className="mt-4 space-y-2.5">
              {FREE_INCLUDES.map((f) => (
                <li key={f} className="flex gap-2 text-[13px] leading-relaxed" style={{ color: "rgba(28,37,38,0.65)" }}>
                  <span style={{ color: "#16A34A" }}>✓</span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            {!isPro && (
              <p className="mt-4 text-[11px]" style={{ color: "rgba(28,37,38,0.35)" }}>
                Tu plan actual
              </p>
            )}
          </div>

          {/* ── Pro ── */}
          <div
            className="relative rounded-3xl p-6"
            style={{
              background: "linear-gradient(160deg, #FFF7ED 0%, #ffffff 55%)",
              border: "2px solid rgba(242,140,56,0.45)",
              boxShadow: "0 8px 28px rgba(242,140,56,0.14)",
            }}
          >
            <span
              className="absolute -top-3 left-6 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white"
              style={{ background: "linear-gradient(135deg, #F28C38 0%, #FF9A45 100%)" }}
            >
              Recomendado
            </span>
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "#F28C38" }}>
                ⭐ Pro — la máquina de que regresen
              </p>
              {isPro && (
                <span
                  className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider"
                  style={{ background: "rgba(242,140,56,0.15)", color: "#F28C38" }}
                >
                  Activo
                </span>
              )}
            </div>
            <p className="mt-1 text-[28px] font-black" style={{ color: "#1C2526" }}>
              $299 <span className="text-[13px] font-semibold" style={{ color: "rgba(28,37,38,0.4)" }}>MXN / mes</span>
            </p>
            <ul className="mt-4 space-y-2.5">
              {PRO_INCLUDES.map((f) => (
                <li key={f} className="flex gap-2 text-[13px] leading-relaxed" style={{ color: "rgba(28,37,38,0.7)" }}>
                  <span style={{ color: "#F28C38" }}>✓</span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            {isPro ? (
              <p className="mt-5 text-[12px] font-semibold" style={{ color: "#16A34A" }}>
                ✓ Plan Pro activo — gracias por confiar en la máquina.
              </p>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleActivatePro}
                  disabled={activating}
                  className="mt-5 w-full rounded-2xl px-4 py-3.5 text-[14px] font-extrabold text-white transition hover:opacity-90 disabled:opacity-60"
                  style={{ background: "linear-gradient(135deg, #F28C38 0%, #FF9A45 100%)" }}
                >
                  {activating ? "Abriendo pago…" : "Activar Pro →"}
                </button>
                <p className="mt-2 text-center text-[11px]" style={{ color: "rgba(28,37,38,0.35)" }}>
                  Pago seguro con Mercado Pago · sin plazos forzosos · cancela cuando quieras
                </p>
              </>
            )}
            {error && (
              <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-600">
                {error}
              </p>
            )}
          </div>
        </div>
      )}

      {!loading && (
        <>
          {/* ── Franja de confianza ── */}
          <div
            className="mx-auto mt-6 flex max-w-4xl flex-wrap items-center justify-center gap-x-8 gap-y-2 rounded-2xl px-6 py-4"
            style={{ background: "rgba(28,37,38,0.03)", border: "1px solid rgba(28,37,38,0.06)" }}
          >
            {[
              "🇲🇽 Hecho en México, para restaurantes mexicanos",
              "💵 Funciona con efectivo",
              "📱 El número de tu cliente es su tarjeta",
              "🔓 Sin plazos forzosos",
            ].map((t) => (
              <span key={t} className="text-[12px] font-semibold" style={{ color: "rgba(28,37,38,0.5)" }}>
                {t}
              </span>
            ))}
          </div>

          {/* ── Mini FAQ ── */}
          <div className="mx-auto mt-8 max-w-4xl">
            <p className="mb-3 text-center text-[14px] font-extrabold" style={{ color: "#1C2526" }}>
              Preguntas rápidas
            </p>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {[
                {
                  q: "¿Lo gratis es gratis de verdad?",
                  a: "Sí. Menú, caja, pedidos, clientes, equipo con PIN y reportes no cuestan nada, sin límite de tiempo y sin tarjeta.",
                },
                {
                  q: "¿Qué pasa si cancelo Pro?",
                  a: "Nada se rompe: sigues operando gratis con todo tu historial. Solo se pausa la máquina — lealtad ilimitada, win-back y AI.",
                },
                {
                  q: "¿Cómo se paga?",
                  a: "Con Mercado Pago desde aquí, o desde la app con tu tienda (Google Play / App Store). Mes a mes, cancelas cuando quieras.",
                },
              ].map((f) => (
                <div
                  key={f.q}
                  className="rounded-2xl p-4"
                  style={{ background: "#ffffff", border: "1px solid rgba(28,37,38,0.07)" }}
                >
                  <p className="text-[13px] font-bold" style={{ color: "#1C2526" }}>{f.q}</p>
                  <p className="mt-1.5 text-[12px] leading-relaxed" style={{ color: "rgba(28,37,38,0.55)" }}>
                    {f.a}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </main>
  );
}
