import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import {
  getFirebaseAdminApp,
  getFirebaseAdminDb,
  hasFirebaseAdminCredentials,
} from "@/lib/firebaseAdmin";
import { markPhoneSeen } from "@/lib/loyalty/freeItemsServer";

/**
 * POST /api/free-items/seen-by-phone  { restaurantId }
 *   Authorization: Bearer <ID token de Firebase>
 *   → 200 { items: [{ id, expiresAt }] }  vencimientos ya actualizados
 *   → 401 sin sesión verificada por SMS
 *
 * El reloj del taco desde /puntos (docs/REFERIDOS_POR_TELEFONO.md §7): cuando la
 * lista de tacos se DIBUJA en su pantalla, el taco pasa a vivir 7 días desde
 * ese momento. Es la misma regla que en el recibo del pedido y usa la misma
 * función (lib/loyalty/freeItemsServer.ts).
 *
 * La llave aquí NO es un link: es su sesión. /puntos solo enseña tacos después
 * de verificar el número por SMS, así que el token de Firebase trae
 * `phone_number`. EL TELÉFONO SALE DEL TOKEN, NUNCA DEL CUERPO: si viniera del
 * navegador, cualquiera le arrancaría el reloj al taco de otra persona (y le
 * acortaría la vida de 30 días a 7).
 */
export const dynamic = "force-dynamic";

const ID_RE = /^[A-Za-z0-9_-]{6,64}$/;

export async function POST(request: Request) {
  const noStore = { "Cache-Control": "private, no-store" };

  const authz = request.headers.get("authorization") ?? "";
  const idToken = authz.startsWith("Bearer ") ? authz.slice(7).trim() : "";
  if (!idToken) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: noStore });
  }

  let body: { restaurantId?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400, headers: noStore });
  }
  const restaurantId = typeof body.restaurantId === "string" ? body.restaurantId : "";
  if (!ID_RE.test(restaurantId)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400, headers: noStore });
  }
  if (!hasFirebaseAdminCredentials()) {
    return NextResponse.json({ error: "service_unavailable" }, { status: 503, headers: noStore });
  }

  // El número verificado por SMS, del token. Una sesión anónima o de correo no
  // trae phone_number y no puede marcar nada.
  let phone = "";
  try {
    const decoded = await getAuth(getFirebaseAdminApp()).verifyIdToken(idToken);
    phone = String(decoded.phone_number ?? "").replace(/\D/g, "");
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: noStore });
  }
  if (phone.length > 10) phone = phone.slice(-10);
  if (phone.length < 10) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: noStore });
  }

  try {
    const items = await markPhoneSeen(getFirebaseAdminDb(), restaurantId, phone);
    return NextResponse.json({ items: items ?? [] }, { headers: noStore });
  } catch (e) {
    console.error("free-items/seen-by-phone", e);
    return NextResponse.json({ error: "server_error" }, { status: 500, headers: noStore });
  }
}
