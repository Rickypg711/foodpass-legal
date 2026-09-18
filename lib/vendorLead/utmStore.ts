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
  /**
   * Meta click id (?fbclid=…) del último clic en un anuncio (17-sep-2026).
   * El pixel lo guarda en la cookie _fbc, pero si la cookie no está (in-app
   * browser, bloqueada, o el pixel cargó después) el evento del servidor
   * llega sin él. Con esto se arma fbc = fb.1.<fbclidAt>.<fbclid>.
   */
  fbclid?: string;
  fbclidAt?: number;
};

function parseFbclid(search: string): string | undefined {
  try {
    const v = new URLSearchParams(search).get("fbclid");
    return v && v.length > 0 ? v.slice(0, 400) : undefined;
  } catch {
    return undefined;
  }
}

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
          fbclid: typeof parsed.fbclid === "string" ? parsed.fbclid.slice(0, 400) : undefined,
          fbclidAt: typeof parsed.fbclidAt === "number" ? parsed.fbclidAt : undefined,
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
  const fbclid = parseFbclid(search);
  const referrerHost = externalReferrerHost();
  const landingPath = window.location.pathname.slice(0, 200);

  if (Object.keys(fromUrl).length > 0) {
    const prev = readStored();
    const record: StoredAttribution = {
      utms: fromUrl,
      referrerHost,
      landingPath,
      capturedAt: Date.now(),
      // El clic nuevo trae su fbclid; si no, se conserva el anterior.
      fbclid: fbclid ?? prev?.fbclid,
      fbclidAt: fbclid ? Date.now() : prev?.fbclidAt,
    };
    writeStored(record);
    return record;
  }

  const stored = readStored();

  // Un fbclid sin UTMs (link del anuncio sin parámetros, o compartido desde
  // el anuncio): se guarda el clic sin borrar la campaña que ya había.
  if (fbclid && fbclid !== stored?.fbclid) {
    const record: StoredAttribution = {
      utms: stored?.utms ?? {},
      referrerHost: stored?.referrerHost ?? referrerHost,
      landingPath: stored?.landingPath ?? landingPath,
      capturedAt: stored?.capturedAt ?? Date.now(),
      fbclid,
      fbclidAt: Date.now(),
    };
    writeStored(record);
    return record;
  }

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

/**
 * fbc para Conversions API cuando la cookie _fbc no existe (17-sep-2026).
 * Formato oficial de Meta: fb.<subdomainIndex>.<creationTime ms>.<fbclid>;
 * subdomainIndex 1 = dominio raíz (comeleal.com).
 */
export function buildFbcFromStored(): string | undefined {
  const stored = readStored();
  if (!stored?.fbclid || !stored.fbclidAt) return undefined;
  return `fb.1.${stored.fbclidAt}.${stored.fbclid}`;
}
