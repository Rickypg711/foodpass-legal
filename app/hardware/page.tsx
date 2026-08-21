import type { Metadata } from "next";
import Link from "next/link";
import { WhatsAppButton } from "@/components/marketing/WhatsAppLeadButton";
import { PUBLIC_WHATSAPP_DISPLAY } from "@/lib/contactEmail";

export const metadata: Metadata = {
  title: "Equipo compatible con Comeleal — no necesitas comprar nada nuevo",
  description:
    "Comeleal funciona en el celular, tablet o computadora que ya tienes. Si quieres impresora de tickets te decimos cuál sirve y cuánto cuesta — no vendemos hardware.",
  alternates: { canonical: "/hardware" },
  openGraph: {
    title: "Equipo compatible con Comeleal — no necesitas comprar nada nuevo",
    description:
      "Funciona en el celular o la tablet que ya tienes. Guía honesta de impresoras y equipo, sin vendernos nada.",
    locale: "es_MX",
    type: "website",
  },
};

const FAQ = [
  {
    q: "¿De verdad puedo empezar sin comprar nada?",
    a: "Sí. Si tienes un celular con internet, ya puedes cobrar, mandar comandas a una pantalla, cargar tu menú y acumular puntos de tus clientes. La impresora de tickets es opcional y muchos negocios empiezan sin ella.",
  },
  {
    q: "¿Ustedes venden el equipo?",
    a: "No, y es a propósito. Si vendiéramos hardware tendríamos un incentivo para recomendarte lo caro. Te decimos qué sirve, tú lo compras donde te salga mejor.",
  },
  {
    q: "¿Qué impresora me recomiendan?",
    a: "Cualquier impresora térmica de 58mm o 80mm. Las de 80mm son las de ticket normal y las de 58mm son más chicas y baratas, buenas para puestos y food trucks. Si nos dices qué negocio tienes te decimos cuál te conviene por WhatsApp.",
  },
  {
    q: "¿Necesito una computadora para el punto de venta?",
    a: "No. Comeleal corre en el navegador, así que sirve igual en celular, tablet o computadora. Muchos negocios usan una tablet en el mostrador y el celular del dueño para ver los reportes.",
  },
  {
    q: "¿Y la terminal para cobrar con tarjeta?",
    a: "Puedes seguir usando la terminal que ya tienes (Clip, Mercado Pago, la del banco) y registrar esa venta en Comeleal como pago con tarjeta. No te cobramos nada por esas ventas. El 3% solo aplica cuando el cliente paga en línea desde tu menú.",
  },
  {
    q: "¿Qué pasa si se va el internet?",
    a: "Comeleal necesita conexión. Lo más barato y lo que hace todo mundo es tener un plan de datos en el celular de la caja como respaldo. Si tu zona tiene señal mala, dinos y vemos cómo prepararte.",
  },
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

const YA_TIENES = [
  {
    t: "Tu celular",
    d: "Es todo lo que necesitas para empezar: cobrar, ver pedidos, cargar el menú y revisar tus reportes. Android o iPhone, da igual.",
  },
  {
    t: "Una tablet (si quieres)",
    d: "Cómoda para dejarla fija en el mostrador o para que la cocina vea las comandas. Cualquier tablet con navegador sirve.",
  },
  {
    t: "Tu computadora",
    d: "Para cargar el menú de golpe, revisar reportes o trabajar la caja desde el escritorio. No hay nada que instalar.",
  },
];

const OPCIONAL = [
  {
    t: "Impresora térmica 80mm",
    d: "La de ticket de toda la vida. Es la más común y la que te recomendamos si tienes local con mostrador fijo.",
    nota: "Lo más común en negocios con local",
  },
  {
    t: "Impresora térmica 58mm",
    d: "Más chica y más barata. Buena para puestos, food trucks y negocios donde el espacio importa.",
    nota: "Para puesto o food truck",
  },
  {
    t: "Rollos de papel térmico",
    d: "Del ancho de tu impresora (58mm u 80mm). Se consiguen en cualquier papelería o tienda de artículos de oficina.",
    nota: "Consumible",
  },
  {
    t: "Adaptador USB-C",
    d: "Si vas a imprimir desde un celular o tablet Android conectando la impresora por cable.",
    nota: "Solo si imprimes desde Android",
  },
  {
    t: "Base para tablet o celular",
    d: "Para dejar la caja fija en el mostrador o en la barra y que no ande de un lado a otro.",
    nota: "Comodidad",
  },
  {
    t: "Cajón de dinero",
    d: "Si manejas mucho efectivo y quieres tenerlo ordenado y bajo llave. Nada del otro mundo.",
    nota: "Si manejas mucho efectivo",
  },
];

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
            Guía honesta de equipo
          </p>
          <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            No necesitas comprar <span className="text-[#F28C38]">nada nuevo</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-[17px] leading-relaxed text-[#1C2526]/70">
            Comeleal corre en el navegador del celular, la tablet o la
            computadora que ya tienes. <b>Nosotros no vendemos hardware</b>, así
            que aquí no hay nada que empujarte: solo qué sirve, cuándo lo
            necesitas de verdad y cuándo no.
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

      <section className="px-5 py-14" style={{ background: "#1C2526" }}>
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            La objeción de siempre: &ldquo;es que tendría que comprar equipo&rdquo;
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-[15px] leading-relaxed text-white/60">
            Los sistemas de punto de venta tradicionales te venden el paquete
            completo: la computadora, la impresora, el cajón, la instalación y el
            técnico. Entre $8,000 y $25,000 pesos antes de vender el primer taco.
            Comeleal no funciona así porque no lo necesita: es un sistema en la
            nube, entra por el navegador y no instala nada. El equipo que ya
            traes en la bolsa alcanza para empezar hoy.
          </p>
        </div>
      </section>

      <section className="px-5 py-14">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">
            Con esto ya puedes trabajar
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-[15px] text-[#1C2526]/60">
            Cualquiera de estos, uno solo, basta.
          </p>
          <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
            {YA_TIENES.map((x) => (
              <div
                key={x.t}
                className="rounded-2xl bg-white p-6"
                style={{
                  border: "1px solid rgba(28,37,38,0.07)",
                  boxShadow: "0 2px 10px rgba(28,37,38,0.04)",
                }}
              >
                <span className="text-[11px] font-bold uppercase tracking-widest text-[#16A34A]">
                  Ya lo tienes
                </span>
                <h3 className="mt-2 text-lg font-bold">{x.t}</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-[#1C2526]/60">
                  {x.d}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 py-14" style={{ background: "#ffffff" }}>
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">
            Opcional — solo si lo necesitas
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-[15px] text-[#1C2526]/60">
            Nada de esto es obligatorio para arrancar. Cómpralo donde te salga
            más barato: no tenemos comisión ni convenio con ninguna marca.
          </p>
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
            {OPCIONAL.map((x) => (
              <div
                key={x.t}
                className="rounded-2xl p-6"
                style={{
                  background: "#FAF7F2",
                  border: "1px solid rgba(28,37,38,0.07)",
                }}
              >
                <span className="text-[11px] font-bold uppercase tracking-widest text-[#F28C38]">
                  {x.nota}
                </span>
                <h3 className="mt-2 text-[16px] font-bold">{x.t}</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-[#1C2526]/60">
                  {x.d}
                </p>
              </div>
            ))}
          </div>
          <p className="mx-auto mt-8 max-w-2xl text-center text-[14px] leading-relaxed text-[#1C2526]/55">
            ¿No sabes cuál te conviene? Mándanos un WhatsApp diciéndonos qué
            negocio tienes y te decimos exactamente qué comprar —{" "}
            <b>y qué no comprar</b>.
          </p>
        </div>
      </section>

      <section className="px-5 pb-16 pt-14">
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
                <p className="mt-2 text-[14px] leading-relaxed text-[#1C2526]/65">
                  {f.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 pb-20">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-2xl font-bold tracking-tight">
            Empieza con lo que ya tienes
          </h2>
          <div className="mt-6 flex justify-center">
            <WhatsAppButton />
          </div>
          <div className="mt-8 flex flex-col items-center gap-2 sm:flex-row sm:justify-center sm:gap-6">
            <Link href="/software-para-restaurantes" className="text-[13px] font-semibold text-[#F28C38] underline underline-offset-4">Software por tipo de negocio →</Link>
            <Link href="/punto-de-venta-gratis-restaurantes" className="text-[13px] font-semibold text-[#F28C38] underline underline-offset-4">Punto de venta gratis →</Link>
            <Link href="/precios" className="text-[13px] font-semibold text-[#F28C38] underline underline-offset-4">Precios →</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
