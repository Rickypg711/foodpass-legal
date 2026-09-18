/**
 * Cuentas internas de Comeleal — NO son conversiones.
 *
 * Ricardo monta menús con alias comeleal+loquesea@gmail.com (y con su propio
 * correo) y luego entrega la cuenta al dueño. Cada uno de esos montajes
 * disparaba Lead / CompleteRegistration hacia Meta, así que la pauta
 * "aprendía" de Ricardo, no de dueños de restaurante (cazado 17-sep-2026:
 * 91 Leads en 28 días contra 46 altas, la mayoría nuestras).
 *
 * Isomórfico: se usa en el navegador (para no disparar el pixel) y en
 * /api/meta/events (para no mandar el evento al servidor de Meta).
 *
 * Correos extra sin tocar código: NEXT_PUBLIC_META_INTERNAL_EMAILS="a@x.com,b@y.com"
 */

const INTERNAL_EMAIL_PATTERNS: RegExp[] = [
  /^comeleal(\+[^@]*)?@gmail\.com$/i,
  /^paredesricardog@gmail\.com$/i,
];

function extraInternalEmails(): string[] {
  const raw = process.env.NEXT_PUBLIC_META_INTERNAL_EMAILS ?? "";
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0);
}

/** true si el correo es de Comeleal (alias de montaje o Ricardo). */
export function isInternalEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const e = email.trim().toLowerCase();
  if (!e) return false;
  if (INTERNAL_EMAIL_PATTERNS.some((re) => re.test(e))) return true;
  return extraInternalEmails().includes(e);
}

// ── Navegador interno ──────────────────────────────────────────────────────
// En /demo el usuario es ANÓNIMO (sin correo). Ricardo sube menús desde su
// Chrome para montarlos; ese "subió su menú" tampoco es conversión. Cuando un
// correo interno entra en este navegador, se marca y desde ahí todo evento
// de Meta de este navegador se calla.

const INTERNAL_BROWSER_KEY = "cml_meta_internal";

export function markInternalBrowser(): void {
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(INTERNAL_BROWSER_KEY, "1");
  } catch {
    // privado / sin storage: no pasa nada
  }
}

export function isInternalBrowser(): boolean {
  try {
    return typeof localStorage !== "undefined" && localStorage.getItem(INTERNAL_BROWSER_KEY) === "1";
  } catch {
    return false;
  }
}

/** Lado navegador: ¿este evento NO debe ir a Meta? (correo interno o navegador marcado). */
export function isInternalConversion(email?: string | null): boolean {
  if (isInternalEmail(email)) {
    markInternalBrowser();
    return true;
  }
  return isInternalBrowser();
}
