"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { getAuth, onAuthStateChanged, signOut } from "firebase/auth";
import { getFirebaseApp } from "@/lib/firebase";
import { ActivarModal } from "@/components/home/ActivarModal";

const NAV_LINKS = [
  { href: "#como-funciona", label: "Cómo funciona" },
  { href: "#beneficios", label: "Beneficios" },
  { href: "#preguntas", label: "Preguntas" },
] as const;

export function HomeHeader() {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

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
    <>
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#141414]/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <Image src="/comeleal-app-icon.png" alt="Comeleal" width={36} height={36}
            className="h-9 w-9 rounded-[10px] ring-1 ring-white/15" />
          <span className="text-lg font-bold tracking-tight text-white">Comeleal</span>
        </Link>

        <nav className="hidden md:block" aria-label="Principal">
          <ul className="flex items-center gap-6">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href}
                  className="text-sm font-medium text-white/85 transition-colors hover:text-white">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Desktop auth CTAs — hidden until auth state known to avoid flash */}
        <div className="hidden items-center gap-3 sm:flex">
          {loggedIn === true ? (
            <>
              <Link href="/vendor"
                className="shrink-0 rounded-full border border-white/20 px-4 py-2 text-sm font-medium text-white/70 transition-colors hover:border-white/40 hover:text-white">
                Mi panel
              </Link>
              <button
                onClick={handleSignOut}
                className="shrink-0 rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-white/50 transition-colors hover:text-white/80">
                Cerrar sesión
              </button>
            </>
          ) : (
            <>
              <Link href="/vendor"
                className="shrink-0 rounded-full border border-white/20 px-4 py-2 text-sm font-medium text-white/70 transition-colors hover:border-white/40 hover:text-white">
                Entrar
              </Link>
              <button
                onClick={() => setModalOpen(true)}
                className="shrink-0 rounded-full bg-[#d97757] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#c46644]">
                Empieza gratis
              </button>
            </>
          )}
        </div>

        {/* Mobile menu */}
        <details className="relative md:hidden">
          <summary className="min-h-11 cursor-pointer list-none rounded-lg border border-white/15 px-3 py-2.5 text-sm font-medium leading-none text-white [&::-webkit-details-marker]:hidden">
            Menú
          </summary>
          <div className="absolute right-0 mt-2 w-52 rounded-xl border border-white/10 bg-[#1a1a1a] p-4 shadow-xl">
            <ul className="flex flex-col gap-1">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href}
                    className="block py-2 text-sm font-medium text-white/85 hover:text-white">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-col gap-2 border-t border-white/10 pt-4">
              {loggedIn === true ? (
                <>
                  <Link href="/vendor" className="block rounded-lg px-3 py-2 text-sm text-white/70 hover:text-white">Mi panel</Link>
                  <button onClick={handleSignOut} className="block rounded-lg px-3 py-2 text-left text-sm text-white/50 hover:text-white/80">Cerrar sesión</button>
                </>
              ) : (
                <>
                  <Link href="/vendor" className="block rounded-lg px-3 py-2 text-sm text-white/70 hover:text-white">Entrar</Link>
                  <button onClick={() => setModalOpen(true)} className="block w-full rounded-full bg-[#d97757] px-3 py-2 text-center text-sm font-semibold text-white">Empieza gratis</button>
                </>
              )}
            </div>
          </div>
        </details>
      </div>
    </header>
    {modalOpen && <ActivarModal asModal onClose={() => setModalOpen(false)} />}
    </>
  );
}
