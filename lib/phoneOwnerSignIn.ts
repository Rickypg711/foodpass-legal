/**
 * Alta y entrada del DUEÑO con su número de teléfono (SMS), en la web.
 *
 * Por qué existe (22-sep-2026): la pauta trae dueños de Chihuahua al demo.
 * Suben su menú, lo ven, pican "Quédatelo" y se topan con Google (que no
 * funciona dentro de Facebook) o con una contraseña que no quieren inventar.
 * 6 de 8 se quedaron ahí. Muchos dueños en México no tienen correo a la
 * mano; su número sí, y el demo ya lo tiene. Owner.com entra solo con
 * teléfono; registro y login son el mismo paso.
 *
 * Es el espejo del diner en components/loyalty/PhonePointsCard.tsx y de la
 * app en lib/pages/phone_sign_in_page.dart (FOODPASS):
 *   - anónimo (dueño del demo) → linkWithPhoneNumber: conserva el uid, el
 *     demo sigue siendo suyo.
 *   - con sesión de otro tipo → signInWithPhoneNumber.
 *   - el número ya tiene cuenta phone → credential-already-in-use →
 *     signInWithCredential: entra a ESA cuenta (es el mismo dueño).
 *   - el número es linkedPhone de una cuenta Google/correo → el pre-check
 *     del servidor (phoneSignInPrecheck) lo dice ANTES de mandar el SMS y
 *     se le manda a entrar por ahí: jamás dos cuentas para un número.
 */
import {
  linkWithPhoneNumber,
  signInWithPhoneNumber,
  signInWithCredential,
  PhoneAuthProvider,
  type Auth,
  type ConfirmationResult,
  type RecaptchaVerifier,
  type User,
} from "firebase/auth";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getFirebaseApp } from "@/lib/firebase";
import { type PhonePrecheck } from "./phoneOwnerSignInPure.ts";

export { ownerPhoneToE164, phoneAuthErrorText, type PhonePrecheck } from "./phoneOwnerSignInPure.ts";

/**
 * Pregunta al servidor si el número ya es de alguien (sin autenticar; corre
 * antes del SMS). Si la llamada falla por red, se sigue como "free": el
 * propio Firebase todavía protege el caso phone_account, y bloquear a un
 * dueño nuevo por un fallo nuestro sería peor.
 */
export async function precheckOwnerPhone(phoneE164: string): Promise<PhonePrecheck> {
  try {
    const fns = getFunctions(getFirebaseApp(), "us-central1");
    const res = await httpsCallable<{ phoneE164: string }, { status?: string }>(
      fns,
      "phoneSignInPrecheck",
    )({ phoneE164 });
    const s = res.data?.status;
    if (s === "phone_account" || s === "social_account") return s;
    return "free";
  } catch {
    return "free";
  }
}

/** Manda el SMS. Link si la sesión es anónima (demo), sign-in si no. */
export async function sendOwnerPhoneCode(
  auth: Auth,
  phoneE164: string,
  verifier: RecaptchaVerifier,
): Promise<ConfirmationResult> {
  const current = auth.currentUser;
  if (current && current.isAnonymous && !current.phoneNumber) {
    return linkWithPhoneNumber(current, phoneE164, verifier);
  }
  return signInWithPhoneNumber(auth, phoneE164, verifier);
}

/**
 * Confirma el código. Si el número ya era de otra cuenta, entra a esa
 * (mismo fallback que el diner y que la app).
 */
export async function confirmOwnerPhoneCode(
  auth: Auth,
  confirmation: ConfirmationResult,
  code: string,
): Promise<User> {
  const clean = code.replace(/\D/g, "");
  try {
    const cred = await confirmation.confirm(clean);
    return cred.user;
  } catch (e: unknown) {
    const codeStr = (e as { code?: string })?.code ?? "";
    if (
      codeStr === "auth/credential-already-in-use" ||
      codeStr === "auth/account-exists-with-different-credential"
    ) {
      const cred =
        PhoneAuthProvider.credentialFromError(
          e as Parameters<typeof PhoneAuthProvider.credentialFromError>[0],
        ) ?? PhoneAuthProvider.credential(confirmation.verificationId, clean);
      const res = await signInWithCredential(auth, cred);
      return res.user;
    }
    throw e;
  }
}

