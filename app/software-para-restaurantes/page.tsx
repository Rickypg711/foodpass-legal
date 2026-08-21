import type { Metadata } from "next";
import Link from "next/link";
import { WhatsAppButton } from "@/components/marketing/WhatsAppLeadButton";
import { PUBLIC_WHATSAPP_DISPLAY } from "@/lib/contactEmail";
import { VERTICALES } from "@/lib/marketing/verticals";

export const metadata: Metadata = {
  title: "Software para restaurantes en México — punto de venta gratis | Comeleal",
  description:
    "Software para restaurantes sin mensualidad: punto de venta, menú QR, pedidos en línea y programa de lealtad. Elige tu tipo de negocio — taquerías, pizzerías, cafeterías, bares, food trucks y más.",
  alternates: { canonical: "/software-para-restaurantes" },
  openGraph: {
    title: "Software para restaurantes en México — punto de venta gratis | Comeleal",
    description:
      "Punto de venta, menú QR, pedidos y lealtad. Gratis para operar, sin mensualidad. Elige tu tipo de negocio.",
    locale: "es_MX",
    type: "website",
  },
};

export default function Page() {
  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#1C2526]">
      <section className="px-5 pb-14 pt-14 sm:pt-20">
        <div className="mx-auto max-w-3xl text-center">
          <p className="mb-4 inline-block rounded-full border border-[#F28C38]/30 bg-[#F28C38]/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#F28C38]">
            Hecho en Chihuahua 🇲🇽
          </p>
          <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            Software para <span className="text-[#F28C38]">restaurantes</span> que
            opera gratis
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-[17px] leading-relaxed text-[#1C2526]/70">
            Punto de venta, menú QR, pedidos en línea, tus clientes y tus
            reportes: <b>gratis para siempre, sin mensualidad</b>. Lo que cobramos
            es la máquina que hace que tus clientes regresen — y esa la pruebas 14
            días sin tarjeta.
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
            Se crea en menos de 3 minutos · sin tarjeta · WhatsApp {PUBLIC_WHATSAPP_DISPLAY}
          </p>
        </div>
      </section>

      <section className="px-5 pb-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">
            ¿Qué tipo de negocio tienes?
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-[15px] leading-relaxed text-[#1C2526]/60">
            Cada negocio pierde dinero de una forma distinta. Entra al tuyo y te
            decimos exactamente cómo se arregla.
          </p>
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
            {VERTICALES.map((v) => (
              <Link
                key={v.slug}
                href={`/software-para-restaurantes/${v.slug}`}
                className="rounded-2xl bg-white p-5 transition-all hover:shadow-md"
                style={{ border: "1px solid rgba(28,37,38,0.08)" }}
              >
                <span className="text-2xl">{v.emoji}</span>
                <h3 className="mt-2 text-[16px] font-bold capitalize">{v.nombre}</h3>
                <p className="mt-1 text-[13px] font-semibold text-[#F28C38]">
                  Ver cómo →
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 py-14" style={{ background: "#1C2526" }}>
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Lo que en otras plataformas cuesta $749 al mes, aquí es gratis
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-[15px] leading-relaxed text-white/60">
            Cobrar, tu menú, tus pedidos, tus clientes y tus reportes no cuestan
            nada y nunca van a costar: son lo que necesitas para operar. Solo los
            pagos digitales en línea llevan 3% — en efectivo y con tu terminal de
            siempre, 0%. Cobramos $299 al mes por lo que sí nos cuesta a nosotros:
            los mensajes de WhatsApp que recuperan a tus clientes y la AI.
          </p>
          <div className="mt-7 flex justify-center">
            <Link
              href="/precios"
              className="inline-flex items-center justify-center rounded-2xl bg-[#F28C38] px-7 py-4 text-[15px] font-bold text-white transition-all hover:opacity-90"
            >
              Ver precios completos →
            </Link>
          </div>
        </div>
      </section>

      <section className="px-5 py-16">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-2xl font-bold tracking-tight">
            ¿No ves tu tipo de negocio?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-[15px] leading-relaxed text-[#1C2526]/60">
            Comeleal funciona igual para loncherías, rosticerías, cocinas
            económicas, heladerías y cualquier negocio que venda de comer.
            Escríbenos y te lo dejamos configurado hoy.
          </p>
          <div className="mt-6 flex justify-center">
            <WhatsAppButton />
          </div>
          <div className="mt-8 flex flex-col items-center gap-2 sm:flex-row sm:justify-center sm:gap-6">
            <Link href="/punto-de-venta-gratis-restaurantes" className="text-[13px] font-semibold text-[#F28C38] underline underline-offset-4">Punto de venta gratis →</Link>
            <Link href="/menu-qr-gratis-restaurantes" className="text-[13px] font-semibold text-[#F28C38] underline underline-offset-4">Menú QR gratis →</Link>
            <Link href="/hardware" className="text-[13px] font-semibold text-[#F28C38] underline underline-offset-4">Equipo compatible →</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
