"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { getAuth, onAuthStateChanged, signOut } from "firebase/auth";
import { getFirebaseApp } from "@/lib/firebase";

const NAV_LINKS = [
  { href: "#como-funciona", label: "Cómo funciona" },
  { href: "#beneficios", label: "Beneficios" },
  { href: "#preguntas", label: "Preguntas" },
  // Customer door on a vendor-first homepage: diners who land here reach
  // their balance without touching the vendor funnel.
  { href: "/puntos", label: "Mis puntos" },
] as const;

// 17-sep-2026 (Ricardo, paso 1 de la portada contenida): header blanco, sin
// color de marca, sin emoji en la nav. Sigue sin "Empieza gratis" (10-sep):
// el único CTA de alta es el botón del hero; aquí solo "Entrar".
const PILL = "shrink-0 rounded-full border border-[#1A1816]/15 px-4 py-1.5 text-[13px] font-medium text-[#1A1816]/80 transition-colors hover:border-[#1A1816]/40 hover:text-[#1A1816]";

export function HomeHeader() {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    getFirebaseApp();
    const unsub = onAuthStateChanged(getAuth(), (user) => {
      setLoggedIn(!!user);
    });
    return unsub;
  }, []);

  async function handleSignOut() {
    await signOut(getAuth());
    setLoggedIn(false);
  }

  return (
    <header className="sticky top-0 z-50 border-b border-[#1A1816]/8 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <Image src="/comeleal-app-icon.png" alt="Comeleal" width={28} height={28}
            className="h-7 w-7 rounded-[8px]" />
          <span className="text-[15px] font-semibold tracking-tight text-[#1A1816]">Comeleal</span>
        </Link>

        <nav className="hidden md:block" aria-label="Principal">
          <ul className="flex items-center gap-7">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href}
                  className="text-[13px] font-medium text-[#1A1816]/70 transition-colors hover:text-[#1A1816]">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Desktop auth CTAs — hidden until auth state known to avoid flash */}
        <div className="hidden items-center gap-2 sm:flex">
          {loggedIn === true ? (
            <>
              <Link href="/vendor" className={PILL}>Mi panel</Link>
              <button onClick={handleSignOut} className={`${PILL} text-[#1A1816]/50`}>Cerrar sesión</button>
            </>
          ) : (
            <Link href="/activar?modo=entrar" className={PILL}>Entrar</Link>
          )}
        </div>

        {/* Mobile menu */}
        <details className="relative md:hidden">
          <summary className="min-h-11 cursor-pointer list-none rounded-full border border-[#1A1816]/15 px-4 py-2.5 text-[13px] font-medium leading-none text-[#1A1816]/80 [&::-webkit-details-marker]:hidden">
            Menú
          </summary>
          <div className="absolute right-0 mt-2 w-52 rounded-xl border border-[#1A1816]/10 bg-white p-4 shadow-xl">
            <ul className="flex flex-col gap-1">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href}
                    className="block py-2 text-sm font-medium text-[#1A1816]/80 hover:text-[#1A1816]">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-col gap-2 border-t border-[#1A1816]/10 pt-4">
              {loggedIn === true ? (
                <>
                  <Link href="/vendor" className="block rounded-lg px-3 py-2 text-sm text-[#1A1816]/70 hover:text-[#1A1816]">Mi panel</Link>
                  <button onClick={handleSignOut} className="block rounded-lg px-3 py-2 text-left text-sm text-[#1A1816]/50 hover:text-[#1A1816]">Cerrar sesión</button>
                </>
              ) : (
                <Link href="/activar?modo=entrar" className="block rounded-lg px-3 py-2 text-sm text-[#1A1816]/70 hover:text-[#1A1816]">Entrar</Link>
              )}
            </div>
          </div>
        </details>
      </div>
    </header>
  );
}
