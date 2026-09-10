import { PRO_PRICE_LABEL } from "@/lib/subscription/pricing";
import type { Metadata } from "next";
import Link from "next/link";
import { HomeCta } from "@/components/home/HomeCta";
import { HomeHeader } from "@/components/home/HomeHeader";
import { VendorPageAnalytics } from "@/components/vendor/VendorPageAnalytics";
import { SITE_NAME, SITE_URL, siteIcons } from "@/lib/siteMetadata";

// 10-sep-2026: título con lo que el dueño busca en Google ("menú digital",
// "QR", "gratis", "restaurante"), no con el nombre de la marca. MenuBot y
// Poster compiten por esa búsqueda; Tacos El Negro llegó por Google.
const PAGE_TITLE = "Menú digital con QR gratis para tu restaurante, en 1 minuto";
const PAGE_DESCRIPTION =
  "Tu menú de papel, digital y gratis en 1 minuto. Con QR, pedidos por WhatsApp y puntos para que tus clientes regresen, también cuando pagan en efectivo. Hecho en Chihuahua.";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    siteName: SITE_NAME,
    locale: "es_MX",
    type: "website",
    url: SITE_URL,
  },
  twitter: {
    card: "summary_large_image",
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
  },
  icons: siteIcons,
  alternates: { canonical: SITE_URL },
};


/** Números REALES de restaurantes en Comeleal, contados en Firestore el
 *  10-sep-2026 en hora de Chihuahua. Sin nombres a propósito (regla: nada de
 *  prueba social con nombre hasta ~50 locales). Los tres cuentan UNA historia,
 *  en el orden de la promesa: foto → ventas → clientes con nombre y teléfono.
 *  - 64 platillos: CENTRAL FAST FOOD (RzeRSmepS5JP0HY8kD8G) montó su menú de
 *    una foto en una tarde (4-sep); 64 docs en restaurants/{id}/menu.
 *  - 214 ventas: Pecado Escondido (d3v9krkR2YY90lrZGkjt) cobró 214 ventas
 *    (status completed + paid) en su Caja en agosto 2026; solo 1 con teléfono.
 *    Es el MISMO local del villano de abajo, a propósito: la Caja aguanta 214,
 *    sin el paso del teléfono te quedas con 1.
 *  - 10 de 10: CENTRAL FAST FOOD, primera semana con pedidos (5 al 11-sep):
 *    10 pedidos reales por el link, los 10 con nombre y teléfono. Muestra
 *    chica, pero real. Al recontar, correr scratch numeros.js (admin SDK). */
const PROOF_POINTS = [
  { figure: "64 platillos", body: "leídos de una sola foto del menú, en una tarde" },
  { figure: "214 ventas", body: "cobradas en un mes desde la Caja de un solo local" },
  { figure: "10 de 10 pedidos", body: "con nombre y teléfono en la primera semana de un local" },
] as const;

/** El villano (5-sep-2026, revisión contra Owner/Fluxsales): concreto y
 *  VERDADERO. "214 ventas, 1 teléfono" es Pecado Escondido en agosto 2026
 *  (mismo conteo que la tarjeta de arriba, 10-sep, hora de Chihuahua), sin
 *  nombre a propósito. Si cambia una cifra, cambian las dos. */
const PROBLEM_CARDS = [
  {
    title: "No sabes quién te compró",
    body: "Cobras, entregas, y el cliente se va sin nombre ni número. Un local con 214 ventas en un mes se quedó con 1 teléfono. Con 1 no traes a nadie de vuelta.",
    icon: "🧾",
  },
  {
    title: "El que no vuelve, no avisa",
    body: "Nadie te dice \"ya no vengo\". Solo dejas de verlo. Sin su número no hay forma de recordarle que existes.",
    icon: "🔄",
  },
  {
    title: "La app de reparto se queda con tu cliente",
    body: "Te cobra comisión por cada pedido y además se queda con el nombre, el número y la costumbre. El cliente es de ellos, no tuyo.",
    icon: "📉",
  },
] as const;

