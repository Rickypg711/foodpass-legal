import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";

import {
  getFirebaseAdminApp,
  getFirebaseAdminDb,
  hasFirebaseAdminCredentials,
} from "@/lib/firebaseAdmin";

export const runtime = "nodejs";

/**
 * Cierra el connect de Mercado Pago iniciado desde la APP.
 *
 * Existe para sacar el `client_secret` del bundle de Flutter: hasta ago-2026 la
 * app hacía el intercambio del código en el CLIENTE, con el secreto empacado en
 * `.env` como asset — extraíble de cualquier APK con un unzip. Ahora la app
 * recibe el código por su deep link (igual que siempre) y lo manda AQUÍ; el
 * secreto vive solo en Vercel.
 *
 * Auth: a diferencia del callback web (que se protege con el nonce de `start`
 * porque llega por redirect del navegador), aquí la app manda su ID token de
 * Firebase — prueba directa de identidad, así que no hace falta pre-registro.
 * La verificación de dueño es la misma que en `oauth/start`.
 *
 * La escritura es EL MISMO batch que el callback web: los campos públicos en el
 * doc del restaurante y el token vivo en `private/mercadoPago`, de donde ya lo
 * lee create-preference. Nunca se devuelven tokens al cliente.
 */
export async function POST(request: Request) {
  try {
    const clientId = (process.env.MERCADO_PAGO_CLIENT_ID ?? "").trim();
    const clientSecret = (process.env.MERCADO_PAGO_CLIENT_SECRET ?? "").trim();
    const redirectUri = (process.env.MERCADO_PAGO_REDIRECT_URI ?? "").trim();
    if (!clientId || !clientSecret || !redirectUri) {
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

    const body = (await request.json()) as { restaurantId?: string; code?: string };
    const restaurantId = body.restaurantId?.trim() ?? "";
    const code = body.code?.trim() ?? "";
    if (!restaurantId || !code) {
      return NextResponse.json({ error: "missing_fields" }, { status: 400 });
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

    const tokenRes = await fetch("https://api.mercadopago.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        grant_type: "authorization_code",
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });
    if (!tokenRes.ok) {
      // Nunca se registra el cuerpo: trae el access_token del vendedor.
      console.error("[mp-oauth-exchange] token exchange failed", tokenRes.status);
      return NextResponse.json({ error: "exchange_failed" }, { status: 502 });
    }
    const token = (await tokenRes.json()) as {
      access_token?: string;
      refresh_token?: string;
      user_id?: number | string;
    };
    const accessToken = token.access_token;
    if (!accessToken || token.user_id == null) {
      return NextResponse.json({ error: "exchange_failed" }, { status: 502 });
    }

    // El correo es cosmético (se muestra en el panel): si falla, se conecta igual.
    let email: string | null = null;
    try {
      const meRes = await fetch("https://api.mercadopago.com/users/me", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (meRes.ok) {
        const me = (await meRes.json()) as { email?: string };
        email = me.email ?? null;
      }
    } catch {
      /* cosmético */
    }

    const batch = db.batch();
    batch.update(db.collection("restaurants").doc(restaurantId), {
      mercadoPagoConnected: true,
      mercadoPagoAccountId: String(token.user_id),
      mercadoPagoEmail: email,
      mercadoPagoConnectedAt: FieldValue.serverTimestamp(),
    });
    batch.set(
        db
            .collection("restaurants")
            .doc(restaurantId)
            .collection("private")
            .doc("mercadoPago"),
        {
          mercadoPagoAccessToken: accessToken,
          mercadoPagoRefreshToken: token.refresh_token ?? null,
          updatedAt: FieldValue.serverTimestamp(),
        },
        {merge: true},
    );
    await batch.commit();

    // Solo hechos no sensibles: la app pinta "conectado" con esto.
    return NextResponse.json({
      connected: true,
      accountId: String(token.user_id),
      email,
    });
  } catch (e) {
    console.error("[mp-oauth-exchange]", e);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
