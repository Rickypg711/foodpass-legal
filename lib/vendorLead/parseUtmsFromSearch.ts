import type { VendorUtmParams } from "@/lib/analytics/vendorAcquisition";

const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const;

/** Read UTM query params from a URL search string (browser or SSR-safe input). */
export function parseUtmsFromSearch(search: string): VendorUtmParams {
  const params = new URLSearchParams(search.startsWith("?") ? search : `?${search}`);
  const out: VendorUtmParams = {};
  for (const key of UTM_KEYS) {
    const v = params.get(key)?.trim();
    if (v) {
      out[key] = v.slice(0, 120);
    }
  }
  return out;
}
