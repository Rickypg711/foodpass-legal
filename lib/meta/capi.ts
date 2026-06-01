/**
 * Meta Conversions API (CAPI) — server-only.
 *
 * NEVER import this file in "use client" components or browser code.
 * It reads server-only environment variables:
 *
 *   FACEBOOK_CONVERSIONS_API_TOKEN  — required; system-user access token
 *   META_TEST_EVENT_CODE            — optional; e.g. "TEST12345" for Events Manager validation
 *
 * All functions are best-effort: they log errors but never throw, so a CAPI
 * failure can never break an API route response.
 */

const PIXEL_ID = "1774133503558467";
const GRAPH_API_VERSION = "v23.0";
const CAPI_ENDPOINT = `https://graph.facebook.com/${GRAPH_API_VERSION}/${PIXEL_ID}/events`;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CapiUserData {
  /** Public IPv4 or IPv6 address. Not hashed. */
  client_ip_address?: string;
  /** Full User-Agent string. Not hashed. */
  client_user_agent?: string;
  /** Meta _fbp cookie value (set by browser pixel). */
  fbp?: string;
  /** Meta _fbc cookie value (set when user clicked a Facebook ad). */
  fbc?: string;
}

export interface CapiCustomData {
  content_name?: string;
  content_category?: string;
  // UTM attribution fields forwarded as custom parameters.
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
}

export interface CapiEvent {
  event_name: string;
  /** Unix timestamp in seconds. */
  event_time: number;
  action_source: "website";
  event_source_url: string;
  /** Must match the eventID passed to fbq() for deduplication. */
  event_id: string;
  user_data: CapiUserData;
  custom_data?: CapiCustomData;
}

// ---------------------------------------------------------------------------
// Internal utilities
// ---------------------------------------------------------------------------

/**
 * Remove keys whose value is undefined, null, or empty string.
 * Meta's API rejects events with empty string fields in some positions.
 */
function stripEmpty(
  obj: Record<string, string | undefined>,
): Record<string, string> | undefined {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== null && v !== "") {
      out[k] = v;
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

// ---------------------------------------------------------------------------
// Core sender — called by all typed helpers and by the API route directly.
// ---------------------------------------------------------------------------

/**
 * POST one or more events to the Meta Conversions API.
 *
 * Logs:
 *   "[Meta CAPI success]" with Meta's response body on 2xx
 *   "[Meta CAPI error]"   with HTTP status + Meta's error body on non-2xx
 *   "[Meta CAPI error]"   with the thrown message on network failure
 */
export async function sendCapiEvents(events: CapiEvent[]): Promise<void> {
  const token = process.env.FACEBOOK_CONVERSIONS_API_TOKEN;
  if (!token) {
    console.error(
      "[Meta CAPI error] FACEBOOK_CONVERSIONS_API_TOKEN is not set — CAPI send skipped",
    );
    return;
  }

  const testEventCode = process.env.META_TEST_EVENT_CODE ?? undefined;

  const payload: Record<string, unknown> = { data: events };
  if (testEventCode) {
    payload.test_event_code = testEventCode;
  }

  let responseBody: unknown = null;
  try {
    const res = await fetch(`${CAPI_ENDPOINT}?access_token=${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    responseBody = await res.json().catch(() => null);

    if (res.ok) {
      console.log("[Meta CAPI success]", JSON.stringify(responseBody));
    } else {
      console.error(
        `[Meta CAPI error] HTTP ${res.status}`,
        JSON.stringify(responseBody),
      );
    }
  } catch (e) {
    console.error(
      "[Meta CAPI error] fetch failed:",
      e instanceof Error ? e.message : String(e),
    );
  }
}

// ---------------------------------------------------------------------------
// Typed event helpers
// ---------------------------------------------------------------------------

interface BaseCapiParams {
  eventId: string;
  eventSourceUrl: string;
  userData: CapiUserData;
  /** Override for event_time (Unix seconds). Defaults to now. */
  eventTime?: number;
}

/**
 * Send a Lead event via CAPI.
 * Call this from the /api/vendor-leads route (or /api/meta/events) after the
 * lead is successfully saved to Firestore, passing the same eventId that was
 * sent to fbq() in the browser.
 */
export async function sendLeadEvent(
  params: BaseCapiParams & {
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    utmContent?: string;
    utmTerm?: string;
  },
): Promise<void> {
  const customData = stripEmpty({
    utm_source: params.utmSource,
    utm_medium: params.utmMedium,
    utm_campaign: params.utmCampaign,
    utm_content: params.utmContent,
    utm_term: params.utmTerm,
  });

  await sendCapiEvents([
    {
      event_name: "Lead",
      event_time: params.eventTime ?? Math.floor(Date.now() / 1000),
      action_source: "website",
      event_source_url: params.eventSourceUrl,
      event_id: params.eventId,
      user_data: params.userData,
      ...(customData ? { custom_data: customData } : {}),
    },
  ]);
}

/**
 * Send a Contact event via CAPI.
 * Fires when the user opens a WhatsApp conversation with Comeleal.
 */
export async function sendContactEvent(
  params: BaseCapiParams,
): Promise<void> {
  await sendCapiEvents([
    {
      event_name: "Contact",
      event_time: params.eventTime ?? Math.floor(Date.now() / 1000),
      action_source: "website",
      event_source_url: params.eventSourceUrl,
      event_id: params.eventId,
      user_data: params.userData,
    },
  ]);
}

/**
 * Send a ViewContent event via CAPI.
 * Fires when the user views /para-restaurantes.
 */
export async function sendViewContentEvent(
  params: BaseCapiParams & {
    contentName?: string;
    contentCategory?: string;
  },
): Promise<void> {
  const customData = stripEmpty({
    content_name: params.contentName,
    content_category: params.contentCategory,
  });

  await sendCapiEvents([
    {
      event_name: "ViewContent",
      event_time: params.eventTime ?? Math.floor(Date.now() / 1000),
      action_source: "website",
      event_source_url: params.eventSourceUrl,
      event_id: params.eventId,
      user_data: params.userData,
      ...(customData ? { custom_data: customData } : {}),
    },
  ]);
}
