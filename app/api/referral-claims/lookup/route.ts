import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import {
  getFirebaseAdminApp,
  getFirebaseAdminDb,
  hasFirebaseAdminCredentials,
} from "@/lib/firebaseAdmin";
import { freeItemsEnabled, welcomeItemNameOf } from "@/lib/loyalty/freeItems";

/**
 * POST /api/referral-claims/lookup  { restaurantId, phone }
 *   Authorization: Bearer <ID token de Firebase>
 *   → 200 { referred: boolean, itemName?: string }
 *
 * "¿Este número que estoy cobrando llegó por la invitación de alguien?"
 *
 * 22-sep-2026: la Caja se enteraba del referido DESPUÉS de cobrar (el botón
 * "Avísale"). Cobrando no decía nada, y "ves quién te trajo a quién" es justo
 * lo que vendemos: el cajero tiene que poder decirle al comensal "ah, te trajo
 * un amigo" EN el momento, no descubrirlo cuando ya se fue.
 *
 * Por qué una ruta y no una lectura directa: `referralClaims` está cerrado a
 * TODOS en las reglas (`read, write: if false`) porque el doc lleva el teléfono
 * de QUIEN INVITA. Este endpoint es la rendija mínima — devuelve un sí/no y el
 * nombre del premio, y **jamás** el teléfono ni el código del que invitó.
 *
 * Candado de acceso: espejo de `isRestaurantAssociate` de firestore.rules —
 * miembro ACTIVO del local con rol owner/manager/staff/employee. Un dueño no
 * puede preguntar por los clientes de otro local.
 */
export const dynamic = "force-dynamic";

const ID_RE = /^[A-Za-z0-9_-]{6,64}$/;
const ROLES = new Set(["owner", "manager", "staff", "employee"]);

export async function POST(request: Request) {
  const no = () =>
    NextResponse.json(
      { referred: false },
      { headers: { "Cache-Control": "private, no-store" } },
    );

  if (!hasFirebaseAdminCredentials()) {
    return NextResponse.json({ error: "service_unavailable" }, { status: 503 });
  }

  const authHeader = request.headers.get("authorization") ?? "";
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!idToken) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let uid: string;
  try {
    uid = (await getAuth(getFirebaseAdminApp()).verifyIdToken(idToken)).uid;
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { restaurantId?: unknown; phone?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const restaurantId = typeof body.restaurantId === "string" ? body.restaurantId : "";
  let phone = String(body.phone ?? "").replace(/\D/g, "");
  if (phone.length > 10) phone = phone.slice(-10);
  if (!ID_RE.test(restaurantId) || phone.length < 10) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  try {
    const db = getFirebaseAdminDb();

    // Mismo candado que las reglas: miembro ACTIVO con rol de operación.
    const memberSnap = await db.doc(`restaurants/${restaurantId}/members/${uid}`).get();
    const member = memberSnap.data() ?? {};
    if (!memberSnap.exists || member.status !== "active" || !ROLES.has(String(member.role))) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const restSnap = await db.doc(`restaurants/${restaurantId}`).get();
    const restaurant = restSnap.data() ?? {};
    if (!freeItemsEnabled(restaurant)) return no();

    const claimSnap = await db.doc(`restaurants/${restaurantId}/referralClaims/${phone}`).get();
    if (!claimSnap.exists) return no();
    // Una reclamación ya usada no se anuncia: ese taco ya se otorgó.
    if ((claimSnap.data() ?? {}).usedAt) return no();

    // El candado 1 también se respeta aquí: si ya le compró al local, no es
    // "amigo nuevo" y el grant lo va a rechazar. No se promete lo que no va a
    // pasar — el cajero se lo diría al comensal en voz alta.
    const pcSnap = await db.doc(`restaurants/${restaurantId}/phoneCustomers/${phone}`).get();
    if (Number((pcSnap.data() ?? {}).visits ?? 0) > 0) return no();

    const itemName = welcomeItemNameOf(restaurant);
    return NextResponse.json(
      { referred: true, ...(itemName ? { itemName } : {}) },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    console.error("referral-claims/lookup", e);
    // Best-effort: si esto falla, el cobro sigue igual que siempre.
    return no();
  }
}
