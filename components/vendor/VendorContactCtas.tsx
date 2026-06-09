"use client";

import Link from "next/link";
import { PUBLIC_WHATSAPP_WA_ME_ACTIVATE } from "@/lib/contactEmail";
import { trackVendorCtaClick } from "@/lib/analytics/vendorAcquisition";
import { parseUtmsFromSearch } from "@/lib/vendorLead/parseUtmsFromSearch";

const ACTIVAR_URL =
  "/activar?utm_source=web&utm_medium=vendor_lp&utm_campaign=para_restaurantes_contact";

function trackCta(cta: string, section: string) {
  const utms = parseUtmsFromSearch(typeof window !== "undefined" ? window.location.search : "");
  trackVendorCtaClick({ cta, section, ...utms });
}

export function VendorContactCtas() {
  return (
    <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
      <Link
        href={ACTIVAR_URL}
        onClick={() => trackCta("signup", "contact")}
        className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-[#d97757] px-6 py-3.5 text-center text-sm font-semibold text-white shadow-md shadow-[#d97757]/20 transition-colors hover:bg-[#c46644] sm:w-auto"
      >
        Registrar mi restaurante →
      </Link>
      <a
        href={PUBLIC_WHATSAPP_WA_ME_ACTIVATE}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => trackCta("whatsapp", "contact")}
        className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-[#1C2526]/15 bg-white px-6 py-3.5 text-center text-sm font-semibold text-[#1C2526] transition-colors hover:bg-[#FAF7F2] sm:w-auto"
      >
        Contactar por WhatsApp
      </a>
    </div>
  );
}
