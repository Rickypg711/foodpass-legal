import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { VendorHeroCtas } from "@/components/vendor/VendorHeroCtas";
import { VendorLeadForm } from "@/components/vendor/VendorLeadForm";
import { VendorPageAnalytics } from "@/components/vendor/VendorPageAnalytics";
import { SITE_NAME, SITE_URL, siteIcons } from "@/lib/siteMetadata";

const PAGE_TITLE = "Comeleal para restaurantes";
const PAGE_DESCRIPTION =
  "Haz que tus clientes regresen: mapa, menú público, puntos con QR y pedidos para recoger. Para restaurantes, cafés y food trucks locales.";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    siteName: SITE_NAME,
    locale: "es_MX",
    type: "website",
    url: `${SITE_URL}/para-restaurantes`,
  },
  twitter: {
    card: "summary_large_image",
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
  },
  icons: siteIcons,
  alternates: {
    canonical: `${SITE_URL}/para-restaurantes`,
  },
};

const NAV_LINKS = [
  { href: "#problema", label: "El problema" },
  { href: "#como-funciona", label: "Cómo funciona" },
  { href: "#beneficios", label: "Beneficios" },
  { href: "#preguntas", label: "Preguntas" },
  { href: "/download.html", label: "Descargar app" },
  { href: "/support.html", label: "Soporte" },
] as const;

const PROBLEM_CARDS = [
  {
    title: "Los clientes no regresan",
    body: "Muchos piden o visitan una vez, pero no tienes un programa claro para que vuelvan.",
    icon: "🔄",
  },
  {
    title: "Todo pasa por WhatsApp",
    body: "Sin un lugar en el mapa ni puntos visibles, cuesta que nuevos vecinos te descubran.",
    icon: "💬",
  },
  {
    title: "Comisiones altas de delivery",
    body: "Las apps de reparto se llevan un buen porcentaje y no siempre te dejan la relación con el cliente.",
    icon: "📉",
  },
] as const;

const VALUE_POINTS = [
  {
    title: "Te encuentran en el mapa",
    body: "Tu lugar puede aparecer en Explorar para que la gente de tu zona te descubra.",
  },
  {
    title: "Puntos y recompensas con QR",
    body: "El cliente muestra su QR; tú escaneas en la app y sumas puntos o canjeas recompensas.",
  },
  {
    title: "Menú público en internet",
    body: "Comparte un enlace tipo comeleal.com/menu/tu-lugar en redes o en mostrador.",
  },
  {
    title: "Pedidos para recoger (opcional)",
    body: "Si conectas Mercado Pago, puedes recibir pedidos pagados en línea para recoger en local — no delivery.",
  },
] as const;

const STEPS = [
  {
    step: "1",
    title: "Descarga y registra tu negocio",
    body: "Crea tu lugar en la app: nombre, dirección, categoría y datos básicos.",
  },
  {
    step: "2",
    title: "Horario, menú y recompensa",
    body: "Sube horarios, platillos y una recompensa de bienvenida. Puedes pedir ayuda en el proceso.",
  },
  {
    step: "3",
    title: "Comparte tu menú y QR",
    body: "Pon el enlace o QR del menú en mostrador, mesas o redes sociales.",
  },
  {
    step: "4",
    title: "Escanea y suma puntos",
    body: "Cuando el cliente visita, escaneas su QR en la pestaña QR del modo restaurante.",
  },
] as const;

const BENEFITS = [
  "Gratis para empezar (plan Free; Pro opcional en la app).",
  "App disponible en App Store y Google Play.",
  "Herramientas en una sola app: panel, POS, escáner QR y pedidos si activas Mercado Pago.",
  "Menú digital sin depender solo de fotos en WhatsApp.",
  "Acompañamiento para dejar tu negocio listo con menú, horario y una recompensa inicial.",
  "Enfocado en negocios locales — restaurantes, cafés, food trucks y cocinas independientes.",
] as const;

