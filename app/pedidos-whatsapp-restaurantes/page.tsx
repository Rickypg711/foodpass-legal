import type { Metadata } from "next";
import Link from "next/link";
import {
  PUBLIC_WHATSAPP_DISPLAY,
  PUBLIC_WHATSAPP_WA_ME_ACTIVATE,
} from "@/lib/contactEmail";

export const metadata: Metadata = {
  title: "Pedidos por WhatsApp para restaurantes — sin comisiones de apps",
  description: "Recibe pedidos de tu restaurante directo en WhatsApp, sin pagar 30% a las apps de reparto. Menú QR gratis, pago al recoger y puntos de lealtad. Chihuahua.",
  alternates: { canonical: "/pedidos-whatsapp-restaurantes" },
  openGraph: {
    title: "Pedidos por WhatsApp para restaurantes — sin comisiones de apps",
    description: "Recibe pedidos de tu restaurante directo en WhatsApp, sin pagar 30% a las apps de reparto. Menú QR gratis, pago al recoger y puntos de lealtad. Chihuahua.",
    locale: "es_MX",
    type: "website",
  },
};

const FAQ = [
  {
    q: "¿Cuánto me cobra Comeleal por pedido?",
    a: "En efectivo o pago al recoger: 0%. En pagos digitales (tarjeta/Mercado Pago): 3%. Compáralo con el hasta 30% de las apps de reparto.",
  },
  {
    q: "¿Necesito repartidores?",
    a: "No es obligatorio. Puedes trabajar solo con pedidos para recoger, o usar tus propios repartidores si ya los tienes — tú decides tu esquema.",
  },
  {
    q: "¿Cómo me llegan los pedidos?",
    a: "Llegan al instante a tu panel de Comeleal con notificación sonora en tu teléfono, y el cliente te manda la confirmación por WhatsApp con el detalle completo del pedido. Sin tablets extra, sin comisiones de reparto.",
  },
  {
    q: "¿Esto reemplaza a las apps de reparto?",
    a: "Puede convivir con ellas. Muchos negocios usan las apps para alcance y Comeleal para convertir a sus clientes frecuentes en pedidos directos sin comisión.",
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
            Pedidos por <span className="text-[#F28C38]">WhatsApp</span> — deja de regalar el 30%
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-[17px] leading-relaxed text-[#1C2526]/70">
            Las apps de reparto te cobran hasta un 30% por pedido. Con Comeleal los pedidos llegan directo a tu negocio — alerta al instante en tu teléfono y el detalle por WhatsApp: <b>0% en efectivo, 3% en pago digital.</b> Tú te quedas con tu margen.
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
            Haz las cuentas de un mes
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-[15px] leading-relaxed text-white/60">
            Si vendes $20,000 MXN al mes por apps de reparto, les regalas hasta $6,000. Con pedidos directos por WhatsApp ese dinero se queda en tu caja — y además cada pedido junta puntos que hacen volver al cliente. Es tu cliente, tu canal y tu margen.
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
                t: "Comparte tu menú QR",
                d: "En tus mesas, tu mostrador, tus redes y tus estados de WhatsApp. El cliente lo abre sin descargar nada.",
              },
              {
                n: "2",
                t: "El pedido te llega al instante",
                d: "Suena la alerta en tu teléfono y ves el pedido completo en tu panel; el cliente te lo confirma por WhatsApp con platillos, cantidades y su nombre. Tú cobras al recoger o digital.",
              },
              {
                n: "3",
                t: "El cliente vuelve solo",
                d: "Su número junta puntos en cada compra y sus recompensas lo traen de regreso. La IA de Comeleal te avisa a quién escribirle y cuándo.",
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
            <Link href="/menu-qr-gratis-restaurantes" className="text-[13px] font-semibold text-[#F28C38] underline underline-offset-4">Menú QR gratis →</Link>
            <Link href="/lealtad-restaurantes-chihuahua" className="text-[13px] font-semibold text-[#F28C38] underline underline-offset-4">Programa de lealtad en Chihuahua →</Link>
            <Link href="/clientes-que-regresan" className="text-[13px] font-semibold text-[#F28C38] underline underline-offset-4">¿Cómo hacer que tus clientes regresen? →</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
