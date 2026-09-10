import type { Metadata } from "next";
import Link from "next/link";
import { WhatsAppButton } from "@/components/marketing/WhatsAppLeadButton";
import { PUBLIC_WHATSAPP_DISPLAY } from "@/lib/contactEmail";
import { PRO_PRICE_LABEL } from "@/lib/subscription/pricing";

// 10-sep-2026: la página de comparación. MenuBot y Poster tienen la suya y se
// ponen primero; la nuestra es honesta a propósito (dice para quién es cada
// una) porque el dueño que llega buscando "mejores apps de menú" ya vio dos
// más y huele el humo. Precios y funciones vistos con las manos el 10-sep-2026
// (competitive/2026-09-10-*.md en el repo de la app). Actualizar la fecha de
// abajo cada vez que se revisen.

const REVISADO = "10 de septiembre de 2026";

export const metadata: Metadata = {
  title: "Las mejores apps de menú digital para restaurantes en México (2026)",
  description:
    "Comparamos Comeleal, MenuBot, Poster QR y Maspedidos con las manos: precio del menú QR, fotos, pedidos por WhatsApp, puntos para que el cliente regrese y caja. Para quién es cada una.",
  alternates: { canonical: "/mejores-apps-menu-digital-restaurantes" },
  openGraph: {
    title: "Las mejores apps de menú digital para restaurantes en México (2026)",
    description:
      "Comparamos Comeleal, MenuBot, Poster QR y Maspedidos con las manos: precio del menú QR, fotos, pedidos por WhatsApp, puntos para que el cliente regrese y caja. Para quién es cada una.",
    locale: "es_MX",
    type: "article",
  },
};

type Row = {
  app: string;
  menu: string;
  fotos: string;
  pedidos: string;
  cliente: string;
  horario: string;
  caja: string;
};

const ROWS: Row[] = [
  {
    app: "Comeleal",
    menu: "Gratis",
    fotos: "Gratis",
    pedidos: "Gratis, te llegan a tu WhatsApp",
    cliente: "Sí: cada venta deja el teléfono y el cliente ve sus puntos, también si paga en efectivo",
    horario: "Sí, por categoría (tu especial del sábado solo sale el sábado)",
    caja: `Gratis. Pro ${PRO_PRICE_LABEL}/mes para historial de más de 30 días, segundo cajero y cuentas de mesa`,
  },
  {
    app: "MenuBot",
    menu: "Gratis sin fotos",
    fotos: "$99/mes",
    pedidos: "$99/mes, a tu WhatsApp",
    cliente: "No: el pedido pide solo el nombre, sin puntos",
    horario: "No",
    caja: "No tiene",
  },
  {
    app: "Poster QR",
    menu: "$133/mes y solo se mira",
    fotos: "Incluidas",
    pedidos: "$361/mes más 2.9% por pago con tarjeta; necesitas su punto de venta desde $495/mes",
    cliente: "A medias: el cajero busca al cliente en la caja; el cliente no ve sus puntos",
    horario: "No",
    caja: "Sí, completa, con inventario y recetas (desde $495/mes)",
  },
  {
    app: "Maspedidos",
    menu: "Desde $299/mes",
    fotos: "Incluidas",
    pedidos: "Incluidos, a tu WhatsApp (100 al mes en el plan básico)",
    cliente: "No: guarda el teléfono pero no hace nada con él",
    horario: "No",
    caja: "Sí, con cocina y meseros (desde $299/mes)",
  },
];

const COLS: { key: keyof Row; label: string }[] = [
  { key: "menu", label: "Menú con QR" },
  { key: "fotos", label: "Fotos de platillos" },
  { key: "pedidos", label: "Pedidos por WhatsApp" },
  { key: "cliente", label: "¿Sabes quién te compró?" },
  { key: "horario", label: "Horario por categoría" },
  { key: "caja", label: "Caja" },
];

const PARA_QUIEN = [
  {
    app: "MenuBot",
    t: "Si solo quieres un menú bonito y ya",
    d: "Está hecho en Chihuahua por un solo programador y el menú se ve bien. Le falta lo que hace que el cliente regrese: no pide teléfono, no da puntos y no sabe tu horario. Las fotos y el carrito cuestan $99 al mes.",
  },
  {
    app: "Poster QR",
    t: "Si ya usas Poster para inventario y nómina",
    d: "Poster es un punto de venta serio, con recetas, cocina y nómina. Su menú QR es un agregado de $133 al mes que solo se mira. Para que el cliente pida hay que pagar otro agregado de $361 al mes. Si no eres cliente de Poster, no tiene sentido.",
  },
  {
    app: "Maspedidos",
    t: "Si quieres caja con cocina y meseros y no te importa la lealtad",
    d: "Menú, pedido a WhatsApp, caja, pantalla de cocina y comandero para meseros desde $299 al mes con 14 días gratis. Guarda el teléfono del cliente en el pedido pero no le da puntos ni te dice quién regresó.",
  },
  {
    app: "Comeleal",
    t: "Si quieres que cada venta te deje el teléfono del cliente y que regrese",
    d: "Menú con fotos, QR, pedidos por WhatsApp, caja y puntos, gratis para empezar. El cliente junta puntos con su número, también cuando paga en efectivo, y tú ves quién volvió y quién se está perdiendo. Hecho en Chihuahua.",
  },
];

