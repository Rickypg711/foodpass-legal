/**
 * UTM persistence layer — sessionStorage backed.
 *
 * Problem solved:
 *   parseUtmsFromSearch() only reads from the current URL. If a user clicks a
 *   Meta ad (landing on /para-restaurantes?utm_source=fb...) and then navigates
 *   away and back, the UTMs are gone from the URL and lost from the form.
 *
 * This module:
 *   1. Reads UTMs from the URL if present → writes them to sessionStorage.
 *   2. Falls back to sessionStorage when the URL has no UTMs.
 *   3. Returns an empty object if neither source has UTMs.
 *
 * sessionStorage is scoped to the browser tab + origin. It persists through
 * in-tab navigation and page refreshes but clears when the tab closes.
 * This is the correct scope for attribution — it matches a single user session.
 *
 * Browser-only. Never call from server code.
 */

import { parseUtmsFromSearch } from "./parseUtmsFromSearch";
import type { VendorUtmParams } from "@/lib/analytics/vendorAcquisition";

const SESSION_KEY = "cml_utms_v1";

/**
 * Read UTMs from the URL search string, persist to sessionStorage, and return
 * them. Falls back to stored UTMs when the URL carries none.
 *
 * @param search - window.location.search (e.g. "?utm_source=fb&utm_medium=cpc")
 */
export function readAndPersistUtms(search: string): VendorUtmParams {
  if (typeof window === "undefined") return {};

  const fromUrl = parseUtmsFromSearch(search);

  if (Object.keys(fromUrl).length > 0) {
    // URL has UTMs — store them for the rest of this session.
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(fromUrl));
    } catch {
      // Private browsing or storage quota — silently ignore.
    }
    return fromUrl;
  }

  // No UTMs in URL — try the stored session value.
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
        // Validate that the stored value only contains known UTM string fields.
        const utmKeys: (keyof VendorUtmParams)[] = [
          "utm_source",
          "utm_medium",
          "utm_campaign",
          "utm_content",
          "utm_term",
        ];
        const result: VendorUtmParams = {};
        for (const key of utmKeys) {
          const val = (parsed as Record<string, unknown>)[key];
          if (typeof val === "string" && val.length > 0) {
            result[key] = val.slice(0, 120);
          }
        }
        return result;
      }
    }
  } catch {
    // Corrupt storage — ignore.
  }

  return {};
}
