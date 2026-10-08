import type { Metadata } from "next";
import Link from "next/link";
import { WhatsAppButton } from "@/components/marketing/WhatsAppLeadButton";
import {
  PUBLIC_WHATSAPP_DISPLAY,
} from "@/lib/contactEmail";

export const metadata: Metadata = {
  title: "Inteligencia artificial para restaurantes: te dice a quién escribirle hoy",
  description: "IA para tu restaurante: detecta clientes que dejaron de venir, le recuerda solo a quien tiene la app, te escribe el WhatsApp para los demás, te dice tu siguiente movimiento y te muestra cuántos clientes regresaron y cuánto dejaron. Gratis para empezar.",
  alternates: { canonical: "/inteligencia-artificial-para-restaurantes" },
  openGraph: {
    title: "Inteligencia artificial para restaurantes: te dice a quién escribirle hoy",
    description: "IA para tu restaurante: detecta clientes que dejaron de venir, le recuerda solo a quien tiene la app, te escribe el WhatsApp para los demás, te dice tu siguiente movimiento y te muestra cuántos clientes regresaron y cuánto dejaron. Gratis para empezar.",
    locale: "es_MX",
    type: "website",
  },
};

const FAQ = [
  {
    q: "¿Qué hace exactamente la IA de Comeleal?",
    a: "Ve qué clientes llevan tiempo sin volver, manda recordatorios automáticos a usuarios de la app y te escribe el WhatsApp para los demás, que tú mandas. También te dice cada día qué hacer primero, te sugiere premios para tu menú y puede pasar tu carta a digital desde una foto.",
  },
  {
    q: "¿Necesito saber de tecnología?",
    a: "No. La IA hace las cuentas y te habla en español claro: “tienes 2 clientes con WhatsApp que no han vuelto, escríbeles hoy”. Tú decides y tú mandas cada mensaje.",
  },
  {
    q: "¿La IA manda mensajes sin mi permiso?",
    a: "Las notificaciones a usuarios de la app son automáticas (recordatorios de premios y de regreso). Los mensajes de WhatsApp los mandas tú. La IA te dice a quién y te escribe el texto, y tú lo lees y lo mandas.",
  },
  {
    q: "¿Cuánto cuesta la IA?",
    a: "Nada. Viene incluida gratis con Comeleal, junto con el menú QR, los pedidos en línea y el punto de venta. Otras plataformas cobran desde $749 MXN al mes y su IA es un extra de pago.",
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
            Inteligencia artificial para tu restaurante: <span className="text-[#F28C38]">te dice a quién escribirle hoy y te deja el mensaje escrito</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-[17px] leading-relaxed text-[#1C2526]/70">
            La IA de Comeleal revisa tu negocio mientras tú cocinas. Ve quién dejó de venir, le recuerda solo a quien tiene la app y te escribe el WhatsApp para los demás. Cada día te dice <b>cuál es tu siguiente movimiento</b> y te enseña los resultados en pesos.
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
            Te dice qué hacer y te deja el trabajo listo
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-[15px] leading-relaxed text-white/60">
            Otras plataformas te dan gráficas para que tú adivines. La IA de Comeleal manda los recordatorios a quien tiene la app y te escribe los mensajes de WhatsApp para los demás, que tú mandas. También sugiere premios para tus platillos y pasa tu menú a digital desde una foto. Y en el panel ves cuántos mensajes mandaste, cuántos clientes regresaron y cuánto dejaron. Todo incluido gratis.
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
                t: "Detecta quién se está enfriando",
                d: "La IA revisa las visitas de tus clientes. Cuando alguien lleva 14 días sin volver, a quien tiene la app le llega un aviso automático. Para los demás te dice a quién escribirle por WhatsApp, con el mensaje ya escrito. Tú lo lees y lo mandas.",
              },
              {
                n: "2",
                t: "Te dice tu siguiente movimiento",
                d: "Cada día tu panel te muestra UNA acción clara: a quién recuperar, qué recompensa activar, qué número capturar. Nada de estudiar gráficas. La IA hace las cuentas y te da la jugada.",
              },
              {
                n: "3",
                t: "Te muestra el dinero que regresó",
                d: "El panel te dice cuántos mensajes mandaste, cuántos clientes regresaron y cuántos pesos dejaron. Si no te está haciendo ganar dinero, lo ves. Y si sí, también.",
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
            <Link href="/programa-de-lealtad-para-restaurantes" className="text-[13px] font-semibold text-[#F28C38] underline underline-offset-4">Programa de lealtad para restaurantes →</Link>
            <Link href="/punto-de-venta-gratis-restaurantes" className="text-[13px] font-semibold text-[#F28C38] underline underline-offset-4">Punto de venta gratis →</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
