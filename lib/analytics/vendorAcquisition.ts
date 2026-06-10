import { getFirebaseApp } from "../firebase";

/**
 * Vendor acquisition analytics — no PII in event params.
 * Best-effort Firebase Analytics; failures must never break the page.
 */
export const VENDOR_ACQUISITION_EVENTS = {
  landingView: "vendor_landing_view",
  ctaClick: "vendor_cta_click",
  leadStarted: "vendor_lead_started",
  leadSubmitted: "vendor_lead_submitted",
  restaurantCreated: "restaurant_created",
  onboardingCompleted: "vendor_onboarding_completed",
} as const;

export type VendorUtmParams = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
};

type SafeLeadSubmittedParams = VendorUtmParams & {
  city?: string;
  business_type?: string;
  source?: string;
};

type CtaClickParams = VendorUtmParams & {
  cta: string;
  section: string;
};

type AnalyticsInstance = import("firebase/analytics").Analytics;

let analyticsInitPromise: Promise<AnalyticsInstance | null> | null = null;

function getAnalyticsIfSupported(): Promise<AnalyticsInstance | null> {
  if (typeof window === "undefined") {
    return Promise.resolve(null);
  }
  if (analyticsInitPromise) return analyticsInitPromise;
  analyticsInitPromise = (async () => {
    try {
      const { getAnalytics, isSupported } = await import("firebase/analytics");
      if (!(await isSupported().catch(() => false))) {
        return null;
      }
      return getAnalytics(getFirebaseApp());
    } catch {
      return null;
    }
  })();
  return analyticsInitPromise;
}

async function logEventSafe(
  eventName: string,
  params: Record<string, string | number | undefined>,
) {
  try {
    const analytics = await getAnalyticsIfSupported();
    if (!analytics) return;
    const { logEvent } = await import("firebase/analytics");
    const clean: Record<string, string | number> = {};
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === "") continue;
      clean[k] = v;
    }
    logEvent(analytics, eventName, clean);
  } catch {
    // no-op
  }
}

let lastLandingViewKey: string | null = null;

export function trackVendorLandingView(utms: VendorUtmParams = {}): void {
  if (typeof window === "undefined") return;
  const key = JSON.stringify(utms);
  if (lastLandingViewKey === key) return;
  lastLandingViewKey = key;
  try {
    void logEventSafe(VENDOR_ACQUISITION_EVENTS.landingView, {
      source: "para_restaurantes",
      ...utms,
    });
  } catch {
    // no-op
  }
}

export function trackVendorCtaClick(params: CtaClickParams): void {
  if (typeof window === "undefined") return;
  try {
    void logEventSafe(VENDOR_ACQUISITION_EVENTS.ctaClick, {
      source: "para_restaurantes",
      ...params,
    });
  } catch {
    // no-op
  }
}

export function trackVendorLeadStarted(params: {
  business_type?: string;
  utm_source?: string;
  utm_campaign?: string;
}): void {
  if (typeof window === "undefined") return;
  try {
    void logEventSafe(VENDOR_ACQUISITION_EVENTS.leadStarted, {
      source: "para_restaurantes",
      ...params,
    });
  } catch {
    // no-op
  }
}

export function trackVendorLeadSubmitted(params: SafeLeadSubmittedParams): void {
  if (typeof window === "undefined") return;
  try {
    void logEventSafe(VENDOR_ACQUISITION_EVENTS.leadSubmitted, {
      source: "para_restaurantes",
      ...params,
    });
  } catch {
    // no-op
  }
}

/**
 * Fires when a restaurant document is successfully created via web signup
 * (ActivarModal). This is the web "Lead" moment — mark it as a key event
 * in GA4 admin so paid traffic conversions become visible.
 * No PII — only category + UTMs.
 */
export function trackRestaurantCreated(
  params: VendorUtmParams & { category?: string },
): void {
  if (typeof window === "undefined") return;
  try {
    void logEventSafe(VENDOR_ACQUISITION_EVENTS.restaurantCreated, {
      source: "web_activar",
      ...params,
    });
  } catch {
    // no-op
  }
}

/**
 * Fires once when the vendor reaches /vendor/setup/done (wizard finished).
 * Matches the Flutter app's vendor_onboarding_completed event name.
 */
export function trackVendorOnboardingCompleted(): void {
  if (typeof window === "undefined") return;
  try {
    void logEventSafe(VENDOR_ACQUISITION_EVENTS.onboardingCompleted, {
      source: "web_activar",
    });
  } catch {
    // no-op
  }
}
