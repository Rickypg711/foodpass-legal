import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getFirebaseAdminDb, hasFirebaseAdminCredentials } from "@/lib/firebaseAdmin";
import {
  buildMercadoPagoPreferenceBody,
  pickCheckoutRedirectUrl,
} from "@/lib/mercadoPago/buildPreferenceRequest";
import {
  logMpSandboxLocalhostSiteUrlWarning,
  mpWebDebugServer,
  pickRedirectSource,
  preferenceBodySafeSummary,
  urlHostOnly,
} from "@/lib/mercadoPago/mpWebDebug";
import {
  calculateMarketplaceFeeAmount,
  parseMarketplaceFeeRate,
} from "@/lib/mercadoPago/marketplaceFee";
import { evaluateRestaurantMpEligibility } from "@/lib/mercadoPago/restaurantEligibility";
import { PAYMENT_METHOD_MERCADO_PAGO } from "@/lib/types/order";

const MP_PREFERENCES_URL = "https://api.mercadopago.com/checkout/preferences";

function siteBaseUrl(request: Request): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? "http";
  if (host) return `${proto}://${host}`;
  return "http://localhost:3000";
}

function isSandboxMode(): boolean {
  return process.env.MERCADO_PAGO_SANDBOX === "true";
}

type OrderRow = {
  restaurantId?: string;
  customerId?: string;
  customerName?: string;
  paymentMethod?: string;
  status?: string;
  paymentStatus?: string;
  total?: number;
  items?: Array<{ name?: string; quantity?: number; subtotal?: number; price?: number }>;
};

