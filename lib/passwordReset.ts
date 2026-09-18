/**
 * "¿Olvidaste tu contraseña?" (18-sep-2026).
 *
 * Lo manda Resend desde ricardo@comeleal.com, en español y texto plano, a
 * través de la función `requestPasswordReset` (FOODPASS/functions/
 * password_reset_email.js). Antes lo mandaba Firebase en inglés desde
 * noreply@foodpass-18b33.firebaseapp.com y asustaba.
 *
 * - Nunca dice si el correo existe: la UI confirma igual.
 * - "wait" = tope de 3 por hora por correo (la función contesta
 *   resource-exhausted); la UI pide revisar spam o esperar.
 * - Si la función no contesta (red, despliegue), cae al correo de Firebase
 *   (plantilla ya en español) para que nadie se quede sin entrar.
 */
import { httpsCallable } from "firebase/functions";
import { getFirebaseFunctions } from "@/lib/firebase";
import { getFirebaseAuth } from "@/lib/auth";

export type ResetResult = "sent" | "wait";

export async function requestPasswordReset(correo: string): Promise<ResetResult> {
  const email = correo.trim();
  if (!email) return "sent";

  try {
    const fn = httpsCallable<{ email: string }, { ok: boolean }>(
      getFirebaseFunctions(),
      "requestPasswordReset",
    );
    await fn({ email });
    return "sent";
  } catch (e) {
    const code = (e as { code?: string } | null)?.code ?? "";
    if (code === "functions/resource-exhausted") return "wait";
    // invalid-argument: correo mal escrito. Se confirma igual, no se revela nada.
    if (code === "functions/invalid-argument") return "sent";
    // unavailable / red / función caída → plan B abajo.
  }

  try {
    const { sendPasswordResetEmail } = await import("firebase/auth");
    const a = getFirebaseAuth();
    a.languageCode = "es";
    await sendPasswordResetEmail(a, email);
  } catch {
    // Se ignora a propósito: no se le dice a nadie si un correo existe o no.
  }
  return "sent";
}
