import type { Metadata } from "next";
import Link from "next/link";
import { WhatsAppButton } from "@/components/marketing/WhatsAppLeadButton";
import { PUBLIC_WHATSAPP_DISPLAY } from "@/lib/contactEmail";

export const metadata: Metadata = {
  title: "Precios — Comeleal para restaurantes",
  description:
    "Gratis para operar: menú QR, punto de venta, pedidos y tus clientes. Pro $299/mes: la máquina de que tus clientes regresen — lealtad ilimitada, recuperación por WhatsApp y AI.",
  alternates: { canonical: "/precios" },
  openGraph: {
    title: "Precios — Comeleal para restaurantes",
    description:
      "Gratis para operar: menú QR, punto de venta, pedidos y tus clientes. Pro $299/mes: lealtad ilimitada, recuperación por WhatsApp y AI.",
    locale: "es_MX",
    type: "website",
  },
};

const FREE_FEATURES = [
  "Menú digital QR — tus clientes escanean y ven tu carta",
  "Caja / punto de venta: cobra en segundos, cuentas abiertas por mesa",
  "Pedidos en línea y por WhatsApp",
  "Tus clientes guardados: visitas, gasto y quién dejó de venir",
  "Reportes de ventas y de clientes",
  "Tu página en Google — te ponemos en los resultados de búsqueda",
  "Lealtad: hasta 50 visitas de clientes al mes",
];

const PRO_FEATURES = [
  "Lealtad ilimitada — ningún cliente se queda sin sus puntos",
  "Recuperación automática por WhatsApp sin límite: si un cliente deja de venir, le llega un mensaje para que regrese",
  "Comeleal AI sin límite: pregúntale por tus ventas, tus VIP y cuándo lanzar promos",
  "Soporte directo — te contesta una persona, no un bot",
];

const FAQ = [
  {
    q: "¿Lo gratis es gratis de verdad?",
    a: "Sí. Menú QR, Caja, pedidos, tus clientes y reportes no cuestan nada, sin límite de tiempo y sin tarjeta. Solo los pagos digitales en línea (Mercado Pago) llevan un 3% — efectivo y tu terminal de siempre: 0%.",
  },
  {
    q: "¿Qué pasa cuando llego a las 50 visitas de lealtad del mes?",
    a: "Tu operación sigue igual: cobras, vendes y tus clientes se siguen guardando con su número. Lo único que se pausa es que las visitas nuevas ya no suman puntos hasta el próximo mes — o desde $299 al mes con Pro, ilimitado.",
  },
  {
    q: "¿Por qué Pro cuesta $299?",
    a: "Porque lo que incluye nos cuesta de verdad: cada mensaje de WhatsApp que mandamos para recuperar a un cliente tuyo se paga, y el AI también. Cobramos por lo que cuesta, no por candados artificiales.",
  },
  {
    q: "¿Puedo cancelar cuando quiera?",
    a: "Sí, desde tu panel, sin plazos forzosos ni penalizaciones. Si cancelas, regresas al plan gratis y tu menú, tu Caja y tus clientes siguen ahí.",
  },
  {
    q: "¿Cómo pago?",
    a: "Con Mercado Pago desde tu panel web, o desde la app (App Store / Google Play). El plan se activa al momento.",
  },
];

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

