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
  },
  {
    title: "El que no vuelve, no avisa",
    body: "Nadie te dice \"ya no vengo\". Solo dejas de verlo. Sin su número no hay forma de recordarle que existes.",
  },
  {
    title: "La app de reparto se queda con tu cliente",
    body: "Te cobra comisión por cada pedido y además se queda con el nombre, el número y la costumbre. El cliente es de ellos, no tuyo.",
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
  // 17-sep-2026: la FAQ contesta MIEDOS, no funciones (espejo de la portada
  // de CarSignal, YC S26). Fuera "¿Qué es Apple Wallet?" (ya está en valor);
  // entran "¿y si la IA lee mal?" y "¿le escriben a un robot?".
  {
    q: "¿Y si la IA lee mal mi menú?",
    a: "Lo ves antes de quedártelo y lo corriges tú desde tu panel: nombres, precios, salsas y tamaños. Nada les sale a tus clientes sin que tú lo apruebes.",
  },
  {
    q: "¿Mis clientes le escriben a un robot?",
    a: "No. El pedido llega a TU WhatsApp y les contestas tú, como siempre. Comeleal no manda mensajes por ti ni le contesta a nadie en tu nombre.",
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
  { href: "/puntos", label: "Mis puntos" },
  { href: "/support.html", label: "Soporte" },
  { href: "/privacy-policy.html", label: "Privacy Policy" },
  { href: "/terms-of-use.html", label: "Terms of Use" },
  { href: "/delete-account.html", label: "Delete Account" },
] as const;


function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#1C2526]/45">
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#F28C38]" aria-hidden />
      {children}
    </p>
  );
}

const H2 = "mt-4 max-w-2xl text-3xl font-semibold leading-[1.1] tracking-[-0.03em] text-[#1C2526] sm:text-4xl";
const LEAD = "mt-4 max-w-xl text-[#1C2526]/60";
const SECTION = "border-t border-[#1C2526]/8 px-5 py-20 sm:px-6 sm:py-24";

