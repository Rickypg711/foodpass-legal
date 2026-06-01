/**
 * POST /api/meta/events
 *
 * Server-side proxy between the browser and the Meta Conversions API.
 *
 * The browser cannot call CAPI directly because:
 *   - FACEBOOK_CONVERSIONS_API_TOKEN must stay server-side.
 *   - The client IP address is only visible to the server.
 *   - CORS would block a direct browser→graph.facebook.com call.
 *
 * Request body (JSON):
 * {
 *   events: Array<{
 *     event_name:      "Lead" | "Contact" | "ViewContent"
 *     event_id:        string   // same UUID sent to fbq() for deduplication
 *     event_source_url: string  // window.location.href
 *     custom_data?: {
 *       content_name?, content_category?,
 *       utm_source?, utm_medium?, utm_campaign?, utm_content?, utm_term?
 *     }
 *   }>
 *   fbp?:              string   // _fbp cookie value
 *   fbc?:              string   // _fbc cookie value
 *   client_user_agent?: string  // navigator.userAgent
 * }
 *
 * Response: always 200 { ok: true } once events are dispatched.
 * CAPI failures are logged server-side and never surface to the browser.
 */

import { NextResponse } from "next/server";
import {
  sendLeadEvent,
  sendContactEvent,
  sendViewContentEvent,
  type CapiUserData,
} from "@/lib/meta/capi";

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

const ALLOWED_EVENT_NAMES = ["Lead", "Contact", "ViewContent"] as const;
type AllowedEventName = (typeof ALLOWED_EVENT_NAMES)[number];

function isAllowedEventName(value: unknown): value is AllowedEventName {
  return (
    typeof value === "string" &&
    (ALLOWED_EVENT_NAMES as readonly string[]).includes(value)
  );
}

function safeString(value: unknown, maxLength = 500): string | undefined {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim().slice(0, maxLength);
  }
  return undefined;
}

interface IncomingEvent {
  event_name: AllowedEventName;
  event_id: string;
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

interface RequestBody {
  events: IncomingEvent[];
  fbp?: string;
  fbc?: string;
  client_user_agent?: string;
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: Request): Promise<NextResponse> {
  // Parse body — return 400 only for malformed JSON or missing events array.
  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_json" },
      { status: 400 },
    );
  }

  if (!Array.isArray(body.events) || body.events.length === 0) {
    return NextResponse.json(
      { ok: false, error: "events_required" },
      { status: 400 },
    );
  }

  // ---------------------------------------------------------------------------
  // Build shared user_data for all events in this request.
  // IP comes from Vercel/CDN forwarding headers — never from the browser body.
  // ---------------------------------------------------------------------------

  const clientIp =
    safeString(request.headers.get("x-forwarded-for")?.split(",")[0]) ??
    safeString(request.headers.get("x-real-ip")) ??
    undefined;

  const userData: CapiUserData = {
    client_ip_address: clientIp,
    // Prefer the User-Agent from the request header (most accurate).
    // Fall back to the value the browser sent in the body.
    client_user_agent:
      safeString(request.headers.get("user-agent")) ??
      safeString(body.client_user_agent),
    fbp: safeString(body.fbp, 200),
    fbc: safeString(body.fbc, 200),
  };

  // ---------------------------------------------------------------------------
  // Dispatch each valid event to CAPI.
  // Invalid events are silently skipped (no event_name or empty event_id).
  // ---------------------------------------------------------------------------

  const sends: Promise<void>[] = [];

  for (const e of body.events) {
    if (!isAllowedEventName(e.event_name)) continue;
    const eventId = safeString(e.event_id);
    if (!eventId) continue;
    const eventSourceUrl = safeString(e.event_source_url, 2000) ?? "";

    const base = { eventId, eventSourceUrl, userData };

    switch (e.event_name) {
      case "Lead":
        sends.push(
          sendLeadEvent({
            ...base,
            utmSource: safeString(e.custom_data?.utm_source),
            utmMedium: safeString(e.custom_data?.utm_medium),
            utmCampaign: safeString(e.custom_data?.utm_campaign),
            utmContent: safeString(e.custom_data?.utm_content),
            utmTerm: safeString(e.custom_data?.utm_term),
          }),
        );
        break;

      case "Contact":
        sends.push(sendContactEvent(base));
        break;

      case "ViewContent":
        sends.push(
          sendViewContentEvent({
            ...base,
            contentName: safeString(e.custom_data?.content_name),
            contentCategory: safeString(e.custom_data?.content_category),
          }),
        );
        break;
    }
  }

  // Await all sends before responding so Vercel doesn't terminate the function
  // before the CAPI requests complete. allSettled never rejects.
  await Promise.allSettled(sends);

  return NextResponse.json({ ok: true });
}