export default function Page() {
  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#1C2526]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <section className="px-5 pb-10 pt-14 sm:pt-20">
        <div className="mx-auto max-w-3xl text-center">
          <p className="mb-4 inline-block rounded-full border border-[#F28C38]/30 bg-[#F28C38]/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#F28C38]">
            Hecho en Chihuahua 🇲🇽
          </p>
          <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            Opera <span className="text-[#F28C38]">gratis</span>. Paga solo por la máquina de que regresen.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-[17px] leading-relaxed text-[#1C2526]/70">
            Tu menú, tu Caja y tus pedidos no cuestan nada — hoy ni nunca. Pro es
            para cuando quieres que Comeleal trabaje solo trayendo a tus clientes
            de vuelta.
          </p>
        </div>
      </section>

      <section className="px-5 pb-14">
        <div className="mx-auto grid max-w-4xl grid-cols-1 gap-5 md:grid-cols-2">
          {/* Free */}
          <div
            className="rounded-3xl bg-white p-7"
            style={{ border: "1px solid rgba(28,37,38,0.08)", boxShadow: "0 2px 12px rgba(28,37,38,0.04)" }}
          >
            <p className="text-[13px] font-bold uppercase tracking-wider text-[#1C2526]/45">Gratis</p>
            <p className="mt-2 text-4xl font-black">$0</p>
            <p className="mt-1 text-[13px] text-[#1C2526]/50">Para operar tu restaurante. Sin tarjeta, sin plazo.</p>
            <ul className="mt-6 space-y-2.5">
              {FREE_FEATURES.map((f) => (
                <li key={f} className="flex gap-2 text-[14px] leading-relaxed text-[#1C2526]/75">
                  <span className="text-[#F28C38]">✓</span> {f}
                </li>
              ))}
            </ul>
            <Link
              href="/activar"
              className="mt-7 inline-flex w-full items-center justify-center rounded-2xl border border-[#1C2526]/15 bg-white px-6 py-3.5 text-[15px] font-bold transition-all hover:shadow-md"
            >
              Empieza gratis →
            </Link>
          </div>

          {/* Pro */}
          <div
            className="rounded-3xl p-7"
            style={{
              background: "#1C2526",
              border: "1px solid rgba(242,140,56,0.35)",
              boxShadow: "0 8px 30px rgba(28,37,38,0.18)",
            }}
          >
            <p className="text-[13px] font-bold uppercase tracking-wider text-[#F28C38]">Pro</p>
            <p className="mt-2 text-4xl font-black text-white">
              $299 <span className="text-[15px] font-semibold text-white/50">MXN/mes</span>
            </p>
            <p className="mt-1 text-[13px] text-white/55">La máquina de que tus clientes regresen.</p>
            <ul className="mt-6 space-y-2.5">
              {PRO_FEATURES.map((f) => (
                <li key={f} className="flex gap-2 text-[14px] leading-relaxed text-white/80">
                  <span className="text-[#F28C38]">✓</span> {f}
                </li>
              ))}
            </ul>
            <Link
              href="/activar"
              className="mt-7 inline-flex w-full items-center justify-center rounded-2xl bg-[#F28C38] px-6 py-3.5 text-[15px] font-bold text-white transition-all hover:opacity-90"
            >
              Empieza gratis y actívalo cuando quieras →
            </Link>
            <p className="mt-2 text-center text-[11px] text-white/40">
              Se activa desde tu panel · Mercado Pago · cancela cuando quieras
            </p>
          </div>
        </div>

        <p className="mx-auto mt-6 max-w-2xl text-center text-[13px] leading-relaxed text-[#1C2526]/50">
          ¿Y las comisiones? Efectivo y cobros con tu terminal: <b>0%</b>. Solo los
          pagos digitales en línea con Mercado Pago llevan un 3% — cobramos
          únicamente cuando tú vendes. Las apps de delivery cobran hasta 30%.
        </p>
      </section>

      <section className="px-5 pb-16">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-center text-2xl font-bold tracking-tight">Preguntas frecuentes</h2>
          <div className="mt-7 space-y-3">
            {FAQ.map((f) => (
              <details
                key={f.q}
                className="group rounded-2xl bg-white px-5 py-4"
                style={{ border: "1px solid rgba(28,37,38,0.08)" }}
              >
                <summary className="cursor-pointer list-none text-[15px] font-bold">{f.q}</summary>
                <p className="mt-2 text-[14px] leading-relaxed text-[#1C2526]/65">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 pb-20">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-2xl font-bold tracking-tight">Te lo dejamos funcionando hoy</h2>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <WhatsAppButton />
          </div>
          <p className="mt-3 text-[12px] text-[#1C2526]/45">
            WhatsApp {PUBLIC_WHATSAPP_DISPLAY} · te contesta una persona, no un bot
          </p>
          <div className="mt-8 flex flex-col items-center gap-2 sm:flex-row sm:justify-center sm:gap-6">
            <Link href="/menu-qr-gratis-restaurantes" className="text-[13px] font-semibold text-[#F28C38] underline underline-offset-4">Menú QR gratis →</Link>
            <Link href="/punto-de-venta-gratis-restaurantes" className="text-[13px] font-semibold text-[#F28C38] underline underline-offset-4">Punto de venta gratis →</Link>
            <Link href="/lealtad-restaurantes-chihuahua" className="text-[13px] font-semibold text-[#F28C38] underline underline-offset-4">Lealtad en Chihuahua →</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
