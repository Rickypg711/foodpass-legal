"use client";

import Link from "next/link";
import { PUBLIC_WHATSAPP_WA_ME_ACTIVATE } from "@/lib/contactEmail";
import { trackVendorCtaClick } from "@/lib/analytics/vendorAcquisition";
import { parseUtmsFromSearch } from "@/lib/vendorLead/parseUtmsFromSearch";

const VENDOR_DOWNLOAD_URL =
  "/download.html?utm_source=web&utm_medium=vendor_lp&utm_campaign=para_restaurantes";

function trackCta(cta: string, section: string) {
  const utms = parseUtmsFromSearch(typeof window !== "undefined" ? window.location.search : "");
  trackVendorCtaClick({ cta, section, ...utms });
}

export function VendorContactCtas() {
  return (
    <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
      <a
        href={PUBLIC_WHATSAPP_WA_ME_ACTIVATE}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => trackCta("whatsapp", "contact")}
        className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-[#F28C38] px-6 py-3.5 text-center text-sm font-semibold text-white shadow-md shadow-[#F28C38]/20 transition-colors hover:bg-[#e07d30] sm:w-auto"
      >
        Activar por WhatsApp
      </a>
      <Link
        href={VENDOR_DOWNLOAD_URL}
        onClick={() => trackCta("download", "contact")}
        className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-[#1C2526]/15 bg-white px-6 py-3.5 text-center text-sm font-semibold text-[#1C2526] transition-colors hover:bg-[#FAF7F2] sm:w-auto"
      >
        Descargar la app
      </Link>
    </div>
  );
}
