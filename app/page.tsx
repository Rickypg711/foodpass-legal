import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  HOME_PAGE_TITLE,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_URL,
  siteIcons,
} from "@/lib/siteMetadata";

export const metadata: Metadata = {
  title: HOME_PAGE_TITLE,
  description: SITE_DESCRIPTION,
  openGraph: {
    title: HOME_PAGE_TITLE,
    description: SITE_DESCRIPTION,
    siteName: SITE_NAME,
    locale: "es_MX",
    type: "website",
    url: SITE_URL,
  },
  twitter: {
    card: "summary_large_image",
    title: HOME_PAGE_TITLE,
    description: SITE_DESCRIPTION,
  },
  icons: siteIcons,
  alternates: {
    canonical: SITE_URL,
  },
};

const NAV_LINKS = [
  { href: "#como-funciona", label: "Cómo funciona" },
  { href: "#restaurantes", label: "Para restaurantes" },
  { href: "/download.html", label: "Descargar app" },
  { href: "/support.html", label: "Soporte" },
] as const;

const VALUE_CARDS = [
  {
    title: "Explora lugares locales",
    body: "Encuentra restaurantes cerca de ti y descubre dónde comer en tu ciudad.",
    icon: "📍",
  },
  {
    title: "Gana puntos y recompensas",
    body: "Acumula beneficios cuando visitas restaurantes participantes.",
    icon: "⭐",
  },
  {
    title: "Vuelve fácil a tus favoritos",
    body: "Guarda tus lugares preferidos y vuelve más fácil cuando se te antoje.",
    icon: "🔁",
  },
] as const;

const STEPS = [
  { step: "1", title: "Encuentra un lugar", body: "Explora restaurantes locales en la app." },
  { step: "2", title: "Revisa o visita", body: "Explora el menú y visita el local cuando se te antoje." },
  { step: "3", title: "Acumula recompensas", body: "Gana puntos según las reglas de cada lugar." },
  { step: "4", title: "Vuelve por más", body: "Canjea recompensas y regresa a tus favoritos." },
] as const;

const FOOTER_LINKS = [
  { href: "/download.html", label: "Descargar app" },
  { href: "/support.html", label: "Soporte" },
  { href: "/privacy-policy.html", label: "Privacy Policy" },
  { href: "/terms-of-use.html", label: "Terms of Use" },
  { href: "/delete-account.html", label: "Delete Account" },
] as const;

const APP_STORE_URL = "https://apps.apple.com/mx/app/foodpass/id6745301069";
const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.comeleal.app";

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