const FAQ = [
  {
    q: "¿Cuál es la mejor app de menú digital gratis para restaurantes?",
    a: "Depende de qué quieras. Si solo quieres el menú con QR, MenuBot y Comeleal lo dan gratis; MenuBot cobra $99 al mes por fotos y pedidos, Comeleal no. Si además quieres que el pedido te deje el teléfono del cliente y que junte puntos, hoy solo Comeleal lo hace gratis.",
  },
  {
    q: "¿Cuánto cuesta un menú digital con QR en México?",
    a: `Vimos los precios el ${REVISADO}: gratis en Comeleal y en MenuBot (sin fotos), $99 al mes en MenuBot con fotos y pedidos, $133 al mes en Poster QR solo para ver el menú, y desde $299 al mes en Maspedidos con caja incluida.`,
  },
  {
    q: "¿Necesito un punto de venta para tener menú QR?",
    a: "No. Con Comeleal, MenuBot o Maspedidos el menú vive en un link y tus clientes lo abren con la cámara del teléfono. Poster QR sí necesita que uses su punto de venta, que empieza en $495 al mes.",
  },
  {
    q: "¿Qué diferencia hay entre un menú QR y pedidos por WhatsApp?",
    a: "El menú QR solo se ve. Los pedidos por WhatsApp dejan que el cliente arme su pedido desde el menú y te llegue como mensaje a tu WhatsApp. Poster QR solo tiene lo primero; MenuBot cobra $99 al mes por lo segundo; Comeleal y Maspedidos lo incluyen.",
  },
  {
    q: "¿Por qué importa que el pedido deje el teléfono del cliente?",
    a: "Porque sin teléfono no sabes quién te compró ni puedes hacer que regrese. Con el número, el cliente junta puntos, ve sus premios y tú puedes escribirle por WhatsApp cuando lleva semanas sin venir.",
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

export default function Page() {
  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#1C2526]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <section className="px-5 pb-12 pt-14 sm:pt-20">
        <div className="mx-auto max-w-3xl text-center">
          <p className="mb-4 inline-block rounded-full border border-[#F28C38]/30 bg-[#F28C38]/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#F28C38]">
            Comparación honesta · revisada el {REVISADO}
          </p>
          <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            Las mejores apps de <span className="text-[#F28C38]">menú digital</span> para restaurantes en México
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-[17px] leading-relaxed text-[#1C2526]/70">
            Probamos cuatro con las manos: abrimos el menú, armamos un pedido y vimos qué pasa con el cliente después. Aquí está lo que cobra cada una y para quién sirve. Sí, nosotros somos una de las cuatro, por eso te decimos también cuándo <b>no</b> somos la mejor opción.
          </p>
        </div>
      </section>

      <section className="px-5 pb-14">
        <div className="mx-auto max-w-5xl overflow-x-auto rounded-2xl bg-white" style={{ border: "1px solid rgba(28,37,38,0.08)" }}>
          <table className="w-full min-w-[760px] border-collapse text-left text-[14px]">
            <thead>
              <tr className="bg-[#1C2526] text-white">
                <th className="px-4 py-3 font-bold">App</th>
                {COLS.map((c) => (
                  <th key={c.key} className="px-4 py-3 font-bold">{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r) => (
                <tr key={r.app} className="align-top odd:bg-white even:bg-[#FAF7F2]">
                  <td className="px-4 py-3 font-bold">{r.app}</td>
                  {COLS.map((c) => (
                    <td key={c.key} className="px-4 py-3 leading-relaxed text-[#1C2526]/75">{r[c.key]}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mx-auto mt-3 max-w-5xl text-[12px] text-[#1C2526]/45">
          Precios en pesos mexicanos, sin IVA, tal como aparecen en los sitios de cada app el {REVISADO}. Si algo cambió, escríbenos y lo corregimos.
        </p>
      </section>

      <section className="px-5 py-14" style={{ background: "#fff" }}>
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">
            Para quién es cada una
          </h2>
          <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
            {PARA_QUIEN.map((p) => (
              <div
                key={p.app}
                className="rounded-2xl bg-[#FAF7F2] p-6"
                style={{ border: "1px solid rgba(28,37,38,0.07)" }}
              >
                <p className="text-[12px] font-semibold uppercase tracking-wide text-[#F28C38]">{p.app}</p>
                <h3 className="mt-2 text-lg font-bold">{p.t}</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-[#1C2526]/65">{p.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 py-14" style={{ background: "#1C2526" }}>
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            El menú es lo fácil. Lo difícil es que regresen.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-[15px] leading-relaxed text-white/60">
            Las cuatro te hacen un menú bonito. Solo una te deja el teléfono del cliente en cada venta, incluida la de mostrador en efectivo, y le da puntos para que vuelva. Por eso Comeleal regala el menú: el negocio no es el menú, es el cliente que regresa.
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
                <p className="mt-2 text-[14px] leading-relaxed text-[#1C2526]/65">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 pb-20">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-2xl font-bold tracking-tight">
            Sube la foto de tu menú y míralo en 1 minuto
          </h2>
          <p className="mt-3 text-[14px] text-[#1C2526]/60">
            Gratis para empezar. Sin tarjeta. Si no te gusta, no pasa nada.
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
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
          <div className="mt-8 flex flex-col items-center gap-2 sm:flex-row sm:justify-center sm:gap-6">
            <Link href="/menu-qr-gratis-restaurantes" className="text-[13px] font-semibold text-[#F28C38] underline underline-offset-4">Menú digital QR gratis →</Link>
            <Link href="/pedidos-whatsapp-restaurantes" className="text-[13px] font-semibold text-[#F28C38] underline underline-offset-4">Pedidos por WhatsApp sin comisiones →</Link>
            <Link href="/precios" className="text-[13px] font-semibold text-[#F28C38] underline underline-offset-4">Precios de Comeleal →</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
