import type { Metadata } from "next";
import Link from "next/link";
import {
  PUBLIC_WHATSAPP_DISPLAY,
  PUBLIC_WHATSAPP_WA_ME_ACTIVATE,
} from "@/lib/contactEmail";

export const metadata: Metadata = {
  title: "Tarjeta de lealtad digital para tu restaurante — adiós tarjetitas de cartón",
  description: "Tarjeta de lealtad digital: el número de teléfono de tu cliente es su tarjeta. Puntos automáticos en cada compra, premios canjeables con código y compatible con Apple Wallet. Gratis.",
  alternates: { canonical: "/tarjeta-de-lealtad-digital" },
  openGraph: {
    title: "Tarjeta de lealtad digital para tu restaurante — adiós tarjetitas de cartón",
    description: "Tarjeta de lealtad digital: el número de teléfono de tu cliente es su tarjeta. Puntos automáticos en cada compra, premios canjeables con código y compatible con Apple Wallet. Gratis.",
    locale: "es_MX",
    type: "website",
  },
};

const FAQ = [
  {
    q: "¿Mis clientes necesitan descargar una app?",
    a: "No. El número de teléfono basta para juntar puntos y canjear premios. La app de Comeleal es opcional — quien la usa gana extras como su tarjeta en el Wallet y notificaciones de sus premios.",
  },
  {
    q: "¿Cómo es más segura que una tarjeta de sellos?",
    a: "Los sellos se falsifican y las tarjetas se prestan. Aquí cada canje pide un código personal que solo el cliente ve en su teléfono — queda registrado quién canjeó qué y cuándo.",
  },
  {
    q: "¿Qué premios puedo dar?",
    a: "Los que tú decidas, ligados a tus platillos reales: ej. pizza personal gratis a los 20 puntos. También hay premio de bienvenida para la primera visita — el gancho para que el cliente nuevo regrese.",
  },
  {
    q: "¿Cuánto cuesta?",
    a: "Nada — la tarjeta digital, los puntos y los premios vienen gratis con Comeleal, junto con el menú QR y el punto de venta. Otras plataformas de lealtad cobran desde $749 MXN al mes.",
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
            Tarjeta de lealtad <span className="text-[#F28C38]">digital</span> — adiós a las tarjetitas de cartón
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-[17px] leading-relaxed text-[#1C2526]/70">
            La tarjeta que no se pierde, no se moja y no se olvida: <b>el número de teléfono de tu cliente ES su tarjeta.</b> Puntos automáticos en cada compra, premios que lo hacen volver — y para los que usan la app, su tarjeta vive en su Wallet.
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
            Las tarjetas de sellos se pierden — los números no
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-[15px] leading-relaxed text-white/60">
            El 90% de las tarjetitas de cartón terminan en la lavadora. Con Comeleal el cliente solo da su número al pagar: sus puntos se acumulan solos, ve su saldo y sus premios en su teléfono, y canjea con un código personal que solo él tiene — nadie puede usar sus puntos sin él. Sin apps obligatorias, sin sellos falsificables, sin cartón.
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
                t: "El número es la tarjeta",
                d: "Al cobrar preguntas: “¿tu número para tus puntos?”. Eso es todo — sus puntos se suman automáticamente en cada compra, sin descargar nada.",
              },
              {
                n: "2",
                t: "El cliente ve sus puntos y premios",
                d: "Desde su teléfono consulta cuántos puntos tiene, qué premios ya desbloqueó y cuánto le falta para el siguiente — esa cuenta pendiente es la que lo trae de vuelta.",
              },
              {
                n: "3",
                t: "Canje seguro, hasta en Wallet",
                d: "Para canjear muestra su código personal — así ni un empleado puede regalar puntos ajenos. Y quien usa la app de Comeleal puede llevar su tarjeta en Apple Wallet, como una tarjeta de crédito.",
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
            <Link href="/programa-de-lealtad-para-restaurantes" className="text-[13px] font-semibold text-[#F28C38] underline underline-offset-4">Programa de lealtad para restaurantes →</Link>
            <Link href="/clientes-que-regresan" className="text-[13px] font-semibold text-[#F28C38] underline underline-offset-4">¿Cómo hacer que tus clientes regresen? →</Link>
            <Link href="/inteligencia-artificial-para-restaurantes" className="text-[13px] font-semibold text-[#F28C38] underline underline-offset-4">IA para restaurantes →</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
