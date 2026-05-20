import { getFirebaseApp } from "../firebase";

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

export async function logEventSafe(
  eventName: string,
  params: Record<string, string | number | undefined>,
): Promise<void> {
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
    /* best-effort */
  }
}
