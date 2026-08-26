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
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getFirebaseDb, getFirebaseApp } from "@/lib/firebase";
import {
  signInWithGoogle,
  waitForAuthReady,
  getFirebaseAuth,
} from "@/lib/auth";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  linkWithPopup,
  linkWithCredential,
  EmailAuthProvider,
  GoogleAuthProvider,
} from "firebase/auth";
import type { DemoItem, DemoInfo } from "@/lib/demo/demoJobs";
import { RESTAURANT_CATEGORIES, inferCategoryFromDemo } from "@/lib/demo/inferCategory";
import type { User } from "firebase/auth";
import { pixelLead } from "@/lib/meta/pixel";
import { generateEventId } from "@/lib/meta/eventId";
import { sendBrowserCapiEvents } from "@/lib/meta/capiBrowser";
import { readAndPersistUtms } from "@/lib/vendorLead/utmStore";
import { trackRestaurantCreated } from "@/lib/analytics/vendorAcquisition";

// ─── Constants ────────────────────────────────────────────────────────────────


const DEFAULT_BUSINESS_HOURS = Object.fromEntries(
  ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"].map(
    (day) => [day, { openingTime: { hour: 9, minute: 0 }, closingTime: { hour: 17, minute: 0 }, isClosed: false }]
  )
);

type Stage = "idle" | "signing" | "form" | "creating" | "done" | "existing";

// ─── Modal ────────────────────────────────────────────────────────────────────

/** El claim del embudo menú-primero (§6): la cuenta nace YA VESTIDA. */
export interface DemoClaim {
  jobId: string;
  items: DemoItem[];
  info?: DemoInfo | null;
  whatsapp?: string | null;
}

interface ActivarModalProps {
  asModal?: boolean;
  onClose?: () => void;
  demo?: DemoClaim;
}