/** Tres cosas, en el orden en que el dueño las vive. Solo lo que existe hoy. */
const VALUE_POINTS = [
  {
    title: "Tu menú digital con QR, de una foto",
    body: "La IA lee tu menú de papel: platillos, precios, salsas y tamaños. Lo compartes por WhatsApp o lo pegas en la mesa, y tus clientes ordenan desde ahí. Sin comisión por pedido.",
  },
  {
    title: "Puntos por cada compra, también en efectivo",
    body: "El cliente deja su número al pagar y junta puntos: en mostrador, en mesa o en pedido en línea. Los ve en Apple Wallet o Google Wallet sin descargar nada.",
  },
  {
    title: "Ves quién volvió y quién se está perdiendo",
    body: "Cada venta con número te dice quién regresó. Y cuando un cliente de siempre lleva tiempo sin venir, te lo señalamos para que le escribas tú.",
  },
] as const;

const STEPS = [
  { step: "1", title: "Sube la foto de tu menú", body: "La IA lee tus platillos, precios, salsas y tamaños — y te enseña tu menú digital en ~1 minuto. Sin cuenta." },
  { step: "2", title: "Míralo y quédatelo", body: "¿Te gustó? Es tuyo gratis: creas tu cuenta en 2 taps y tu menú ya viene montado adentro." },
  { step: "3", title: "Acepta tus premios", body: "La IA te propone recompensas con TUS platillos para que tus clientes regresen. Tú solo dices que sí." },
  { step: "4", title: "Imprime tu QR y a vender", body: "Tus clientes ven tu menú, ordenan y suman puntos. Todo activo en unos 5 minutos." },
] as const;

/** Sin repetir lo de arriba. Una sola cifra de tiempo en toda la página:
 *  menú en 1 minuto, local activo en 5. */
const BENEFITS = [
  "Gratis para empezar. Sin tarjeta, sin contrato.",
  "Sin cambiar tu caja ni tu POS: funciona junto a lo que ya tienes.",
  "Un celular en el mostrador es todo lo que necesitas.",
  "Menú en 1 minuto. Local activo en 5.",
] as const;

const FAQ_ITEMS = [
  {
    q: "¿Cuánto cuesta?",
    a: `Operar es gratis: menú digital, Caja/POS, pedidos, puntos para tus clientes sin tope, tus clientes y reportes. Pro (${PRO_PRICE_LABEL}/mes) es para cuando tu Caja crece: todo tu historial de ventas, tu equipo cobra con su PIN y llevas mesas.`,
  },
  {
    q: "¿Qué es Apple Wallet / Google Wallet y cómo lo usan mis clientes?",
    a: "Tus clientes guardan su tarjeta de puntos en Apple Wallet (iPhone) o Google Wallet (Android). La próxima visita la abren sin descargar ninguna app — más rápido para ellos, más visitas para ti.",
  },
  {
    q: "¿Necesito Mercado Pago?",
    a: "No para lealtad ni menú. Sí si quieres recibir pedidos en línea pagados antes de preparar (solo para recoger en local).",
  },
  {
    q: "¿Cuánto tarda activar mi negocio?",
    a: "Menos de 5 minutos. Registras tu negocio, agregas un menú básico y activas tu primera recompensa — listo para escanear clientes el mismo día.",
  },
  {
    q: "¿Me ayudan a configurarlo?",
    a: "Sí. Te contestamos por WhatsApp y, si quieres, montamos tu menú contigo.",
  },
  {
    q: "¿Qué necesito en el mostrador?",
    a: "Un celular. Abres comeleal.com/vendor y ya puedes escanear. Nada más.",
  },
] as const;

const FOOTER_LINKS = [
  { href: "/puntos", label: "⭐ Mis puntos" },
  { href: "/support.html", label: "Soporte" },
  { href: "/privacy-policy.html", label: "Privacy Policy" },
  { href: "/terms-of-use.html", label: "Terms of Use" },
  { href: "/delete-account.html", label: "Delete Account" },
] as const;


