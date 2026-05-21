/**
 * Mercado Pago web checkout debug logging (no secrets).
 * Client: NEXT_PUBLIC_MP_WEB_DEBUG=true
 * Server: MP_WEB_DEBUG=true
 */

export function isMpWebDebugClient(): boolean {
  return process.env.NEXT_PUBLIC_MP_WEB_DEBUG === "true";
}

export function isMpWebDebugServer(): boolean {
  return process.env.MP_WEB_DEBUG === "true";
}

/** True when site URL uses http://localhost or http://127.0.0.1 (MP discourages for back_urls). */
export function isHttpLocalhostSiteUrl(siteUrl: string | null | undefined): boolean {
  if (!siteUrl?.trim()) return false;
  try {
    const u = new URL(siteUrl.trim());
    return (
      u.protocol === "http:" &&
      (u.hostname === "localhost" || u.hostname === "127.0.0.1")
    );
  } catch {
    return false;
  }
}

/**
 * Loud dev warning when sandbox checkout uses localhost site URL for back_urls.
 * Gated on MP_WEB_DEBUG — does not block requests.
 */
export function logMpSandboxLocalhostSiteUrlWarning(siteUrl: string): void {
  if (!isMpWebDebugServer()) return;
  if (process.env.MERCADO_PAGO_SANDBOX !== "true") return;
  if (!isHttpLocalhostSiteUrl(siteUrl)) return;

  console.warn("[mp-web-debug]", {
    level: "WARN",
    event: "mp_sandbox_localhost_site_url",
    siteUrlHost: urlHostOnly(siteUrl),
    mercadoPagoSandbox: true,
    impact:
      "back_urls use HTTP localhost; MP may show 'Something went wrong' after pay; auto_return omitted",
    fix:
      "Use Vercel Preview (HTTPS) — see docs/WEB_MP_VERCEL_PREVIEW_TESTING.md; or optional local tunnel in docs/WEB_MP_HTTPS_LOCAL_TESTING.md",
    doc: "docs/WEB_MP_VERCEL_PREVIEW_TESTING.md",
  });
}

export function urlHostOnly(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

export function mpWebDebugClient(event: string, data: Record<string, unknown>): void {
  if (!isMpWebDebugClient()) return;
  console.info("[mp-web-debug]", event, data);
}

export function mpWebDebugServer(event: string, data: Record<string, unknown>): void {
  if (!isMpWebDebugServer()) return;
  console.info("[mp-web-debug]", event, data);
}

export function preferenceBodySafeSummary(
  body: Record<string, unknown>,
): Record<string, unknown> {
  const items = Array.isArray(body.items) ? body.items : [];
  let totalAmount = 0;
  for (const raw of items) {
    if (raw && typeof raw === "object") {
      const row = raw as Record<string, unknown>;
      const qty = typeof row.quantity === "number" ? row.quantity : 1;
      const unit = typeof row.unit_price === "number" ? row.unit_price : 0;
      totalAmount += qty * unit;
    }
  }

  const backUrls = body.back_urls as Record<string, string> | undefined;
  const backUrlHosts =
    backUrls && typeof backUrls === "object"
      ? {
          success: urlHostOnly(backUrls.success),
          failure: urlHostOnly(backUrls.failure),
          pending: urlHostOnly(backUrls.pending),
        }
      : null;

  let usesHttpLocalhostBackUrls = false;
  if (backUrls && typeof backUrls === "object") {
    for (const url of Object.values(backUrls)) {
      if (typeof url !== "string") continue;
      try {
        const u = new URL(url);
        if (u.hostname === "localhost" || u.hostname === "127.0.0.1") {
          usesHttpLocalhostBackUrls = true;
          break;
        }
      } catch {
        /* ignore */
      }
    }
  }

  const marketplaceFeeAmount =
    typeof body.marketplace_fee === "number" && Number.isFinite(body.marketplace_fee)
      ? body.marketplace_fee
      : 0;

  return {
    itemCount: items.length,
    totalAmount: Math.round(totalAmount * 100) / 100,
    hasNotificationUrl:
      typeof body.notification_url === "string" && body.notification_url.trim().length > 0,
    backUrlHosts,
    usesHttpLocalhostBackUrls,
    autoReturnPresent: "auto_return" in body,
    hasPayer: "payer" in body,
    hasMarketplaceFee: marketplaceFeeAmount > 0,
    marketplaceFeeAmount,
  };
}

export function pickRedirectSource(
  mpJson: Record<string, unknown>,
  sandboxMode: boolean,
  redirectUrl: string,
): string {
  const sandbox = mpJson.sandbox_init_point;
  const prod = mpJson.init_point;
  if (
    sandboxMode &&
    typeof sandbox === "string" &&
    sandbox.length > 0 &&
    redirectUrl === sandbox
  ) {
    return "sandbox_init_point";
  }
  if (typeof prod === "string" && prod.length > 0 && redirectUrl === prod) {
    return "init_point";
  }
  if (typeof sandbox === "string" && sandbox.length > 0 && redirectUrl === sandbox) {
    return "sandbox_init_point_fallback";
  }
  return "unknown";
}
