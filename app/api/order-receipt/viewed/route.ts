import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getFirebaseAdminDb, hasFirebaseAdminCredentials } from "@/lib/firebaseAdmin";
import { receiptViewFromOrder } from "@/lib/order/receiptView";
import { receiptStampFields } from "@/lib/order/receiptStamps";

/**
 * POST /api/order-receipt/viewed  { restaurantId, orderId }
 *
 * "Visto" = el bloque del recibo se dibujó en la pantalla del comensal
 * (docs/REFERIDOS_POR_TELEFONO.md §7 y §10, FOODPASS). La página lo manda
 * desde un IntersectionObserver DESPUÉS de render; por eso vive en el
 * navegador y no en el GET: el preview de WhatsApp hace el fetch del link
 * pero no ejecuta scripts, y no debe contar como vista.
 *
 * El link ES la llave (igual que el GET): solo quien tiene el id del pedido
 * puede marcarlo. Solo se marca lo que tiene recibo público
 * (receiptViewFromOrder != null) — nada más se toca. No regresa datos.
 *
 * Escribe: viewedAt (solo la primera vez), viewedLastAt, viewCount (+1).
 */
export const dynamic = "force-dynamic";

const ID_RE = /^[A-Za-z0-9_-]{6,64}$/;

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

  try {
    const db = getFirebaseAdminDb();
    const ref = db.doc(`restaurants/${restaurantId}/orders/${orderId}`);
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return;
      // Solo pedidos con recibo público (Caja y menú web) — el mismo filtro del GET.
      if (!receiptViewFromOrder(snap.data(), undefined)) return;
      tx.update(
        ref,
        receiptStampFields("viewed", snap.data(), FieldValue.serverTimestamp(), FieldValue.increment(1)),
      );
    });
    return new NextResponse(null, { status: 204, headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    console.error("order-receipt/viewed", e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
