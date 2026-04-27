import { getFirebaseApp } from "./firebase";

/**
 * Best-effort Firebase Analytics for the public web menu (browser only).
 * All tracking is fire-and-forget: failures must never break the page.
 */
export const WEB_MENU_EVENTS = {
  view: "web_menu_view",
  openAppClick: "web_menu_open_app_click",
  downloadClick: "web_menu_download_click",
} as const;

type ViewParams = {
  restaurantId: string;
  restaurantName: string;
  itemCount: number;
};

type ClickParams = {
  restaurantId: string;
  restaurantName: string;
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
      if (v === undefined) continue;
      clean[k] = v;
    }
    logEvent(analytics, eventName, clean);
  } catch {
    // best-effort only
  }
}

/* Dedupe [web_menu_view] when React Strict Mode double-invokes effects in dev. */
let lastViewDedupe: { key: string; t: number } | null = null;
function isDuplicateView(p: ViewParams): boolean {
  const key = `${p.restaurantId}|${p.itemCount}|${p.restaurantName}`;
  const t = Date.now();
  if (
    lastViewDedupe &&
    lastViewDedupe.key === key &&
    t - lastViewDedupe.t < 2000
  ) {
    return true;
  }
  lastViewDedupe = { key, t };
  return false;
}

/**
 * Fires after restaurant doc + menu collection load without error.
 */
export function trackWebMenuView(p: ViewParams): void {
  if (typeof window === "undefined") return;
  try {
    if (isDuplicateView(p)) return;
    void logEventSafe(WEB_MENU_EVENTS.view, {
      restaurantId: p.restaurantId,
      restaurantName: p.restaurantName,
      itemCount: p.itemCount,
    });
  } catch {
    // no-op
  }
}

export function trackWebMenuOpenAppClick(p: ClickParams): void {
  if (typeof window === "undefined") return;
  try {
    void logEventSafe(WEB_MENU_EVENTS.openAppClick, {
      restaurantId: p.restaurantId,
      restaurantName: p.restaurantName,
    });
  } catch {
    // no-op
  }
}

export function trackWebMenuDownloadClick(p: ClickParams): void {
  if (typeof window === "undefined") return;
  try {
    void logEventSafe(WEB_MENU_EVENTS.downloadClick, {
      restaurantId: p.restaurantId,
      restaurantName: p.restaurantName,
    });
  } catch {
    // no-op
  }
}
