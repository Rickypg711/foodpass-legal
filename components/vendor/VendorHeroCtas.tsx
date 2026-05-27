"use client";

import Link from "next/link";
import { trackVendorCtaClick } from "@/lib/analytics/vendorAcquisition";
import { parseUtmsFromSearch } from "@/lib/vendorLead/parseUtmsFromSearch";

function trackCta(cta: string, section: string) {
  const utms = parseUtmsFromSearch(typeof window !== "undefined" ? window.location.search : "");
  trackVendorCtaClick({ cta, section, ...utms });
}

export function VendorHeroCtas() {
  return (
    <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
      <Link
        href="#contacto"
        onClick={() => trackCta("form", "hero")}
        className="inline-flex w-full min-h-11 items-center justify-center rounded-full bg-[#F28C38] px-6 py-3.5 text-center text-sm font-semibold text-white shadow-lg shadow-[#F28C38]/25 transition-colors hover:bg-[#e07d30] sm:w-auto"
      >
        Solicitar información
      </Link>
      <Link
        href="/download.html?utm_source=web&utm_medium=vendor_lp&utm_campaign=para_restaurantes"
        onClick={() => trackCta("download", "hero")}
        className="inline-flex w-full min-h-11 items-center justify-center rounded-full border border-white/20 bg-white/5 px-6 py-3.5 text-center text-sm font-semibold text-white transition-colors hover:bg-white/10 sm:w-auto"
      >
        Ya quiero instalar la app
      </Link>
    </div>
  );
}
