import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";
import { randomUUID } from "node:crypto";

import {
  getFirebaseAdminApp,
  getFirebaseAdminDb,
  hasFirebaseAdminCredentials,
} from "@/lib/firebaseAdmin";
import { encodeWebOAuthState } from "@/lib/mercadoPago/oauthState";

export const runtime = "nodejs";

/**
 * Arranca el connect de Mercado Pago desde el PANEL WEB.
 *
 * Por qué existe un "start" y no solo un callback: sin esto, cualquiera podría
 * llamar al callback con un `state` apuntando al restaurante de otro y enganchar
 * SU cuenta de Mercado Pago al negocio ajeno — o sea, desviarle los cobros. Aquí
 * se verifica que quien inicia es el dueño y se aparta un nonce de un solo uso
 * que el callback exige después.
 *
 * El `client_secret` NUNCA aparece en esta ruta ni en el navegador: la URL de
 * autorización solo lleva el `client_id`, que es público por diseño.
 */
export async function POST(request: Request) {
  try {
    const clientId = (process.env.MERCADO_PAGO_CLIENT_ID ?? "").trim();
    const redirectUri = (process.env.MERCADO_PAGO_REDIRECT_URI ?? "").trim();
    if (!clientId || !redirectUri) {
      return NextResponse.json({ error: "mp_oauth_not_configured" }, { status: 503 });
    }
    if (!hasFirebaseAdminCredentials()) {
      return NextResponse.json({ error: "firebase_admin_credentials_missing" }, { status: 503 });
    }

    const authHeader = request.headers.get("authorization") ?? "";
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    if (!idToken) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    let uid: string;
    try {
      uid = (await getAuth(getFirebaseAdminApp()).verifyIdToken(idToken)).uid;
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
    const isOwner = data.ownerId === uid || data.billingOwnerUserId === uid;
    if (!isOwner) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    // Nonce de un solo uso. Vive en `private/` porque las reglas no exponen esa
    // subcolección al cliente — solo el Admin SDK la lee.
    const nonce = randomUUID().replace(/-/g, "").slice(0, 24);
    await db
        .collection("restaurants")
        .doc(restaurantId)
        .collection("private")
        .doc("mercadoPagoOAuth")
        .set(
            {startedByUid: uid, nonce, startedAt: FieldValue.serverTimestamp()},
            {merge: true},
        );

    const authorizeUrl =
      "https://auth.mercadopago.com.mx/authorization?" +
      new URLSearchParams({
        client_id: clientId,
        response_type: "code",
        platform_id: "mp",
        redirect_uri: redirectUri,
        state: encodeWebOAuthState(restaurantId, nonce),
      }).toString();

    return NextResponse.json({ authorizeUrl });
  } catch (e) {
    console.error("[mp-oauth-start]", e);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
