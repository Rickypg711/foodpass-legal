/**
 * Client-side helper that forwards Meta events to our server-side CAPI route.
 *
 * Browser-only. Do NOT import in server components, API routes, or lib/meta/capi.ts.
 *
 * This module:
 *   1. Reads _fbp and _fbc cookies set by the Meta browser pixel.
 *   2. Attaches navigator.userAgent.
 *   3. POSTs to /api/meta/events — the server reads the client IP and calls CAPI.
 *   4. Is entirely fire-and-forget — errors are logged server-side, never thrown here.
 */

export type BrowserCapiEventName =
  | "Lead"
  | "Contact"
  | "ViewContent"
  | "CompleteRegistration";

export interface BrowserCapiEvent {
  event_name: BrowserCapiEventName;
  /** Must match the eventID passed to fbq() for Meta to deduplicate correctly. */
  event_id: string;
  /** Full URL of the current page, e.g. window.location.href. */
  event_source_url: string;
  custom_data?: {
    content_name?: string;
    content_category?: string;
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
    utm_content?: string;
    utm_term?: string;
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  // Escape regex special chars in cookie name, then match value.
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${escaped}=([^;]*)`),
  );
  return match ? decodeURIComponent(match[1]) : undefined;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Forward one or more events to /api/meta/events (our server-side CAPI proxy).
 *
 * Call this immediately after calling the corresponding fbq() functions,
 * passing the same event_id values so Meta can deduplicate.
 *
 * Uses `keepalive: true` so the request survives page unloads (e.g. if the
 * success state triggers a redirect before the fetch completes).
 */
export function sendBrowserCapiEvents(events: BrowserCapiEvent[]): void {
  if (typeof window === "undefined" || events.length === 0) return;

  const body = {
    events,
    fbp: readCookie("_fbp"),
    fbc: readCookie("_fbc"),
    client_user_agent: navigator.userAgent,
  };

  fetch("/api/meta/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    keepalive: true,
  }).catch(() => {
    // Silently ignore — errors are logged server-side.
  });
}