export function ActivarModal({ asModal = true, onClose, demo }: ActivarModalProps) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("idle");
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  /// `true` cuando el fallo fue de credenciales: ahi si hay algo que ofrecer.
  const [showReset, setShowReset] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  // Modo demo: la IA ya leyó nombre/dirección/teléfono del menú de papel
  // (§6.9 — el dato no se pide, se lee) y el WhatsApp del paso de la foto
  // llega pre-llenado (§6.5).
  const [name, setName] = useState(demo?.info?.restaurantName ?? "");
  const [address, setAddress] = useState(demo?.info?.address ?? "");
  const [phone, setPhone] = useState(demo?.whatsapp ?? demo?.info?.phone ?? "");
  // El tipo tampoco se pregunta si ya se puede leer: primero la clasificación
  // de Gemini (info.category), si no el fallback de palabras clave. El dueño
  // solo lo cambia si no le atinamos.
  const inferredCategory =
    (demo?.info?.category &&
      (RESTAURANT_CATEGORIES as readonly string[]).includes(demo.info.category)
      ? demo.info.category
      : null) ??
    (demo ? inferCategoryFromDemo(demo.info?.restaurantName, demo.items) : null);
  const [category, setCategory] = useState(inferredCategory ?? "");
  // Colapsado solo cuando la IA dedujo algo; sin deducción, el muro completo.
  const [categoryExpanded, setCategoryExpanded] = useState(!inferredCategory);
  /** "📆 Leí de tu menú: Mar-Dom 1-11pm — ¿está bien?" (default sí). */
  const [hoursOk, setHoursOk] = useState(true);
  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [authMode, setAuthMode] = useState<"signup" | "signin">("signup");

  // Escape cierra — pero jamás a media conexión/creación (in-flight). El
  // backdrop a propósito NO cierra: en teléfono un roce afuera de la tarjeta
  // borraría el correo/contraseña a medio teclear (el ✕ siempre está).
  useEffect(() => {
    if (!onClose) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && stage !== "signing" && stage !== "creating") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, stage]);

  // En demo casi todo llega leído del papel: el cursor aterriza solo en el
  // PRIMER campo que de verdad falta (una vez, al entrar al formulario) —
  // cero búsqueda de "¿y a mí qué me toca llenar?".
  useEffect(() => {
    if (stage !== "form") return;
    const t = window.setTimeout(() => {
      const empty = document.querySelector<HTMLInputElement>(
        'input[data-claim-field="empty"]',
      );
      empty?.focus();
    }, 80);
    return () => window.clearTimeout(t);
  }, [stage]);

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setShowReset(false);
    setStage("signing");
    try {
      const auth = getFirebaseAuth();
      const email = emailInput.trim();
      let cred;
      if (authMode === "signup" && demo && auth.currentUser?.isAnonymous) {
        // Mismo principio que Google: LINK conserva el uid dueño del demo.
        cred = await linkWithCredential(
          auth.currentUser,
          EmailAuthProvider.credential(email, passwordInput),
        );
      } else {
        cred =
          authMode === "signup"
            ? await createUserWithEmailAndPassword(auth, email, passwordInput)
            : await signInWithEmailAndPassword(auth, email, passwordInput);
      }
      setUser(cred.user);
      const snap = await getDoc(doc(getFirebaseDb(), "users", cred.user.uid));
      setStage(snap.data()?.ownedRestaurantId ? "existing" : "form");
    } catch (err: unknown) {
      console.error(err);
      const code = (err as { code?: string })?.code ?? "";
      if (code === "auth/email-already-in-use") {
        setAuthMode("signin");
        setError("Ese correo ya tiene cuenta. Escribe tu contraseña para entrar.");
      } else if (code === "auth/weak-password") {
        setError("La contraseña debe tener al menos 6 caracteres.");
      } else if (code === "auth/invalid-email") {
        setError("Ese correo no se ve bien. Revísalo.");
      } else if (authMode === "signup") {
        setError("No pudimos crear tu cuenta. Intenta de nuevo.");
      } else {
        setError("Correo o contraseña incorrectos.");
        // No se afirma CUAL de las dos fallo: Firebase no lo dice (proteccion
        // contra enumeracion de correos) y adivinarlo seria inventarle al
        // usuario. Se ofrecen las dos salidas y que el escoja.
        setShowReset(true);
      }
      setStage("idle");
    }
  }

  async function handleReset() {
    const correo = emailInput.trim();
    if (!correo) return;
    try {
      const { sendPasswordResetEmail } = await import("firebase/auth");
      await sendPasswordResetEmail(getFirebaseAuth(), correo);
    } catch {
      // Se ignora a proposito: ver abajo.
    }
    // Se confirma SIEMPRE, exista o no la cuenta. Decir "ese correo no
    // existe" le regalaria a cualquiera una forma de averiguar quien tiene
    // cuenta — la misma razon por la que Firebase ya no lo dice.
    setResetSent(true);
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
      // Demo: el prospecto YA es un usuario (anónimo, dueño de su job).
      // LINK en vez de sign-in nuevo: mismo uid → su demo sigue siendo suyo
      // y las reglas del job no ven a un extraño. Si el Google ya tiene
      // cuenta (credential-already-in-use), se cae al sign-in normal y la
      // conversión se estampa por la regla de dueño-del-restaurante.
      let u: User;
      const current = getFirebaseAuth().currentUser;
      if (demo && current?.isAnonymous) {
        try {
          const provider = new GoogleAuthProvider();
          provider.setCustomParameters({ prompt: "select_account" });
          const cred = await linkWithPopup(current, provider);
          u = cred.user;
        } catch (linkErr: unknown) {
          const code = (linkErr as { code?: string })?.code ?? "";
          if (code === "auth/credential-already-in-use" ||
              code === "auth/email-already-in-use") {
            u = await signInWithGoogle();
          } else {
            throw linkErr;
          }
        }
      } else {
        u = await signInWithGoogle();
      }
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
        // Pay-at-pickup ON by default so a new vendor can take orders and start
        // the loyalty loop from day one. Vendor can turn it off in Configuración.
        payAtPickupEnabled: true,
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

      // ── Geocodificación ────────────────────────────────────────────────
      // ANTES (bug, 16 de 28 locales en 0,0): este bloque dependía de una
      // llave que NO existe en el entorno de producción de Vercel, así que se
      // saltaba entero y TODO local creado desde la web quedaba en el Golfo de
      // Guinea — invisible en la app, que filtra Recompensas a 20 km.
      // Además le pegaba ", Chihuahua, Chihuahua, México" a cualquier
      // dirección, aunque el local estuviera en Colombia o Guatemala.
      //
      // Ahora pasa por /api/geocode (servidor), que comparte guardas EXACTAS con
      // el backfill del lado servidor: país deducido del teléfono, piso de
      // precisión, y rechazo de partial_match que no conserve nada de lo
      // pedido. Un pin equivocado es PEOR que no tener pin.
      //
      // Y cuando NO se puede ubicar, ya no se calla: marca
      // locationNeedsReview para que sea consultable en vez de invisible.
      try {
        // Ruta de servidor: la llave de Google NUNCA baja al navegador.
        const geoRes = await fetch("/api/geocode", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address: address.trim(), phone: phone.trim() }),
        });
        const verdict = await geoRes.json();
        const { updateDoc } = await import("firebase/firestore");
        if (verdict.ok) {
          await updateDoc(restaurantRef, {
            lat: verdict.lat,
            lng: verdict.lng,
            locationSource: "web_signup",
            locationPrecision: verdict.precision,
            locationFormattedAddress: verdict.formatted,
            locationNeedsReview: false,
            locationVerifiedAt: serverTimestamp(),
            locationUpdatedAt: serverTimestamp(),
          });
        } else {
          console.warn("[activar] geocode rechazado:", verdict.reason);
          await updateDoc(restaurantRef, {
            locationNeedsReview: true,
            locationReviewReason: verdict.reason,
            locationUpdatedAt: serverTimestamp(),
          });
        }
      } catch (geoErr) {
        console.warn("[activar] geocode failed (non-blocking):", geoErr);
        try {
          const { updateDoc } = await import("firebase/firestore");
          await updateDoc(restaurantRef, {
            locationNeedsReview: true,
            locationReviewReason: "geocode_exception",
            locationUpdatedAt: serverTimestamp(),
          });
        } catch { /* nunca romper el alta por esto */ }
      }

      // ── Modo demo: la cuenta nace YA VESTIDA (§6.5/§6.8) ────────────────
      // El menú que la IA leyó se copia al restaurante (cero re-trabajo), el
      // horario impreso se escribe si el dueño lo confirmó, y el job estampa
      // su conversión — el escalón "cuenta" de la escalera (§6.2).
      if (demo) {
        try {
          const dbb = getFirebaseDb();
          const items = demo.items.slice(0, 300);
          for (let i = 0; i < items.length; i += 400) {
            const batch = writeBatch(dbb);
            for (const it of items.slice(i, i + 400)) {
              const mref = doc(collection(dbb, "restaurants", restaurantRef.id, "menu"));
              batch.set(mref, {
                name: it.name,
                description: it.description ?? "",
                price: it.price,
                category: it.category ?? "",
                isAvailable: true,
                ...(it.optionGroups ? { optionGroups: it.optionGroups } : {}),
                importedFromDemo: demo.jobId,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              });
            }
            await batch.commit();
          }
          // El momento IA de premios (§6.3/§6.4): el borrador se genera en
          // background para que Recompensas lo reciba YA propuesto — igual
          // que el publish normal del wizard. Nunca bloquea.
          try {
            const fns = getFunctions(getFirebaseApp(), "us-central1");
            httpsCallable(fns, "generateRewardDraft")({ restaurantId: restaurantRef.id }).catch(() => {});
          } catch { /* la página de recompensas tiene botón manual */ }
          if (hoursOk && demo.info?.businessHours) {
            await updateDoc(restaurantRef, {
              businessHours: demo.info.businessHours,
              hoursConfirmed: true,
            });
          }
          await updateDoc(doc(dbb, "menuDemoJobs", demo.jobId), {
            convertedToRestaurantId: restaurantRef.id,
            convertedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } catch (seedErr) {
          // El alta JAMÁS se rompe por el sembrado: sin menú copiado, el
          // wizard normal lo captura — el dueño no pierde nada.
          console.warn("[activar] demo seed failed (non-blocking):", seedErr);
        }
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
          {/* Viniendo del demo el arco es de posesión (§7): "es tuyo" (E3) →
              "lo quiero" (E4) → aquí se CIERRA con "hazlo tuyo". El genérico
              se queda para quien llega sin demo. */}
          <h2 className="mt-3 text-2xl font-bold leading-tight text-[#141413] sm:text-3xl">
            {demo ? "Tu menú ya está montado — hazlo tuyo." : "Registra tu restaurante en minutos."}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[#141413]/55">
            {demo
              ? "Crea tu cuenta y te lo entregamos adentro: platillos, precios y tamaños."
              : "Un clic y empiezas a recibir clientes hoy mismo. Sin POS, sin contratos."}
          </p>

          {/* Stats */}
          <div className="mt-5 flex items-center justify-center gap-5 text-xs text-[#141413]/45">
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-base font-bold text-[#141413]">Gratis</span>
              <span>siempre</span>
            </div>
            <div className="h-6 w-px bg-[#141413]/10" />
            {/* En demo, la estadística del centro es SU dato vivo — "scans/mes"
                es jerga que el prospecto aún no conoce. */}
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-base font-bold text-[#141413]">
                {demo ? demo.items.length : "50"}
              </span>
              <span>{demo ? "platillos ya adentro" : "scans / mes"}</span>
            </div>
            <div className="h-6 w-px bg-[#141413]/10" />
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-base font-bold text-[#141413]">&lt; 5 min</span>
              <span>para activar</span>
            </div>
          </div>

          {error && (
            <div className="mt-4 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-600">
              <p>{error}</p>
              {/* Decir "contraseña incorrecta" sin dar forma de cambiarla es
                  un callejón sin salida: reintentar con la misma contraseña
                  va a fallar igual, para siempre. */}
              {showReset && (
                <p className="mt-2">
                  {resetSent ? (
                    <span className="font-semibold text-[#1C2526]">
                      Te mandamos un correo para cambiarla.
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleReset}
                      className="font-semibold text-[#F28C38] underline underline-offset-2"
                    >
                      ¿Olvidaste tu contraseña? Te mandamos un correo
                    </button>
                  )}
                </p>
              )}
            </div>
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

          <form onSubmit={handleEmailSubmit} className="flex flex-col gap-2.5 text-left">
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
              placeholder={authMode === "signup" ? "Contraseña (mínimo 6 caracteres)" : "Contraseña"}
              minLength={6}
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              required
              disabled={stage === "signing"}
              className="w-full rounded-xl border border-[#e8e6dc] bg-white px-4 py-2.5 text-sm text-[#141413] outline-none placeholder:text-[#141413]/30 focus:border-[#F28C38]"
            />
            <button
              type="submit"
              disabled={stage === "signing"}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#F28C38] py-2.5 text-sm font-bold text-[#1C2526] shadow-sm transition-all hover:bg-[#c46644] disabled:opacity-50"
            >
              {stage === "signing"
                ? <Spinner className="text-white" />
                : authMode === "signup" ? "Crear mi cuenta →" : "Iniciar sesión →"}
            </button>
          </form>

          <button
            type="button"
            onClick={() => { setAuthMode(authMode === "signup" ? "signin" : "signup"); setError(null); }}
            className="mt-3 text-xs font-semibold text-[#141413]/50 underline underline-offset-2 transition-colors hover:text-[#F28C38]"
          >
            {authMode === "signup"
              ? "¿Ya tienes cuenta? Inicia sesión"
              : "¿Primera vez? Crea tu cuenta"}
          </button>

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
              {/* Cuentas de correo no tienen displayName: sin esta guarda el
                  correo salía DOS veces, apilado (cazado por Ricardo 26-ago). */}
              {user.displayName && (
                <p className="text-xs text-[#141413]/45">{user.email}</p>
              )}
            </div>
          </div>

          <h2 className="text-xl font-bold text-[#141413]">
            {demo ? "Confirma tus datos — los leí de tu menú" : "Cuéntanos de tu restaurante"}
          </h2>
          <p className="mt-1 text-xs text-[#141413]/45">
            {demo
              ? "Revisa que estén bien — el resto se completa desde tu panel."
              : "Solo lo esencial — completa el resto desde tu panel."}
          </p>

          {error && (
            <p className="mt-3 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
          )}

          <form onSubmit={handleCreateRestaurant} className="mt-5 flex flex-col gap-4">
            <div>
              <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-[#141413]/45">
                Nombre del restaurante *
              </label>
              <input
                data-claim-field={name.trim() ? "full" : "empty"}
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
                data-claim-field={address.trim() ? "full" : "empty"}
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
                data-claim-field={phone.trim() ? "full" : "empty"}
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
              {/* La IA ya eligió → se muestra SOLO su elección (fuerte) +
                  "Cambiar". El muro de 10 chips solo aparece si el dueño
                  quiere otra cosa o si no hubo deducción. */}
              {!categoryExpanded && category ? (
                <div className="flex items-center gap-2.5">
                  <span className="rounded-full border border-[#F28C38] bg-[#F28C38] px-4 py-1.5 text-xs font-bold text-[#1C2526]">
                    {category}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCategoryExpanded(true)}
                    disabled={stage === "creating"}
                    className="text-xs font-semibold text-[#141413]/45 underline underline-offset-2 transition-colors hover:text-[#F28C38] disabled:opacity-50"
                  >
                    Cambiar
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {RESTAURANT_CATEGORIES.map((cat) => (
                    <button key={cat} type="button"
                      onClick={() => setCategory(cat === category ? "" : cat)}
                      disabled={stage === "creating"}
                      className={`rounded-full border px-3 py-1.5 text-xs transition-all disabled:opacity-50 ${
                        category === cat
                          ? "border-[#F28C38] bg-[#F28C38] font-bold text-[#1C2526]"
                          : "border-[#e8e6dc] bg-white font-medium text-[#141413]/55 hover:border-[#b0aea5] hover:text-[#141413]"
                      }`}
                    >{cat}</button>
                  ))}
                </div>
              )}
              {inferredCategory && category === inferredCategory && (
                <p className="mt-1.5 text-[10px] text-[#141413]/40">
                  ✨ Lo deduje de tu menú — cámbialo si no le atiné.
                </p>
              )}
            </div>
            {demo?.info?.businessHours && demo.info.hoursText ? (
              <label className="flex items-start gap-2.5 rounded-xl border border-[#e8e6dc] bg-white px-4 py-3 text-left">
                <input
                  type="checkbox"
                  checked={hoursOk}
                  onChange={(e) => setHoursOk(e.target.checked)}
                  disabled={stage === "creating"}
                  className="mt-0.5 h-4 w-4 accent-[#F28C38]"
                />
                <span className="text-[12px] leading-snug text-[#141413]/70">
                  📆 Leí este horario en tu menú:{" "}
                  <b className="text-[#141413]">{demo.info.hoursText}</b>
                  {" — "}déjalo puesto (lo cambias después si quieres)
                </span>
              </label>
            ) : null}
            <button
              type="submit"
              disabled={!name.trim() || !phone.trim() || stage === "creating"}
              className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-[#F28C38] px-6 py-3.5 text-sm font-semibold text-[#1C2526] shadow-sm transition-all hover:bg-[#c46644] disabled:cursor-not-allowed disabled:opacity-50"
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
          <h2 className="text-xl font-bold text-[#141413]">
            {demo ? "¡Es tuyo! Tu menú ya está adentro." : "¡Restaurante creado!"}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[#141413]/55">
            {demo
              ? "Tus platillos, precios y tamaños ya viven en tu cuenta. Solo falta elegir tus premios — la IA ya te preparó una propuesta."
              : "Solo faltan 3 pasos rápidos: horario, menú y recompensas. Tardas menos de 5 minutos."}
          </p>
          <button
            onClick={() => router.push(demo ? "/vendor/setup/recompensas?wizard=1" : "/vendor/setup/horario?wizard=1")}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[#F28C38] px-6 py-3.5 text-sm font-semibold text-[#1C2526] shadow-sm transition-all hover:bg-[#c46644]"
          >
            {demo ? "Elegir mis premios →" : "Configurar mi restaurante →"}
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
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[#F28C38] px-6 py-3.5 text-sm font-semibold text-[#1C2526] shadow-sm transition-all hover:bg-[#c46644]"
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
      {/* Backdrop — NO cierra al tap: protege lo ya tecleado (✕ y Escape sí). */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
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
