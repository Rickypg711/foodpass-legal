import { NextResponse } from "next/server";

import { hasFirebaseAdminCredentials } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ¿Está listo el connect de Mercado Pago en ESTE deploy?
 *
 * Devuelve **solo booleanos** — nunca un valor, ni un prefijo, ni una longitud.
 * Existe porque las credenciales se ponen a mano en Vercel y hasta ahora la
 * única forma de saber si quedaron era darle click al botón y ver un error
 * genérico. Con esto se comprueba con un curl, sin tocar la cuenta de nadie.
 *
 * `redirectUri` sí se devuelve: es una URL pública que ya viaja en la barra de
 * direcciones del dueño durante el connect, y verla es justo lo que permite
 * cachar el error más probable — que no coincida con la registrada en Mercado
 * Pago.
 */
export async function GET() {
  const clientId = (process.env.MERCADO_PAGO_CLIENT_ID ?? "").trim();
  const clientSecret = (process.env.MERCADO_PAGO_CLIENT_SECRET ?? "").trim();
  const redirectUri = (process.env.MERCADO_PAGO_REDIRECT_URI ?? "").trim();
  const adminReady = hasFirebaseAdminCredentials();

  const ready = Boolean(clientId && clientSecret && redirectUri && adminReady);

  return NextResponse.json({
    ready,
    hasClientId: Boolean(clientId),
    hasClientSecret: Boolean(clientSecret),
    hasRedirectUri: Boolean(redirectUri),
    redirectUri: redirectUri || null,
    firebaseAdminReady: adminReady,
  });
}
