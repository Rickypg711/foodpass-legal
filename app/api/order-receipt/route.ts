import { NextResponse } from "next/server";
import { getFirebaseAdminDb, hasFirebaseAdminCredentials } from "@/lib/firebaseAdmin";
import { receiptViewFromOrder } from "@/lib/order/receiptView";

/**
 * GET /api/order-receipt?restaurantId=…&orderId=…
 *
 * El recibo que llega por WhatsApp. Las reglas solo dejan leer el pedido al dueño del
 * pedido o al local, y el link se abre SIN esa sesión: la venta de la Caja no trae
 * `customerId` (10-sep-2026, La Familia) y el del menú web se abre desde WhatsApp o
 * en el teléfono del dueño (12-sep-2026, IGO #KGPAPR) — los dos decían "No pudimos
 * cargar tu pedido". Aquí se lee con Admin SDK y se regresa SOLO la vista de recibo
 * (`receiptViewFromOrder`, allowlist).
 *
 * El link ES la llave: el id del pedido son 20 caracteres al azar, igual que un
 * recibo de Stripe. Pedidos de la Caja y del menú web; nada de PIN ni dirección. Las reglas
 * de Firestore NO cambian: nadie puede listar pedidos.
 */
export const dynamic = "force-dynamic";

const ID_RE = /^[A-Za-z0-9_-]{6,64}$/;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const restaurantId = url.searchParams.get("restaurantId") ?? "";
  const orderId = url.searchParams.get("orderId") ?? "";
  if (!ID_RE.test(restaurantId) || !ID_RE.test(orderId)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }
  if (!hasFirebaseAdminCredentials()) {
    return NextResponse.json({ error: "service_unavailable" }, { status: 503 });
  }

  try {
    const db = getFirebaseAdminDb();
    const [orderSnap, restaurantSnap] = await Promise.all([
      db.doc(`restaurants/${restaurantId}/orders/${orderId}`).get(),
      db.doc(`restaurants/${restaurantId}`).get(),
    ]);
    const view = orderSnap.exists
      ? receiptViewFromOrder(orderSnap.data(), restaurantSnap.data()?.name)
      : null;
    if (!view) {
      // No existe o no tiene recibo público: mismo 404, para no confirmar qué ids hay.
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json(
      { order: view },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    console.error("order-receipt", e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
