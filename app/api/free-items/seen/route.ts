import { NextResponse } from "next/server";
import { getFirebaseAdminDb, hasFirebaseAdminCredentials } from "@/lib/firebaseAdmin";
import { receiptViewFromOrder } from "@/lib/order/receiptView";
import { markPhoneSeen } from "@/lib/loyalty/freeItemsServer";

/**
 * POST /api/free-items/seen  { restaurantId, orderId }
 *
 * El reloj del taco (docs/REFERIDOS_POR_TELEFONO.md §7): un taco vive 7 días
 * desde que el comensal LO VE, con tope de 30 desde que nació. "Verlo" = el
 * bloque se dibujó en su pantalla, así que esto lo manda el navegador con un
 * IntersectionObserver DESPUÉS de render — igual que el "visto" del recibo del
 * paso 1. El preview de WhatsApp hace el fetch del link pero no corre scripts,
 * y por eso no cuenta; tampoco cuenta que el dueño toque "Enviar recibo".
 *
 * El link ES la llave: solo quien tiene el id del pedido puede marcarlo, y solo
 * si ese pedido tiene recibo público (misma allowlist que el recibo). El
 * teléfono NUNCA viaja en la URL: se saca del pedido, en el servidor.
 *
 * Escribe solo el servidor (Admin SDK) y solo `seenAt`/`expiresAt` de las filas
 * vivas que no se habían visto. Es idempotente: la segunda vez no cambia nada,
 * así que un taco no se puede "re-ver" para estirarle la vida.
 * No regresa datos.
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

  const noContent = () =>
    new NextResponse(null, { status: 204, headers: { "Cache-Control": "private, no-store" } });

  try {
    const db = getFirebaseAdminDb();
    const orderSnap = await db.doc(`restaurants/${restaurantId}/orders/${orderId}`).get();
    if (!orderSnap.exists) return noContent();
    const order = orderSnap.data() ?? {};
    // Solo pedidos con recibo público (Caja y menú web) — el link es la llave.
    if (!receiptViewFromOrder(order, undefined)) return noContent();

    let phone = String(order.customerPhone ?? "").replace(/\D/g, "");
    if (phone.length > 10) phone = phone.slice(-10);
    if (phone.length < 10) return noContent();

    // Misma lógica que /puntos (lib/loyalty/freeItemsServer.ts): si cambia
    // una, cambian las dos.
    await markPhoneSeen(db, restaurantId, phone);
    return noContent();
  } catch (e) {
    console.error("free-items/seen", e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
