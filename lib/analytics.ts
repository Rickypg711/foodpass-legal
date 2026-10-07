import { getFirebaseApp } from "./firebase";

/**
 * Best-effort Firebase Analytics for the public web menu (browser only).
 * All tracking is fire-and-forget: failures must never break the page.
 */
export const WEB_MENU_EVENTS = {
  view: "web_menu_view",
  openAppClick: "web_menu_open_app_click",
  downloadClick: "web_menu_download_click",
  landingView: "web_landing_view",
  landingMenuClick: "web_landing_menu_click",
  landingWhatsappClick: "web_landing_whatsapp_click",
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

/** Vista de la página pública del restaurante (/r/{id} — landing). */
/**
 * `?m=wa` en la portada = llegó por el WhatsApp de win-back del dueño
 * (functions/winback_signals.js menuShareLink). Corto a propósito: un utm
 * largo en el mensaje del cliente parecía spam. Se manda como parámetro del
 * evento (via) para contar los toques en GA4.
 */
export function landingViaFromLocation(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const sp = new URLSearchParams(window.location.search);
    const m = sp.get("m");
    if (m === "wa") return "winback_whatsapp";
    // 6-oct-2026: activación en tres toques — el dueño comparte con
    // utm_source=whatsapp|instagram|google & utm_medium=owner_share.
    const src = sp.get("utm_source");
    if (src && sp.get("utm_medium") === "owner_share") return `owner_${src.slice(0, 24)}`;
    return null;
  } catch {
    return null;
  }
}

export function trackWebLandingView(p: ClickParams & { via?: string | null }): void {
  if (typeof window === "undefined") return;
  try {
    void logEventSafe(WEB_MENU_EVENTS.landingView, {
      restaurantId: p.restaurantId,
      restaurantName: p.restaurantName,
      ...(p.via ? { via: p.via } : {}),
    });
  } catch {
    // no-op
  }
}

/** Click en "Ver menú" desde la landing — el funnel landing → menú. */
export function trackWebLandingMenuClick(p: ClickParams): void {
  if (typeof window === "undefined") return;
  try {
    void logEventSafe(WEB_MENU_EVENTS.landingMenuClick, {
      restaurantId: p.restaurantId,
      restaurantName: p.restaurantName,
    });
  } catch {
    // no-op
  }
}

/** Click en el botón de WhatsApp de la landing. */
export function trackWebLandingWhatsappClick(p: ClickParams): void {
  if (typeof window === "undefined") return;
  try {
    void logEventSafe(WEB_MENU_EVENTS.landingWhatsappClick, {
      restaurantId: p.restaurantId,
      restaurantName: p.restaurantName,
    });
  } catch {
    // no-op
  }
}
