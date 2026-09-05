// País del teléfono — UNA verdad para armar links wa.me y números E.164.
//
// Nació el 5-sep-2026 con Zahir (Central Fast Food, República Dominicana):
// el canon del 26-ago cosía "52" en todo link y "+52" en todo SMS, así que a
// un dueño de RD el botón de WhatsApp de su menú marcaba a un número mexicano
// y el código de verificación de sus clientes nunca llegaba. México sigue
// siendo el default; el restaurante puede decir otro país en Configuración.
//
// La identidad de los puntos NO cambia: sigue siendo los últimos 10 dígitos
// (phoneCustomers/{phone10}, users.linkedPhone, reglas con sufijo). Por eso la
// lista sólo trae países cuyo número nacional tiene 10 dígitos — un país de 8
// ó 9 dígitos rompería "10 dígitos" en cada pantalla y no lo prometemos.

export const DEFAULT_PHONE_COUNTRY = "52";

export type PhoneCountry = {
  /** Código de país en dígitos, sin "+". */
  code: string;
  /** Nombre corto para el selector. */
  label: string;
  flag: string;
  /** Ejemplo local de 10 dígitos para el placeholder. */
  example: string;
  /** Moneda del país (ISO 4217). El paso de puntos sale de aquí (earnPolicy.ts). */
  currency: string;
};

/** Sólo países con número nacional de 10 dígitos (ver nota arriba). */
export const PHONE_COUNTRIES: readonly PhoneCountry[] = [
  { code: "52", label: "México", flag: "🇲🇽", example: "614 123 4567", currency: "MXN" },
  { code: "1", label: "República Dominicana", flag: "🇩🇴", example: "809 123 4567", currency: "DOP" },
  { code: "1", label: "Estados Unidos", flag: "🇺🇸", example: "915 123 4567", currency: "USD" },
  { code: "57", label: "Colombia", flag: "🇨🇴", example: "321 123 4567", currency: "COP" },
] as const;

/** Ladas de República Dominicana dentro del +1 (NANP). */
const DO_AREA_CODES = ["809", "829", "849"];

/**
 * La entrada del selector que corresponde a un restaurante: por código de
 * país y, cuando el código lo comparten varios (+1), por moneda. México si
 * no hay nada.
 */
export function phoneCountryEntryOf(
  data: { phoneCountryCode?: unknown; currencyCode?: unknown } | Record<string, unknown> | null | undefined,
): PhoneCountry {
  const code = phoneCountryOf(data);
  const cur = (data as { currencyCode?: unknown } | null | undefined)?.currencyCode;
  const byBoth = PHONE_COUNTRIES.find((c) => c.code === code && c.currency === cur);
  return byBoth ?? PHONE_COUNTRIES.find((c) => c.code === code) ?? PHONE_COUNTRIES[0];
}

/**
 * Moneda que delata el número escrito con "+": "+1 809..." es DOP (RD),
 * cualquier otro "+1" es USD, "+57" COP, "+52" MXN. Sin "+" no adivinamos.
 */
export function currencyForTypedPhone(raw: string): string | null {
  const code = countryFromTypedPhone(raw);
  if (!code) return null;
  if (code === "1") {
    const p10 = phoneLast10(raw);
    return DO_AREA_CODES.includes(p10.slice(0, 3)) ? "DOP" : "USD";
  }
  return PHONE_COUNTRIES.find((c) => c.code === code)?.currency ?? null;
}

/** ¿Es un código de país que aceptamos? */
export function isSupportedPhoneCountry(code: unknown): code is string {
  return typeof code === "string" && PHONE_COUNTRIES.some((c) => c.code === code);
}

/**
 * País del teléfono de un restaurante (doc crudo o parcial). Default México.
 * Lee `phoneCountryCode`; cualquier basura cae al default en vez de romper.
 */
export function phoneCountryOf(
  data: { phoneCountryCode?: unknown } | Record<string, unknown> | null | undefined,
): string {
  const raw = (data as { phoneCountryCode?: unknown } | null | undefined)?.phoneCountryCode;
  return isSupportedPhoneCountry(raw) ? raw : DEFAULT_PHONE_COUNTRY;
}

/** Últimos 10 dígitos — la identidad del teléfono en todo Comeleal. */
export function phoneLast10(raw: string): string {
  const d = String(raw ?? "").replace(/\D/g, "");
  return d.length > 10 ? d.slice(-10) : d;
}

/** Número para wa.me: país + últimos 10, se haya guardado como se haya guardado. */
export function waNumber(raw: string, countryCode: string = DEFAULT_PHONE_COUNTRY): string {
  return `${countryCode}${phoneLast10(raw)}`;
}

/** E.164 para Firebase Phone Auth: "+" + país + últimos 10. */
export function toE164(raw: string, countryCode: string = DEFAULT_PHONE_COUNTRY): string {
  return `+${waNumber(raw, countryCode)}`;
}

/**
 * Si el dueño escribió su número con "+" (ej. "+1 809 952 4637"), el país
 * viene ahí. Sin "+" no adivinamos: 10 dígitos pelones son México.
 */
export function countryFromTypedPhone(raw: string): string | null {
  const s = String(raw ?? "").trim();
  if (!s.startsWith("+")) return null;
  const digits = s.replace(/\D/g, "");
  // Los códigos más largos primero para que "52" no le gane a "521" etc.
  const codes = [...new Set(PHONE_COUNTRIES.map((c) => c.code))].sort(
    (a, b) => b.length - a.length,
  );
  for (const code of codes) {
    if (digits.startsWith(code) && digits.length === code.length + 10) return code;
  }
  return null;
}

/** "+52 614 123 4567" para enseñar en pantalla. */
export function formatPhoneForDisplay(raw: string, countryCode: string = DEFAULT_PHONE_COUNTRY): string {
  const p = phoneLast10(raw);
  if (p.length !== 10) return raw;
  return `+${countryCode} ${p.slice(0, 3)} ${p.slice(3, 6)} ${p.slice(6)}`;
}
