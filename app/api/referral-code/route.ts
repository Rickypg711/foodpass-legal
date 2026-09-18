import { NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { getFirebaseAdminDb, hasFirebaseAdminCredentials } from "@/lib/firebaseAdmin";
import { receiptViewFromOrder } from "@/lib/order/receiptView";
import { freeItemsEnabled } from "@/lib/loyalty/freeItems";
import {
  CODE_ALPHABET,
  CODE_LEN,
  parseReferralCode,
  referralLink,
} from "@/lib/referral/referralLink";

/**
 * POST /api/referral-code  { restaurantId, orderId }
 *   → 200 { code, link }   cuando ese teléfono ya puede invitar
 *   → 204                  cuando no (y no se dice por qué: es una página pública)
 *
 * El código del que invita (docs/REFERIDOS_POR_TELEFONO.md §4). Se acuña en el
 * SERVIDOR, la primera vez que se dibuja el bloque de invitación en su recibo.
 *
 * El teléfono NUNCA viaja en la URL: se saca del pedido. El link es la llave,
 * igual que el recibo — solo quien tiene el id del pedido puede pedir el código
 * de ese pedido, y solo si el pedido tiene recibo público.
 *
 * Requisito único para invitar (§2): ese teléfono tiene ≥1 pedido PAGADO en el
 * local. El pedido de este recibo cuenta, así que se puede invitar desde el
 * primer recibo — que es justo el punto (47 pueden vs 3 si se espera a la 2ª
 * visita).
 *
 * Un teléfono = un código para siempre en ese local: si ya tiene, se devuelve
 * el mismo. Así el link de un volante o de un chat viejo nunca se muere.
 */
export const dynamic = "force-dynamic";

const ID_RE = /^[A-Za-z0-9_-]{6,64}$/;
const MAX_TRIES = 5;

export async function POST(request: Request) {
  let body: { restaurantId?: unknown; orderId?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const restaurantId = typeof body.restaurantId === "string" ? body.restaurantId : "";
  const orderId = typeof body.orderId === "string" ? body.orderId : "";
  if (!ID_RE.test(restaurantId) || !ID_RE.test(orderId)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }
  if (!hasFirebaseAdminCredentials()) {
    return NextResponse.json({ error: "service_unavailable" }, { status: 503 });
  }

  const noContent = () =>
    new NextResponse(null, { status: 204, headers: { "Cache-Control": "private, no-store" } });

  try {
    const db = getFirebaseAdminDb();
    const orderSnap = await db.doc(`restaurants/${restaurantId}/orders/${orderId}`).get();
    if (!orderSnap.exists) return noContent();
    const order = orderSnap.data() ?? {};
    if (!receiptViewFromOrder(order, undefined)) return noContent();

    let phone = String(order.customerPhone ?? "").replace(/\D/g, "");
    if (phone.length > 10) phone = phone.slice(-10);
    if (phone.length < 10) return noContent();

    const restSnap = await db.doc(`restaurants/${restaurantId}`).get();
    const restaurant = restSnap.data() ?? {};
    // Compuerta: fuera de los locales que ya usan filas, no hay invitación.
    if (!freeItemsEnabled(restaurant)) return noContent();

    // Requisito de §2: este pedido tiene que estar pagado (es su prueba de que
    // ya le compró al local). Un pedido pendiente no habilita invitar.
    if (order.paymentStatus !== "paid") return noContent();

    const phoneRef = db.doc(`restaurants/${restaurantId}/phoneCustomers/${phone}`);
    const phoneSnap = await phoneRef.get();

    // ¿Ya tenía código? Se valida que apunte de vuelta a este teléfono: si el
    // puntero viniera torcido, se acuña uno nuevo en vez de devolver basura.
    const existing = parseReferralCode((phoneSnap.data() ?? {}).referralCode);
    if (existing) {
      const codeSnap = await db.doc(`restaurants/${restaurantId}/referralCodes/${existing}`).get();
      if (codeSnap.exists && String((codeSnap.data() ?? {}).phone ?? "") === phone) {
        return NextResponse.json(
          { code: existing, link: referralLink(restaurantId, existing, originOf(request)) },
          { headers: { "Cache-Control": "private, no-store" } },
        );
      }
    }

    // Acuñar. La transacción se queda con el PRIMER código libre: si dos
    // pestañas piden a la vez, las dos terminan con el mismo.
    for (let i = 0; i < MAX_TRIES; i++) {
      const code = mintCode();
      const codeRef = db.doc(`restaurants/${restaurantId}/referralCodes/${code}`);
      const winner = await db.runTransaction(async (tx) => {
        const cur = await tx.get(phoneRef);
        const ya = parseReferralCode((cur.data() ?? {}).referralCode);
        if (ya) return ya; // otra pestaña se adelantó
        const taken = await tx.get(codeRef);
        if (taken.exists) return null; // choque: se intenta con otro
        tx.set(codeRef, { phone, createdAt: Timestamp.now(), orderId });
        tx.set(phoneRef, { referralCode: code }, { merge: true });
        return code;
      });
      if (winner) {
        return NextResponse.json(
          { code: winner, link: referralLink(restaurantId, winner, originOf(request)) },
          { headers: { "Cache-Control": "private, no-store" } },
        );
      }
    }
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  } catch (e) {
    console.error("referral-code", e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

function mintCode(): string {
  const bytes = new Uint8Array(CODE_LEN);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < CODE_LEN; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}

/** El link sale del mismo dominio que abrió el comensal (comeleal.com en prod). */
function originOf(request: Request): string {
  try {
    return new URL(request.url).origin;
  } catch {
    return "https://comeleal.com";
  }
}