const FAQ_ITEMS = [
  {
    q: "¿Cuánto cuesta?",
    a: "Puedes empezar gratis con el plan Free. Comeleal Pro es opcional en la app si más adelante quieres funciones adicionales.",
  },
  {
    q: "¿Necesito Mercado Pago?",
    a: "No para lealtad y menú público. Sí si quieres pedidos en línea pagados antes de preparar (recoger en local).",
  },
  {
    q: "¿Hacen delivery?",
    a: "No. Comeleal no es una app de reparto a domicilio; los pedidos en línea son para recoger en tu local.",
  },
  {
    q: "¿Me pueden ayudar a activarlo?",
    a: "Sí. La idea es acompañarte para dejar lo básico listo: tu negocio, horario, menú inicial y una recompensa para que puedas empezar a probarlo con clientes.",
  },
  {
    q: "¿Cuánto tarda activar mi lugar?",
    a: "Con acompañamiento, muchos negocios dejan horario, menú básico y una recompensa en unos 15–20 minutos.",
  },
  {
    q: "¿Dónde funciona?",
    a: "Comeleal está pensado para negocios locales que quieren activar menú, recompensas y puntos con QR. Estamos empezando con lugares cercanos para poder acompañarlos bien.",
  },
  {
    q: "¿Qué necesito en el mostrador?",
    a: "Un celular con la app en modo restaurante y, si quieres, el QR o enlace de tu menú visible para clientes.",
  },
] as const;

const FOOTER_LINKS = [
  { href: "/", label: "Inicio" },
  { href: "/download.html", label: "Descargar app" },
  { href: "/support.html", label: "Soporte" },
  { href: "/privacy-policy.html", label: "Privacy Policy" },
  { href: "/terms-of-use.html", label: "Terms of Use" },
] as const;

