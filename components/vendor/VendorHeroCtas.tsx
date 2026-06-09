"use client";

import Link from "next/link";
import { trackVendorCtaClick } from "@/lib/analytics/vendorAcquisition";
import { parseUtmsFromSearch } from "@/lib/vendorLead/parseUtmsFromSearch";

const ACTIVAR_URL =
  "/activar?utm_source=web&utm_medium=vendor_lp&utm_campaign=para_restaurantes";

function trackCta(cta: string, section: string) {
  const utms = parseUtmsFromSearch(typeof window !== "undefined" ? window.location.search : "");
  trackVendorCtaClick({ cta, section, ...utms });
}

export function VendorHeroCtas() {
  return (
    <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      <Link
        href={ACTIVAR_URL}
        onClick={() => trackCta("signup", "hero")}
        className="inline-flex w-full min-h-11 items-center justify-center rounded-full bg-[#d97757] px-6 py-3.5 text-center text-sm font-semibold text-white shadow-lg shadow-[#d97757]/25 transition-colors hover:bg-[#c46644] sm:w-auto"
      >
        Registrar mi restaurante →
      </Link>
      <Link
        href="#contacto"
        onClick={() => trackCta("whatsapp", "hero")}
        className="inline-flex w-full min-h-11 items-center justify-center rounded-full border border-white/15 bg-transparent px-6 py-3.5 text-center text-sm font-medium text-white/80 transition-colors hover:bg-white/5 hover:text-white sm:w-auto"
      >
        Contactar por WhatsApp
      </Link>
    </div>
  );
}
