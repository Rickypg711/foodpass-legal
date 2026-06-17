"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  collection,
  doc,
  addDoc,
  getDoc,
  serverTimestamp,
} from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getFirebaseDb, getFirebaseApp } from "@/lib/firebase";
import {
  signInWithGoogle,
  waitForAuthReady,
  getFirebaseAuth,
} from "@/lib/auth";
import { signInWithEmailAndPassword } from "firebase/auth";
import type { User } from "firebase/auth";
import { pixelLead } from "@/lib/meta/pixel";
import { generateEventId } from "@/lib/meta/eventId";
import { sendBrowserCapiEvents } from "@/lib/meta/capiBrowser";
import { readAndPersistUtms } from "@/lib/vendorLead/utmStore";
import { trackRestaurantCreated } from "@/lib/analytics/vendorAcquisition";

// ─── Constants ────────────────────────────────────────────────────────────────

const RESTAURANT_CATEGORIES = [
  "Tacos","Café","Hamburguesas","Pizza","Sushi",
  "Mariscos","Antojitos","Carnes","Postres","Otro",
] as const;

const DEFAULT_BUSINESS_HOURS = Object.fromEntries(
  ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"].map(
    (day) => [day, { openingTime: { hour: 9, minute: 0 }, closingTime: { hour: 17, minute: 0 }, isClosed: false }]
  )
);

type Stage = "idle" | "signing" | "form" | "creating" | "done" | "existing";

// ─── Modal ────────────────────────────────────────────────────────────────────

interface ActivarModalProps {
  asModal?: boolean;
  onClose?: () => void;
}