export default function Home() {
  // Conteo vivo de restaurantes en el hero: Ricardo lo quiere hasta ~50
  // activos (5-sep: "me da pena, esperemos"). fetchPlatformStats ya existe.
  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#1C2526]">
      <VendorPageAnalytics />

      <HomeHeader />

      <main>
        {/* ── Hero ── */}
        <section className="relative overflow-hidden bg-[#141414] px-4 py-16 sm:px-6 sm:py-24 lg:py-28">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(242,140,56,0.18),transparent)]" aria-hidden />
          <div className="relative mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16">
            <div>
              <p className="mb-4 inline-block rounded-full border border-[#F28C38]/30 bg-[#F28C38]/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#F28C38]">
                Para restaurantes locales
              </p>
              <h1 className="text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl lg:text-[3.2rem] lg:leading-[1.1]">
                Tu menú de papel,{" "}
                <span className="text-[#F28C38]">digital y gratis en 1 minuto.</span>
              </h1>
              <p className="mt-4 max-w-xl text-lg leading-relaxed text-white/70 sm:text-xl">
                <span className="font-semibold text-white/90">Que te pidan, que regresen, que lo veas.</span>{" "}
                Menú con QR, pedidos por WhatsApp y puntos. Sin cambiar tu caja.
              </p>
              <HomeCta />
              {/* Robado de Last.app (10-sep-2026): "si sabes usar WhatsApp ya
                  sabes usarlo". Nivel secundaria, cero jerga, y quita el miedo
                  a "otro sistema" antes de que el dueño lo diga. */}
              <p className="mt-4 text-sm text-white/60">Si sabes mandar un WhatsApp, ya sabes usar Comeleal.</p>
              <p className="mt-2 text-xs text-white/35">Sin tarjeta de crédito · Sin contrato</p>
            </div>

            <div className="flex justify-center lg:justify-end">
              {/* El mock ES la promesa del CTA: un MENÚ digital en un
                  teléfono, recién leído del papel (decisión Ricardo, 26-ago;
                  antes era un panel de dueño avanzado). */}
              <div className="relative w-full max-w-[300px]">
                <div className="overflow-hidden rounded-[2rem] border border-white/12 bg-[#faf9f5] shadow-2xl">
                  {/* Header del menú */}
                  <div className="bg-[#1C2526] px-4 pb-3 pt-4">
                    <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-white/35">Menú digital</p>
                    <p className="mt-0.5 text-lg font-extrabold text-white">Tacos El Güero</p>
                    <span className="mt-1.5 inline-block rounded-full bg-green-500/15 px-2 py-0.5 text-[9px] font-bold text-green-400">
                      🟢 Abierto · cierra 11 pm
                    </span>
                  </div>
                  {/* Platillos */}
                  <div className="space-y-2 p-3">
                    {[
                      { name: "Taco de pastor", price: "$28", chip: null },
                      { name: "Quesadilla", price: "$45", chip: "Elige tu salsa" },
                      { name: "Torta cubana", price: "$85", chip: "Elige tamaño" },
                    ].map((it) => (
                      <div key={it.name} className="flex items-center justify-between rounded-xl bg-white p-3 shadow-sm">
                        <div>
                          <p className="text-[12px] font-bold text-[#1C2526]">{it.name}</p>
                          {it.chip && (
                            <span className="mt-0.5 inline-block rounded-full bg-[#F28C38]/12 px-1.5 py-0.5 text-[8px] font-bold text-[#B45309]">
                              {it.chip}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <p className="text-[12px] font-extrabold text-[#1C2526]">{it.price}</p>
                          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#F28C38] text-[12px] font-bold text-[#1C2526]">+</div>
                        </div>
                      </div>
                    ))}
                    <div className="rounded-xl bg-[#1C2526] px-3 py-2 text-center text-[10px] font-bold text-white">
                      🛒 Ordenar por WhatsApp
                    </div>
                  </div>
                </div>
                {/* El badge que cuenta la historia */}
                <div className="absolute -left-3 -top-3 rounded-full bg-[#F28C38] px-3 py-1.5 text-[10px] font-extrabold text-[#1C2526] shadow-lg">
                  📸 Leído de su menú de papel
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Números reales (5-sep-2026) ── Cifras de restaurantes reales en
            Comeleal, sin nombres (eso lo decide Ricardo). Regla: solo números
            que existan — jamás prometer lo que no existe. */}
        <section className="border-b border-[#1C2526]/8 bg-white px-4 py-8 sm:px-6" aria-label="Números reales">
          <ul className="mx-auto grid max-w-5xl grid-cols-1 gap-6 text-center sm:grid-cols-3">
            {PROOF_POINTS.map((p) => (
              <li key={p.figure}>
                <p className="text-3xl font-extrabold tracking-tight text-[#1C2526] sm:text-4xl">{p.figure}</p>
                <p className="mt-1 text-sm text-[#1C2526]/65">{p.body}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* ── Problem ── */}
        <section className="px-4 py-16 sm:px-6 sm:py-20" aria-labelledby="problema-heading">
          <div className="mx-auto max-w-6xl">
            <h2 id="problema-heading" className="text-2xl font-bold tracking-tight text-[#1C2526] sm:text-3xl">
              Lo que te está costando hoy
            </h2>
            <p className="mt-3 max-w-2xl text-[#1C2526]/70">
              No es la comida. Es que no sabes quién te compró, y por eso no puedes hacer que vuelva.
            </p>
            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {PROBLEM_CARDS.map((card) => (
                <article key={card.title} className="rounded-2xl border border-[#1C2526]/8 bg-white p-6 shadow-sm">
                  <span className="text-2xl" aria-hidden>{card.icon}</span>
                  <h3 className="mt-4 text-lg font-bold text-[#1C2526]">{card.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#1C2526]/70">{card.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── Value props ── */}
        <section className="border-y border-[#1C2526]/8 bg-white px-4 py-16 sm:px-6 sm:py-20" aria-labelledby="valor-heading">
          <div className="mx-auto max-w-6xl">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#F28C38]">Qué incluye</p>
            <h2 id="valor-heading" className="mt-2 text-2xl font-bold tracking-tight text-[#1C2526] sm:text-3xl">
              Todo lo que necesitas para que tus clientes regresen
            </h2>
            <p className="mt-3 max-w-2xl text-[#1C2526]/70">
              Activo en unos 5 minutos, sin contratos. Comeleal funciona junto a tu punto de venta actual.
            </p>
            <ul className="mt-10 grid gap-6 sm:grid-cols-2">
              {VALUE_POINTS.map((point) => (
                <li key={point.title} className="rounded-2xl border border-[#1C2526]/8 bg-[#FAF7F2] p-5">
                  <h3 className="font-bold text-[#1C2526]">{point.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#1C2526]/70">{point.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── How it works ── */}
        <section id="como-funciona" className="scroll-mt-20 px-4 py-16 sm:px-6 sm:py-20" aria-labelledby="como-funciona-heading">
          <div className="mx-auto max-w-6xl">
            <h2 id="como-funciona-heading" className="text-2xl font-bold tracking-tight text-[#1C2526] sm:text-3xl">
              Cómo funciona
            </h2>
            <p className="mt-3 max-w-2xl text-[#1C2526]/70">
              Cuatro pasos para dejar tu negocio listo y empezar a escanear clientes hoy.
            </p>
            <ol className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((item) => (
                <li key={item.step} className="relative rounded-2xl border border-[#1C2526]/8 bg-white p-5 shadow-sm">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#F28C38] text-sm font-bold text-[#1C2526]">
                    {item.step}
                  </span>
                  <h3 className="mt-4 font-bold text-[#1C2526]">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#1C2526]/70">{item.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ── Benefits ── */}
        <section id="beneficios" className="scroll-mt-20 border-y border-[#1C2526]/8 bg-[#141414] px-4 py-16 sm:px-6 sm:py-20" aria-labelledby="beneficios-heading">
          <div className="mx-auto max-w-6xl">
            <h2 id="beneficios-heading" className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Por qué Comeleal
            </h2>
            <ul className="mt-8 grid gap-3 sm:grid-cols-2">
              {BENEFITS.map((benefit) => (
                <li key={benefit} className="flex gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm leading-relaxed text-white/80">
                  <span className="shrink-0 text-[#F28C38]" aria-hidden>✓</span>
                  {benefit}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── Final CTA ── */}
        <section className="border-t border-[#1C2526]/8 bg-[#141414] px-4 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Empieza gratis hoy.
            </h2>
            <p className="mt-4 text-lg text-white/65">
              Sube la foto de tu menú. En 1 minuto lo ves digital. En 5 tienes tu QR y tu primer premio. Y desde la primera venta empiezas a saber quién te compró.
            </p>
            <HomeCta />
          </div>
        </section>

        {/* ── FAQ ── */}
        <section id="preguntas" className="scroll-mt-20 border-t border-[#1C2526]/8 px-4 py-16 sm:px-6 sm:py-20" aria-labelledby="faq-heading">
          <div className="mx-auto max-w-6xl">
            <h2 id="faq-heading" className="text-2xl font-bold tracking-tight text-[#1C2526] sm:text-3xl">
              Preguntas frecuentes
            </h2>
            <dl className="mt-10 divide-y divide-[#1C2526]/10 rounded-2xl border border-[#1C2526]/8 bg-white">
              {FAQ_ITEMS.map((item) => (
                <div key={item.q} className="px-5 py-5 sm:px-6">
                  <dt className="font-bold text-[#1C2526]">{item.q}</dt>
                  <dd className="mt-2 text-sm leading-relaxed text-[#1C2526]/70">{item.a}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#1C2526]/10 bg-[#141414] px-4 py-10 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-lg font-bold text-white">Comeleal</p>
            <p className="mt-2 max-w-xs text-sm text-white/55">
              Herramientas para que tus clientes te encuentren, acumulen puntos y regresen.
            </p>
          </div>
          {/* SEO cluster links — footer only, homepage design untouched
              (Ricardo-approved Jul 18). Flows homepage authority to the
              marketing pages so Google crawls/ranks the cluster. */}
          <nav aria-label="Para restaurantes">
            <p className="text-sm font-semibold text-white/70">Para restaurantes</p>
            <ul className="mt-2 flex flex-col gap-2">
              {[
                { href: "/menu-qr-gratis-restaurantes", label: "Menú digital QR gratis" },
                { href: "/programa-de-lealtad-para-restaurantes", label: "Programa de lealtad" },
                { href: "/tarjeta-de-lealtad-digital", label: "Tarjeta de lealtad digital" },
                { href: "/punto-de-venta-gratis-restaurantes", label: "Punto de venta gratis" },
                { href: "/pedidos-en-linea-restaurantes", label: "Pedidos en línea sin comisiones" },
                { href: "/pedidos-whatsapp-restaurantes", label: "Pedidos por WhatsApp" },
                { href: "/clientes-que-regresan", label: "Clientes que regresan" },
                { href: "/como-vender-mas-en-mi-restaurante", label: "Cómo vender más" },
                { href: "/inteligencia-artificial-para-restaurantes", label: "IA para restaurantes" },
                { href: "/lealtad-restaurantes-chihuahua", label: "Lealtad en Chihuahua" },
                { href: "/precios", label: "Precios" },
              ].map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="block py-1 text-sm text-white/55 transition-colors hover:text-white">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <nav aria-label="Legal y soporte">
            <ul className="flex flex-col gap-2 sm:items-end">
              {FOOTER_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="block py-1.5 text-sm text-white/65 transition-colors hover:text-white">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <p className="mx-auto mt-8 max-w-6xl border-t border-white/10 pt-6 text-center text-xs text-white/45 sm:text-left">
          © 2026 Comeleal. Todos los derechos reservados.
        </p>
      </footer>
    </div>
  );
}
