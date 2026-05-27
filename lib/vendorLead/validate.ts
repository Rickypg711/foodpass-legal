export const VENDOR_LEAD_SOURCE = "para_restaurantes" as const;

export const VENDOR_BUSINESS_TYPES = [
  "restaurante",
  "cafe",
  "food_truck",
  "dark_kitchen",
  "otro",
] as const;

export type VendorBusinessType = (typeof VENDOR_BUSINESS_TYPES)[number];

export const MAX_OPTIONAL_MESSAGE_LENGTH = 500;
const MAX_NAME_LENGTH = 100;
const MAX_BUSINESS_NAME_LENGTH = 150;
const MAX_CITY_LENGTH = 80;
const MAX_UTM_LENGTH = 120;

export type VendorLeadPayload = {
  name: string;
  businessName: string;
  city: string;
  whatsapp: string;
  businessType: VendorBusinessType;
  optionalMessage: string | null;
  consent: boolean;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  /** Honeypot — must be empty */
  website?: string;
};

export type VendorLeadValidationResult =
  | { ok: true; data: VendorLeadPayload }
  | { ok: false; error: string };

function trimToNull(value: unknown, maxLen: number): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s) return null;
  return s.slice(0, maxLen);
}

function trimRequired(value: unknown, maxLen: number): string | null {
  const s = trimToNull(value, maxLen);
  if (!s) return null;
  return s;
}

function normalizeWhatsapp(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) return null;
  return digits;
}

function parseUtm(value: unknown): string | null {
  return trimToNull(value, MAX_UTM_LENGTH);
}

export function validateVendorLeadBody(body: unknown): VendorLeadValidationResult {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Datos inválidos." };
  }

  const b = body as Record<string, unknown>;

  if (typeof b.website === "string" && b.website.trim().length > 0) {
    return { ok: false, error: "No se pudo enviar el formulario." };
  }

  const name = trimRequired(b.name, MAX_NAME_LENGTH);
  const businessName = trimRequired(b.businessName, MAX_BUSINESS_NAME_LENGTH);
  const city = trimRequired(b.city, MAX_CITY_LENGTH);
  const whatsappRaw = trimRequired(b.whatsapp, 30);
  const businessTypeRaw = trimToNull(b.businessType, 40);

  if (!name || !businessName || !city || !whatsappRaw) {
    return { ok: false, error: "Completa los campos obligatorios." };
  }

  const whatsapp = normalizeWhatsapp(whatsappRaw);
  if (!whatsapp) {
    return { ok: false, error: "Ingresa un número de WhatsApp válido (10 dígitos o más)." };
  }

  if (
    !businessTypeRaw ||
    !VENDOR_BUSINESS_TYPES.includes(businessTypeRaw as VendorBusinessType)
  ) {
    return { ok: false, error: "Selecciona un tipo de negocio." };
  }

  if (b.consent !== true) {
    return { ok: false, error: "Debes aceptar el consentimiento de contacto." };
  }

  const optionalRaw = trimToNull(b.optionalMessage, MAX_OPTIONAL_MESSAGE_LENGTH);
  const optionalMessage =
    optionalRaw && optionalRaw.length > MAX_OPTIONAL_MESSAGE_LENGTH
      ? optionalRaw.slice(0, MAX_OPTIONAL_MESSAGE_LENGTH)
      : optionalRaw;

  return {
    ok: true,
    data: {
      name,
      businessName,
      city,
      whatsapp,
      businessType: businessTypeRaw as VendorBusinessType,
      optionalMessage,
      consent: true,
      utmSource: parseUtm(b.utmSource),
      utmMedium: parseUtm(b.utmMedium),
      utmCampaign: parseUtm(b.utmCampaign),
      utmContent: parseUtm(b.utmContent),
      utmTerm: parseUtm(b.utmTerm),
    },
  };
}
