import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import {
  getFirebaseAdminApp,
  getFirebaseAdminDb,
  hasFirebaseAdminCredentials,
} from "@/lib/firebaseAdmin";

/**
 * Comeleal Pro — web subscription checkout (MP Suscripciones / preapproval).
 *
 * Creates a pending preapproval ($299 MXN/mes) with external_reference = restaurantId
 * and returns its init_point. The vendor pays on MP; the Cloud Function
 * mercadopagoSubscriptionWebhook then writes the canonical Pro fields on
 * restaurants/{id} (same fields the app IAP writes), unlocking Pro everywhere.
 *
 * Uses the "ComeLeal Suscripciones" MP app (#1520524476334064) — this token is
 * OUR account charging the vendor, unrelated to the per-vendor OAuth used for
 * order payments (ComeLeal app).
 *
 * Env (Vercel):
 * - MP_SUBSCRIPTIONS_ACCESS_TOKEN  (required)
 * - MP_PREAPPROVAL_PLAN_ID         (optional; associates subscriptions to the plan)
 */

const MP_PREAPPROVAL_URL = "https://api.mercadopago.com/preapproval";
const PRO_AMOUNT_MXN = 299;

function siteBaseUrl(request: Request): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? "http";
  if (host) return `${proto}://${host}`;
  return "http://localhost:3000";
}

export async function POST(request: Request) {
  try {
    const accessToken = process.env.MP_SUBSCRIPTIONS_ACCESS_TOKEN?.trim();
    if (!accessToken) {
      return NextResponse.json({ error: "mp_subscriptions_token_missing" }, { status: 503 });
    }
    if (!hasFirebaseAdminCredentials()) {
      return NextResponse.json({ error: "firebase_admin_credentials_missing" }, { status: 503 });
    }

    // ── Auth: caller must be a signed-in owner of the restaurant ──
    const authHeader = request.headers.get("authorization") ?? "";
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    if (!idToken) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    let uid: string;
    let tokenEmail: string | undefined;
    try {
      const decoded = await getAuth(getFirebaseAdminApp()).verifyIdToken(idToken);
      uid = decoded.uid;
      tokenEmail = decoded.email ?? undefined;
    } catch {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as { restaurantId?: string };
    const restaurantId = body.restaurantId?.trim() ?? "";
    if (!restaurantId) {
      return NextResponse.json({ error: "missing_restaurant_id" }, { status: 400 });
    }

    const db = getFirebaseAdminDb();
    const snap = await db.collection("restaurants").doc(restaurantId).get();
    if (!snap.exists) {
      return NextResponse.json({ error: "restaurant_not_found" }, { status: 404 });
    }
    const data = snap.data() as Record<string, unknown>;
    const ownerId = (data.ownerId as string) ?? "";
    const billingOwner = ((data.billingOwnerUserId as string) ?? "").trim();
    if (ownerId !== uid && billingOwner !== uid) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const payerEmail = tokenEmail;
    if (!payerEmail) {
      return NextResponse.json({ error: "payer_email_missing" }, { status: 400 });
    }

    // ── Create pending preapproval on MP ──
    const planId = process.env.MP_PREAPPROVAL_PLAN_ID?.trim();
    const preapprovalBody: Record<string, unknown> = {
      reason: "Comeleal Pro",
      external_reference: restaurantId,
      payer_email: payerEmail,
      back_url: `${siteBaseUrl(request)}/vendor/configuracion?pro=pending`,
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: PRO_AMOUNT_MXN,
        currency_id: "MXN",
      },
      status: "pending",
    };
    if (planId) preapprovalBody.preapproval_plan_id = planId;

    const mpResponse = await fetch(MP_PREAPPROVAL_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(preapprovalBody),
    });

    const mpJson = (await mpResponse.json().catch(() => ({}))) as Record<string, unknown>;
    if (!mpResponse.ok) {
      console.error("[mp-subscribe] preapproval_create_failed", {
        status: mpResponse.status,
        message: (mpJson as { message?: string }).message ?? null,
        restaurantId,
      });
      return NextResponse.json({ error: "mp_preapproval_failed" }, { status: 502 });
    }

    const initPoint =
      (mpJson.init_point as string) || (mpJson.sandbox_init_point as string) || "";
    if (!initPoint) {
      return NextResponse.json({ error: "mp_init_point_missing" }, { status: 502 });
    }

    return NextResponse.json({
      initPoint,
      preapprovalId: (mpJson.id as string) ?? null,
    });
  } catch (error) {
    console.error("[mp-subscribe] unexpected_error", {
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
