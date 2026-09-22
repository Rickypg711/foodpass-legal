/**
 * Piezas PURAS del alta por número (sin Firebase): las importa el candado
 * scripts/validate-phone-signup.mjs desde node. Lo que habla con Firebase
 * vive en ./phoneOwnerSignIn.ts.
 */
import {
  DEFAULT_PHONE_COUNTRY,
  countryFromTypedPhone,
  phoneLast10,
  toE164,
} from './phone/phoneCountry.ts';

export type PhonePrecheck = "free" | "phone_account" | "social_account";

/** "+52 614 123 4567" | "6141234567" | "+1 809 952 4637" → E.164 o null. */
export function ownerPhoneToE164(raw: string): string | null {
  const cc = countryFromTypedPhone(raw) ?? DEFAULT_PHONE_COUNTRY;
  const last10 = phoneLast10(raw);
  if (last10.length !== 10) return null;
  return toE164(raw, cc);
}

/** Texto para el dueño según el error de Firebase. Nunca jerga. */
export function phoneAuthErrorText(e: unknown, step: "send" | "confirm"): string {
  const code = (e as { code?: string })?.code ?? "";
  if (code === "auth/invalid-phone-number") return "Ese número no se ve bien. Revisa los 10 dígitos.";
  if (code === "auth/too-many-requests") return "Muchos intentos seguidos. Espera unos minutos y vuelve a intentar.";
  if (code === "auth/quota-exceeded") return "No pudimos mandar más mensajes por hoy. Entra con tu correo mientras.";
  if (code === "auth/invalid-verification-code") return "Ese código no es. Revísalo o pide otro.";
  if (code === "auth/code-expired") return "Ese código ya venció. Pide otro.";
  if (code === "auth/provider-already-linked") return "Esta sesión ya tiene otro número. Recarga la página e intenta de nuevo.";
  return step === "send"
    ? "No pudimos mandar el código. Intenta de nuevo."
    : "No pudimos confirmar el código. Intenta de nuevo.";
}
