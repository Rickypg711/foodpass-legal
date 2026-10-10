import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { Timestamp } from "firebase-admin/firestore";
import {
  getFirebaseAdminApp,
  getFirebaseAdminDb,
  hasFirebaseAdminCredentials,
} from "@/lib/firebaseAdmin";
import { freeItemsEnabled, welcomeItemNameOf } from "@/lib/loyalty/freeItems";
import {
  CODE_ALPHABET,
  CODE_LEN,
  parseReferralCode,
  referralLink,
} from "@/lib/referral/referralLink";
import {
  decideAccountInvite,
  phoneFromAccount,
  phoneVariants,
} from "@/lib/referral/accountInvite";

/**
 * POST /api/referral-code/by-account  { restaurantId, tapped? }
 *   Authorization: Bearer <ID token de Firebase>
 *   → 200 { code, link, itemName, receiptText? }   ese comensal ya puede invitar
 *   → 204                                          no puede (no se dice por qué)
 *   → 401                                          sin sesión
 *
 * El MISMO código del que invita que acuña POST /api/referral-code desde el
 * recibo, pero con la sesión como llave en vez del link del pedido. Lo usa la
 * app (paridad 9-oct-2026): "Regálale {premio} a un amigo" manda este link
 * (/menu/{rid}?ref={codigo}), ya no el de Branch.
 *
 * El teléfono sale del token (SMS) o de users/{uid}.linkedPhone (las reglas solo
 * lo dejan escribir con un token que trae ese número). NUNCA del cuerpo: si
 * viniera de ahí, cualquiera sacaría el código de otro teléfono.
 *
 * Un teléfono = un código para siempre en ese local (el mismo campo
 * phoneCustomers/{tel}.referralCode que usa el recibo). Sin compuerta, sin
 * premio con nombre o sin ≥1 pedido pagado: 204, y la app comparte el perfil
 * sin prometer nada.
 */
export const dynamic = "force-dynamic";

const ID_RE = /^[A-Za-z0-9_-]{6,64}$/;
const MAX_TRIES = 5;

export async function POST(request: Request) {
  const noStore = { "Cache-Control": "private, no-store" };
  const noContent = () => new NextResponse(null, { status: 204, headers: noStore });

  const authz = request.headers.get("authorization") ?? "";
  const idToken = authz.startsWith("Bearer ") ? authz.slice(7).trim() : "";
  if (!idToken) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: noStore });
  }

  let body: { restaurantId?: unknown; tapped?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400, headers: noStore });
  }
  const restaurantId = typeof body.restaurantId === "string" ? body.restaurantId : "";
  const tapped = body.tapped === true;
  if (!ID_RE.test(restaurantId)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400, headers: noStore });
  }
  if (!hasFirebaseAdminCredentials()) {
    return NextResponse.json({ error: "service_unavailable" }, { status: 503, headers: noStore });
  }

  let uid = "";
  let tokenPhone: unknown = null;
  try {
    const decoded = await getAuth(getFirebaseAdminApp()).verifyIdToken(idToken);
    uid = decoded.uid;
    tokenPhone = decoded.phone_number ?? null;
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: noStore });
  }

  try {
    const db = getFirebaseAdminDb();

    const restSnap = await db.doc(`restaurants/${restaurantId}`).get();
    const restaurant = restSnap.data() ?? {};
    const gateOn = freeItemsEnabled(restaurant);
    const itemName = welcomeItemNameOf(restaurant);
    // Compuerta primero: fuera de ella no se lee nada más.
    if (!gateOn || !itemName) return noContent();

    let linkedPhone: unknown = null;
    if (!tokenPhone) {
      const userSnap = await db.doc(`users/${uid}`).get();
      linkedPhone = (userSnap.data() ?? {}).linkedPhone ?? null;
    }
    const phone = phoneFromAccount({ tokenPhone, linkedPhone });

    let paidOrders = 0;
    if (phone) {
      const snap = await db
        .collection(`restaurants/${restaurantId}/orders`)
        .where("customerPhone", "in", phoneVariants(phone))
        .get();
      snap.forEach((d) => {
        if ((d.data() ?? {}).paymentStatus === "paid") paidOrders++;
      });
    }

    const decision = decideAccountInvite({ gateOn, itemName, phone, paidOrders });
    if (!decision.ok || !phone) return noContent();

    const phoneRef = db.doc(`restaurants/${restaurantId}/phoneCustomers/${phone}`);
    const phoneSnap = await phoneRef.get();

    if (tapped) {
      // Misma medida que el recibo (§10): el que invita TOCÓ mandar.
      phoneRef.set({ inviteTappedAt: Timestamp.now() }, { merge: true }).catch(() => {});
    }

    const aiLines = ((phoneSnap.data() ?? {}).aiLines ?? {}) as Record<string, unknown>;
    const receiptText =
      typeof aiLines.receipt === "string" && aiLines.receipt.trim() ? aiLines.receipt.trim() : null;

    const reply = (code: string) =>
      NextResponse.json(
        {
          code,
          link: referralLink(restaurantId, code, originOf(request)),
          itemName,
          ...(receiptText ? { receiptText } : {}),
        },
        { headers: noStore },
      );

    // ¿Ya tenía código (del recibo o de antes)? Se valida que apunte a este teléfono.
    const existing = parseReferralCode((phoneSnap.data() ?? {}).referralCode);
    if (existing) {
      const codeSnap = await db.doc(`restaurants/${restaurantId}/referralCodes/${existing}`).get();
      if (codeSnap.exists && String((codeSnap.data() ?? {}).phone ?? "") === phone) {
        return reply(existing);
      }
    }

    // Acuñar: misma transacción que /api/referral-code (el primero gana).
    for (let i = 0; i < MAX_TRIES; i++) {
      const code = mintCode();
      const codeRef = db.doc(`restaurants/${restaurantId}/referralCodes/${code}`);
      const winner = await db.runTransaction(async (tx) => {
        const cur = await tx.get(phoneRef);
        const ya = parseReferralCode((cur.data() ?? {}).referralCode);
        if (ya) return ya;
        const taken = await tx.get(codeRef);
        if (taken.exists) return null;
        tx.set(codeRef, { phone, createdAt: Timestamp.now(), via: "app_account" });
        tx.set(phoneRef, { referralCode: code }, { merge: true });
        return code;
      });
      if (winner) return reply(winner);
    }
    return NextResponse.json({ error: "server_error" }, { status: 500, headers: noStore });
  } catch (e) {
    console.error("referral-code/by-account", e);
    return NextResponse.json({ error: "server_error" }, { status: 500, headers: noStore });
  }
}

function mintCode(): string {
  const bytes = new Uint8Array(CODE_LEN);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < CODE_LEN; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}

/** El link sale del mismo dominio que llamó (www.comeleal.com desde la app). */
function originOf(request: Request): string {
  try {
    return new URL(request.url).origin;
  } catch {
    return "https://comeleal.com";
  }
}
