import type { Metadata } from "next";
import Link from "next/link";
import {
  PUBLIC_WHATSAPP_DISPLAY,
  PUBLIC_WHATSAPP_WA_ME_ACTIVATE,
} from "@/lib/contactEmail";

export const metadata: Metadata = {
  title: "Programa de lealtad para restaurantes — puntos que hacen volver clientes",
  description: "Programa de lealtad para tu restaurante sin mensualidad: puntos automáticos con el número de teléfono, premios ligados a tu menú e IA que recupera a los que dejaron de venir.",
  alternates: { canonical: "/programa-de-lealtad-para-restaurantes" },
  openGraph: {
    title: "Programa de lealtad para restaurantes — puntos que hacen volver clientes",
    description: "Programa de lealtad para tu restaurante sin mensualidad: puntos automáticos con el número de teléfono, premios ligados a tu menú e IA que recupera a los que dejaron de venir.",
    locale: "es_MX",
    type: "website",
  },
};

const FAQ = [
  {
    q: "¿Qué tipo de programa es: sellos, visitas o puntos?",
    a: "Puntos por compra: cada venta suma según el monto, y los premios se canjean al llegar a la meta que tú definas. Es más justo que los sellos (quien gasta más, avanza más) y no se puede falsificar.",
  },
  {
    q: "¿Funciona si mis clientes no usan apps?",
    a: "Sí — está diseñado exactamente para eso. El número de teléfono es la tarjeta de lealtad: nada que descargar, nada que imprimir. Quien quiera la app gana extras, pero nadie la necesita.",
  },
  {
    q: "¿Cómo evito que empleados regalen premios?",
    a: "Cada canje pide un código personal que solo el cliente ve en su teléfono. Sin cliente presente no hay canje — y todo queda registrado para que tú lo audites.",
  },
  {
    q: "¿De verdad es gratis?",
    a: "Sí: el programa de puntos, el menú QR, los pedidos en línea y el punto de venta no tienen mensualidad. Solo los pagos digitales llevan 3% — en efectivo, 0%. Compáralo con los $749+ MXN al mes de otras plataformas.",
  },
  {
    q: "¿Están en mi ciudad?",
    a: "Comeleal funciona en todo México desde el navegador — te configuramos por WhatsApp en el mismo día. Y si estás en Chihuahua capital, vamos en persona a tu negocio a dejarte todo listo.",
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
            Programa de <span className="text-[#F28C38]">lealtad</span> para tu restaurante
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-[17px] leading-relaxed text-[#1C2526]/70">
            Puntos automáticos con el número de teléfono, premios ligados a tus platillos y una IA que trae de vuelta a los que dejaron de venir. <b>Sin mensualidad, sin apps obligatorias</b> — así compra México.
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
            La lealtad no es un lujo de cadenas — es tu arma contra ellas
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-[15px] leading-relaxed text-white/60">
            Las cadenas gastan millones en sus programas de puntos porque funcionan: un cliente con puntos acumulados regresa aunque tenga opciones más cerca. Comeleal te da la misma arma gratis: cada venta suma puntos con el número del cliente, los premios usan tus propios platillos, y la IA vigila quién se enfría y lo recupera. Otras plataformas cobran desde $749 MXN al mes por esto.
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
                t: "Actívalo en 10 minutos",
                d: "Eliges tus premios (ej. pizza gratis a los 50 puntos, premio de bienvenida para la primera visita) y listo — funciona en tu Caja, tu menú QR y tus pedidos en línea al mismo tiempo.",
              },
              {
                n: "2",
                t: "Cada venta suma sola",
                d: "El cliente da su número al pagar y sus puntos se acumulan automáticamente — en mostrador, en línea o por teléfono. Sin sellos, sin tarjetas, sin trabajo extra para tu equipo.",
              },
              {
                n: "3",
                t: "La IA cierra el círculo",
                d: "Cuando un cliente deja de venir, la IA lo detecta y actúa: recordatorios automáticos, mensajes de recuperación listos para enviar, y un reporte de cuántos clientes y pesos te regresó.",
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
            <Link href="/lealtad-restaurantes-chihuahua" className="text-[13px] font-semibold text-[#F28C38] underline underline-offset-4">¿Estás en Chihuahua? Te visitamos →</Link>
            <Link href="/tarjeta-de-lealtad-digital" className="text-[13px] font-semibold text-[#F28C38] underline underline-offset-4">Tarjeta de lealtad digital →</Link>
            <Link href="/inteligencia-artificial-para-restaurantes" className="text-[13px] font-semibold text-[#F28C38] underline underline-offset-4">IA para restaurantes →</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
