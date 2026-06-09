"use client";

import React, { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";

const APP_STORE_URL = "https://apps.apple.com/mx/app/foodpass/id6745301069";
const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.comeleal.app";

const VALUE_CARDS = [
  {
    title: "Gana puntos en restaurantes participantes",
    icon: "⭐",
  },
  {
    title: "Canjea recompensas exclusivas",
    icon: "🎁",
  },
  {
    title: "Descubre lugares locales cerca de ti",
    icon: "📍",
  },
  {
    title: "Vuelve fácil a tus favoritos",
    icon: "🔁",
  },
] as const;

const FOOTER_LINKS = [
  { href: "/support.html", label: "Soporte" },
  { href: "/privacy-policy.html", label: "Política de Privacidad" },
  { href: "/terms-of-use.html", label: "Términos de Uso" },
  { href: "/delete-account.html", label: "Eliminar Cuenta" },
] as const;

function DownloadContent() {
  const searchParams = useSearchParams();
  const type = searchParams.get("type") || "";
  const rid = searchParams.get("restaurantId") || "";
  const hasCtx = !!(type || rid);

  let leadText = "Gana recompensas en restaurantes locales, descubre menús y vuelve fácil a tus favoritos.";
  let ctxHint: string | null = null;

  if (type === "menu" && rid) {
    leadText = "Te compartieron un menú. Descarga Comeleal para ver este lugar, guardar tus favoritos y ganar recompensas.";
  } else if (hasCtx) {
    if (type === "restaurant" && rid) {
      ctxHint = "Te compartieron un restaurante. Ábrelo en Comeleal para ver el perfil.";
    } else if (type === "referral" && rid) {
      ctxHint = "Te invitaron a un restaurante en Comeleal. Abre la app para ver el perfil y tus beneficios.";
    } else {
      ctxHint = "Abre Comeleal para continuar.";
    }
  }

  useEffect(() => {
    if (hasCtx) return;

    // Best-effort auto-redirect for mobile devices when there is no direct link context
    const userAgent = navigator.userAgent || navigator.vendor || "";
    const isIOS = /iPad|iPhone|iPod/.test(userAgent) && !("MSStream" in window);
    const isAndroid = /android/i.test(userAgent);

    if (isIOS) {
      window.location.replace(APP_STORE_URL);
    } else if (isAndroid) {
      window.location.replace(PLAY_STORE_URL);
    }
  }, [hasCtx]);

  return (
    <div className="flex min-h-screen flex-col bg-[#FAF7F2] text-[#1C2526]">
      {/* Header Bar */}
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
          <Link
            href="/"
            className="rounded-full border border-white/20 bg-white/5 px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-white/10"
          >
            Volver al inicio
          </Link>
        </div>
      </header>

      <main className="flex-grow">
        {/* Dark Hero */}
        <section className="relative overflow-hidden bg-[#141414] px-4 py-16 text-center sm:px-6 sm:py-24">
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(242,140,56,0.18),transparent)]"
            aria-hidden
          />
          <div className="relative mx-auto max-w-xl">
            <div className="mx-auto mb-6 h-20 w-20">
              <Image
                src="/comeleal-app-icon.png"
                alt="Comeleal Logo"
                width={80}
                height={80}
                className="h-20 w-20 rounded-[20px] shadow-2xl ring-1 ring-white/10"
                priority
              />
            </div>
            <p className="mb-4 inline-block rounded-full border border-[#d97757]/30 bg-[#d97757]/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#d97757]">
              Restaurantes locales · Recompensas
            </p>
            <h1 className="text-3xl font-bold leading-tight tracking-tight text-white sm:text-4xl">
              Descargar Comeleal
            </h1>
            <p className="mt-4 text-base leading-relaxed text-white/70">
              {leadText}
            </p>

            {ctxHint && (
              <div className="mx-auto mt-6 max-w-md rounded-xl border border-[#d97757]/30 bg-[#d97757]/10 px-4 py-3 text-sm font-semibold text-[#FFB366]">
                {ctxHint}
              </div>
            )}

            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-6">
              <a
                href={APP_STORE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="transition-transform hover:scale-105 active:scale-95"
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
                className="transition-transform hover:scale-105 active:scale-95"
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
            <p className="mt-4 text-xs text-white/50">Disponible para iPhone y Android</p>
          </div>
        </section>

        {/* Benefits cards */}
        <section className="px-4 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-3xl">
            <h2 className="mb-8 text-center text-xl font-bold tracking-tight text-[#1C2526] sm:text-2xl">
              Por qué descargar la app
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {VALUE_CARDS.map((card, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 rounded-2xl border border-[#1C2526]/8 bg-white p-5 shadow-sm"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#d97757]/10 text-xl" aria-hidden>
                    {card.icon}
                  </span>
                  <span className="font-semibold text-[#1C2526] text-sm sm:text-base">{card.title}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#1C2526]/10 bg-[#141414] px-4 py-8 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 sm:flex-row">
          <div>
            <p className="text-base font-bold text-white">Comeleal</p>
            <p className="mt-1 text-xs text-white/50">
              Operamos Comeleal · Todos los derechos reservados.
            </p>
          </div>
          <nav aria-label="Legal y soporte">
            <ul className="flex flex-wrap justify-center gap-x-6 gap-y-2">
              {FOOTER_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-xs font-semibold text-white/60 transition-colors hover:text-white"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <p className="mx-auto mt-6 max-w-6xl border-t border-white/5 pt-6 text-center text-[11px] text-white/35">
          © 2026 Comeleal.
        </p>
      </footer>
    </div>
  );
}

export default function DownloadPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-[#FAF7F2]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#d97757] border-t-transparent"></div>
      </div>
    }>
      <DownloadContent />
    </Suspense>
  );
}