export async function POST(request: Request) {
  let restaurantId = "";
  let orderId = "";
  try {
    const body = (await request.json()) as {
      restaurantId?: string;
      orderId?: string;
      customerId?: string;
    };

    restaurantId = body.restaurantId?.trim() ?? "";
    orderId = body.orderId?.trim() ?? "";
    const customerId = body.customerId?.trim() ?? "";

    const siteUrlFromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim() ?? "";
    logMpSandboxLocalhostSiteUrlWarning(siteUrlFromEnv);

    mpWebDebugServer("create_preference_request", {
      restaurantId: restaurantId || null,
      orderId: orderId || null,
      hasRestaurantId: !!restaurantId,
      hasOrderId: !!orderId,
      hasCustomerId: !!customerId,
      env: {
        mpWebDebug: process.env.MP_WEB_DEBUG === "true",
        hasGoogleApplicationCredentials: !!process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim(),
        hasFirebaseServiceAccountPath: !!process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim(),
        hasFirebaseServiceAccountJson: !!process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim(),
        hasNextPublicSiteUrl: !!siteUrlFromEnv,
        nextPublicSiteUrlHost: urlHostOnly(siteUrlFromEnv || null),
        mercadoPagoSandbox: process.env.MERCADO_PAGO_SANDBOX === "true",
        hasMercadoPagoWebhookUrl: !!process.env.MERCADO_PAGO_WEBHOOK_URL?.trim(),
        hasFirebaseAdminCredentials: hasFirebaseAdminCredentials(),
      },
    });

    if (!restaurantId || !orderId || !customerId) {
      return NextResponse.json(
        { error: "missing_fields", message: "restaurantId, orderId, and customerId are required" },
        { status: 400 },
      );
    }

    if (!hasFirebaseAdminCredentials()) {
      mpWebDebugServer("firebase_admin_credentials_missing", { restaurantId, orderId });
      return NextResponse.json(
        { error: "firebase_admin_credentials_missing" },
        { status: 503 },
      );
    }

    const db = getFirebaseAdminDb();
    const restaurantSnap = await db.collection("restaurants").doc(restaurantId).get();
    const restaurantData = restaurantSnap.data() as Record<string, unknown> | undefined;

    mpWebDebugServer("restaurant_loaded", {
      restaurantId,
      orderId,
      restaurantDocFound: restaurantSnap.exists,
      mercadoPagoConnected: restaurantData?.mercadoPagoConnected === true,
      hasAccessToken:
        typeof restaurantData?.mercadoPagoAccessToken === "string" &&
        restaurantData.mercadoPagoAccessToken.trim().length > 0,
    });

    const eligibility = evaluateRestaurantMpEligibility(restaurantId, restaurantData);
    if (!eligibility.eligible) {
      mpWebDebugServer("restaurant_ineligible", {
        restaurantId,
        orderId,
        reason: eligibility.reason ?? "restaurant_not_eligible",
      });
      return NextResponse.json(
        { error: eligibility.reason ?? "restaurant_not_eligible" },
        { status: 403 },
      );
    }

    const accessToken = (restaurantData?.mercadoPagoAccessToken as string | undefined)?.trim();
    if (!accessToken) {
      mpWebDebugServer("mercado_pago_token_missing", { restaurantId, orderId });
      return NextResponse.json({ error: "mercado_pago_token_missing" }, { status: 403 });
    }

    const orderSnap = await db
      .collection("restaurants")
      .doc(restaurantId)
      .collection("orders")
      .doc(orderId)
      .get();

    const order = orderSnap.data() as OrderRow | undefined;

    mpWebDebugServer("order_loaded", {
      restaurantId,
      orderId,
      orderDocFound: orderSnap.exists,
      paymentMethod: order?.paymentMethod ?? null,
      status: order?.status ?? null,
      paymentStatus: order?.paymentStatus ?? null,
    });

    if (!orderSnap.exists || !order) {
      return NextResponse.json({ error: "order_not_found" }, { status: 404 });
    }
    if (order.restaurantId && order.restaurantId !== restaurantId) {
      return NextResponse.json({ error: "order_restaurant_mismatch" }, { status: 403 });
    }
    if (order.customerId !== customerId) {
      return NextResponse.json({ error: "order_customer_mismatch" }, { status: 403 });
    }
    if (order.paymentMethod !== PAYMENT_METHOD_MERCADO_PAGO) {
      return NextResponse.json({ error: "order_not_mercado_pago" }, { status: 400 });
    }
    if (order.status !== "payment_pending") {
      return NextResponse.json({ error: "order_not_awaiting_payment" }, { status: 400 });
    }

    const base = siteBaseUrl(request);
    const orderPath = `/menu/${encodeURIComponent(restaurantId)}/order/${encodeURIComponent(orderId)}`;
    const successUrl = `${base}${orderPath}?payment=success`;
    const failureUrl = `${base}${orderPath}?payment=failure`;
    const pendingUrl = `${base}${orderPath}?payment=pending`;

    const items = (order.items ?? []).map((it) => ({
      title: (it.name ?? "Item").toString(),
      quantity: typeof it.quantity === "number" ? it.quantity : 1,
      unit_price:
        typeof it.price === "number"
          ? it.price
          : typeof it.subtotal === "number" && typeof it.quantity === "number" && it.quantity > 0
            ? it.subtotal / it.quantity
            : 0,
    }));

    const webhookUrl = process.env.MERCADO_PAGO_WEBHOOK_URL?.trim() ?? "";
    if (!webhookUrl) {
      mpWebDebugServer("webhook_url_missing", {
        restaurantId,
        orderId,
        hint: "Set MERCADO_PAGO_WEBHOOK_URL in .env.local for IPN",
      });
    }

    const orderTotal = typeof order.total === "number" ? order.total : 0;
    const marketplaceFeeRate = parseMarketplaceFeeRate(
      process.env.MERCADO_PAGO_MARKETPLACE_FEE_RATE,
    );
    const marketplaceFeeAmount = calculateMarketplaceFeeAmount(
      orderTotal,
      marketplaceFeeRate,
    );

    const preferenceBody = buildMercadoPagoPreferenceBody({
      orderId,
      restaurantId,
      customerId,
      customerName: order.customerName,
      items,
      total: orderTotal,
      marketplaceFeeRate,
      successUrl,
      failureUrl,
      pendingUrl,
      notificationUrl: webhookUrl || undefined,
      statementDescriptor:
        typeof restaurantData?.name === "string"
          ? restaurantData.name.slice(0, 22)
          : "COMELEAL",
    });

    const preferenceSummary = preferenceBodySafeSummary(preferenceBody);
    mpWebDebugServer("preference_body_summary", {
      restaurantId,
      orderId,
      ...preferenceSummary,
      marketplaceFeeRate,
    });
    if (preferenceSummary.usesHttpLocalhostBackUrls === true) {
      logMpSandboxLocalhostSiteUrlWarning(siteBaseUrl(request));
    } else if (preferenceSummary.autoReturnPresent === true) {
      mpWebDebugServer("checkout_https_back_urls_ok", {
        restaurantId,
        orderId,
        autoReturnPresent: true,
        backUrlHosts: preferenceSummary.backUrlHosts,
      });
    }

    const mpResponse = await fetch(MP_PREFERENCES_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        "X-Idempotency-Key": `${orderId}-${Date.now()}`,
      },
      body: JSON.stringify(preferenceBody),
    });

    const mpJson = (await mpResponse.json()) as Record<string, unknown>;
    if (!mpResponse.ok) {
      const message =
        typeof mpJson.message === "string" ? mpJson.message : "preference_create_failed";
      const mpError = typeof mpJson.error === "string" ? mpJson.error : null;
      const mpStatusDetail =
        typeof mpJson.status === "number" ? mpJson.status : mpResponse.status;
      mpWebDebugServer("mercado_pago_api_error", {
        restaurantId,
        orderId,
        mpStatus: mpResponse.status,
        mpStatusDetail,
        mpMessage: message,
        mpError,
      });
      return NextResponse.json(
        { error: "mercado_pago_api_error", message },
        { status: 502 },
      );
    }

    const preferenceId = typeof mpJson.id === "string" ? mpJson.id : null;
    const redirectUrl = pickCheckoutRedirectUrl(mpJson, isSandboxMode());
    const redirectSource = redirectUrl
      ? pickRedirectSource(mpJson, isSandboxMode(), redirectUrl)
      : null;

    mpWebDebugServer("mercado_pago_api_success", {
      restaurantId,
      orderId,
      mpStatus: mpResponse.status,
      hasPreferenceId: !!preferenceId,
      redirectSource,
      redirectUrlHost: redirectUrl ? urlHostOnly(redirectUrl) : null,
      sandboxMode: isSandboxMode(),
    });

    if (!preferenceId || !redirectUrl) {
      mpWebDebugServer("preference_missing_redirect", { restaurantId, orderId });
      return NextResponse.json({ error: "preference_missing_redirect" }, { status: 502 });
    }

    await orderSnap.ref.update({
      mercadoPagoPreferenceId: preferenceId,
      mercadoPagoPreferenceCreatedAt: FieldValue.serverTimestamp(),
    });

    mpWebDebugServer("create_preference_success", {
      restaurantId,
      orderId,
      sandboxMode: isSandboxMode(),
      redirectSource,
      redirectUrlHost: urlHostOnly(redirectUrl),
    });

    return NextResponse.json({
      preferenceId,
      redirectUrl,
      sandboxMode: isSandboxMode(),
      redirectSource: redirectSource ?? undefined,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "internal_error";
    mpWebDebugServer("internal_error", {
      restaurantId: restaurantId || null,
      orderId: orderId || null,
      message,
    });
    if (message === "firebase_admin_credentials_missing") {
      return NextResponse.json({ error: message }, { status: 503 });
    }
    return NextResponse.json({ error: "internal_error", message }, { status: 500 });
  }
}
