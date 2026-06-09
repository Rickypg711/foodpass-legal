"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { doc, getDoc } from "firebase/firestore";
import { getAuth, signOut } from "firebase/auth";
import { getFirebaseDb } from "@/lib/firebase";
import { waitForAuthReady } from "@/lib/auth";
import FloatingAI from "./_components/FloatingAI";

// ─── Icons ────────────────────────────────────────────────────────────────────

function IconHome() {
  return (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  );
}
function IconQr() {
  return (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12v.01M12 4h.01M4 4h4v4H4V4zm16 0h-4v4h4V4zM4 16h4v4H4v-4z" />
    </svg>
  );
}
function IconUsers() {
  return (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}
function IconCash() {
  return (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  );
}
function IconBarChart() {
  return (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );
}
function IconGear() {
  return (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}
function IconHelp() {
  return (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
function IconChevronLeft() {
  return (
    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
  );
}
function IconLogOut() {
  return (
    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  );
}

// ─── Nav items ────────────────────────────────────────────────────────────────

function IconList() {
  return (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </svg>
  );
}

interface NavDef {
  href: string;
  label: string;
  icon: React.ReactNode;
  exact?: boolean;
}

const NAV_ITEMS: NavDef[] = [
  { href: "/vendor", label: "Panel", icon: <IconHome />, exact: true },
  { href: "/vendor/pedidos", label: "Pedidos", icon: <IconList /> },
  { href: "/vendor/pos", label: "Caja / POS", icon: <IconCash /> },
  { href: "/vendor/scanner", label: "Escanear", icon: <IconQr /> },
  { href: "/vendor/clientes", label: "Clientes", icon: <IconUsers /> },
  { href: "/vendor/reportes", label: "Reportes", icon: <IconBarChart /> },
];

const NAV_SECONDARY: NavDef[] = [
  { href: "/vendor/configuracion", label: "Configuración", icon: <IconGear /> },
  { href: "/para-restaurantes", label: "Ayuda", icon: <IconHelp /> },
];

// ─── Layout ───────────────────────────────────────────────────────────────────

export default function VendorLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [restaurantName, setRestaurantName] = useState<string>("");
  const [isLive] = useState(false);
  const [userName, setUserName] = useState<string>("");
  const [userPhoto, setUserPhoto] = useState<string | null>(null);
  const [userInitial, setUserInitial] = useState<string>("V");

  // Setup pages should render without the sidebar (hooks must come before any return)
  const isSetupFlow = pathname.startsWith("/vendor/setup");

  useEffect(() => {
    if (isSetupFlow) return;
    let cancelled = false;
    async function load() {
      const u = await waitForAuthReady();
      if (!u || cancelled) return;
      const displayName = u.displayName ?? "";
      const email = u.email ?? "";
      setUserName(displayName.split(" ")[0] || email.split("@")[0] || "");
      setUserPhoto(u.photoURL ?? null);
      setUserInitial((displayName[0] ?? email[0] ?? "V").toUpperCase());

      const db = getFirebaseDb();
      const userSnap = await getDoc(doc(db, "users", u.uid));
      const rid = userSnap.data()?.ownedRestaurantId as string | undefined;
      if (!rid || cancelled) return;
      if (!cancelled) setRestaurantId(rid);

      const restSnap = await getDoc(doc(db, "restaurants", rid));
      const rData = restSnap.data() ?? {};
      if (!cancelled) {
        setRestaurantName((rData.name as string | undefined) ?? "");
      }
    }
    load().catch(() => {});
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSetupFlow]);

  if (isSetupFlow) {
    return <>{children}</>;
  }

  const w = open ? 220 : 60;

  function isActive(href: string, exact = false) {
    return exact ? pathname === href : pathname.startsWith(href);
  }

  function NavLink({ href, label, icon, exact }: NavDef) {
    const active = isActive(href, exact);
    return (
      <Link
        href={href}
        className="flex w-full items-center gap-3 rounded-xl px-2.5 py-[9px] text-[13px] font-medium transition-colors"
        title={!open ? label : undefined}
        style={active
          ? { background: "rgba(242,140,56,0.16)", color: "#d97757" }
          : { color: "rgba(255,255,255,0.52)" }
        }
      >
        <span className="shrink-0">{icon}</span>
        {open && <span className="whitespace-nowrap">{label}</span>}
      </Link>
    );
  }

  return (
    <div className="flex min-h-screen" style={{ background: "#F5F3EF" }}>

      {/* ── Sidebar ── */}
      <aside
        className="fixed left-0 top-0 z-30 hidden h-screen flex-col transition-all duration-200 md:flex"
        style={{ width: w, background: "#1C2526", overflow: "hidden" }}
      >
        {/* Logo */}
        <div
          className="flex h-[60px] shrink-0 items-center gap-3 px-4"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.07)", minWidth: w }}
        >
          <Link href="/" className="flex shrink-0 items-center gap-2.5">
            <Image
              src="/comeleal-app-icon.png"
              alt="Comeleal"
              width={28}
              height={28}
              className="h-7 w-7 shrink-0 rounded-[7px]"
              style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.12)" }}
            />
            {open && (
              <span className="whitespace-nowrap text-[15px] font-bold text-white tracking-tight">
                Comeleal
              </span>
            )}
          </Link>
        </div>

        {/* Restaurant name */}
        {open && restaurantName && (
          <div className="shrink-0 px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
            <p className="mb-0.5 text-[10px] font-bold uppercase tracking-widest"
              style={{ color: "rgba(255,255,255,0.28)" }}>
              Restaurante
            </p>
            <p className="truncate text-[13px] font-semibold text-white">{restaurantName}</p>
            {isLive && (
              <div className="mt-1.5 flex items-center gap-1.5">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-70" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-400" />
                </span>
                <span className="text-[10px] font-semibold text-green-400">En vivo</span>
              </div>
            )}
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.href} {...item} />
          ))}
          {open && (
            <div className="my-2" style={{ height: 1, background: "rgba(255,255,255,0.07)" }} />
          )}
          {NAV_SECONDARY.map((item) => (
            <NavLink key={item.href} {...item} />
          ))}
        </nav>

        {/* Collapse toggle */}
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex h-11 w-full shrink-0 items-center justify-center transition-colors hover:bg-white/5"
          style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}
          title={open ? "Colapsar menú" : "Expandir menú"}
        >
          <span
            className="text-white/40"
            style={{ transform: open ? "none" : "rotate(180deg)", display: "inline-block", transition: "transform 0.2s" }}
          >
            <IconChevronLeft />
          </span>
        </button>

        {/* User section */}
        {open ? (
          <div className="shrink-0 p-3" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
            <div className="flex items-center gap-2.5">
              {userPhoto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={userPhoto}
                  alt=""
                  className="h-7 w-7 shrink-0 rounded-full"
                  style={{ boxShadow: "0 0 0 1.5px rgba(255,255,255,0.16)" }}
                />
              ) : (
                <div
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                  style={{ background: "rgba(242,140,56,0.2)", color: "#d97757" }}
                >
                  {userInitial}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] font-semibold" style={{ color: "rgba(255,255,255,0.7)" }}>
                  {userName || "Propietario"}
                </p>
                <span
                  className="inline-flex rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider"
                  style={{ background: "rgba(242,140,56,0.18)", color: "#d97757" }}
                >
                  Free
                </span>
              </div>
              <button
                onClick={async () => {
                  await signOut(getAuth());
                  router.push("/activar");
                }}
                className="shrink-0 rounded-lg p-1.5 transition-colors hover:bg-white/10"
                title="Cerrar sesión"
              >
                <IconLogOut />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex shrink-0 items-center justify-center py-3">
            {userPhoto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={userPhoto} alt="" className="h-7 w-7 rounded-full" />
            ) : (
              <div
                className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold"
                style={{ background: "rgba(242,140,56,0.2)", color: "#d97757" }}
              >
                {userInitial}
              </div>
            )}
          </div>
        )}
      </aside>

      {/* Sidebar spacer — pushes content right (sidebar is fixed/out-of-flow) */}
      <div
        className="hidden shrink-0 transition-all duration-200 md:block"
        style={{ width: w }}
      />

      {/* ── Page content ── */}
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        {children}
      </div>

      {/* ── Floating AI ── */}
      <FloatingAI restaurantId={restaurantId} />
    </div>
  );
}