function NavLinks({ className = "" }: { className?: string }) {
  return (
    <ul
      className={`flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-6 sm:gap-y-2 ${className}`}
    >
      {NAV_LINKS.map((link) => (
        <li key={link.href}>
          <Link
            href={link.href}
            className="block py-2 text-sm font-medium text-white/85 transition-colors hover:text-white"
          >
            {link.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function ParaRestaurantesPage() {
  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#1C2526]">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#141414]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/" className="flex shrink-0 items-center gap-2.5">
            <Image
              src="/comeleal-app-icon.png"
              alt="Comeleal"
              width={36}
              height={36}
              className="h-9 w-9 rounded-[10px] ring-1 ring-white/15"
            />
            <span className="text-lg font-bold tracking-tight text-white">Comeleal</span>
          </Link>

          <nav className="hidden lg:block" aria-label="Principal">
            <NavLinks className="!flex-row !gap-5" />
          </nav>

          <Link
            href="#contacto"
            className="hidden shrink-0 rounded-full bg-[#F28C38] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#e07d30] sm:inline-block"
          >
            Activar mi negocio
          </Link>

          <details className="relative lg:hidden">
            <summary className="min-h-11 cursor-pointer list-none rounded-lg border border-white/15 px-3 py-2.5 text-sm font-medium leading-none text-white [&::-webkit-details-marker]:hidden">
              Menú
            </summary>
            <div className="absolute right-0 mt-2 w-56 rounded-xl border border-white/10 bg-[#1a1a1a] p-4 shadow-xl">
              <NavLinks />
            </div>
          </details>
        </div>
      </header>

      <main>
        <VendorPageAnalytics />
        {/* Hero */}
        <section className="relative overflow-hidden bg-[#141414] px-4 py-16 sm:px-6 sm:py-24 lg:py-28">
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(242,140,56,0.18),transparent)]"
            aria-hidden
          />
          <div className="relative mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
            <div>
              <p className="mb-4 inline-block rounded-full border border-[#F28C38]/30 bg-[#F28C38]/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#F28C38]">
                Para restaurantes locales
              </p>
              <h1 className="text-3xl font-bold leading-tight tracking-tight text-white sm:text-4xl lg:text-[2.65rem] lg:leading-[1.15]">
                Activa menú digital, puntos con QR y recompensas para tu negocio.
              </h1>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-white/70 sm:text-lg">
                Haz que tus clientes regresen. Comeleal ayuda a restaurantes, cafés, food trucks y
                cocinas independientes a aparecer en el mapa, compartir un menú público, dar puntos
                con QR y, si lo deseas, recibir pedidos para recoger con Mercado Pago.
              </p>
              <VendorHeroCtas />
            </div>

            <div className="flex justify-center lg:justify-end">
              <div className="relative w-full max-w-sm rounded-3xl border border-white/10 bg-gradient-to-b from-[#2a2a2a] to-[#1a1a1a] p-8 shadow-2xl">
                <div className="mx-auto flex w-full flex-col items-center text-center">
                  <Image
                    src="/comeleal-app-icon.png"
                    alt="Comeleal"
                    width={96}
                    height={96}
                    priority
                    className="h-24 w-24 rounded-[24px] shadow-lg ring-1 ring-white/10"
                  />
                  <p className="mt-5 text-xl font-bold text-white">Modo restaurante</p>
                  <p className="mt-2 text-sm leading-relaxed text-white/60">
                    Panel, menú web, QR de clientes y herramientas simples para operar tu local.
                  </p>
                  <div className="mt-6 grid w-full gap-2 text-left text-sm">
                    {["Mapa y descubrimiento", "Puntos con QR", "Menú en comeleal.com"].map(
                      (item) => (
                        <div
                          key={item}
                          className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-white/80"
                        >
                          <span className="text-[#F28C38]" aria-hidden>
                            ✓
                          </span>
                          {item}
                        </div>
                      ),
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Problem */}
        <section
          id="problema"
          className="scroll-mt-20 px-4 py-16 sm:px-6 sm:py-20"
          aria-labelledby="problema-heading"
        >
          <div className="mx-auto max-w-6xl">
            <h2
              id="problema-heading"
              className="text-2xl font-bold tracking-tight text-[#1C2526] sm:text-3xl"
            >
              Problemas comunes en negocios locales
            </h2>
            <p className="mt-3 max-w-2xl text-[#1C2526]/70">
              No necesitas depender de apps de delivery para fidelizar a tus clientes. Necesitas
              herramientas prácticas para que quien ya te conoce vuelva.
            </p>
            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {PROBLEM_CARDS.map((card) => (
                <article
                  key={card.title}
                  className="rounded-2xl border border-[#1C2526]/8 bg-white p-6 shadow-sm"
                >
                  <span className="text-2xl" aria-hidden>
                    {card.icon}
                  </span>
                  <h3 className="mt-4 text-lg font-bold text-[#1C2526]">{card.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#1C2526]/70">{card.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Value proposition */}
        <section
          className="border-y border-[#1C2526]/8 bg-white px-4 py-16 sm:px-6 sm:py-20"
          aria-labelledby="valor-heading"
        >
          <div className="mx-auto max-w-6xl">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#F28C38]">
              Propuesta de valor
            </p>
            <h2
              id="valor-heading"
              className="mt-2 text-2xl font-bold tracking-tight text-[#1C2526] sm:text-3xl"
            >
              Todo lo que necesitas para fidelizar, sin prometer magia
            </h2>
            <p className="mt-3 max-w-2xl text-[#1C2526]/70">
              Comeleal no garantiza más ventas automáticamente: te da estructura para que clientes
              te encuentren, acumulen puntos y regresen si tú operas el programa en mostrador.
            </p>
            <ul className="mt-10 grid gap-6 sm:grid-cols-2">
              {VALUE_POINTS.map((point) => (
                <li
                  key={point.title}
                  className="rounded-2xl border border-[#1C2526]/8 bg-[#FAF7F2] p-5"
                >
                  <h3 className="font-bold text-[#1C2526]">{point.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#1C2526]/70">{point.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* How it works */}
        <section
          id="como-funciona"
          className="scroll-mt-20 px-4 py-16 sm:px-6 sm:py-20"
          aria-labelledby="como-funciona-heading"
        >
          <div className="mx-auto max-w-6xl">
            <h2
              id="como-funciona-heading"
              className="text-2xl font-bold tracking-tight text-[#1C2526] sm:text-3xl"
            >
              Cómo funciona
            </h2>
            <p className="mt-3 max-w-2xl text-[#1C2526]/70">
              Cuatro pasos para dejar tu lugar listo y empezar a escanear clientes.
            </p>
            <ol className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((item) => (
                <li
                  key={item.step}
                  className="relative rounded-2xl border border-[#1C2526]/8 bg-white p-5 shadow-sm"
                >
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#F28C38] text-sm font-bold text-white">
                    {item.step}
                  </span>
                  <h3 className="mt-4 font-bold text-[#1C2526]">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#1C2526]/70">{item.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Benefits */}
        <section
          id="beneficios"
          className="scroll-mt-20 border-y border-[#1C2526]/8 bg-[#141414] px-4 py-16 sm:px-6 sm:py-20"
          aria-labelledby="beneficios-heading"
        >
          <div className="mx-auto max-w-6xl">
            <h2
              id="beneficios-heading"
              className="text-2xl font-bold tracking-tight text-white sm:text-3xl"
            >
              Beneficios para tu negocio
            </h2>
            <ul className="mt-8 grid gap-3 sm:grid-cols-2">
              {BENEFITS.map((benefit) => (
                <li
                  key={benefit}
                  className="flex gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm leading-relaxed text-white/80"
                >
                  <span className="shrink-0 text-[#F28C38]" aria-hidden>
                    ✓
                  </span>
                  {benefit}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Example use case */}
        <section className="px-4 py-16 sm:px-6 sm:py-20" aria-labelledby="ejemplo-heading">
          <div className="mx-auto max-w-6xl">
            <div className="rounded-3xl border border-[#1C2526]/8 bg-white px-6 py-10 sm:px-10 sm:py-12">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#F28C38]">
                Ejemplo de activación
              </p>
              <h2
                id="ejemplo-heading"
                className="mt-3 text-2xl font-bold tracking-tight text-[#1C2526] sm:text-3xl"
              >
                Un café o food truck puede activar en una visita
              </h2>
              <p className="mt-4 max-w-3xl text-base leading-relaxed text-[#1C2526]/70">
                Imagina un café en el centro o un food truck con fila en la hora pico: en una sesión
                corta registras el lugar, subes un menú básico y una recompensa de bienvenida.
                Compartes el enlace del menú en Instagram o en mostrador. Cuando un cliente con la
                app visita, escaneas su QR y empiezas a sumar puntos — sin prometer resultados que
                aún no has medido en tu negocio.
              </p>
              <p className="mt-4 text-sm text-[#1C2526]/55">
                Los resultados dependen de tu operación diaria (QR visible, personal entrenado,
                recompensas atractivas). Comeleal te da las herramientas; tú ejecutas en el local.
              </p>
            </div>
          </div>
        </section>

        {/* CTA / Contact */}
        <section
          id="contacto"
          className="scroll-mt-20 border-t border-[#1C2526]/8 bg-white px-4 py-16 sm:px-6 sm:py-20"
          aria-labelledby="contacto-heading"
        >
          <div className="mx-auto max-w-6xl">
            <div className="rounded-3xl border border-[#1C2526]/8 bg-[#FAF7F2] px-6 py-10 sm:px-10 sm:py-14">
              <h2
                id="contacto-heading"
                className="text-2xl font-bold tracking-tight text-[#1C2526] sm:text-3xl"
              >
                ¿Listo para conocer Comeleal en tu negocio?
              </h2>
              <p className="mt-4 max-w-2xl text-base leading-relaxed text-[#1C2526]/70">
                Completa el formulario y te contactamos para ayudarte a activar tu lugar. También
                puedes instalar la app si ya quieres empezar con acompañamiento.
              </p>

              <VendorLeadForm />

              <p className="mt-6 text-sm text-[#1C2526]/55">
                ¿Dudas técnicas o de cuenta? Visita{" "}
                <Link href="/support.html" className="font-medium text-[#F28C38] hover:underline">
                  soporte
                </Link>
                .
              </p>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section
          id="preguntas"
          className="scroll-mt-20 border-t border-[#1C2526]/8 px-4 py-16 sm:px-6 sm:py-20"
          aria-labelledby="faq-heading"
        >
          <div className="mx-auto max-w-6xl">
            <h2
              id="faq-heading"
              className="text-2xl font-bold tracking-tight text-[#1C2526] sm:text-3xl"
            >
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

      <footer className="border-t border-[#1C2526]/10 bg-[#141414] px-4 py-10 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-lg font-bold text-white">Comeleal para restaurantes</p>
            <p className="mt-2 max-w-xs text-sm text-white/55">
              Herramientas locales para que tus clientes te encuentren, acumulen puntos y regresen.
            </p>
          </div>
          <nav aria-label="Enlaces">
            <ul className="flex flex-col gap-2 sm:items-end">
              {FOOTER_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="block py-1.5 text-sm text-white/65 transition-colors hover:text-white"
                  >
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
