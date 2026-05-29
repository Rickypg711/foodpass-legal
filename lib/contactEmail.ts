/** Public contact email for support and vendor acquisition (user-facing). */
export const PUBLIC_CONTACT_EMAIL = "comeleal@gmail.com";

/** Comeleal WhatsApp Business (display). */
export const PUBLIC_WHATSAPP_DISPLAY = "614 601 7597";

/** Comeleal WhatsApp Business (wa.me base, MX +52). */
export const PUBLIC_WHATSAPP_WA_ME = "https://wa.me/526146017597";

/** Pre-filled message for vendor activation intent. */
export const PUBLIC_WHATSAPP_WA_ME_ACTIVATE =
  "https://wa.me/526146017597?text=Hola%2C%20quiero%20activar%20mi%20negocio%20en%20Comeleal.%0A%0ANombre%20del%20negocio%3A%0ACiudad%3A%0ATipo%20de%20negocio%3A%0A%0A%C2%BFMe%20pueden%20ayudar%20a%20configurar%20mi%20men%C3%BA%2C%20horario%20y%20recompensa%3F";

/** User-facing message when the vendor lead API is unavailable. */
export const VENDOR_LEAD_FORM_UNAVAILABLE_MESSAGE =
  "El formulario no está disponible en este momento. Escríbenos a comeleal@gmail.com o por WhatsApp al 614 601 7597.";

/** WhatsApp deep link with message built from vendor lead form fields (post-save handoff). */
export function buildVendorActivationWhatsAppUrl(input: {
  name?: string;
  businessName?: string;
  city?: string;
  whatsapp?: string;
  businessType?: string;
  optionalMessage?: string | null;
}) {
  const lines = [
    "Hola, quiero activar mi negocio en Comeleal.",
    "",
    input.name?.trim() ? `Mi nombre: ${input.name.trim()}` : null,
    input.businessName?.trim()
      ? `Nombre del negocio: ${input.businessName.trim()}`
      : "Nombre del negocio:",
    input.city?.trim() ? `Ciudad: ${input.city.trim()}` : "Ciudad:",
    input.whatsapp?.trim() ? `WhatsApp: ${input.whatsapp.trim()}` : null,
    input.businessType?.trim()
      ? `Tipo de negocio: ${input.businessType.trim()}`
      : "Tipo de negocio:",
    input.optionalMessage?.trim() ? "" : null,
    input.optionalMessage?.trim()
      ? `Mensaje: ${input.optionalMessage.trim()}`
      : null,
    "",
    "¿Me pueden ayudar a configurar mi menú, horario y recompensa?",
  ].filter(Boolean);

  return `${PUBLIC_WHATSAPP_WA_ME}?text=${encodeURIComponent(lines.join("\n"))}`;
}
