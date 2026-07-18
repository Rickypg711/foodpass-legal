import type { Metadata } from "next";
import Link from "next/link";
import { WhatsAppButton } from "@/components/marketing/WhatsAppLeadButton";
import {
  PUBLIC_WHATSAPP_DISPLAY,
} from "@/lib/contactEmail";

export const metadata: Metadata = {
  title: "Inteligencia artificial para restaurantes — el empleado que no duerme",
  description: "IA para tu restaurante: detecta clientes que dejaron de venir, manda recordatorios automáticos, te dice tu siguiente movimiento y te muestra cuántos clientes y pesos te regresó. Gratis.",
  alternates: { canonical: "/inteligencia-artificial-para-restaurantes" },
  openGraph: {
    title: "Inteligencia artificial para restaurantes — el empleado que no duerme",
    description: "IA para tu restaurante: detecta clientes que dejaron de venir, manda recordatorios automáticos, te dice tu siguiente movimiento y te muestra cuántos clientes y pesos te regresó. Gratis.",
    locale: "es_MX",
    type: "website",
  },
};

const FAQ = [
  {
    q: "¿Qué hace exactamente la IA de Comeleal?",
    a: "Detecta clientes en riesgo de no volver, envía recordatorios automáticos a usuarios de la app, redacta mensajes de WhatsApp para que tú recuperes a los demás, te recomienda tu siguiente mejor acción cada día, sugiere recompensas para tu menú y puede digitalizar tu carta a partir de una foto.",
  },
  {
    q: "¿Necesito saber de tecnología?",
    a: "No. La IA trabaja sola y te habla en español claro: “tienes 2 clientes con WhatsApp que no han vuelto — contáctalos hoy”. Tú decides y ella ejecuta.",
  },
  {
    q: "¿La IA manda mensajes sin mi permiso?",
    a: "Las notificaciones a usuarios de la app son automáticas (recordatorios de premios y de regreso). Los mensajes de WhatsApp los mandas tú — la IA te dice a quién y te redacta el texto, pero el botón lo aprietas tú.",
  },
  {
    q: "¿Cuánto cuesta la IA?",
    a: "Nada — viene incluida gratis con Comeleal, junto con el menú QR, los pedidos en línea y el punto de venta. Otras plataformas cobran desde $749 MXN al mes y su IA es un extra de pago.",
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
            Inteligencia artificial para tu restaurante — <span className="text-[#F28C38]">el empleado que no duerme</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-[17px] leading-relaxed text-[#1C2526]/70">
            La IA de Comeleal vigila tu negocio mientras tú cocinas: detecta quién dejó de venir, lo trae de vuelta con recordatorios automáticos, y cada día te dice <b>cuál es tu siguiente movimiento</b> — con resultados en pesos, no en promesas.
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
            No es un chatbot — es un empleado que trabaja solo
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-[15px] leading-relaxed text-white/60">
            Mientras otras plataformas te dan gráficas para que tú adivines, la IA de Comeleal actúa: manda los recordatorios, redacta los mensajes de recuperación, sugiere recompensas para tus platillos y digitaliza tu menú de una foto. Y te rinde cuentas: “Comeleal trabajó por ti: te recuperó N clientes ≈ $X MXN”. Todo incluido gratis.
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
                d: "La IA vigila las visitas de tus clientes. Cuando alguien lleva 14 días sin volver, actúa: notificación automática a usuarios de la app, y a los de WhatsApp te dice a quién escribirle — con el mensaje ya redactado, tú solo lo mandas.",
              },
              {
                n: "2",
                t: "Te dice tu siguiente movimiento",
                d: "Cada día tu panel te muestra UNA acción clara: a quién recuperar, qué recompensa activar, qué número capturar. Nada de estudiar gráficas — la IA estudia por ti y te da la jugada.",
              },
              {
                n: "3",
                t: "Te muestra el dinero, no solo datos",
                d: "El panel te dice cuántos mensajes mandó la IA, cuántos clientes regresaron y cuántos pesos representa. Si no te está haciendo ganar dinero, lo ves — y si sí, también.",
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
