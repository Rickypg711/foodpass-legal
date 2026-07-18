import type { Metadata } from "next";
import Link from "next/link";
import {
  PUBLIC_WHATSAPP_DISPLAY,
  PUBLIC_WHATSAPP_WA_ME_ACTIVATE,
} from "@/lib/contactEmail";

export const metadata: Metadata = {
  title: "Menú QR gratis para restaurantes — con pedidos por WhatsApp",
  description: "Crea el menú digital QR de tu restaurante gratis: fotos, precios, pedidos por WhatsApp y programa de puntos incluido. Sin mensualidad. Hecho en Chihuahua.",
  alternates: { canonical: "/menu-qr-gratis-restaurantes" },
  openGraph: {
    title: "Menú QR gratis para restaurantes — con pedidos por WhatsApp",
    description: "Crea el menú digital QR de tu restaurante gratis: fotos, precios, pedidos por WhatsApp y programa de puntos incluido. Sin mensualidad. Hecho en Chihuahua.",
    locale: "es_MX",
    type: "website",
  },
};

const FAQ = [
  {
    q: "¿De verdad es gratis el menú QR?",
    a: "Sí. El menú digital, el código QR, los pedidos por WhatsApp y el programa de puntos no tienen mensualidad. Comeleal solo cobra 3% en pagos digitales; en efectivo no cobramos nada.",
  },
  {
    q: "¿Qué necesito para empezar?",
    a: "Solo tu menú (fotos y precios) y un WhatsApp. Te lo dejamos funcionando en unos 10 minutos — en Chihuahua podemos ir en persona a tu negocio.",
  },
  {
    q: "¿Mis clientes necesitan descargar una app?",
    a: "No. Escanean el QR, ven tu menú en el navegador y piden por WhatsApp. Sus puntos se juntan con su número de teléfono.",
  },
  {
    q: "¿Puedo actualizar precios y platillos?",
    a: "Sí, cuando quieras desde tu panel — los cambios se ven al instante en el QR que ya imprimiste, sin reimprimir nada.",
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
            Menú QR <span className="text-[#F28C38]">gratis</span> para tu restaurante
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-[17px] leading-relaxed text-[#1C2526]/70">
            Tu menú digital con fotos y precios, un QR para imprimir y pedidos directos por WhatsApp. <b>Sin mensualidad, sin comisión en efectivo.</b> Listo en 10 minutos.
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
            Gratis de verdad — no “gratis por 14 días”
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-[15px] leading-relaxed text-white/60">
            El menú QR, los pedidos por WhatsApp y el programa de puntos no cuestan mensualidad. Solo pagamos nosotros cuando tú cobras digital (3%); en efectivo, 0%. Compáralo: otras plataformas cobran desde $749 MXN al mes por lo mismo.
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
                t: "Nos mandas tu menú",
                d: "Fotos, platillos y precios por WhatsApp. Nosotros lo subimos y te entregamos tu página en comeleal.com con tu QR listo para imprimir.",
              },
              {
                n: "2",
                t: "Tus clientes escanean y piden",
                d: "Ven el menú en su teléfono, arman su pedido y te llega directo a tu WhatsApp — sin apps de por medio, sin comisiones de reparto.",
              },
              {
                n: "3",
                t: "Cada venta junta puntos",
                d: "El número de teléfono de tu cliente es su tarjeta de lealtad. Sus puntos se acumulan solos y las recompensas lo hacen volver.",
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
            <Link href="/pedidos-whatsapp-restaurantes" className="text-[13px] font-semibold text-[#F28C38] underline underline-offset-4">Pedidos por WhatsApp sin comisiones →</Link>
            <Link href="/clientes-que-regresan" className="text-[13px] font-semibold text-[#F28C38] underline underline-offset-4">¿Cómo hacer que tus clientes regresen? →</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
