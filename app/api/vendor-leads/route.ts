import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { VENDOR_LEAD_FORM_UNAVAILABLE_MESSAGE } from "@/lib/contactEmail";
import { getFirebaseAdminDb, hasFirebaseAdminCredentials } from "@/lib/firebaseAdmin";
import { validateVendorLeadBody, VENDOR_LEAD_SOURCE } from "@/lib/vendorLead/validate";

/**
 * Persists vendor acquisition leads to Firestore `vendorLeads`.
 *
 * Requires server credentials (same as MP checkout route):
 * - FIREBASE_SERVICE_ACCOUNT_JSON, or
 * - FIREBASE_SERVICE_ACCOUNT_PATH, or
 * - GOOGLE_APPLICATION_CREDENTIALS
 */
export async function POST(request: Request) {
  try {
    if (!hasFirebaseAdminCredentials()) {
      return NextResponse.json(
        {
          error: "service_unavailable",
          message: VENDOR_LEAD_FORM_UNAVAILABLE_MESSAGE,
        },
        { status: 503 },
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "invalid_json", message: "Datos inválidos." },
        { status: 400 },
      );
    }

    const validated = validateVendorLeadBody(body);
    if (!validated.ok) {
      return NextResponse.json(
        { error: "validation_failed", message: validated.error },
        { status: 400 },
      );
    }

    const lead = validated.data;
    const db = getFirebaseAdminDb();

    await db.collection("vendorLeads").add({
      createdAt: FieldValue.serverTimestamp(),
      name: lead.name,
      businessName: lead.businessName,
      city: lead.city,
      whatsapp: lead.whatsapp,
      businessType: lead.businessType,
      optionalMessage: lead.optionalMessage,
      source: VENDOR_LEAD_SOURCE,
      utmSource: lead.utmSource,
      utmMedium: lead.utmMedium,
      utmCampaign: lead.utmCampaign,
      utmContent: lead.utmContent,
      utmTerm: lead.utmTerm,
      status: "new",
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const message =
      e instanceof Error && e.message === "firebase_admin_credentials_missing"
        ? VENDOR_LEAD_FORM_UNAVAILABLE_MESSAGE
        : "No pudimos guardar tu información. Intenta de nuevo o escríbenos a comeleal@gmail.com o por WhatsApp al 614 601 7597.";
    return NextResponse.json(
      { error: "server_error", message },
      { status: 500 },
    );
  }
}