export default function Home() {
  // Conteo vivo de restaurantes en el hero: Ricardo lo quiere hasta ~50
  // activos (5-sep: "me da pena, esperemos"). fetchPlatformStats ya existe.
  //
  // 17-sep-2026 (tarde): fondo crema #FAF7F2 y texto #1C2526 del estándar de
  // marca (skill comeleal-brand-creative-director); tarjetas y mock en blanco.
  // 17-sep-2026, paso 1 de la portada contenida (decisión Ricardo tras ver
  // capturas de /dev/portada): un solo fondo blanco, sin bandas; el naranja
  // solo en el botón y en puntitos; cero emojis; mock de líneas finas y
  // mono; título apretado. MISMO copy. Paso 2 (pendiente): foto real de un
  // menú de papel en lugar del mock, cuando un dueño diga que sí.
  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#1C2526] antialiased">
      <VendorPageAnalytics />

      <HomeHeader />

      <main>
        {/* ── Hero ── */}
        <section className="px-5 pb-16 pt-16 sm:px-6 sm:pb-24 sm:pt-28">
          <div className="mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-[1.1fr_0.9fr] lg:gap-20">
            <div>
              <Eyebrow>Para restaurantes locales</Eyebrow>
              <h1 className="mt-5 text-[2.6rem] font-semibold leading-[1.02] tracking-[-0.045em] sm:text-[3.4rem]">
                Tu menú de papel,<br />digital y gratis<br />en 1 minuto.
              </h1>
              <p className="mt-6 max-w-lg text-lg leading-relaxed text-[#1C2526]/65">
                <span className="font-medium text-[#1C2526]">Que te pidan, que regresen, que lo veas.</span>{" "}
                Menú con QR, pedidos por WhatsApp y puntos. Sin cambiar tu caja.
              </p>
              <HomeCta />
              {/* Robado de Last.app (10-sep-2026): "si sabes usar WhatsApp ya
                  sabes usarlo". Nivel secundaria, cero jerga, y quita el miedo
                  a "otro sistema" antes de que el dueño lo diga. */}
              <p className="mt-6 text-sm text-[#1C2526]/55">Si sabes mandar un WhatsApp, ya sabes usar Comeleal.</p>
              <p className="mt-1.5 text-xs text-[#1C2526]/35">Sin tarjeta de crédito · Sin contrato</p>
            </div>

            <div className="flex justify-center lg:justify-end">
              {/* El mock ES la promesa del CTA: un MENÚ digital en un
                  teléfono, recién leído del papel (decisión Ricardo, 26-ago;
                  antes era un panel de dueño avanzado). 17-sep: líneas finas
                  y mono, un solo punto naranja. */}
              <div className="w-full max-w-[340px] overflow-hidden rounded-2xl border border-[#1C2526]/12 bg-white shadow-[0_1px_2px_rgba(28,37,38,0.04),0_12px_40px_-12px_rgba(28,37,38,0.12)]">
                <div className="flex items-center justify-between border-b border-[#1C2526]/8 px-4 py-3">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#1C2526]/40">Menú digital</p>
                    <p className="mt-0.5 text-[15px] font-semibold">Tacos El Güero</p>
                  </div>
                  <span className="flex items-center gap-1.5 rounded-full border border-[#1C2526]/10 px-2 py-0.5 font-mono text-[10px] text-[#1C2526]/60">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#F28C38]" aria-hidden />
                    Abierto · 11 pm
                  </span>
                </div>
                <div className="px-4 pt-3">
                  <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#1C2526]/40">Leído de su menú de papel</p>
                </div>
                <ul className="divide-y divide-[#1C2526]/8 px-4">
                  {[
                    { name: "Taco de pastor", price: "$28", chip: null },
                    { name: "Quesadilla", price: "$45", chip: "Elige tu salsa" },
                    { name: "Torta cubana", price: "$85", chip: "Elige tamaño" },
                  ].map((it) => (
                    <li key={it.name} className="flex items-center justify-between py-3">
                      <div>
                        <p className="text-[13px] font-medium">{it.name}</p>
                        {it.chip && <p className="mt-0.5 text-[11px] text-[#1C2526]/50">{it.chip}</p>}
                      </div>
                      <div className="flex items-center gap-3">
                        <p className="font-mono text-[13px]">{it.price}</p>
                        <span className="flex h-6 w-6 items-center justify-center rounded-full border border-[#1C2526]/20 text-[13px] leading-none">+</span>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="p-4">
                  <div className="rounded-full bg-[#1C2526] py-2.5 text-center text-[12px] font-semibold text-white">
                    Ordenar por WhatsApp
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Números reales (5-sep-2026) ── Cifras de restaurantes reales en
            Comeleal, sin nombres (eso lo decide Ricardo). Regla: solo números
            que existan — jamás prometer lo que no existe. */}
        <section className="border-y border-[#1C2526]/8 px-5 py-10 sm:px-6" aria-label="Números reales">
          <ul className="mx-auto grid max-w-6xl grid-cols-1 gap-8 sm:grid-cols-3">
            {PROOF_POINTS.map((p) => (
              <li key={p.figure}>
                <p className="text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">{p.figure}</p>
                <p className="mt-1.5 text-sm text-[#1C2526]/55">{p.body}</p>
              </li>
            ))}
          </ul>
          <p className="mx-auto mt-6 max-w-6xl font-mono text-[11px] text-[#1C2526]/40">Cifras reales de locales en Comeleal, agosto 2026.</p>
        </section>

        {/* ── Problem ── */}
        <section className="px-5 py-20 sm:px-6 sm:py-24" aria-labelledby="problema-heading">
          <div className="mx-auto max-w-6xl">
            <Eyebrow>01 · El problema</Eyebrow>
            <h2 id="problema-heading" className={H2}>Lo que te está costando hoy</h2>
            <p className={LEAD}>
              No es la comida. Es que no sabes quién te compró, y por eso no puedes hacer que vuelva.
            </p>
            <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-[#1C2526]/10 bg-[#1C2526]/10 md:grid-cols-3">
              {PROBLEM_CARDS.map((card, i) => (
                <article key={card.title} className="bg-white p-7">
                  <p className="font-mono text-[11px] text-[#1C2526]/40">0{i + 1}</p>
                  <h3 className="mt-5 text-[17px] font-semibold leading-snug">{card.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-[#1C2526]/60">{card.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── Value props ── */}
        <section className={SECTION} aria-labelledby="valor-heading">
          <div className="mx-auto max-w-6xl">
            <Eyebrow>02 · Qué incluye</Eyebrow>
            <h2 id="valor-heading" className={H2}>Todo lo que necesitas para que tus clientes regresen</h2>
            <p className={LEAD}>
              Activo en unos 5 minutos, sin contratos. Comeleal funciona junto a tu punto de venta actual.
            </p>
            <ul className="mt-12 grid gap-10 md:grid-cols-3">
              {VALUE_POINTS.map((point) => (
                <li key={point.title} className="border-t border-[#1C2526]/15 pt-5">
                  <h3 className="text-[17px] font-semibold leading-snug">{point.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-[#1C2526]/60">{point.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── How it works ── */}
        <section id="como-funciona" className={`scroll-mt-20 ${SECTION}`} aria-labelledby="como-funciona-heading">
          <div className="mx-auto max-w-6xl">
            <Eyebrow>03 · Cómo funciona</Eyebrow>
            <h2 id="como-funciona-heading" className={H2}>Cuatro pasos y a vender</h2>
            <p className={LEAD}>
              Para dejar tu negocio listo y empezar a escanear clientes hoy.
            </p>
            <ol className="mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((item) => (
                <li key={item.step}>
                  <p className="font-mono text-[11px] text-[#1C2526]/40">0{item.step}</p>
                  <h3 className="mt-4 text-[16px] font-semibold leading-snug">{item.title}</h3>
                  <p className="mt-2.5 text-sm leading-relaxed text-[#1C2526]/60">{item.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ── Benefits ── */}
        <section id="beneficios" className={`scroll-mt-20 ${SECTION}`} aria-labelledby="beneficios-heading">
          <div className="mx-auto max-w-6xl">
            <Eyebrow>04 · Por qué Comeleal</Eyebrow>
            <h2 id="beneficios-heading" className="sr-only">Por qué Comeleal</h2>
            <ul className="mt-8 grid gap-x-12 gap-y-4 sm:grid-cols-2">
              {BENEFITS.map((benefit) => (
                <li key={benefit} className="flex gap-3 border-b border-[#1C2526]/8 pb-4 text-[15px] leading-relaxed text-[#1C2526]/80">
                  <span className="mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[#F28C38]" aria-hidden />
                  {benefit}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── Final CTA ── */}
        <section className="border-t border-[#1C2526]/8 px-5 py-24 sm:px-6 sm:py-32">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-4xl font-semibold leading-[1.05] tracking-[-0.04em] sm:text-5xl">Empieza gratis hoy.</h2>
            <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-[#1C2526]/60">
              Sube la foto de tu menú. En 1 minuto lo ves digital. En 5 tienes tu QR y tu primer premio. Y desde la primera venta empiezas a saber quién te compró.
            </p>
            <HomeCta section="home_final" />
          </div>
        </section>

        {/* ── FAQ ── */}
        <section id="preguntas" className={`scroll-mt-20 ${SECTION}`} aria-labelledby="faq-heading">
          <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <Eyebrow>Preguntas</Eyebrow>
              <h2 id="faq-heading" className={H2}>Lo que preguntan primero.</h2>
            </div>
            <dl className="divide-y divide-[#1C2526]/8 border-y border-[#1C2526]/8">
              {FAQ_ITEMS.map((item) => (
                <div key={item.q} className="py-5">
                  <dt className="text-[15px] font-semibold">{item.q}</dt>
                  <dd className="mt-2 text-sm leading-relaxed text-[#1C2526]/60">{item.a}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#1C2526]/8 px-5 py-12 sm:px-6">
        <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-[1.2fr_1fr_1fr]">
          <div>
            <p className="text-[15px] font-semibold">Comeleal</p>
            <p className="mt-2 max-w-xs text-sm text-[#1C2526]/55">
              Herramientas para que tus clientes te encuentren, acumulen puntos y regresen.
            </p>
          </div>
          {/* SEO cluster links — footer only, homepage design untouched
              (Ricardo-approved Jul 18). Flows homepage authority to the
              marketing pages so Google crawls/ranks the cluster. */}
          <nav aria-label="Para restaurantes">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#1C2526]/45">Para restaurantes</p>
            <ul className="mt-3 space-y-1.5 text-sm">
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
                  <Link href={link.href} className="text-[#1C2526]/60 hover:text-[#1C2526]">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <nav aria-label="Legal y soporte">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#1C2526]/45">Comeleal</p>
            <ul className="mt-3 space-y-1.5 text-sm">
              {FOOTER_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-[#1C2526]/60 hover:text-[#1C2526]">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <p className="mx-auto mt-10 max-w-6xl text-xs text-[#1C2526]/40">
          © 2026 Comeleal. Todos los derechos reservados.
        </p>
      </footer>
    </div>
  );
}
