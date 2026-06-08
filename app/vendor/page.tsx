"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  Timestamp,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import { waitForAuthReady } from "@/lib/auth";
import type { User } from "firebase/auth";

// ─── Types ────────────────────────────────────────────────────────────────────

type LoadState = "loading" | "ready" | "error";

interface DashboardData {
  restaurantName: string;
  scanCountTotal: number;
  scansToday: number;
  pointsToday: number;
  weeklyBriefText?: string;
  atRiskCount?: number;
  restaurantStatus: string;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function VendorDashboard() {
  const router = useRouter();
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [user, setUser] = useState<User | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    async function init() {
      const u = await waitForAuthReady();

      // Not signed in or anonymous → go register
      if (!u || u.isAnonymous) {
        router.push("/activar");
        return;
      }
      setUser(u);

      try {
        const db = getFirebaseDb();
        const userSnap = await getDoc(doc(db, "users", u.uid));
        const userData = userSnap.data();

        if (!userData?.ownedRestaurantId) {
          router.push("/activar");
          return;
        }

        const rid = userData.ownedRestaurantId as string;

        const todayStart = (() => {
          const d = new Date();
          d.setHours(0, 0, 0, 0);
          return Timestamp.fromDate(d);
        })();

        const [restaurantSnap, insightsSnap, visitsSnap] = await Promise.all([
          getDoc(doc(db, "restaurants", rid)),
          getDoc(doc(db, "restaurants", rid, "vendorInsights", "current")),
          getDocs(
            query(
              collection(db, "restaurants", rid, "visitHistory"),
              where("timestamp", ">=", todayStart)
            )
          ),
        ]);

        const r = restaurantSnap.data() ?? {};
        const ins = insightsSnap.exists() ? insightsSnap.data() : {};

        let scansToday = 0;
        let pointsToday = 0;
        visitsSnap.forEach((d) => {
          scansToday++;
          pointsToday += d.data().pointsAwarded ?? 0;
        });

        setData({
          restaurantName: r.name ?? "Mi restaurante",
          scanCountTotal: r.scanCount ?? 0,
          scansToday,
          pointsToday,
          weeklyBriefText: ins.weeklyBriefText,
          atRiskCount: ins.atRiskCount,
          restaurantStatus: r.status ?? "active",
        });
        setLoadState("ready");
      } catch (err) {
        console.error("[vendor/dashboard]", err);
        setLoadState("error");
      }
    }
    init();
  }, [router]);

  // ── Loading ─────────────────────────────────────────────────────────────────

  if (loadState === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#141414]">
        <Spinner />
      </div>
    );
  }

  if (loadState === "error" || !data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#141414] px-6 text-center">
        <p className="text-sm text-white/50">No pudimos cargar tu panel.</p>
        <button
          onClick={() => window.location.reload()}
          className="rounded-xl bg-[#F28C38] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#e07d30]"
        >
          Reintentar
        </button>
      </div>
    );
  }

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Buenos días" : hour < 19 ? "Buenas tardes" : "Buenas noches";
  const firstName = user?.displayName?.split(" ")[0] ?? "";

  return (
    <div className="min-h-screen bg-[#141414]">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-10 border-b border-white/8 bg-[#141414]/95 backdrop-blur-sm px-4 py-3">
        <div className="mx-auto flex max-w-xl items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Link href="/">
              <Image
                src="/comeleal-app-icon.png"
                alt="Comeleal"
                width={28}
                height={28}
                className="h-7 w-7 rounded-[7px] ring-1 ring-white/15"
              />
            </Link>
            <div className="h-4 w-px bg-white/10" />
            <p className="max-w-[160px] truncate text-sm font-semibold text-white/90">
              {data.restaurantName}
            </p>
            {data.restaurantStatus === "setup" && (
              <span className="hidden rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-amber-400 sm:inline-block">
                Setup
              </span>
            )}
          </div>
          {user?.photoURL && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.photoURL}
              alt=""
              className="h-7 w-7 rounded-full ring-1 ring-white/15"
            />
          )}
        </div>
      </header>

      <main className="mx-auto max-w-xl px-4 pb-16 pt-7">
        {/* ── Greeting ───────────────────────────────────────────────────────── */}
        <div className="mb-7">
          <p className="text-[11px] font-medium uppercase tracking-widest text-white/30">
            {new Date().toLocaleDateString("es-MX", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </p>
          <h1 className="mt-1 text-[22px] font-bold text-white">
            {greeting}
            {firstName ? `, ${firstName}` : ""}
          </h1>
        </div>

        {/* ── Primary CTA — Scanner ───────────────────────────────────────────── */}
        <Link
          href="/vendor/scanner"
          className="mb-4 flex items-center justify-between rounded-2xl bg-[#F28C38] p-5 transition-all active:scale-[0.98] hover:bg-[#e07d30]"
          style={{ boxShadow: "0 6px 24px rgba(242,140,56,0.25)" }}
        >
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/65">
              Acción rápida
            </p>
            <p className="mt-0.5 text-[18px] font-bold text-white">
              Escanear cliente
            </p>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 text-white">
            <QrCodeIcon size={22} />
          </div>
        </Link>

        {/* ── Stats row ──────────────────────────────────────────────────────── */}
        <div className="mb-4 grid grid-cols-3 gap-2.5">
          <StatCard
            value={data.scansToday}
            label="scans hoy"
            accent={data.scansToday > 0}
          />
          <StatCard value={data.scanCountTotal} label="total" />
          {data.atRiskCount !== undefined ? (
            <StatCard
              value={data.atRiskCount}
              label="en riesgo"
              danger={data.atRiskCount > 0}
            />
          ) : (
            <StatCard value={data.pointsToday} label="pts hoy" />
          )}
        </div>

        {/* ── Brain brief ────────────────────────────────────────────────────── */}
        <div
          className={`rounded-2xl border p-5 ${
            data.weeklyBriefText
              ? "border-[#F28C38]/20 bg-[#F28C38]/6"
              : "border-white/8 bg-white/3"
          }`}
        >
          <div className="mb-3 flex items-center gap-2">
            <span className="text-[15px]">🧠</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#F28C38]/70">
              Brain · Resumen semanal
            </span>
          </div>
          {data.weeklyBriefText ? (
            <p className="text-sm leading-relaxed text-white/75">
              {data.weeklyBriefText}
            </p>
          ) : (
            <p className="text-sm italic text-white/30">
              El Brain necesita más scans para generar un resumen. Escanea tus
              primeros clientes para activarlo.
            </p>
          )}
        </div>

        {/* ── Bottom links ───────────────────────────────────────────────────── */}
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          <a
            href="https://apps.apple.com/mx/app/foodpass/id6745301069"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 rounded-xl border border-white/8 bg-white/3 px-4 py-3 text-sm text-white/45 transition-colors hover:text-white/75"
          >
            <span>📱</span>
            <span>Abrir app</span>
          </a>
          <Link
            href="/para-restaurantes"
            className="flex items-center gap-2.5 rounded-xl border border-white/8 bg-white/3 px-4 py-3 text-sm text-white/45 transition-colors hover:text-white/75"
          >
            <span>❓</span>
            <span>Ayuda</span>
          </Link>
        </div>
      </main>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  value,
  label,
  accent = false,
  danger = false,
}: {
  value: number;
  label: string;
  accent?: boolean;
  danger?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-3.5 ${
        danger
          ? "border-red-500/20 bg-red-500/6"
          : accent
            ? "border-[#F28C38]/25 bg-[#F28C38]/6"
            : "border-white/8 bg-white/3"
      }`}
    >
      <p
        className={`font-mono text-[30px] font-bold leading-none tabular-nums ${
          danger ? "text-red-400" : accent ? "text-[#F28C38]" : "text-white"
        }`}
      >
        {value}
      </p>
      <p className="mt-1.5 text-[11px] text-white/40">{label}</p>
    </div>
  );
}

function Spinner() {
  return (
    <svg
      className="h-5 w-5 animate-spin text-[#F28C38]"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 12 5.373 12 12H4z"
      />
    </svg>
  );
}

function QrCodeIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M3 11V3h8v8H3zm2-6v4h4V5H5zm8-2h8v8h-8V3zm2 2v4h4V5h-4zM3 13h8v8H3v-8zm2 2v4h4v-4H5zm10 0h2v2h-2v-2zm2 2h2v2h-2v-2zm-2 2h2v2h-2v-2zm-2-4h2v2h-2v-2zm0 4h2v2h-2v-2zm4-2h2v2h-2v-2zm2-2h2v2h-2v-2z" />
    </svg>
  );
}