export default function Home() {
  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#1C2526]">
      {/* Header */}
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

          <nav className="hidden md:block" aria-label="Principal">
            <NavLinks className="!flex-row !gap-6" />
          </nav>

          <Link
            href="/download.html"
            className="hidden shrink-0 rounded-full bg-[#F28C38] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#e07d30] sm:inline-block"
          >
            Descargar app
          </Link>

          <details className="relative md:hidden">
            <summary className="min-h-11 cursor-pointer list-none rounded-lg border border-white/15 px-3 py-2.5 text-sm font-medium leading-none text-white [&::-webkit-details-marker]:hidden">
              Menú
            </summary>
            <div className="absolute right-0 mt-2 w-52 rounded-xl border border-white/10 bg-[#1a1a1a] p-4 shadow-xl">
              <NavLinks />
            </div>
          </details>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden bg-[#141414] px-4 py-16 sm:px-6 sm:py-24 lg:py-28">
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(242,140,56,0.18),transparent)]"
            aria-hidden
          />
          <div className="relative mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
            <div>
              <p className="mb-4 inline-block rounded-full border border-[#F28C38]/30 bg-[#F28C38]/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#F28C38]">
                Restaurantes locales · Recompensas
              </p>
              <h1 className="text-3xl font-bold leading-tight tracking-tight text-white sm:text-4xl lg:text-[2.65rem] lg:leading-[1.15]">
                Descubre restaurantes locales y gana recompensas cuando vuelves.
              </h1>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-white/70 sm:text-lg">
                Comeleal conecta personas con lugares locales para descubrir menús, ganar
                recompensas y volver a tus favoritos en una sola app.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link
                  href="/download.html"
                  className="inline-flex w-full min-h-11 items-center justify-center rounded-full bg-[#F28C38] px-6 py-3.5 text-center text-sm font-semibold text-white shadow-lg shadow-[#F28C38]/25 transition-colors hover:bg-[#e07d30] sm:w-auto"
                >
                  Descargar app
                </Link>
                <Link
                  href="#como-funciona"
                  className="inline-flex w-full min-h-11 items-center justify-center rounded-full border border-white/20 bg-white/5 px-6 py-3.5 text-center text-sm font-semibold text-white transition-colors hover:bg-white/10 sm:w-auto"
                >
                  Ver cómo funciona
                </Link>
              </div>
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
                  <p className="mt-5 text-xl font-bold text-white">Comeleal</p>
                  <p className="mt-2 text-sm leading-relaxed text-white/60">
                    Tu app para explorar, ganar puntos y volver a los lugares que te gustan.
                  </p>
                  <div className="mt-6 grid w-full gap-2 text-left text-sm">
                    {["Lugares locales", "Puntos y recompensas", "Explora menús"].map(
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

        {/* Value cards */}
        <section className="px-4 py-16 sm:px-6 sm:py-20" aria-labelledby="valor-heading">
          <div className="mx-auto max-w-6xl">
            <h2
              id="valor-heading"
              className="mb-8 text-2xl font-bold tracking-tight text-[#1C2526] sm:text-3xl"
            >
              Por qué Comeleal
            </h2>
            <div className="grid gap-6 md:grid-cols-3">
              {VALUE_CARDS.map((card) => (
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

        {/* How it works */}
        <section
          id="como-funciona"
          className="scroll-mt-20 border-y border-[#1C2526]/8 bg-white px-4 py-16 sm:px-6 sm:py-20"
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
              Cuatro pasos simples para descubrir lugares, ganar recompensas y regresar.
            </p>
            <ol className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((item) => (
                <li
                  key={item.step}
                  className="relative rounded-2xl border border-[#1C2526]/8 bg-[#FAF7F2] p-5"
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

        {/* Restaurants */}
        <section
          id="restaurantes"
          className="scroll-mt-20 px-4 py-16 sm:px-6 sm:py-20"
          aria-labelledby="restaurantes-heading"
        >
          <div className="mx-auto max-w-6xl">
            <div className="rounded-3xl border border-[#1C2526]/8 bg-[#141414] px-6 py-10 sm:px-10 sm:py-14">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#F28C38]">
                Para restaurantes
              </p>
              <h2
                id="restaurantes-heading"
                className="mt-3 max-w-2xl text-2xl font-bold tracking-tight text-white sm:text-3xl"
              >
                Convierte visitas en clientes que regresan.
              </h2>
              <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/70">
                Comeleal ayuda a restaurantes locales a convertir visitas en clientes que
                regresan con recompensas, menú digital, QR y herramientas simples para operar
                desde una sola app.
              </p>
              <Link
                href="/para-restaurantes"
                className="mt-8 inline-flex w-full min-h-11 max-w-xl items-center justify-center rounded-full border border-white/20 bg-white/5 px-6 py-3.5 text-center text-sm font-semibold text-white transition-colors hover:bg-white/10 sm:w-auto"
              >
                Quiero conocer Comeleal para mi restaurante
              </Link>
            </div>
          </div>
        </section>

        {/* Download */}
        <section
          className="border-t border-[#1C2526]/8 bg-white px-4 py-16 sm:px-6 sm:py-20"
          aria-labelledby="descarga-heading"
        >
          <div className="mx-auto max-w-6xl text-center">
            <h2
              id="descarga-heading"
              className="text-2xl font-bold tracking-tight text-[#1C2526] sm:text-3xl"
            >
              Descarga Comeleal
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-[#1C2526]/70">
              Empieza a explorar restaurantes locales, ganar recompensas y volver a tus favoritos.
            </p>
            <Link
              href="/download.html"
              className="mt-8 inline-flex items-center justify-center rounded-full bg-[#F28C38] px-8 py-3.5 text-sm font-semibold text-white shadow-md transition-colors hover:bg-[#e07d30]"
            >
              Descargar app
            </Link>
            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-6">
              <a
                href={APP_STORE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="transition-opacity hover:opacity-90"
              >
                <Image
                  src="/app-store-badge.svg"
                  alt="Descargar en App Store"
                  width={180}
                  height={60}
                  className="h-[52px] w-auto"
                />
              </a>
              <a
                href={PLAY_STORE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="transition-opacity hover:opacity-90"
              >
                <Image
                  src="/google-play-badge.png"
                  alt="Disponible en Google Play"
                  width={180}
                  height={60}
                  className="h-[52px] w-auto"
                />
              </a>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#1C2526]/10 bg-[#141414] px-4 py-10 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-lg font-bold text-white">Comeleal</p>
            <p className="mt-2 max-w-xs text-sm text-white/55">
              Recompensas y herramientas simples para conectar restaurantes locales con clientes
              que regresan.
            </p>
          </div>
          <nav aria-label="Legal y soporte">
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
