import type { Metadata } from "next";
import { NeverTouchesYourMoney } from "@/components/vendor/NeverTouchesYourMoney";
import { LivePlatformStats } from "@/components/vendor/LivePlatformStats";
import Link from "next/link";
import { WhatsAppButton } from "@/components/marketing/WhatsAppLeadButton";
import { PUBLIC_WHATSAPP_DISPLAY } from "@/lib/contactEmail";
import { PRO_PRICE_LABEL } from "@/lib/subscription/pricing";

export const metadata: Metadata = {
  title: "Precios — Comeleal para restaurantes",
  description:
    `Gratis para operar: menú QR, Caja, pedidos, puntos sin tope y tus clientes. Pro ${PRO_PRICE_LABEL}/mes: todo tu historial, tu equipo cobra con su PIN y llevas mesas.`,
  alternates: { canonical: "/precios" },
  openGraph: {
    title: "Precios — Comeleal para restaurantes",
    description:
      `Gratis para operar: menú QR, Caja, pedidos, puntos sin tope y tus clientes. Pro ${PRO_PRICE_LABEL}/mes: historial completo, equipo con PIN y mesas.`,
    locale: "es_MX",
    type: "website",
  },
};

const FREE_FEATURES = [
  "Menú digital QR — tus clientes escanean y ven tu menú",
  "Caja / punto de venta: cobra en segundos, sin tope de ventas",
  "Pedidos en línea y por WhatsApp",
  "Tus clientes guardados: visitas, gasto y quién dejó de venir",
  "Recupera al que dejó de venir: Comeleal te dice quién y te arma el WhatsApp — tú lo mandas, sin tope",
  "Reportes de hoy, de la semana y de 30 días",
  "Tu página en Google — te ponemos en los resultados de búsqueda",
  "Puntos para tus clientes — sin tope de visitas, nunca",
];

const PRO_FEATURES = [
  "Todo tu historial de ventas — más de 30 días, para siempre",
  "Tu equipo cobra con su PIN — cada venta con el nombre de quien la hizo",
  "Cuentas por mesa — las rondas juntas, un solo cobro",
  "Reportes de más de 30 días",
  "Comeleal AI sin límite: pregúntale por tus ventas, tus VIP y cuándo lanzar promos",
  "Descuentos especiales para staff y familia — la caja los aplica sola al cobrar",
];

const FAQ = [
  {
    q: "¿Lo gratis es gratis de verdad?",
    a: "Sí. Menú QR, Caja, pedidos, tus clientes y reportes no cuestan nada, sin límite de tiempo y sin tarjeta. Solo los pagos digitales en línea (Mercado Pago) llevan un 3% — efectivo y tu terminal de siempre: 0%.",
  },
  {
    q: "¿Los puntos de mis clientes tienen tope?",
    a: "No. Cada venta con número suma puntos, gratis y sin límite de visitas. Nunca se pausan, ni en tu mes más lleno.",
  },
  {
    q: `¿Qué es Pro y por qué cuesta ${PRO_PRICE_LABEL}?`,
    a: "Pro es para cuando tu Caja crece: ves todo tu historial de ventas (más de 30 días), tu equipo cobra con su PIN y llevas cuentas por mesa. Cobramos por eso. Lo que necesitas para operar — menú, Caja, pedidos, puntos y tus clientes — sigue gratis.",
  },
  {
    q: "¿Cómo funciona la prueba de 14 días?",
    a: "Le das un botón desde tu panel y ya: Pro completo por 14 días, sin tarjeta y sin dejar datos de pago. Al día 15, si no lo activas, no te cobramos nada — regresas solo al plan gratis con tu menú, tu Caja, tus clientes y todo tu historial intactos. Es una prueba por restaurante.",
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
            Opera <span className="text-[#F28C38]">gratis</span>. Paga solo cuando tu Caja crece.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-[17px] leading-relaxed text-[#1C2526]/70">
            Tu menú, tu Caja, tus pedidos y los puntos de tus clientes no cuestan
            nada — hoy ni nunca. Pro es para cuando tu Caja crece: todo tu
            historial, tu equipo con su PIN y mesas.
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
              {PRO_PRICE_LABEL} <span className="text-[15px] font-semibold text-white/50">MXN/mes</span>
            </p>
            <p className="mt-1 text-[13px] text-white/55">Para cuando tu Caja crece.</p>
            <p className="mt-3 inline-block rounded-full bg-[#F28C38]/15 px-3 py-1 text-[12px] font-bold text-[#F28C38]">
              14 días gratis · sin tarjeta
            </p>
            <ul className="mt-6 space-y-2.5">
              {PRO_FEATURES.map((f) => (
                <li key={f} className="flex gap-2 text-[14px] leading-relaxed text-white/80">
                  <span className="text-[#F28C38]">✓</span> {f}
                </li>
              ))}
            </ul>
            <Link
              href="/activar"
              className="mt-7 inline-flex w-full items-center justify-center rounded-2xl bg-[#F28C38] px-6 py-3.5 text-[15px] font-bold text-[#1C2526] transition-all hover:opacity-90"
            >
              Prueba Pro 14 días gratis →
            </Link>
            <p className="mt-2 text-center text-[11px] text-white/40">
              Sin tarjeta · al terminar regresas solo al plan gratis, sin perder nada
            </p>
          </div>
        </div>

        <p className="mx-auto mt-6 max-w-2xl text-center text-[13px] leading-relaxed text-[#1C2526]/50">
          ¿Y las comisiones? Efectivo y cobros con tu terminal: <b>0%</b>. Solo los
          pagos digitales en línea con Mercado Pago llevan un 3% — cobramos
          únicamente cuando tú vendes. Las apps de delivery cobran hasta 30%.
        </p>
      </section>
      <NeverTouchesYourMoney />
      <LivePlatformStats />


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
