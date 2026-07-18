import type { Metadata } from "next";
import Link from "next/link";
import { WhatsAppButton } from "@/components/marketing/WhatsAppLeadButton";
import {
  PUBLIC_WHATSAPP_DISPLAY,
} from "@/lib/contactEmail";

// SEO landing: "programa de lealtad para restaurantes en Chihuahua".
// Server component on purpose — fully static, crawlable, fast. The homepage
// stays untouched; this page owns the local-search + WhatsApp-first funnel.

export const metadata: Metadata = {
  title: "Programa de lealtad para restaurantes en Chihuahua — gratis",
  description:
    "Menú QR gratis, pedidos por WhatsApp y programa de puntos para restaurantes en Chihuahua. Sin mensualidad. Hecho en Chihuahua. Empieza hoy por WhatsApp.",
  alternates: { canonical: "/lealtad-restaurantes-chihuahua" },
  openGraph: {
    title: "Programa de lealtad para restaurantes en Chihuahua — Comeleal",
    description:
      "Menú QR gratis, pedidos por WhatsApp y puntos que hacen volver a tus clientes. Sin mensualidad — hecho en Chihuahua.",
    locale: "es_MX",
    type: "website",
  },
};

const FAQ = [
  {
    q: "¿Cuánto cuesta el programa de lealtad de Comeleal?",
    a: "Empezar es gratis: menú QR, pedidos por WhatsApp y programa de puntos sin mensualidad. Otras plataformas de lealtad en México cobran desde $749 MXN al mes. En Comeleal solo pagas una comisión del 3% en pagos digitales — en efectivo, 0%.",
  },
  {
    q: "¿Necesito que mis clientes descarguen una app?",
    a: "No. El número de teléfono de tu cliente es su tarjeta de lealtad: lo das de alta al cobrar y sus puntos se acumulan solos. Quien quiera la app de Comeleal la puede usar, pero nadie la necesita para juntar puntos.",
  },
  {
    q: "¿Qué incluye el menú QR gratis?",
    a: "Tu menú digital con fotos y precios en comeleal.com, un código QR para imprimir, pedidos directos por WhatsApp y pago al recoger. Se configura en unos 10 minutos.",
  },
  {
    q: "¿Cómo me ayuda a que mis clientes regresen?",
    a: "Cada venta suma puntos automáticamente. La IA de Comeleal detecta clientes que dejaron de venir, les manda recordatorios automáticos y te dice a quién escribirle por WhatsApp — y te muestra cuántos clientes y cuántos pesos te regresó.",
  },
  {
    q: "¿Atienden en persona en Chihuahua?",
    a: "Sí. Comeleal está hecho en Chihuahua y visitamos negocios locales para dejarte todo configurado: menú, horario y tu primera recompensa. Escríbenos por WhatsApp al " +
      PUBLIC_WHATSAPP_DISPLAY +
      ".",
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


export default function LealtadRestaurantesChihuahua() {
  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#1C2526]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      {/* Hero */}
      <section className="px-5 pb-14 pt-14 sm:pt-20">
        <div className="mx-auto max-w-3xl text-center">
          <p className="mb-4 inline-block rounded-full border border-[#F28C38]/30 bg-[#F28C38]/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#F28C38]">
            Hecho en Chihuahua 🇲🇽
          </p>
          <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            Programa de lealtad para restaurantes en{" "}
            <span className="text-[#F28C38]">Chihuahua</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-[17px] leading-relaxed text-[#1C2526]/70">
            Menú QR gratis, pedidos por WhatsApp y puntos que hacen volver a tus
            clientes. <b>Sin mensualidad.</b> Te lo dejamos funcionando en 10
            minutos.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <WhatsAppButton />
            <Link
              href="/activar"
              className="inline-flex items-center justify-center rounded-2xl border border-[#1C2526]/15 bg-white px-7 py-4 text-[15px] font-bold text-[#1C2526] transition-all hover:shadow-md"
            >
              Empieza gratis en línea →
            </Link>
          </div>
          <p className="mt-3 text-[12px] text-[#1C2526]/45">
            WhatsApp {PUBLIC_WHATSAPP_DISPLAY} · te contesta una persona, no un bot
          </p>
        </div>
      </section>

      {/* Money message */}
      <section className="px-5 py-14" style={{ background: "#1C2526" }}>
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Deja de regalarle el <span className="text-[#F28C38]">30%</span> a las
            apps de reparto
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-[15px] leading-relaxed text-white/60">
            Con Comeleal los pedidos llegan directo a tu WhatsApp. En efectivo
            pagas <b className="text-white">0% de comisión</b>; en pagos digitales,
            solo 3%. Otras plataformas de lealtad cobran desde{" "}
            <b className="text-white">$749 MXN al mes</b> — aquí empiezas gratis.
          </p>
          <div className="mx-auto mt-8 grid max-w-2xl grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              { v: "$0", l: "mensualidad para empezar" },
              { v: "0%", l: "comisión en efectivo" },
              { v: "10 min", l: "para dejarlo funcionando" },
            ].map((s) => (
              <div
                key={s.l}
                className="rounded-2xl px-4 py-5"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
              >
                <p className="text-2xl font-bold text-[#F28C38]">{s.v}</p>
                <p className="mt-1 text-[12px] text-white/55">{s.l}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="px-5 py-14">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">
            Así funciona
          </h2>
          <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
            {[
              {
                n: "1",
                t: "Tu menú QR gratis",
                d: "Subimos tu menú con fotos y precios. Imprimes el QR y tus clientes piden por WhatsApp — sin apps de por medio.",
              },
              {
                n: "2",
                t: "El teléfono es la tarjeta",
                d: "Al cobrar pides el número del cliente. Sus puntos se suman solos en cada venta — no necesita descargar nada.",
              },
              {
                n: "3",
                t: "La IA los hace volver",
                d: "Comeleal detecta quién dejó de venir, manda recordatorios automáticos y te muestra cuántos clientes y pesos te regresó.",
              },
            ].map((step) => (
              <div
                key={step.n}
                className="rounded-2xl bg-white p-6"
                style={{ border: "1px solid rgba(28,37,38,0.07)", boxShadow: "0 2px 10px rgba(28,37,38,0.04)" }}
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F28C38]/10 text-[15px] font-black text-[#F28C38]">
                  {step.n}
                </span>
                <h3 className="mt-4 text-lg font-bold">{step.t}</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-[#1C2526]/60">{step.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Local trust */}
      <section className="px-5 pb-14">
        <div
          className="mx-auto max-w-3xl rounded-3xl p-8 text-center"
          style={{ background: "rgba(242,140,56,0.08)", border: "1px solid rgba(242,140,56,0.2)" }}
        >
          <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
            Somos de aquí — no una plataforma de Monterrey o CDMX
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-[14px] leading-relaxed text-[#1C2526]/65">
            Visitamos tu negocio en Chihuahua, configuramos tu menú, tu horario y
            tu primera recompensa contigo, y te acompañamos por WhatsApp. Si algo
            no jala, nos escribes y lo arreglamos — en persona si hace falta.
          </p>
          <div className="mt-6">
            <WhatsAppButton label={`💬 Escríbenos: ${PUBLIC_WHATSAPP_DISPLAY}`} />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="px-5 pb-16">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-center text-2xl font-bold tracking-tight">
            Preguntas frecuentes
          </h2>
          <div className="mt-7 space-y-3">
            {FAQ.map((f) => (
              <details
                key={f.q}
                className="group rounded-2xl bg-white px-5 py-4"
                style={{ border: "1px solid rgba(28,37,38,0.08)" }}
              >
                <summary className="cursor-pointer list-none text-[15px] font-bold">
                  {f.q}
                </summary>
                <p className="mt-2 text-[14px] leading-relaxed text-[#1C2526]/65">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-5 pb-20">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-2xl font-bold tracking-tight">
            Tu programa de lealtad puede estar listo hoy
          </h2>
          <p className="mt-2 text-[14px] text-[#1C2526]/55">
            Mándanos un WhatsApp y te dejamos el menú QR, los puntos y tu primera
            recompensa funcionando.
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <WhatsAppButton />
            <Link
              href="/"
              className="text-[13px] font-semibold text-[#1C2526]/50 underline underline-offset-4 hover:text-[#1C2526]"
            >
              Conocer más de Comeleal
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
