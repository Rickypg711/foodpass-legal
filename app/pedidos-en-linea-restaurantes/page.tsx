import type { Metadata } from "next";
import Link from "next/link";
import {
  PUBLIC_WHATSAPP_DISPLAY,
  PUBLIC_WHATSAPP_WA_ME_ACTIVATE,
} from "@/lib/contactEmail";

export const metadata: Metadata = {
  title: "Sistema de pedidos en línea para restaurantes — sin comisiones de apps",
  description: "Recibe pedidos en línea en tu restaurante sin pagar 30% a las apps: menú web propio, pago al recoger o digital, alerta al instante y puntos de lealtad. Gratis.",
  alternates: { canonical: "/pedidos-en-linea-restaurantes" },
  openGraph: {
    title: "Sistema de pedidos en línea para restaurantes — sin comisiones de apps",
    description: "Recibe pedidos en línea en tu restaurante sin pagar 30% a las apps: menú web propio, pago al recoger o digital, alerta al instante y puntos de lealtad. Gratis.",
    locale: "es_MX",
    type: "website",
  },
};

const FAQ = [
  {
    q: "¿Cuánto cuesta recibir pedidos en línea?",
    a: "El sistema es gratis, sin mensualidad. Pago al recoger: 0% de comisión. Pago digital con Mercado Pago: 3%. Las apps de reparto cobran hasta 30% por pedido.",
  },
  {
    q: "¿Incluye repartidores?",
    a: "No — Comeleal es tu canal directo de pedidos, no una app de reparto. Funciona perfecto para recoger en mostrador, y si tienes tus propios repartidores, tú manejas la entrega.",
  },
  {
    q: "¿Cómo sé que llegó un pedido nuevo?",
    a: "Te suena una notificación en el teléfono al instante, el pedido aparece en tu panel de cocina, y el cliente además te manda la confirmación por WhatsApp con el detalle completo.",
  },
  {
    q: "¿El cliente necesita descargar algo?",
    a: "No. Tu menú abre en el navegador de su teléfono. Deja su WhatsApp para avisarle de su pedido, recibe su PIN de entrega y sus puntos se suman con su número.",
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
            Pedidos <span className="text-[#F28C38]">en línea</span> para tu restaurante — sin apps de reparto
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-[17px] leading-relaxed text-[#1C2526]/70">
            Tu propio menú en línea en comeleal.com: el cliente arma su pedido desde su teléfono, tú recibes la alerta al instante y cobras <b>sin regalarle el 30% a nadie.</b>
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
            Tu canal directo, no el de las apps
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-[15px] leading-relaxed text-white/60">
            En las apps de reparto el cliente es de la app — pagas hasta 30% por pedido y no te dejan ni su número. Con tu menú en línea de Comeleal el pedido es tuyo: 0% en pago al recoger, 3% en digital, y cada pedido suma puntos que hacen volver al cliente. El cliente es tuyo, el canal es tuyo, el margen es tuyo.
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
                t: "El cliente pide desde tu menú web",
                d: "Entra por tu QR, tu link o Google, arma su carrito con fotos y precios y elige cómo pagar: al recoger o en línea con Mercado Pago.",
              },
              {
                n: "2",
                t: "Te llega la alerta al instante",
                d: "Suena la notificación en tu teléfono y el pedido aparece completo en tu panel de cocina — y el cliente te lo confirma por WhatsApp con todo el detalle.",
              },
              {
                n: "3",
                t: "Entregas con PIN y sumas puntos",
                d: "Cada pedido lleva un PIN de entrega para cero confusiones, el recibo va por WhatsApp y los puntos del cliente se suman automáticamente.",
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
            <Link href="/pedidos-whatsapp-restaurantes" className="text-[13px] font-semibold text-[#F28C38] underline underline-offset-4">Pedidos por WhatsApp sin comisiones →</Link>
            <Link href="/punto-de-venta-gratis-restaurantes" className="text-[13px] font-semibold text-[#F28C38] underline underline-offset-4">Punto de venta gratis →</Link>
            <Link href="/clientes-que-regresan" className="text-[13px] font-semibold text-[#F28C38] underline underline-offset-4">¿Cómo hacer que tus clientes regresen? →</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
