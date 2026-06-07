"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  collection,
  doc,
  addDoc,
  getDoc,
  serverTimestamp,
} from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getFirebaseDb, getFirebaseApp } from "@/lib/firebase";
import { getFirebaseAuth, signInWithGoogle, waitForAuthReady } from "@/lib/auth";
import type { User } from "firebase/auth";

// ─── Constants ────────────────────────────────────────────────────────────────

const APP_STORE_URL = "https://apps.apple.com/mx/app/foodpass/id6745301069";
const PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=com.comeleal.app";

const RESTAURANT_CATEGORIES = [
  "Tacos",
  "Café",
  "Hamburguesas",
  "Pizza",
  "Sushi",
  "Mariscos",
  "Antojitos",
  "Carnes",
  "Postres",
  "Otro",
] as const;

const DEFAULT_BUSINESS_HOURS = Object.fromEntries(
  ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map(
    (day) => [
      day,
      {
        openingTime: { hour: 9, minute: 0 },
        closingTime: { hour: 17, minute: 0 },
        isClosed: false,
      },
    ]
  )
);

// ─── Types ────────────────────────────────────────────────────────────────────

type Stage = "idle" | "signing" | "form" | "creating" | "done" | "existing";

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ActivarPage() {
  const [stage, setStage] = useState<Stage>("idle");
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [category, setCategory] = useState<string>("");

  // Check if user already has a restaurant on mount
  useEffect(() => {
    waitForAuthReady().then(async (u) => {
      if (!u) return;
      setUser(u);
      try {
        const userDoc = await getDoc(
          doc(getFirebaseDb(), "users", u.uid)
        );
        const data = userDoc.data();
        if (data?.ownedRestaurantId) {
          setStage("existing");
        } else {
          setStage("form");
        }
      } catch {
        setStage("form");
      }
    });
  }, []);

  // ── Handlers ───────────────────────────────────────────────────────────────

  async function handleGoogleSignIn() {
    setError(null);
    setStage("signing");
    try {
      const u = await signInWithGoogle();
      setUser(u);
      // Check if they already own a restaurant
      const userDoc = await getDoc(doc(getFirebaseDb(), "users", u.uid));
      const data = userDoc.data();
      if (data?.ownedRestaurantId) {
        setStage("existing");
      } else {
        setStage("form");
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error al iniciar sesión";
      // User closed the popup — silently reset
      if (msg.includes("popup-closed") || msg.includes("cancelled")) {
        setStage("idle");
      } else {
        setError("No pudimos conectar con Google. Intenta de nuevo.");
        setStage("idle");
      }
    }
  }

  async function handleCreateRestaurant(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setError(null);
    setStage("creating");

    try {
      const db = getFirebaseDb();

      // Create the restaurant document (mirrors AddRestaurantScreen.dart)
      const restaurantRef = await addDoc(collection(db, "restaurants"), {
        name: name.trim(),
        address: "",
        phone: phone.trim(),
        whatsapp: phone.trim(),
        categories: category ? [category] : [],
        ownerId: user.uid,
        billingOwnerUserId: user.uid,
        createdAt: serverTimestamp(),
        currencyCode: "MXN",
        loyaltyEarnPolicy: {
          currencyCode: "MXN",
          basePointsPerPurchase: 1,
          spendStepAmount: 30,
        },
        pointsPerVisit: 1,
        pointsRequired: 10,
        lat: 0,
        lng: 0,
        locationSource: "web_signup",
        locationVerifiedAt: serverTimestamp(),
        locationUpdatedAt: serverTimestamp(),
        rewardTiers: [],
        businessHours: DEFAULT_BUSINESS_HOURS,
        hoursConfirmed: false,
        subscriptionPlan: "free",
        subscriptionAccessStatus: "inactive",
        subscriptionAccessExpiresAt: null,
        subscriptionTrialEndsAt: null,
        subscriptionUpdatedAt: serverTimestamp(),
        scanCount: 0,
        lastReset: serverTimestamp(),
        status: "setup",
        isSetupComplete: false,
      });

      // Call ensureOwnerMember CF to set ownedRestaurantId + vendorRole on user doc
      const functions = getFunctions(getFirebaseApp(), "us-central1");
      const ensureOwnerMember = httpsCallable(functions, "ensureOwnerMember");
      await ensureOwnerMember({ restaurantId: restaurantRef.id });

      setStage("done");
    } catch (e: unknown) {
      console.error("[activar] create failed:", e);
      setError("No pudimos crear tu restaurante. Intenta de nuevo.");
      setStage("form");
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#141414] text-white">
      {/* Header */}
      <header className="border-b border-white/10 px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <Image
              src="/comeleal-app-icon.png"
              alt="Comeleal"
              width={32}
              height={32}
              className="h-8 w-8 rounded-[8px] ring-1 ring-white/15"
            />
            <span className="text-base font-bold tracking-tight text-white">
              Comeleal
            </span>
          </Link>
          <Link
            href="/para-restaurantes"
            className="text-sm text-white/60 hover:text-white transition-colors"
          >
            ¿Por qué Comeleal?
          </Link>
        </div>
      </header>

      <main className="flex min-h-[calc(100vh-57px)] flex-col items-center justify-center px-4 py-12">
        {/* ── idle / signing: landing ─────────────────────────────────────── */}
        {(stage === "idle" || stage === "signing") && (
          <div className="mx-auto w-full max-w-md text-center">
            <div className="mb-8 inline-block rounded-full border border-[#F28C38]/30 bg-[#F28C38]/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#F28C38]">
              Para restaurantes
            </div>
            <h1 className="text-3xl font-bold leading-tight tracking-tight text-white sm:text-4xl">
              Registra tu restaurante en minutos.
            </h1>
            <p className="mt-4 text-base leading-relaxed text-white/60">
              Un clic con Google y empiezas a fidelizar clientes hoy mismo. Sin POS, sin contratos.
            </p>

            {/* Social proof */}
            <div className="mt-8 flex items-center justify-center gap-6 text-sm text-white/50">
              <div className="flex flex-col items-center">
                <span className="text-xl font-bold text-white">Gratis</span>
                <span>siempre</span>
              </div>
              <div className="h-8 w-px bg-white/10" />
              <div className="flex flex-col items-center">
                <span className="text-xl font-bold text-white">50</span>
                <span>scans / mes</span>
              </div>
              <div className="h-8 w-px bg-white/10" />
              <div className="flex flex-col items-center">
                <span className="text-xl font-bold text-white">15 min</span>
                <span>para activar</span>
              </div>
            </div>

            {error && (
              <p className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {error}
              </p>
            )}

            <button
              onClick={handleGoogleSignIn}
              disabled={stage === "signing"}
              className="mt-8 flex w-full items-center justify-center gap-3 rounded-xl border border-white/15 bg-white px-6 py-3.5 text-sm font-semibold text-[#1C2526] shadow-lg transition-all hover:bg-white/90 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {stage === "signing" ? (
                <>
                  <Spinner className="text-[#1C2526]" />
                  Conectando…
                </>
              ) : (
                <>
                  <GoogleLogo />
                  Continuar con Google
                </>
              )}
            </button>

            <p className="mt-4 text-xs text-white/35">
              Al continuar aceptas los{" "}
              <Link
                href="/terms-of-use.html"
                className="underline hover:text-white/60"
              >
                Términos de uso
              </Link>{" "}
              y{" "}
              <Link
                href="/privacy-policy.html"
                className="underline hover:text-white/60"
              >
                Política de privacidad
              </Link>
              .
            </p>

            {/* Feature preview */}
            <div className="mt-12 grid gap-3 text-left text-sm">
              {[
                { icon: "📱", text: "QR de lealtad — clientes escanean y acumulan puntos" },
                { icon: "🧠", text: "Inteligencia de retención — sabes quién ya no regresó" },
                { icon: "💳", text: "Apple Wallet y Google Wallet — sin que descarguen app" },
                { icon: "📋", text: "Menú digital — sin imprimir nada" },
              ].map((f) => (
                <div
                  key={f.text}
                  className="flex items-start gap-3 rounded-xl border border-white/8 bg-white/5 px-4 py-3"
                >
                  <span className="text-base">{f.icon}</span>
                  <span className="text-white/70">{f.text}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── form: restaurant details ────────────────────────────────────── */}
        {(stage === "form" || stage === "creating") && user && (
          <div className="mx-auto w-full max-w-md">
            {/* User greeting */}
            <div className="mb-6 flex items-center gap-3">
              {user.photoURL && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.photoURL}
                  alt=""
                  className="h-10 w-10 rounded-full ring-1 ring-white/15"
                />
              )}
              <div>
                <p className="text-sm font-semibold text-white">
                  {user.displayName ?? user.email}
                </p>
                <p className="text-xs text-white/50">{user.email}</p>
              </div>
            </div>

            <h1 className="text-2xl font-bold text-white">
              Cuéntanos de tu restaurante
            </h1>
            <p className="mt-2 text-sm text-white/55">
              Solo lo esencial — puedes completar el resto desde la app.
            </p>

            {error && (
              <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {error}
              </p>
            )}

            <form onSubmit={handleCreateRestaurant} className="mt-6 flex flex-col gap-4">
              {/* Name */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-white/50">
                  Nombre del restaurante *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="El Rancho de Don Pepe"
                  disabled={stage === "creating"}
                  className="w-full rounded-xl border border-white/15 bg-white/8 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-[#F28C38]/60 focus:outline-none focus:ring-2 focus:ring-[#F28C38]/20 disabled:opacity-50"
                />
              </div>

              {/* WhatsApp */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-white/50">
                  WhatsApp / Teléfono *
                </label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+52 614 123 4567"
                  disabled={stage === "creating"}
                  className="w-full rounded-xl border border-white/15 bg-white/8 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-[#F28C38]/60 focus:outline-none focus:ring-2 focus:ring-[#F28C38]/20 disabled:opacity-50"
                />
              </div>

              {/* Category */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-white/50">
                  Tipo de restaurante
                </label>
                <div className="flex flex-wrap gap-2">
                  {RESTAURANT_CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategory(cat === category ? "" : cat)}
                      disabled={stage === "creating"}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all disabled:opacity-50 ${
                        category === cat
                          ? "border-[#F28C38] bg-[#F28C38]/20 text-[#F28C38]"
                          : "border-white/15 bg-white/5 text-white/60 hover:border-white/30 hover:text-white"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={!name.trim() || !phone.trim() || stage === "creating"}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[#F28C38] px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-[#F28C38]/20 transition-all hover:bg-[#e07d30] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {stage === "creating" ? (
                  <>
                    <Spinner className="text-white" />
                    Creando tu restaurante…
                  </>
                ) : (
                  "Activar mi restaurante →"
                )}
              </button>
            </form>
          </div>
        )}

        {/* ── done: success ───────────────────────────────────────────────── */}
        {stage === "done" && (
          <div className="mx-auto w-full max-w-md text-center">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[#F28C38]/15 text-4xl">
              🎉
            </div>
            <h1 className="text-2xl font-bold text-white">
              ¡Tu restaurante está listo!
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-white/60">
              Descarga la app para completar tu perfil, ver el QR de lealtad y
              empezar a escanear clientes.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
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

            <div className="mt-10 grid gap-3 text-left text-sm">
              {[
                "Inicia sesión con la misma cuenta de Google",
                "Completa tu dirección y horarios",
                "Muestra el QR a tus primeros clientes",
              ].map((step, i) => (
                <div
                  key={step}
                  className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/5 px-4 py-3"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#F28C38] text-xs font-bold text-white">
                    {i + 1}
                  </span>
                  <span className="text-white/70">{step}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── existing: already has restaurant ───────────────────────────── */}
        {stage === "existing" && (
          <div className="mx-auto w-full max-w-md text-center">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[#F28C38]/15 text-4xl">
              ✓
            </div>
            <h1 className="text-2xl font-bold text-white">
              Ya tienes un restaurante en Comeleal
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-white/60">
              Descarga la app e inicia sesión con tu cuenta de Google para acceder.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
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
        )}
      </main>
    </div>
  );
}

// ─── Small reusable SVGs ──────────────────────────────────────────────────────

function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <path
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"
        fill="#34A853"
      />
      <path
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z"
        fill="#EA4335"
      />
    </svg>
  );
}

function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`h-4 w-4 animate-spin ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden
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
