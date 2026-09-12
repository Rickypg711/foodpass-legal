/**
 * UTM + referrer persistence — localStorage backed (was sessionStorage).
 *
 * Problem solved:
 *   parseUtmsFromSearch() only reads from the current URL. If a user clicks a
 *   Meta ad (landing on /?utm_source=facebook...) and then navigates away,
 *   the UTMs are gone from the URL and lost by signup time.
 *
 * Why localStorage now (12-sep-2026): the owner who comes from MENU_B uploads
 * a photo, waits for the menu, and often closes the Facebook in-app tab and
 * comes back later through "retomar" — sessionStorage died with the tab, so
 * the restaurant was born without a campaign. The record lives 30 days.
 *
 * Rules:
 *   1. A URL with UTMs always wins (last paid touch) → overwrites the record.
 *   2. Without UTMs, an EXTERNAL referrer (google.com, instagram…) is saved
 *      only if nothing is stored yet — it never erases a campaign.
 *   3. Returns null / an empty object if no source has anything.
 *
 * Browser-only. Never call from server code.
 */

import { parseUtmsFromSearch } from "./parseUtmsFromSearch";
import type { VendorUtmParams } from "@/lib/analytics/vendorAcquisition";

const STORE_KEY = "cml_attribution_v2";
const LEGACY_SESSION_KEY = "cml_utms_v1";
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

const UTM_KEYS: (keyof VendorUtmParams)[] = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
];

export type StoredAttribution = {
  utms: VendorUtmParams;
  /** Host of the external page that sent them ("m.facebook.com"), if any. */
  referrerHost?: string;
  /** Path where they landed ("/", "/demo"). */
  landingPath?: string;
  /** Epoch ms of the touch that set this record. */
  capturedAt: number;
};

function cleanUtms(raw: unknown): VendorUtmParams {
  const out: VendorUtmParams = {};
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return out;
  for (const key of UTM_KEYS) {
    const val = (raw as Record<string, unknown>)[key];
    if (typeof val === "string" && val.length > 0) out[key] = val.slice(0, 120);
  }
  return out;
}

function externalReferrerHost(): string | undefined {
  try {
    if (!document.referrer) return undefined;
    const host = new URL(document.referrer).hostname;
    if (!host || host === window.location.hostname || host.endsWith("comeleal.com")) {
      return undefined;
    }
    return host.slice(0, 120);
  } catch {
    return undefined;
  }
}

function readStored(): StoredAttribution | null {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<StoredAttribution>;
      const capturedAt = typeof parsed.capturedAt === "number" ? parsed.capturedAt : 0;
      if (Date.now() - capturedAt <= TTL_MS) {
        return {
          utms: cleanUtms(parsed.utms),
          referrerHost:
            typeof parsed.referrerHost === "string" ? parsed.referrerHost.slice(0, 120) : undefined,
          landingPath:
            typeof parsed.landingPath === "string" ? parsed.landingPath.slice(0, 200) : undefined,
          capturedAt,
        };
      }
      localStorage.removeItem(STORE_KEY);
    }
  } catch {
    // Private browsing, blocked storage or corrupt value — ignore.
  }
  // Legacy: a tab opened before this deploy still has its UTMs in sessionStorage.
  try {
    const raw = sessionStorage.getItem(LEGACY_SESSION_KEY);
    if (raw) {
      const utms = cleanUtms(JSON.parse(raw));
      if (Object.keys(utms).length > 0) return { utms, capturedAt: Date.now() };
    }
  } catch {
    // ignore
  }
  return null;
}

function writeStored(record: StoredAttribution) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(record));
  } catch {
    // Storage quota or blocked — silently ignore.
  }
}

/**
 * Capture the touch of THIS page load (URL UTMs or external referrer) and
 * return the attribution that currently applies. Safe to call on every page.
 */
export function captureAttribution(search: string): StoredAttribution | null {
  if (typeof window === "undefined") return null;

  const fromUrl = parseUtmsFromSearch(search);
  const referrerHost = externalReferrerHost();
  const landingPath = window.location.pathname.slice(0, 200);

  if (Object.keys(fromUrl).length > 0) {
    const record: StoredAttribution = {
      utms: fromUrl,
      referrerHost,
      landingPath,
      capturedAt: Date.now(),
    };
    writeStored(record);
    return record;
  }

  const stored = readStored();
  if (stored) return stored;

  if (referrerHost) {
    const record: StoredAttribution = { utms: {}, referrerHost, landingPath, capturedAt: Date.now() };
    writeStored(record);
    return record;
  }
  return null;
}

/**
 * Read UTMs from the URL search string, persist them, and return them. Falls
 * back to the stored record when the URL carries none.
 *
 * @param search - window.location.search (e.g. "?utm_source=fb&utm_medium=cpc")
 */
export function readAndPersistUtms(search: string): VendorUtmParams {
  return captureAttribution(search)?.utms ?? {};
}
