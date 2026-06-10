/**
 * Meta Pixel (fbq) — type-safe, best-effort browser wrapper.
 *
 * All exported functions are:
 *   - SSR-safe: guarded by typeof window checks
 *   - Best-effort: never throw, never block rendering
 *   - No-ops when NEXT_PUBLIC_META_PIXEL_ID is unset
 *
 * Deduplication:
 *   Every event function accepts an optional eventId parameter.
 *   Pass the SAME eventId to the corresponding sendBrowserCapiEvents() call
 *   so Meta can match and deduplicate the browser Pixel event against its
 *   server-side CAPI counterpart.
 *
 *   fbq('track', 'Lead', {}, { eventID: eventId })
 *                                    ↑
 *                   eventID is the 4th argument to fbq() — not the 3rd.
 */

export const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID ?? "";

// ---------------------------------------------------------------------------
// Minimal fbq type — avoids adding @types/facebook-pixel as a dependency.
// ---------------------------------------------------------------------------

interface FbqEventConfig {
  eventID?: string;
}

interface FbqFunction {
  (command: "init", pixelId: string): void;
  (
    command: "track",
    event: string,
    data?: Record<string, unknown>,
    config?: FbqEventConfig,
  ): void;
  (command: "set", field: string, value: unknown, pixelId?: string): void;
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[][];
  loaded: boolean;
  version: string;
  push: FbqFunction;
}

declare global {
  interface Window {
    fbq?: FbqFunction;
    _fbq?: FbqFunction;
  }
}

// ---------------------------------------------------------------------------
// Internal helper
// ---------------------------------------------------------------------------

function isFbqReady(): boolean {
  return typeof window !== "undefined" && typeof window.fbq === "function";
}

/**
 * @param event      - Meta standard event name (Lead, Contact, ViewContent, …)
 * @param customData - Optional key-value pairs for the event (3rd fbq argument)
 * @param eventId    - Deduplication ID — must match the CAPI event_id
 */
function callFbq(
  event: string,
  customData?: Record<string, unknown>,
  eventId?: string,
): void {
  if (!META_PIXEL_ID || !isFbqReady()) return;
  try {
    const fbq = window.fbq!;
    const hasData =
      customData !== undefined && Object.keys(customData).length > 0;
    const config: FbqEventConfig | undefined = eventId
      ? { eventID: eventId }
      : undefined;

    if (hasData && config) {
      fbq("track", event, customData, config);
    } else if (hasData) {
      fbq("track", event, customData);
    } else if (config) {
      // Must pass an empty object as 3rd arg when only config is supplied,
      // otherwise fbq misinterprets the argument positions.
      fbq("track", event, {}, config);
    } else {
      fbq("track", event);
    }
  } catch {
    // no-op — pixel must never crash the page
  }
}

// ---------------------------------------------------------------------------
// Pixel init snippet
// ---------------------------------------------------------------------------

/**
 * Returns the canonical Meta Pixel init snippet as a string for injection via
 * next/script dangerouslySetInnerHTML.
 *
 * Includes fbq('init') + fbq('track', 'PageView') so:
 *   - The pixel stub is created synchronously (queues events before CDN loads)
 *   - The first PageView is tracked even before fbevents.js responds
 *   - MetaPixelProvider skips the first useEffect call to avoid a duplicate
 */
export function buildPixelInitSnippet(pixelId: string): string {
  // Intentionally kept as one line — do not auto-format.
  return `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${pixelId}');fbq('track','PageView');`;
}

// ---------------------------------------------------------------------------
// Public event helpers
// ---------------------------------------------------------------------------

/** Track a PageView. Called by MetaPixelProvider on route changes. */
export function pixelPageView(): void {
  callFbq("PageView");
}

/**
 * Track Lead.
 *
 * @param eventId - Deduplication ID. Generate with generateEventId() and
 *                  pass the same value to sendBrowserCapiEvents().
 */
export function pixelLead(eventId?: string): void {
  callFbq("Lead", undefined, eventId);
}

/**
 * Track Contact.
 *
 * @param eventId - Deduplication ID. Generate with generateEventId() and
 *                  pass the same value to sendBrowserCapiEvents().
 */
export function pixelContact(eventId?: string): void {
  callFbq("Contact", undefined, eventId);
}

/**
 * Track CompleteRegistration.
 * Fires when a vendor finishes the full onboarding wizard (/vendor/setup/done).
 *
 * @param eventId - Deduplication ID. Generate with generateEventId() and
 *                  pass the same value to sendBrowserCapiEvents().
 */
export function pixelCompleteRegistration(eventId?: string): void {
  callFbq("CompleteRegistration", undefined, eventId);
}

/**
 * Track ViewContent.
 *
 * @param params  - content_name and content_category for the event.
 * @param eventId - Deduplication ID. Generate with generateEventId() and
 *                  pass the same value to sendBrowserCapiEvents().
 */
export function pixelViewContent(
  params?: { content_name?: string; content_category?: string },
  eventId?: string,
): void {
  callFbq(
    "ViewContent",
    params && Object.keys(params).length > 0 ? params : undefined,
    eventId,
  );
}
