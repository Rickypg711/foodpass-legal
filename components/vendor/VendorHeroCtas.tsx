"use client";

import Link from "next/link";
import { trackVendorCtaClick } from "@/lib/analytics/vendorAcquisition";
import { parseUtmsFromSearch } from "@/lib/vendorLead/parseUtmsFromSearch";

const VENDOR_DOWNLOAD_URL =
  "/download.html?utm_source=web&utm_medium=vendor_lp&utm_campaign=para_restaurantes";

function trackCta(cta: string, section: string) {
  const utms = parseUtmsFromSearch(typeof window !== "undefined" ? window.location.search : "");
  trackVendorCtaClick({ cta, section, ...utms });
}

export function VendorHeroCtas() {
  return (
    <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      <Link
        href="#contacto"
        onClick={() => trackCta("form", "hero")}
        className="inline-flex w-full min-h-11 items-center justify-center rounded-full bg-[#F28C38] px-6 py-3.5 text-center text-sm font-semibold text-white shadow-lg shadow-[#F28C38]/25 transition-colors hover:bg-[#e07d30] sm:w-auto"
      >
        Activar mi negocio por WhatsApp
      </Link>
      <Link
        href={VENDOR_DOWNLOAD_URL}
        onClick={() => trackCta("download", "hero")}
        className="inline-flex w-full min-h-11 items-center justify-center rounded-full border border-white/15 bg-transparent px-6 py-3.5 text-center text-sm font-medium text-white/80 transition-colors hover:bg-white/5 hover:text-white sm:w-auto"
      >
        Descargar la app
      </Link>
    </div>
  );
}
