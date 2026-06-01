"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import {
  buildVendorActivationWhatsAppUrl,
  PUBLIC_CONTACT_EMAIL,
} from "@/lib/contactEmail";
import {
  trackVendorLeadStarted,
  trackVendorLeadSubmitted,
  type VendorUtmParams,
} from "@/lib/analytics/vendorAcquisition";
import { readAndPersistUtms } from "@/lib/vendorLead/utmStore";
import { pixelLead, pixelContact } from "@/lib/meta/pixel";
import { generateEventId } from "@/lib/meta/eventId";
import { sendBrowserCapiEvents } from "@/lib/meta/capiBrowser";
import {
  VENDOR_BUSINESS_TYPES,
  type VendorBusinessType,
} from "@/lib/vendorLead/validate";

const BUSINESS_TYPE_LABELS: Record<VendorBusinessType, string> = {
  restaurante: "Restaurante",
  cafe: "Café",
  food_truck: "Food truck / puesto de comida",
  dark_kitchen: "Dark kitchen",
  otro: "Otro",
};

const VENDOR_DOWNLOAD_URL =
  "/download.html?utm_source=web&utm_medium=vendor_lp&utm_campaign=para_restaurantes";

type FormState = "idle" | "submitting" | "success" | "error";

export function VendorLeadForm() {
  const [formState, setFormState] = useState<FormState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorShowContact, setErrorShowContact] = useState(false);
  const [utms] = useState<VendorUtmParams>(() =>
    // readAndPersistUtms: reads from URL if present, falls back to sessionStorage.
    // VendorPageAnalytics persists UTMs on page mount, so they survive navigation.
    typeof window !== "undefined" ? readAndPersistUtms(window.location.search) : {},
  );
  const leadStartedLogged = useRef(false);

  const [name, setName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [city, setCity] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [businessType, setBusinessType] = useState<VendorBusinessType | "">("");
  const [consent, setConsent] = useState(false);
  const [websiteHoneypot, setWebsiteHoneypot] = useState("");
  const [successWhatsappUrl, setSuccessWhatsappUrl] = useState<string | null>(null);

  const onFirstFieldFocus = useCallback(() => {
    if (leadStartedLogged.current) return;
    leadStartedLogged.current = true;
    trackVendorLeadStarted({
      business_type: businessType || undefined,
      utm_source: utms.utm_source,
      utm_campaign: utms.utm_campaign,
    });
  }, [businessType, utms.utm_campaign, utms.utm_source]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    setErrorShowContact(false);
    setFormState("submitting");

    try {
      const res = await fetch("/api/vendor-leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          businessName,
          city,
          whatsapp,
          businessType,
          optionalMessage: null,
          consent,
          website: websiteHoneypot,
          utmSource: utms.utm_source ?? null,
          utmMedium: utms.utm_medium ?? null,
          utmCampaign: utms.utm_campaign ?? null,
          utmContent: utms.utm_content ?? null,
          utmTerm: utms.utm_term ?? null,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        message?: string;
        ok?: boolean;
      };

      if (!res.ok) {
        setFormState("error");
        setErrorMessage(
          data.message ??
            "No pudimos enviar tu información. Intenta de nuevo o escríbenos por correo.",
        );
        setErrorShowContact(res.status !== 400);
        return;
      }

      const businessTypeLabel =
        businessType !== "" ? BUSINESS_TYPE_LABELS[businessType] : undefined;

      const whatsappUrl = buildVendorActivationWhatsAppUrl({
        name,
        businessName,
        city,
        whatsapp,
        businessType: businessTypeLabel,
        optionalMessage: "",
      });

      setSuccessWhatsappUrl(whatsappUrl);
      setFormState("success");

      // GA4 — existing event (unchanged behaviour)
      trackVendorLeadSubmitted({
        city: city.trim(),
        business_type: businessType,
        source: "para_restaurantes",
        utm_source: utms.utm_source,
        utm_medium: utms.utm_medium,
        utm_campaign: utms.utm_campaign,
        utm_content: utms.utm_content,
        utm_term: utms.utm_term,
      });

      // Generate unique event IDs for deduplication.
      // Each event_id is shared between the browser fbq() call and the
      // server CAPI call so Meta counts only one event per pair.
      const leadEventId = generateEventId();
      const contactEventId = generateEventId();

      // Browser Pixel — Lead (primary conversion signal for Meta optimisation).
      pixelLead(leadEventId);

      // Browser Pixel — Contact (WhatsApp outreach initiated).
      pixelContact(contactEventId);

      // Server CAPI — Lead + Contact with the same event_ids for deduplication.
      // UTMs are forwarded so Meta can attribute the conversion to the campaign.
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
        {
          event_name: "Contact",
          event_id: contactEventId,
          event_source_url: window.location.href,
        },
      ]);

      window.open(whatsappUrl, "_blank", "noopener,noreferrer");
    } catch {
      setFormState("error");
      setErrorShowContact(true);
      setErrorMessage(
        "No pudimos enviar tu información. Revisa tu conexión o escríbenos por correo.",
      );
    }
  }

  if (formState === "success") {
    return (
      <div
        className="mt-8 rounded-2xl border border-[#F28C38]/30 bg-white p-6 sm:p-8"
        role="status"
      >
        <p className="text-lg font-semibold text-[#1C2526]">
          Listo. Abrimos WhatsApp con tu mensaje preparado.
        </p>
        <p className="mt-3 text-sm text-[#1C2526]/70">
          Si WhatsApp no se abrió, usa el botón de WhatsApp aquí abajo.
        </p>
        {successWhatsappUrl && (
          <a
            href={successWhatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex min-h-11 items-center justify-center rounded-full bg-[#25D366] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#1fb855]"
          >
            Abrir WhatsApp
          </a>
        )}
        <p className="mt-4 text-sm text-[#1C2526]/70">
          También puedes descargar la app mientras tanto:
        </p>
        <Link
          href={VENDOR_DOWNLOAD_URL}
          className="mt-4 inline-flex min-h-11 items-center justify-center rounded-full border border-[#1C2526]/15 bg-[#FAF7F2] px-6 py-3 text-sm font-semibold text-[#1C2526] transition-colors hover:bg-white"
        >
          Descargar la app
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="relative mt-8 space-y-5" noValidate>
      <div
        className="absolute -left-[9999px] h-px w-px overflow-hidden"
        aria-hidden
      >
        <label htmlFor="vendor-website-hp">Sitio web</label>
        <input
          id="vendor-website-hp"
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          value={websiteHoneypot}
          onChange={(e) => setWebsiteHoneypot(e.target.value)}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="vendor-name" className="block text-sm font-medium text-[#1C2526]">
            Tu nombre <span className="text-[#F28C38]">*</span>
          </label>
          <input
            id="vendor-name"
            name="name"
            type="text"
            required
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onFocus={onFirstFieldFocus}
            className="mt-1.5 w-full rounded-xl border border-[#1C2526]/15 bg-white px-4 py-3 text-sm text-[#1C2526] outline-none ring-[#F28C38]/30 focus:ring-2"
          />
        </div>
        <div>
          <label
            htmlFor="vendor-business-name"
            className="block text-sm font-medium text-[#1C2526]"
          >
            Nombre del negocio <span className="text-[#F28C38]">*</span>
          </label>
          <input
            id="vendor-business-name"
            name="businessName"
            type="text"
            required
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            onFocus={onFirstFieldFocus}
            className="mt-1.5 w-full rounded-xl border border-[#1C2526]/15 bg-white px-4 py-3 text-sm text-[#1C2526] outline-none ring-[#F28C38]/30 focus:ring-2"
          />
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="vendor-city" className="block text-sm font-medium text-[#1C2526]">
            Ciudad <span className="text-[#F28C38]">*</span>
          </label>
          <input
            id="vendor-city"
            name="city"
            type="text"
            required
            value={city}
            onChange={(e) => setCity(e.target.value)}
            onFocus={onFirstFieldFocus}
            placeholder="Tu ciudad"
            className="mt-1.5 w-full rounded-xl border border-[#1C2526]/15 bg-white px-4 py-3 text-sm text-[#1C2526] outline-none ring-[#F28C38]/30 focus:ring-2"
          />
        </div>
        <div>
          <label htmlFor="vendor-whatsapp" className="block text-sm font-medium text-[#1C2526]">
            WhatsApp <span className="text-[#F28C38]">*</span>
          </label>
          <input
            id="vendor-whatsapp"
            name="whatsapp"
            type="tel"
            required
            inputMode="tel"
            autoComplete="tel"
            placeholder="614 123 4567"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            onFocus={onFirstFieldFocus}
            className="mt-1.5 w-full rounded-xl border border-[#1C2526]/15 bg-white px-4 py-3 text-sm text-[#1C2526] outline-none ring-[#F28C38]/30 focus:ring-2"
          />
        </div>
      </div>

      <div>
        <label htmlFor="vendor-business-type" className="block text-sm font-medium text-[#1C2526]">
          Tipo de negocio <span className="text-[#F28C38]">*</span>
        </label>
        <select
          id="vendor-business-type"
          name="businessType"
          required
          value={businessType}
          onChange={(e) => setBusinessType(e.target.value as VendorBusinessType)}
          onFocus={onFirstFieldFocus}
          className="mt-1.5 w-full rounded-xl border border-[#1C2526]/15 bg-white px-4 py-3 text-sm text-[#1C2526] outline-none ring-[#F28C38]/30 focus:ring-2"
        >
          <option value="" disabled>
            Selecciona una opción
          </option>
          {VENDOR_BUSINESS_TYPES.map((value) => (
            <option key={value} value={value}>
              {BUSINESS_TYPE_LABELS[value]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-start gap-3">
        <input
          id="vendor-consent"
          name="consent"
          type="checkbox"
          required
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-1 h-4 w-4 shrink-0 rounded border-[#1C2526]/25 text-[#F28C38] focus:ring-[#F28C38]"
        />
        <label htmlFor="vendor-consent" className="text-sm leading-relaxed text-[#1C2526]/80">
          Acepto que Comeleal me contacte sobre mi negocio usando los datos que comparto.{" "}
          <Link href="/privacy-policy.html" className="font-medium text-[#F28C38] hover:underline">
            Política de privacidad
          </Link>
          .
        </label>
      </div>

      {formState === "error" && errorMessage && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {errorMessage}
          {errorShowContact && (
            <>
              {" "}
              <a
                href={`mailto:${PUBLIC_CONTACT_EMAIL}?subject=${encodeURIComponent("Comeleal para mi restaurante")}`}
                className="font-medium underline"
              >
                {PUBLIC_CONTACT_EMAIL}
              </a>
            </>
          )}
        </p>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          type="submit"
          disabled={formState === "submitting"}
          className="inline-flex w-full min-h-11 items-center justify-center rounded-full bg-[#F28C38] px-6 py-3.5 text-center text-sm font-semibold text-white shadow-md transition-colors hover:bg-[#e07d30] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          {formState === "submitting" ? "Enviando…" : "Activar por WhatsApp"}
        </button>
        <Link
          href={VENDOR_DOWNLOAD_URL}
          className="inline-flex w-full min-h-11 items-center justify-center rounded-full border border-[#1C2526]/15 bg-white px-6 py-3.5 text-center text-sm font-semibold text-[#1C2526] transition-colors hover:bg-[#FAF7F2] sm:w-auto"
        >
          Descargar la app
        </Link>
      </div>
    </form>
  );
}
