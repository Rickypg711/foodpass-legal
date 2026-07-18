import type { Metadata } from "next";
import Link from "next/link";
import {
  PUBLIC_WHATSAPP_DISPLAY,
  PUBLIC_WHATSAPP_WA_ME_ACTIVATE,
} from "@/lib/contactEmail";

export const metadata: Metadata = {
  title: "¿Cómo hacer que tus clientes regresen a tu restaurante?",
  description: "El 70% de los clientes de un restaurante no vuelve. Aprende cómo un programa de puntos con WhatsApp y recordatorios automáticos los hace regresar — gratis.",
  alternates: { canonical: "/clientes-que-regresan" },
  openGraph: {
    title: "¿Cómo hacer que tus clientes regresen a tu restaurante?",
    description: "El 70% de los clientes de un restaurante no vuelve. Aprende cómo un programa de puntos con WhatsApp y recordatorios automáticos los hace regresar — gratis.",
    locale: "es_MX",
    type: "website",
  },
};

const FAQ = [
  {
    q: "¿Por qué mis clientes no regresan?",
    a: "Rara vez es por mala comida — es porque no existe un motivo concreto ni un recordatorio. Entre tantas opciones, el negocio que premia la lealtad y aparece en el momento correcto es el que gana la siguiente visita.",
  },
  {
    q: "¿Sirven los programas de puntos en negocios pequeños?",
    a: "Sí — funcionan mejor que en cadenas, porque se combinan con el trato personal. La clave es que sea fácil: sin tarjetas de cartón que se pierden, sin apps obligatorias. El número de teléfono basta.",
  },
  {
    q: "¿Qué es un cliente “en riesgo”?",
    a: "Alguien que te visitaba y lleva 14 días o más sin volver. Es el momento exacto de actuar: todavía te recuerda, pero está probando otras opciones. Comeleal te los señala automáticamente.",
  },
  {
    q: "¿Cuánto cuesta el programa de lealtad de Comeleal?",
    a: "Empezar es gratis, sin mensualidad: menú QR, pedidos por WhatsApp y puntos incluidos. Solo pagamos nosotros cuando cobras digital (3%); en efectivo, 0%.",
  }
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

function WhatsAppButton({ label = "💬 Háblanos por WhatsApp" }: { label?: string }) {
  return (
    <a
      href={PUBLIC_WHATSAPP_WA_ME_ACTIVATE}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center justify-center gap-2 rounded-2xl px-7 py-4 text-[16px] font-bold text-white transition-all hover:opacity-90 active:scale-[0.98]"
      style={{ background: "#25D366", boxShadow: "0 6px 24px rgba(37,211,102,0.35)" }}
    >
      {label}
    </a>
  );
}

export default function Page() {
  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#1C2526]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <section className="px-5 pb-14 pt-14 sm:pt-20">
        <div className="mx-auto max-w-3xl text-center">
          <p className="mb-4 inline-block rounded-full border border-[#F28C38]/30 bg-[#F28C38]/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#F28C38]">
            Hecho en Chihuahua 🇲🇽
          </p>
          <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            ¿Cómo hacer que tus clientes <span className="text-[#F28C38]">regresen</span>?
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-[17px] leading-relaxed text-[#1C2526]/70">
            Conseguir un cliente nuevo cuesta hasta 5 veces más que hacer volver a uno que ya te conoce. La respuesta no es más publicidad — es <b>un motivo para volver</b> y <b>un recordatorio a tiempo.</b>
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

      <section className="px-5 py-14" style={{ background: "#1C2526" }}>
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            La fórmula: puntos + recordatorio + premio
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-[15px] leading-relaxed text-white/60">
            Cada venta suma puntos con el número de teléfono del cliente. Cuando alguien deja de venir, Comeleal lo detecta y le manda un recordatorio automático — y a los que dejaron su WhatsApp, tú les escribes en un toque con un mensaje que la IA te redacta. El premio le da la razón para volver hoy y no “algún día”.
          </p>
        </div>
      </section>

      <section className="px-5 py-14">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">
            Así funciona
          </h2>
          <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
            {[
              {
                n: "1",
                t: "Captura el número en cada cobro",
                d: "“¿Tu número para tus puntos?” — 5 segundos al cobrar. Ese número es su tarjeta de lealtad y tu canal directo con él.",
              },
              {
                n: "2",
                t: "La IA detecta quién se está enfriando",
                d: "Comeleal vigila quién no ha regresado en 14 días y trabaja solo: notificaciones automáticas a usuarios de la app y avisos para que tú escribas a los de WhatsApp.",
              },
              {
                n: "3",
                t: "El premio cierra el círculo",
                d: "Recompensas ligadas a tus platillos (ej. pizza gratis a los 50 puntos). El cliente ve cuánto le falta — y esa cuenta pendiente lo trae de vuelta.",
              }
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

      <section className="px-5 pb-20">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-2xl font-bold tracking-tight">
            Te lo dejamos funcionando hoy
          </h2>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <WhatsAppButton />
          </div>
          <div className="mt-8 flex flex-col items-center gap-2 sm:flex-row sm:justify-center sm:gap-6">
            <Link href="/lealtad-restaurantes-chihuahua" className="text-[13px] font-semibold text-[#F28C38] underline underline-offset-4">Programa de lealtad en Chihuahua →</Link>
            <Link href="/menu-qr-gratis-restaurantes" className="text-[13px] font-semibold text-[#F28C38] underline underline-offset-4">Menú QR gratis →</Link>
            <Link href="/pedidos-whatsapp-restaurantes" className="text-[13px] font-semibold text-[#F28C38] underline underline-offset-4">Pedidos por WhatsApp sin comisiones →</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
