import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";

import { getFirebaseAdminDb, hasFirebaseAdminCredentials } from "@/lib/firebaseAdmin";
import { decodeOAuthState } from "@/lib/mercadoPago/oauthState";

export const runtime = "nodejs";

const PANEL = "/vendor/configuracion";

function back(request: Request, status: string) {
  return NextResponse.redirect(new URL(`${PANEL}?mp=${status}`, request.url));
}

/**
 * Cierra el connect de Mercado Pago iniciado desde el panel web.
 *
 * A esta ruta llega `public/mercado-pago-callback.html` cuando el `state` dice
 * que el connect empezó en la web. Si empezó en la app, esa página sigue
 * mandando el deep link como siempre — Mercado Pago devuelve a UNA sola
 * redirect_uri registrada y las dos plataformas la comparten.
 *
 * El intercambio del código por el token se hace AQUÍ, en el servidor. En la app
 * ese intercambio ocurre en el cliente con el `client_secret` empacado dentro del
 * bundle (`pubspec.yaml` lista `.env` como asset), o sea que ese secreto es
 * extraíble de cualquier APK. Esta ruta es también el camino para sacarlo de
 * ahí: cuando la app llame a este endpoint en vez de hablarle directo a Mercado
 * Pago, el secreto se queda solo en Vercel.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (url.searchParams.get("error")) return back(request, "denied");
  if (!code) return back(request, "missing_code");

  const parsed = decodeOAuthState(state);
  if (!parsed) return back(request, "bad_state");

  const clientId = (process.env.MERCADO_PAGO_CLIENT_ID ?? "").trim();
  const clientSecret = (process.env.MERCADO_PAGO_CLIENT_SECRET ?? "").trim();
  const redirectUri = (process.env.MERCADO_PAGO_REDIRECT_URI ?? "").trim();
  if (!clientId || !clientSecret || !redirectUri) return back(request, "not_configured");
  if (!hasFirebaseAdminCredentials()) return back(request, "not_configured");

  try {
    const db = getFirebaseAdminDb();
    const pendingRef = db
        .collection("restaurants")
        .doc(parsed.restaurantId)
        .collection("private")
        .doc("mercadoPagoOAuth");

    // El nonce prueba que ESTE connect lo arrancó el dueño desde el panel. Sin
    // esta comprobación, un `state` fabricado dejaría enganchar una cuenta de
    // Mercado Pago ajena a este restaurante y desviarle los cobros.
    const pending = await pendingRef.get();
    const expectedNonce = pending.exists ? (pending.data()?.nonce as string | undefined) : undefined;
    if (!expectedNonce || expectedNonce !== parsed.nonce) {
      return back(request, "state_expired");
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
      console.error("[mp-oauth-callback] token exchange failed", tokenRes.status);
      return back(request, "exchange_failed");
    }
    const token = (await tokenRes.json()) as {
      access_token?: string;
      refresh_token?: string;
      user_id?: number | string;
    };
    const accessToken = token.access_token;
    if (!accessToken || token.user_id == null) return back(request, "exchange_failed");

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

    // Mismos campos y mismas rutas que escribe la app (FOODPASS lib/main.dart):
    // el token vivo en `private/mercadoPago`, que es de donde ya lo lee
    // create-preference. Si esto se separa, la web conecta y no cobra.
    const batch = db.batch();
    batch.update(db.collection("restaurants").doc(parsed.restaurantId), {
      mercadoPagoConnected: true,
      mercadoPagoAccountId: String(token.user_id),
      mercadoPagoEmail: email,
      mercadoPagoConnectedAt: FieldValue.serverTimestamp(),
    });
    batch.set(
        db
            .collection("restaurants")
            .doc(parsed.restaurantId)
            .collection("private")
            .doc("mercadoPago"),
        {
          mercadoPagoAccessToken: accessToken,
          mercadoPagoRefreshToken: token.refresh_token ?? null,
          updatedAt: FieldValue.serverTimestamp(),
        },
        {merge: true},
    );
    // El nonce se quema: un código de autorización no se reusa.
    batch.delete(pendingRef);
    await batch.commit();

    return back(request, "ok");
  } catch (e) {
    console.error("[mp-oauth-callback]", e);
    return back(request, "internal");
  }
}
