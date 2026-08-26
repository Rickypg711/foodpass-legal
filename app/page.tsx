import type { Metadata } from "next";
import Link from "next/link";
import { HomeCta } from "@/components/home/HomeCta";
import { HomeHeader } from "@/components/home/HomeHeader";
import { VendorPageAnalytics } from "@/components/vendor/VendorPageAnalytics";
import { SITE_NAME, SITE_URL, siteIcons } from "@/lib/siteMetadata";

const PAGE_TITLE = "Comeleal para restaurantes — Empieza gratis";
const PAGE_DESCRIPTION =
  "Haz que tus clientes regresen: puntos con QR, Apple y Google Wallet, menú digital y panel web. Sin cambiar tu sistema actual. Gratis para empezar.";

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


const PROBLEM_CARDS = [
  {
    title: "Los clientes no regresan",
    body: "Muchos visitan una vez pero no tienes un sistema claro para que vuelvan.",
    icon: "🔄",
  },
  {
    title: "Sin presencia digital propia",
    body: "Sin un lugar en el mapa ni puntos visibles, cuesta que nuevos vecinos te descubran — o que los habituales te recuerden.",
    icon: "📍",
  },
  {
    title: "Comisiones altas de delivery",
    body: "Las apps de reparto se llevan un buen porcentaje y no te dejan la relación con el cliente.",
    icon: "📉",
  },
] as const;

const VALUE_POINTS = [
  {
    title: "Monedero digital: Apple Wallet y Google Wallet",
    body: "Tus clientes guardan su tarjeta de lealtad en Apple Wallet o Google Wallet. La abren desde su iPhone o Android sin descargar nada — menos fricción, más visitas.",
  },
  {
    title: "Sabemos cuándo un cliente está por no regresar",
    body: "El sistema detecta automáticamente cuando un cliente habitual lleva tiempo sin visitar y te avisa — para que actúes antes de perderlo.",
  },
  {
    title: "Puntos y recompensas con QR",
    body: "El cliente muestra su QR; tú escaneas y sumas puntos o canjeas recompensas. Funciona junto a tu caja actual, sin reemplazarla.",
  },
  {
    title: "Pedidos en línea para recoger, sin comisiones",
    body: "Recibe pedidos pagados antes de prepararlos, directo desde tu menú digital. Sin apps de delivery, sin comisiones por venta.",
  },
] as const;

const STEPS = [
  { step: "1", title: "Registra tu negocio", body: "Crea tu lugar: nombre, dirección, categoría y datos básicos. Tarda menos de 5 minutos." },
  { step: "2", title: "Sube tu menú y recompensa", body: "Agrega horarios, platillos y una recompensa de bienvenida. Te ayudamos en el proceso." },
  { step: "3", title: "Comparte tu QR o menú", body: "Pon el enlace o QR en mostrador, mesas o redes sociales para que tus clientes lo encuentren." },
  { step: "4", title: "Escanea y suma puntos", body: "Cuando el cliente visita, escaneas su QR desde tu panel. Listo — ya tienes lealtad activa." },
] as const;

const BENEFITS = [
  "Gratis para empezar — sin tarjeta de crédito.",
  "Panel web: administra todo desde comeleal.com/vendor.",
  "Apple Wallet y Google Wallet para tus clientes — sin descargar otra app.",
  "Menú digital sin depender de fotos en WhatsApp.",
  "Sin cambiar tu caja ni tu POS: Comeleal funciona junto a lo que ya tienes.",
  "Activa tu negocio en menos de 5 minutos.",
] as const;

const FAQ_ITEMS = [
  {
    q: "¿Cuánto cuesta?",
    a: "Operar es gratis: menú digital, Caja/POS, pedidos, tus clientes y reportes, con 50 visitas de lealtad al mes. Pro ($299/mes) es para que tus clientes regresen: lealtad ilimitada, recuperación automática por WhatsApp y Comeleal AI sin límite.",
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
    a: "Sí. En menos de 5 minutos dejamos lo básico listo: negocio, menú inicial y primera recompensa activa.",
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
                Con QR, pedidos por WhatsApp y puntos que hacen que tus clientes SIEMPRE regresen. Sin cambiar tu caja.
              </p>
              <HomeCta />
              <p className="mt-3 text-xs text-white/35">Sin tarjeta de crédito · Sin contrato</p>
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

        {/* ── Problem ── */}
        <section className="px-4 py-16 sm:px-6 sm:py-20" aria-labelledby="problema-heading">
          <div className="mx-auto max-w-6xl">
            <h2 id="problema-heading" className="text-2xl font-bold tracking-tight text-[#1C2526] sm:text-3xl">
              Problemas comunes en negocios locales
            </h2>
            <p className="mt-3 max-w-2xl text-[#1C2526]/70">
              No necesitas depender de apps de delivery. Necesitas herramientas para que quien ya te conoce vuelva.
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
              Configura en 15 minutos, sin contratos. Comeleal funciona junto a tu punto de venta actual.
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
              Registra tu negocio y deja activa tu primera recompensa en menos de 5 minutos.
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
