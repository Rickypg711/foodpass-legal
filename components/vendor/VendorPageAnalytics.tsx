"use client";

import { useEffect, useRef } from "react";
import { trackVendorLandingView } from "@/lib/analytics/vendorAcquisition";
import { parseUtmsFromSearch } from "@/lib/vendorLead/parseUtmsFromSearch";

/** Fires vendor_landing_view once per mount with URL UTMs (no PII). */
export function VendorPageAnalytics() {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    const utms = parseUtmsFromSearch(window.location.search);
    trackVendorLandingView(utms);
  }, []);

  return null;
}
