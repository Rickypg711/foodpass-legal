import type { Metadata } from "next";
import Link from "next/link";
import {
  PUBLIC_WHATSAPP_DISPLAY,
  PUBLIC_WHATSAPP_WA_ME_ACTIVATE,
} from "@/lib/contactEmail";

export const metadata: Metadata = {
  title: "¿Cómo vender más en mi restaurante? Las 3 palancas que sí funcionan",
  description: "Para vender más en tu restaurante no necesitas más publicidad: haz que tus clientes regresen, véndeles directo sin comisiones y sube el ticket promedio. Guía práctica.",
  alternates: { canonical: "/como-vender-mas-en-mi-restaurante" },
  openGraph: {
    title: "¿Cómo vender más en mi restaurante? Las 3 palancas que sí funcionan",
    description: "Para vender más en tu restaurante no necesitas más publicidad: haz que tus clientes regresen, véndeles directo sin comisiones y sube el ticket promedio. Guía práctica.",
    locale: "es_MX",
    type: "website",
  },
};

const FAQ = [
  {
    q: "¿Qué funciona mejor: publicidad o lealtad?",
    a: "La publicidad trae desconocidos una vez; la lealtad convierte a los que ya te probaron en clientes frecuentes. Lo sano es tener ambas — pero si hoy tienes que elegir una con presupuesto cero, la lealtad da retorno más rápido y medible.",
  },
  {
    q: "¿Cuánto cuesta empezar con Comeleal?",
    a: "Nada de mensualidad. Menú QR, pedidos directos, punto de venta y programa de puntos son gratis; solo los pagos digitales llevan 3%. Otras plataformas cobran desde $749 MXN al mes.",
  },
  {
    q: "¿Cómo mido si está funcionando?",
    a: "Tu panel te muestra clientes únicos, visitas, canjes y clientes en riesgo — y te dice cuántos clientes te recuperó Comeleal y cuánto dinero representa. Números, no sensaciones.",
  },
  {
    q: "¿Y si mis clientes no usan apps?",
    a: "Perfecto — Comeleal no les pide ninguna. Su número de teléfono es su tarjeta de lealtad y su WhatsApp es el canal. Así compra México.",
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
            ¿Cómo <span className="text-[#F28C38]">vender más</span> en tu restaurante?
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-[17px] leading-relaxed text-[#1C2526]/70">
            No es magia ni más publicidad. Son tres palancas: <b>que tus clientes vuelvan más seguido, que te compren directo sin comisiones, y que cada visita gaste un poco más.</b> Comeleal trabaja las tres — gratis.
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
            La venta más barata es la del cliente que ya te conoce
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-[15px] leading-relaxed text-white/60">
            Conseguir un cliente nuevo cuesta hasta 5 veces más que hacer volver a uno existente. Si tus clientes vuelven una vez más al mes y piden directo en lugar de por apps con 30% de comisión, tu venta neta sube sin gastar un peso en anuncios. Eso es exactamente lo que automatiza Comeleal.
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
                t: "Palanca 1: que regresen",
                d: "Puntos automáticos con el número de teléfono, premios ligados a tus platillos, y una IA que detecta quién dejó de venir y lo trae de vuelta con recordatorios — mientras tú cocinas.",
              },
              {
                n: "2",
                t: "Palanca 2: venta directa",
                d: "Menú QR + pedidos en línea y por WhatsApp sin comisiones de reparto. El margen que hoy le regalas a las apps se queda en tu caja.",
              },
              {
                n: "3",
                t: "Palanca 3: ticket más alto",
                d: "Sugerencias de “¿algo más?” en el momento del pedido y premios que se canjean comprando. Subir el ticket promedio 10% vale más que muchos anuncios.",
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
            <Link href="/clientes-que-regresan" className="text-[13px] font-semibold text-[#F28C38] underline underline-offset-4">¿Cómo hacer que tus clientes regresen? →</Link>
            <Link href="/pedidos-en-linea-restaurantes" className="text-[13px] font-semibold text-[#F28C38] underline underline-offset-4">Pedidos en línea sin comisiones →</Link>
            <Link href="/punto-de-venta-gratis-restaurantes" className="text-[13px] font-semibold text-[#F28C38] underline underline-offset-4">Punto de venta gratis →</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
