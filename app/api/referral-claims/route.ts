import { NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { getFirebaseAdminDb, hasFirebaseAdminCredentials } from "@/lib/firebaseAdmin";
import { freeItemsEnabled } from "@/lib/loyalty/freeItems";
import { parseReferralCode } from "@/lib/referral/referralLink";

/**
 * POST /api/referral-claims  { restaurantId, code, phone }  → 204 SIEMPRE
 *
 * El camino de mostrador (docs/REFERIDOS_POR_TELEFONO.md §4): el amigo abre el
 * link del que lo invitó, pone su número en la página y su taco "queda
 * apuntado". Sin SMS: no se verifica nada aquí porque no se entrega nada aquí
 * — el premio lo otorga el servidor cuando el amigo PAGA (§5), y ahí viven los
 * cuatro candados.
 *
 * Siempre 204, nunca un error ni un "ya no puedes": esta página es pública y
 * decir por qué no se pudo sería decirle a un curioso si un número ya compró
 * en el local. Lo único que puede hacer alguien con esto es apuntar una
 * reclamación que el grant después va a rechazar.
 *
 * Lo que sí se filtra aquí, para no llenar Firestore de basura:
 *   - código con forma válida y que exista en el local;
 *   - el amigo no es el mismo que invita;
 *   - un teléfono con compras previas NO reclama (§5 candado 1) — se descarta
 *     en silencio;
 *   - no se pisa una reclamación ya usada.
 */
export const dynamic = "force-dynamic";

const ID_RE = /^[A-Za-z0-9_-]{6,64}$/;

export async function POST(request: Request) {
  const noContent = () =>
    new NextResponse(null, { status: 204, headers: { "Cache-Control": "private, no-store" } });

  let body: { restaurantId?: unknown; code?: unknown; phone?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return noContent();
  }
  const restaurantId = typeof body.restaurantId === "string" ? body.restaurantId : "";
  const code = parseReferralCode(body.code);
  let phone = String(body.phone ?? "").replace(/\D/g, "");
  if (phone.length > 10) phone = phone.slice(-10);

  if (!ID_RE.test(restaurantId) || !code || phone.length < 10) return noContent();
  if (!hasFirebaseAdminCredentials()) return noContent();

  try {
    const db = getFirebaseAdminDb();
    const restSnap = await db.doc(`restaurants/${restaurantId}`).get();
    if (!freeItemsEnabled(restSnap.data())) return noContent();

    const codeSnap = await db.doc(`restaurants/${restaurantId}/referralCodes/${code}`).get();
    if (!codeSnap.exists) return noContent();
    const referrerPhone = String((codeSnap.data() ?? {}).phone ?? "").replace(/\D/g, "").slice(-10);
    if (referrerPhone.length < 10) return noContent();
    // Nadie se refiere a sí mismo.
    if (referrerPhone === phone) return noContent();

    // Candado 1 por adelantado: un teléfono que ya le compró al local no es
    // "amigo nuevo". Se descarta aquí para no dejar el doc colgado, y de todos
    // modos el grant lo volvería a rechazar.
    const friendSnap = await db.doc(`restaurants/${restaurantId}/phoneCustomers/${phone}`).get();
    if (Number((friendSnap.data() ?? {}).visits ?? 0) > 0) return noContent();

    const claimRef = db.doc(`restaurants/${restaurantId}/referralClaims/${phone}`);
    await db.runTransaction(async (tx) => {
      const cur = await tx.get(claimRef);
      // Una reclamación ya usada no se pisa (su taco ya se otorgó).
      if (cur.exists && (cur.data() ?? {}).usedAt) return;
      tx.set(
        claimRef,
        { code, referrerPhone, phone, createdAt: Timestamp.now(), usedAt: null },
        { merge: true },
      );
    });
    return noContent();
  } catch (e) {
    console.error("referral-claims", e);
    return noContent();
  }
}
