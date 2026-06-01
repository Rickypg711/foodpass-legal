"use client";

import { useEffect, useRef } from "react";
import { trackVendorLandingView } from "@/lib/analytics/vendorAcquisition";
import { readAndPersistUtms } from "@/lib/vendorLead/utmStore";
import { pixelViewContent } from "@/lib/meta/pixel";
import { generateEventId } from "@/lib/meta/eventId";
import { sendBrowserCapiEvents } from "@/lib/meta/capiBrowser";

/**
 * VendorPageAnalytics
 *
 * Fires once per mount on /para-restaurantes:
 *   1. Persists URL UTMs to sessionStorage for use by VendorLeadForm.
 *   2. GA4: vendor_landing_view (existing, unchanged).
 *   3. Meta browser Pixel: ViewContent with deduplication event_id.
 *   4. Meta CAPI: ViewContent forwarded server-side with the same event_id.
 *
 * Renders null — pure side-effect component.
 */
export function VendorPageAnalytics() {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;

    // Persist UTMs from the URL to sessionStorage so VendorLeadForm can
    // read them even after the URL no longer carries them.
    const utms = readAndPersistUtms(window.location.search);

    // GA4 — existing event, unchanged behaviour.
    trackVendorLandingView(utms);

    // Generate a single event_id shared by both the browser pixel call and
    // the server CAPI call. Meta uses this to deduplicate the pair.
    const eventId = generateEventId();

    // Browser Pixel — ViewContent.
    pixelViewContent(
      { content_name: "para-restaurantes", content_category: "vendor-acquisition" },
      eventId,
    );

    // Server CAPI — ViewContent with the same event_id.
    sendBrowserCapiEvents([
      {
        event_name: "ViewContent",
        event_id: eventId,
        event_source_url: window.location.href,
        custom_data: {
          content_name: "para-restaurantes",
          content_category: "vendor-acquisition",
        },
      },
    ]);
  }, []);

  return null;
}
