import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import { getFunctions as _getFunctions, type Functions } from "firebase/functions";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";

// App Check (7-oct-2026). Llave reCAPTCHA Enterprise "Comeleal web", dominio
// comeleal.com, creada en Google Cloud → Fraud Defense. Es pública (va en el
// HTML); lo que la hace valer es que Google solo da tokens desde ese dominio.
// Nació el día que le cambiaron la cuenta bancaria al sitio de sorteos de
// Kevin con un curl y la API key pública. Hoy App Check está en MONITOR
// (sin enforcement): se leen métricas una semana y luego se enforza.
// Ver FOODPASS/docs/AVISO_CAMBIOS_SENSIBLES.md.
export const APP_CHECK_SITE_KEY = "6Ld1CuQtAAAAAEOyoB9NXkMoD4AkecblxWSKwbSF";

// Public client config (same project as the Comeleal / Foodpass app).
const firebaseConfig = {
  apiKey: "AIzaSyB6JpeqOiPEFyELSHl9p64v2XPXk6uN9Xk",
  appId: "1:111825516835:web:c224c2dfd3148dcd627496",
  projectId: "foodpass-18b33",
  authDomain: "foodpass-18b33.firebaseapp.com",
  storageBucket: "foodpass-18b33.firebasestorage.app",
  messagingSenderId: "111825516835",
} as const;

let app: FirebaseApp;
let appCheckStarted = false;

/**
 * Arranca App Check UNA vez, solo en el navegador. En localhost pide un token
 * de debug (sale en la consola; se registra en Firebase → App Check → la app
 * web → Manage debug tokens). Nunca tira la app: si App Check falla, los
 * datos siguen llegando mientras el enforcement esté apagado.
 */
function startAppCheck(firebaseApp: FirebaseApp): void {
  if (appCheckStarted || typeof window === "undefined") return;
  appCheckStarted = true;
  try {
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1") {
      (self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean }).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
    }
    initializeAppCheck(firebaseApp, {
      provider: new ReCaptchaEnterpriseProvider(APP_CHECK_SITE_KEY),
      isTokenAutoRefreshEnabled: true,
    });
  } catch (e) {
    console.warn("[app-check] no arrancó", e);
  }
}

export function getFirebaseApp(): FirebaseApp {
  if (!getApps().length) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApps()[0]!;
  }
  startAppCheck(app);
  return app;
}

export function getFirebaseDb(): Firestore {
  return getFirestore(getFirebaseApp());
}

export function getFirebaseStorage(): FirebaseStorage {
  return getStorage(getFirebaseApp());
}

export function getFirebaseFunctions(): Functions {
  return _getFunctions(getFirebaseApp(), "us-central1");
}