export function ActivarModal({ asModal = true, onClose }: ActivarModalProps) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("idle");
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [category, setCategory] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");

  async function handleEmailSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStage("signing");
    try {
      const auth = getFirebaseAuth();
      const cred = await signInWithEmailAndPassword(auth, emailInput.trim(), passwordInput);
      setUser(cred.user);
      const snap = await getDoc(doc(getFirebaseDb(), "users", cred.user.uid));
      setStage(snap.data()?.ownedRestaurantId ? "existing" : "form");
    } catch (err: unknown) {
      console.error(err);
      setError("Correo o contraseña incorrectos.");
      setStage("idle");
    }
  }

  // If already signed in skip straight to form / existing
  useEffect(() => {
    waitForAuthReady().then(async (u) => {
      if (!u || u.isAnonymous) return;
      setUser(u);
      try {
        const snap = await getDoc(doc(getFirebaseDb(), "users", u.uid));
        setStage(snap.data()?.ownedRestaurantId ? "existing" : "form");
      } catch {
        setStage("form");
      }
    });
  }, []);

  // Close on Escape
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => { if (e.key === "Escape") onClose?.(); },
    [onClose]
  );
  useEffect(() => {
    if (!asModal) return;
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [asModal, handleKeyDown]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  async function handleSignIn() {
    setError(null);
    setStage("signing");
    try {
      const u = await signInWithGoogle();
      setUser(u);
      const snap = await getDoc(doc(getFirebaseDb(), "users", u.uid));
      setStage(snap.data()?.ownedRestaurantId ? "existing" : "form");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "";
      if (msg.includes("popup-closed") || msg.includes("cancelled")) {
        setStage("idle");
      } else {
        setError("No pudimos conectar. Intenta de nuevo.");
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
      const restaurantRef = await addDoc(collection(db, "restaurants"), {
        name: name.trim(),
        address: address.trim(),
        phone: phone.trim(),
        whatsapp: phone.trim(),
        categories: category ? [category] : [],
        ownerId: user.uid,
        billingOwnerUserId: user.uid,
        createdAt: serverTimestamp(),
        currencyCode: "MXN",
        loyaltyEarnPolicy: { currencyCode: "MXN", basePointsPerPurchase: 1, spendStepAmount: 30 },
        pointsPerVisit: 1,
        pointsRequired: 10,
        lat: 0, lng: 0,
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
      const functions = getFunctions(getFirebaseApp(), "us-central1");
      await httpsCallable(functions, "ensureOwnerMember")({ restaurantId: restaurantRef.id });

      // ── Conversion tracking — restaurant successfully created ──────────────
      // This is the real "Lead": Meta optimizes leads campaigns on this event.
      // Pixel + CAPI share one event_id so Meta deduplicates the pair.
      // Wrapped so analytics failures can never break the signup flow.
      try {
        const utms = readAndPersistUtms(window.location.search);
        const leadEventId = generateEventId();
        pixelLead(leadEventId);
        sendBrowserCapiEvents([
          {
            event_name: "Lead",
            event_id: leadEventId,
            event_source_url: window.location.href,
            custom_data: {
              utm_source: utms.utm_source,
              utm_medium: utms.utm_medium,
              utm_campaign: utms.utm_campaign,
              utm_content: utms.utm_content,
              utm_term: utms.utm_term,
            },
          },
        ]);
        // GA4 — mark restaurant_created as a key event in GA4 admin.
        trackRestaurantCreated({ category, ...utms });
      } catch (trackErr) {
        console.warn("[activar] tracking failed (non-blocking):", trackErr);
      }

      // Geocode address → lat/lng (same pattern as Flutter app)
      // Non-blocking: if it fails, restaurant is still created with lat:0, lng:0
      try {
        const geocodeKey = process.env.NEXT_PUBLIC_GOOGLE_GEOCODING_API_KEY;
        if (geocodeKey && address.trim().length >= 10) {
          const query = encodeURIComponent(`${address.trim()}, Chihuahua, Chihuahua, México`);
          const geoRes = await fetch(
            `https://maps.googleapis.com/maps/api/geocode/json?address=${query}&key=${geocodeKey}`
          );
          const geoData = await geoRes.json();
          if (geoData.status === "OK" && geoData.results?.[0]?.geometry?.location) {
            const { lat, lng } = geoData.results[0].geometry.location;
            const { updateDoc } = await import("firebase/firestore");
            await updateDoc(restaurantRef, {
              lat,
              lng,
              locationSource: "web_signup",
              locationVerifiedAt: serverTimestamp(),
              locationUpdatedAt: serverTimestamp(),
            });
          }
        }
      } catch (geoErr) {
        console.warn("[activar] geocode failed (non-blocking):", geoErr);
      }

      setStage("done");
    } catch (e) {
      console.error("[activar] create failed:", e);
      setError("No pudimos crear tu restaurante. Intenta de nuevo.");
      setStage("form");
    }
  }

  // ── Content (light/white design) ──────────────────────────────────────────

  const content = (
    <div className="w-full">

      {/* ── idle / signing ── */}
      {(stage === "idle" || stage === "signing") && (
        <div className="text-center">
          <p className="mb-1 inline-block rounded-full border border-[#F28C38]/25 bg-[#F28C38]/8 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#F28C38]">
            Para restaurantes
          </p>
          <h2 className="mt-3 text-2xl font-bold leading-tight text-[#141413] sm:text-3xl">
            Registra tu restaurante en minutos.
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[#141413]/55">
            Un clic y empiezas a recibir clientes hoy mismo. Sin POS, sin contratos.
          </p>

          {/* Stats */}
          <div className="mt-5 flex items-center justify-center gap-5 text-xs text-[#141413]/45">
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-base font-bold text-[#141413]">Gratis</span>
              <span>siempre</span>
            </div>
            <div className="h-6 w-px bg-[#141413]/10" />
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-base font-bold text-[#141413]">50</span>
              <span>scans / mes</span>
            </div>
            <div className="h-6 w-px bg-[#141413]/10" />
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-base font-bold text-[#141413]">&lt; 5 min</span>
              <span>para activar</span>
            </div>
          </div>

          {error && (
            <p className="mt-4 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </p>
          )}

          <div className="mt-6 flex flex-col gap-3">
            <button
              onClick={handleSignIn}
              disabled={stage === "signing"}
              className="flex w-full items-center justify-center gap-3 rounded-xl border border-[#e8e6dc] bg-white px-6 py-3.5 text-sm font-semibold text-[#141413] shadow-sm transition-all hover:bg-[#faf9f5] hover:border-[#b0aea5] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {stage === "signing"
                ? <><Spinner className="text-[#141413]" />Conectando…</>
                : <><GoogleLogo />Continuar con Google</>}
            </button>
          </div>

          <div className="my-4 flex items-center justify-between gap-3 text-xs text-[#141413]/35">
            <div className="h-px flex-1 bg-[#141413]/10" />
            <span>o con correo</span>
            <div className="h-px flex-1 bg-[#141413]/10" />
          </div>

          <form onSubmit={handleEmailSignIn} className="flex flex-col gap-2.5 text-left">
            <input
              type="email"
              placeholder="Correo electrónico"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              required
              disabled={stage === "signing"}
              className="w-full rounded-xl border border-[#e8e6dc] bg-white px-4 py-2.5 text-sm text-[#141413] outline-none placeholder:text-[#141413]/30 focus:border-[#F28C38]"
            />
            <input
              type="password"
              placeholder="Contraseña"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              required
              disabled={stage === "signing"}
              className="w-full rounded-xl border border-[#e8e6dc] bg-white px-4 py-2.5 text-sm text-[#141413] outline-none placeholder:text-[#141413]/30 focus:border-[#F28C38]"
            />
            <button
              type="submit"
              disabled={stage === "signing"}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#F28C38] py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-[#c46644] disabled:opacity-50"
            >
              {stage === "signing" ? <Spinner className="text-white" /> : "Iniciar sesión →"}
            </button>
          </form>

          <p className="mt-4 text-[11px] text-[#141413]/35">
            Al continuar aceptas los{" "}
            <Link href="/terms-of-use.html" className="underline hover:text-[#141413]/60">Términos de uso</Link>
            {" "}y{" "}
            <Link href="/privacy-policy.html" className="underline hover:text-[#141413]/60">Política de privacidad</Link>.
          </p>
        </div>
      )}

      {/* ── form / creating ── */}
      {(stage === "form" || stage === "creating") && user && (
        <div>
          {/* User avatar + name */}
          <div className="mb-5 flex items-center gap-3 rounded-xl border border-[#e8e6dc] bg-[#faf9f5] px-4 py-3">
            {user.photoURL && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.photoURL} alt="" className="h-8 w-8 rounded-full ring-1 ring-[#e8e6dc]" />
            )}
            <div>
              <p className="text-sm font-semibold text-[#141413]">{user.displayName ?? user.email}</p>
              <p className="text-xs text-[#141413]/45">{user.email}</p>
            </div>
          </div>

          <h2 className="text-xl font-bold text-[#141413]">Cuéntanos de tu restaurante</h2>
          <p className="mt-1 text-xs text-[#141413]/45">Solo lo esencial — completa el resto desde tu panel.</p>

          {error && (
            <p className="mt-3 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
          )}

          <form onSubmit={handleCreateRestaurant} className="mt-5 flex flex-col gap-4">
            <div>
              <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-[#141413]/45">
                Nombre del restaurante *
              </label>
              <input
                type="text" required value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="El Rancho de Don Pepe"
                disabled={stage === "creating"}
                className="w-full rounded-xl border border-[#e8e6dc] bg-white px-4 py-3 text-sm text-[#141413] placeholder:text-[#141413]/30 focus:border-[#F28C38] focus:outline-none focus:ring-2 focus:ring-[#F28C38]/15 disabled:opacity-50"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-[#141413]/45">
                Dirección *
              </label>
              <input
                type="text" required value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Av. Juárez 123, Col. Centro, Chihuahua"
                disabled={stage === "creating"}
                className="w-full rounded-xl border border-[#e8e6dc] bg-white px-4 py-3 text-sm text-[#141413] placeholder:text-[#141413]/30 focus:border-[#F28C38] focus:outline-none focus:ring-2 focus:ring-[#F28C38]/15 disabled:opacity-50"
              />
              <p className="mt-1 text-[10px] text-[#141413]/35">Para que tus clientes te encuentren en el mapa</p>
            </div>
            <div>
              <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-[#141413]/45">
                WhatsApp / Teléfono *
              </label>
              <input
                type="tel" required value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+52 614 123 4567"
                disabled={stage === "creating"}
                className="w-full rounded-xl border border-[#e8e6dc] bg-white px-4 py-3 text-sm text-[#141413] placeholder:text-[#141413]/30 focus:border-[#F28C38] focus:outline-none focus:ring-2 focus:ring-[#F28C38]/15 disabled:opacity-50"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-[#141413]/45">
                Tipo de restaurante
              </label>
              <div className="flex flex-wrap gap-2">
                {RESTAURANT_CATEGORIES.map((cat) => (
                  <button key={cat} type="button"
                    onClick={() => setCategory(cat === category ? "" : cat)}
                    disabled={stage === "creating"}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all disabled:opacity-50 ${
                      category === cat
                        ? "border-[#F28C38] bg-[#F28C38]/8 text-[#F28C38]"
                        : "border-[#e8e6dc] bg-white text-[#141413]/55 hover:border-[#b0aea5] hover:text-[#141413]"
                    }`}
                  >{cat}</button>
                ))}
              </div>
            </div>
            <button
              type="submit"
              disabled={!name.trim() || !phone.trim() || stage === "creating"}
              className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-[#F28C38] px-6 py-3.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#c46644] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {stage === "creating"
                ? <><Spinner className="text-white" />Creando tu restaurante…</>
                : "Activar mi restaurante →"}
            </button>
          </form>
        </div>
      )}

      {/* ── done ── */}
      {stage === "done" && (
        <div className="text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[#F28C38]/10 text-3xl">🎉</div>
          <h2 className="text-xl font-bold text-[#141413]">¡Restaurante creado!</h2>
          <p className="mt-2 text-sm leading-relaxed text-[#141413]/55">
            Solo faltan 3 pasos rápidos: horario, menú y recompensas. Tardas menos de 5 minutos.
          </p>
          <button
            onClick={() => router.push("/vendor/setup/horario?wizard=1")}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[#F28C38] px-6 py-3.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#c46644]"
          >
            Configurar mi restaurante →
          </button>
        </div>
      )}

      {/* ── existing ── */}
      {stage === "existing" && (
        <div className="text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[#F28C38]/10 text-3xl">✓</div>
          <h2 className="text-xl font-bold text-[#141413]">Ya tienes un restaurante en Comeleal</h2>
          <p className="mt-2 text-sm leading-relaxed text-[#141413]/55">
            Entra a tu panel para administrar tu negocio.
          </p>
          <button
            onClick={() => router.push("/vendor")}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[#F28C38] px-6 py-3.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#c46644]"
          >
            Ir a mi panel →
          </button>
        </div>
      )}
    </div>
  );

  // ── Inline (full-page fallback) ────────────────────────────────────────────
  if (!asModal) {
    return (
      <div className="mx-auto w-full max-w-md rounded-2xl border border-[#e8e6dc] bg-[#faf9f5] px-6 py-8 shadow-sm">
        {content}
      </div>
    );
  }

  // ── Modal overlay ──────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />

      {/* Card — light */}
      <div
        className="relative z-10 w-full max-w-md overflow-y-auto rounded-2xl border border-[#e8e6dc] bg-[#faf9f5] p-6 shadow-2xl sm:p-8"
        style={{ maxHeight: "calc(100dvh - 2rem)" }}
      >
        {/* Close */}
        {onClose && (
          <button
            onClick={onClose}
            className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-[#141413]/30 transition-colors hover:bg-[#141413]/6 hover:text-[#141413]/70"
            aria-label="Cerrar"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="1" y1="1" x2="13" y2="13" />
              <line x1="13" y1="1" x2="1" y2="13" />
            </svg>
          </button>
        )}
        {content}
      </div>
    </div>
  );
}

// ─── SVGs ─────────────────────────────────────────────────────────────────────

function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}

function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg className={`h-4 w-4 animate-spin ${className}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 12 5.373 12 12H4z"/>
    </svg>
  );
}
