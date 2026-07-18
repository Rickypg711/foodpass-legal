import type { Metadata } from "next";
import Link from "next/link";
import {
  PUBLIC_WHATSAPP_DISPLAY,
  PUBLIC_WHATSAPP_WA_ME_ACTIVATE,
} from "@/lib/contactEmail";

export const metadata: Metadata = {
  title: "Punto de venta (POS) gratis para restaurantes",
  description: "Caja / punto de venta gratis para tu restaurante: cobra en segundos, cuentas abiertas, recibo por WhatsApp y puntos de lealtad automáticos. Sin mensualidad.",
  alternates: { canonical: "/punto-de-venta-gratis-restaurantes" },
  openGraph: {
    title: "Punto de venta (POS) gratis para restaurantes",
    description: "Caja / punto de venta gratis para tu restaurante: cobra en segundos, cuentas abiertas, recibo por WhatsApp y puntos de lealtad automáticos. Sin mensualidad.",
    locale: "es_MX",
    type: "website",
  },
};

const FAQ = [
  {
    q: "¿La Caja de Comeleal es gratis de verdad?",
    a: "Sí — sin mensualidad. Registrar ventas en efectivo no cuesta nada; solo los pagos digitales en línea (Mercado Pago) llevan un 3%. Otras plataformas de punto de venta cobran desde $749 MXN al mes.",
  },
  {
    q: "¿Necesito comprar equipo?",
    a: "No. La Caja funciona en el navegador de tu teléfono, tablet o computadora. Para cobros con tarjeta sigues usando la terminal que ya tienes — Comeleal registra la venta y le suma los puntos al cliente.",
  },
  {
    q: "¿Puedo manejar cuentas abiertas por mesa?",
    a: "Sí. Abres una cuenta con nombre (“Mesa 3”, “Juan”), le agregas platillos durante la visita y la cobras al final — y los puntos del cliente se aplican al cerrar.",
  },
  {
    q: "¿Cómo funciona la lealtad en la Caja?",
    a: "Al cobrar pides el número del cliente: sus puntos se suman solos y sus premios disponibles aparecen ahí mismo. Para canjear, el cliente muestra su código personal — así nadie puede usar sus puntos sin él.",
  },
  {
    q: "¿Puedo ver reportes de ventas?",
    a: "Sí — ventas del día, tus productos más vendidos y la actividad de tus clientes frecuentes, desde tu panel en cualquier dispositivo.",
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
            Punto de venta <span className="text-[#F28C38]">gratis</span> para tu restaurante
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-[17px] leading-relaxed text-[#1C2526]/70">
            La Caja de Comeleal: cobra en segundos desde tu teléfono o tablet, con cuentas abiertas, recibo por WhatsApp y lealtad integrada. <b>Sin mensualidad y sin equipos caros.</b>
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
            Otras plataformas cobran desde $749 MXN/mes por su punto de venta
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-[15px] leading-relaxed text-white/60">
            La Caja de Comeleal es gratis: registras ventas en efectivo o tarjeta, abres cuentas por mesa, mandas el recibo por WhatsApp y cada venta suma puntos de lealtad automáticamente con el número del cliente. Funciona en el teléfono que ya tienes — sin terminales especiales ni contratos.
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
                t: "Tu menú ya está cargado",
                d: "La misma carta de tu menú QR vive en la Caja: tocas los platillos, se arma el ticket. Venta rápida sin capturar precios a mano.",
              },
              {
                n: "2",
                t: "Cobra como trabajes tú",
                d: "Cobro inmediato en efectivo o tarjeta (con tu terminal de siempre), o cuenta abierta por mesa para cerrar al final. El recibo le llega al cliente por WhatsApp.",
              },
              {
                n: "3",
                t: "La lealtad va sola en cada cobro",
                d: "Pides el número del cliente al cobrar y sus puntos se suman automáticamente. Sus premios aparecen en la misma pantalla y se canjean con un código que solo el cliente tiene.",
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
            <Link href="/pedidos-whatsapp-restaurantes" className="text-[13px] font-semibold text-[#F28C38] underline underline-offset-4">Pedidos por WhatsApp sin comisiones →</Link>
            <Link href="/lealtad-restaurantes-chihuahua" className="text-[13px] font-semibold text-[#F28C38] underline underline-offset-4">Programa de lealtad en Chihuahua →</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
