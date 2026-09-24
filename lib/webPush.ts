/**
 * Push del panel web (24-sep-2026).
 *
 * Por qué: 68 de 76 dueños entran solo por la web y nunca instalaron la app.
 * La alerta de las 11 AM, el reporte del lunes y el aviso de "pedido nuevo"
 * solo sabían hablarle a users.fcmToken (la app). Aquí el navegador pide
 * permiso una vez, saca su token y lo guarda en users.fcmWebToken. Las
 * funciones (functions/owner_push_tokens.js) mandan a los dos.
 *
 * Reglas:
 *   - Nunca pedir permiso sin que el dueño toque "Sí, avísame" (los
 *     navegadores castigan el prompt en frío y el dueño lo niega).
 *   - Si ya dijo sí, refrescar el token en silencio cada vez que abre.
 *   - Sin llave VAPID no hay push web: el componente se esconde, no truena.
 *
 * La llave VAPID es PÚBLICA (Firebase → Cloud Messaging → Web Push
 * certificates). Va en NEXT_PUBLIC_FIREBASE_VAPID_KEY en Vercel.
 */
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { getFirebaseApp, getFirebaseDb } from "@/lib/firebase";

// Llave PÚBLICA generada el 24-sep-2026 en Firebase → Cloud Messaging → Web
// Push certificates. Es pública por diseño (viaja al navegador); el env solo
// permite rotarla sin tocar código.
const DEFAULT_VAPID_KEY = "BNrOOUigYGqeQ7rlXDvUeiLED4VFCvWxyJ9MtigQ4QjqRVLonF8zLp34cGYEezd0dpYjCAA_Zo9HK4XJ3MOBqXk";
export const WEB_PUSH_VAPID_KEY = (process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || DEFAULT_VAPID_KEY).trim();
export const SERVICE_WORKER_PATH = "/firebase-messaging-sw.js";

export type WebPushResult = "saved" | "denied" | "unsupported" | "error";

/** ¿Este navegador puede recibir push y tenemos llave? */
export function webPushAvailable(): boolean {
  if (typeof window === "undefined") return false;
  if (!WEB_PUSH_VAPID_KEY) return false;
  if (!("Notification" in window)) return false;
  if (!("serviceWorker" in navigator)) return false;
  if (!("PushManager" in window)) return false;
  return true;
}

/** Estado actual del permiso sin pedir nada. */
export function webPushPermission(): NotificationPermission | "unsupported" {
  if (!webPushAvailable()) return "unsupported";
  return Notification.permission;
}

/**
 * Saca el token del navegador y lo guarda en users/{uid}.fcmWebToken.
 * Si `ask` es true pide permiso (solo desde un clic del dueño).
 */
export async function saveWebPushToken(uid: string, ask: boolean): Promise<WebPushResult> {
  if (!webPushAvailable()) return "unsupported";
  try {
    const { getMessaging, getToken, isSupported } = await import("firebase/messaging");
    if (!(await isSupported())) return "unsupported";

    let permission = Notification.permission;
    if (permission === "default" && ask) {
      permission = await Notification.requestPermission();
    }
    if (permission !== "granted") return permission === "denied" ? "denied" : "error";

    const registration = await navigator.serviceWorker.register(SERVICE_WORKER_PATH);
    const messaging = getMessaging(getFirebaseApp());
    const token = await getToken(messaging, {
      vapidKey: WEB_PUSH_VAPID_KEY,
      serviceWorkerRegistration: registration,
    });
    if (!token) return "error";

    await updateDoc(doc(getFirebaseDb(), "users", uid), {
      fcmWebToken: token,
      fcmWebTokenUpdatedAt: serverTimestamp(),
    });
    return "saved";
  } catch (e) {
    console.warn("[webPush] no se guardó el token:", e);
    return "error";
  }
}
