/**
 * Plantilla ÚNICA de las landings por vertical (/software-para-restaurantes/{slug}).
 *
 * Las 13 páginas SEO viejas duplican el markup una por una. Aquí no: los datos
 * viven en lib/marketing/verticals.ts y el markup vive aquí, una sola vez.
 * Agregar una vertical nueva = una entrada en el array. Nada más.
 *
 * Incluye dos robos del teardown de Maspedidos (6 ago 2026) que van en TODAS
 * las verticales:
 *   · el mensaje "corte de caja a prueba de faltantes" (el miedo al robo del
 *     empleado es lo que vende POS en México; nosotros ya teníamos la feature
 *     completa —PIN, soldBy, arqueo— y no lo estábamos diciendo)
 *   · "no necesitas comprar equipo" con liga a /hardware (desarma la objeción #1
 *     del restaurantero tradicional)
 */

import Link from "next/link";
import { WhatsAppButton } from "@/components/marketing/WhatsAppLeadButton";
import { PUBLIC_WHATSAPP_DISPLAY } from "@/lib/contactEmail";
import { FAQ_COMUN, VERTICALES, type Vertical } from "@/lib/marketing/verticals";

export function VerticalLanding({ v }: { v: Vertical }) {
  const faq = [...v.faq, ...FAQ_COMUN];
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  // Otras 3 verticales para interlinking (el cluster se cita a sí mismo).
  const otras = VERTICALES.filter((o) => o.slug !== v.slug).slice(0, 3);

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#1C2526]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      {/* ── Hero ── */}
      <section className="px-5 pb-14 pt-14 sm:pt-20">
        <div className="mx-auto max-w-3xl text-center">
          <p className="mb-4 inline-block rounded-full border border-[#F28C38]/30 bg-[#F28C38]/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#F28C38]">
            {v.emoji} Hecho en Chihuahua 🇲🇽
          </p>
          <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            {v.h1pre}
            <span className="text-[#F28C38]">{v.h1kw}</span>
            {v.h1post}
          </h1>
          <p
            className="mx-auto mt-5 max-w-2xl text-[17px] leading-relaxed text-[#1C2526]/70"
            dangerouslySetInnerHTML={{ __html: v.heroP }}
          />
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
            Se crea en menos de 3 minutos · sin tarjeta · WhatsApp {PUBLIC_WHATSAPP_DISPLAY}
          </p>
        </div>
      </section>

      {/* ── El dolor de la vertical + ancla de precio ── */}
      <section className="px-5 py-14" style={{ background: "#1C2526" }}>
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            {v.dolorH2}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-[15px] leading-relaxed text-white/60">
            {v.dolorP}
          </p>
        </div>
      </section>

      {/* ── 6 razones concretas ── */}
      <section className="px-5 py-14">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">
            Lo que Comeleal hace por {v.posesivo}
          </h2>
          <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
            {v.razones.map((r) => (
              <div
                key={r.t}
                className="rounded-2xl bg-white p-6"
                style={{
                  border: "1px solid rgba(28,37,38,0.07)",
                  boxShadow: "0 2px 10px rgba(28,37,38,0.04)",
                }}
              >
                <h3 className="text-[16px] font-bold leading-snug">{r.t}</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-[#1C2526]/60">
                  {r.d}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ROBO: "corte de caja a prueba de faltantes" ── */}
      <section className="px-5 py-14" style={{ background: "#ffffff" }}>
        <div className="mx-auto max-w-3xl">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Tu caja, a prueba de faltantes
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-[#1C2526]/70">
            La razón número uno por la que un dueño en México pone un sistema no
            es vender más: es dejar de perder dinero sin saber por dónde. En
            Comeleal cada venta queda con el nombre de quien la cobró, cada
            descuento y cada cortesía quedan registrados, y al cerrar el día el
            sistema te dice cuánto <b>debería</b> haber en efectivo. Si no
            cuadra, no adivinas: ves el turno, el empleado y la venta.
          </p>
          <ul className="mt-6 space-y-3">
            {[
              "Cada empleado cobra con su PIN — toda venta lleva su nombre",
              "Corte de caja con arqueo: lo esperado contra lo contado",
              "Descuentos y cortesías auditados en Reportes, uno por uno",
              "Ventas por empleado y por turno, sin preguntarle a nadie",
              "La jornada cierra a las 4 AM, para que la noche no se parta en dos",
            ].map((t) => (
              <li key={t} className="flex gap-3 text-[15px] leading-relaxed text-[#1C2526]/75">
                <span className="text-[#16A34A]">✓</span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── ROBO: no necesitas comprar equipo ── */}
      <section className="px-5 py-14">
        <div className="mx-auto max-w-3xl rounded-3xl bg-white p-7" style={{ border: "1px solid rgba(28,37,38,0.08)" }}>
          <h2 className="text-2xl font-bold tracking-tight">
            No necesitas comprar equipo
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-[#1C2526]/70">
            Comeleal corre en el celular, la tablet o la computadora que ya
            tienes, desde el navegador y sin instalar nada. Si quieres impresora
            de tickets o una tablet para la caja, te decimos cuáles funcionan y
            dónde salen baratas — <b>nosotros no vendemos hardware</b>, así que
            no tenemos por qué recomendarte lo caro.
          </p>
          <Link
            href="/hardware"
            className="mt-4 inline-block text-[14px] font-semibold text-[#F28C38] underline underline-offset-4"
          >
            Ver qué equipo es compatible →
          </Link>
        </div>
      </section>

      {/* ── FAQ (vertical + común) ── */}
      <section className="px-5 pb-16">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-center text-2xl font-bold tracking-tight">
            Preguntas frecuentes
          </h2>
          <div className="mt-7 space-y-3">
            {faq.map((f) => (
              <details
                key={f.q}
                className="group rounded-2xl bg-white px-5 py-4"
                style={{ border: "1px solid rgba(28,37,38,0.08)" }}
              >
                <summary className="cursor-pointer list-none text-[15px] font-bold">
                  {f.q}
                </summary>
                <p className="mt-2 text-[14px] leading-relaxed text-[#1C2526]/65">
                  {f.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA final + interlinking del cluster ── */}
      <section className="px-5 pb-20">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-2xl font-bold tracking-tight">
            Te lo dejamos funcionando hoy
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-[15px] leading-relaxed text-[#1C2526]/60">
            Operar es gratis para siempre. Si quieres la máquina completa —
            lealtad ilimitada, recuperación por WhatsApp y AI sin límite —
            pruébala <b>14 días gratis, sin tarjeta</b>.
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <WhatsAppButton />
            <Link
              href="/precios"
              className="inline-flex items-center justify-center rounded-2xl border border-[#1C2526]/15 bg-white px-7 py-4 text-[15px] font-bold text-[#1C2526] transition-all hover:shadow-md"
            >
              Ver precios →
            </Link>
          </div>
          <div className="mt-8 flex flex-col items-center gap-2 sm:flex-row sm:justify-center sm:gap-6">
            {otras.map((o) => (
              <Link
                key={o.slug}
                href={`/software-para-restaurantes/${o.slug}`}
                className="text-[13px] font-semibold text-[#F28C38] underline underline-offset-4"
              >
                Software para {o.nombre} →
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
