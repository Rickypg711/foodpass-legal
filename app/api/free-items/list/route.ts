import { NextResponse } from "next/server";
import { getFirebaseAdminDb, hasFirebaseAdminCredentials } from "@/lib/firebaseAdmin";
import { receiptViewFromOrder } from "@/lib/order/receiptView";
import { freeItemsEnabled, liveRows, toMs } from "@/lib/loyalty/freeItems";

/**
 * POST /api/free-items/list  { restaurantId, orderId }
 *   → 200 { items: [{ id, source, itemName, expiresAt }] }
 *   → 200 { items: [] } cuando no hay nada (o el local no está en esto)
 *
 * Los tacos vivos de quien hizo ESTE pedido, para pintarlos en su recibo
 * (docs/REFERIDOS_POR_TELEFONO.md §3 y §7).
 *
 * Por qué por endpoint y no leyendo Firestore: el comensal en mostrador no
 * tiene sesión, y su doc de teléfono no lo puede leer sin verificar su número.
 * El link del pedido ES la llave — el mismo trato que el recibo, y solo para
 * pedidos con recibo público. El teléfono nunca viaja en la URL: sale del
 * pedido, en el servidor.
 *
 * Solo LEE. El reloj lo arranca /api/free-items/seen, cuando el bloque de
 * verdad se dibuja en su pantalla.
 */
export const dynamic = "force-dynamic";

const ID_RE = /^[A-Za-z0-9_-]{6,64}$/;

export async function POST(request: Request) {
  const vacio = () =>
    NextResponse.json({ items: [] }, { headers: { "Cache-Control": "private, no-store" } });

  let body: { restaurantId?: unknown; orderId?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return vacio();
  }
  const restaurantId = typeof body.restaurantId === "string" ? body.restaurantId : "";
  const orderId = typeof body.orderId === "string" ? body.orderId : "";
  if (!ID_RE.test(restaurantId) || !ID_RE.test(orderId)) return vacio();
  if (!hasFirebaseAdminCredentials()) return vacio();

  try {
    const db = getFirebaseAdminDb();
    const orderSnap = await db.doc(`restaurants/${restaurantId}/orders/${orderId}`).get();
    if (!orderSnap.exists) return vacio();
    const order = orderSnap.data() ?? {};
    if (!receiptViewFromOrder(order, undefined)) return vacio();

    let phone = String(order.customerPhone ?? "").replace(/\D/g, "");
    if (phone.length > 10) phone = phone.slice(-10);
    if (phone.length < 10) return vacio();

    const restSnap = await db.doc(`restaurants/${restaurantId}`).get();
    if (!freeItemsEnabled(restSnap.data())) return vacio();

    const phoneSnap = await db
      .doc(`restaurants/${restaurantId}/phoneCustomers/${phone}`)
      .get();
    if (!phoneSnap.exists) return vacio();

    const pc = phoneSnap.data() ?? {};
    // La frase que escribió la IA antes de que se necesitara (§8). Si no hay,
    // el cliente usa el texto fijo — nunca se espera por un modelo.
    const aiLines = (pc.aiLines ?? {}) as Record<string, unknown>;
    const inviteText =
      typeof aiLines.invite === "string" && aiLines.invite.trim()
        ? aiLines.invite.trim()
        : null;

    const items = liveRows(pc.freeItems, Date.now()).map((r) => ({
      id: r.id,
      source: r.source,
      itemName: r.itemName,
      // En milisegundos: el cliente no necesita saber de Timestamps.
      expiresAt: toMs(r.expiresAt),
      // 22-sep-2026: el recibo necesita estos dos para pintar, DESDE EL PRIMER
      // dibujo, la fecha que va a quedar cuando se marque "visto". Sin ellos el
      // comensal alcanzaba a leer la fecha vieja y se le cambiaba enfrente —
      // parecía que el local le acortaba el premio mientras lo miraba.
      bornAt: toMs(r.bornAt),
      seenAt: toMs(r.seenAt),
      // Quién lo trajo, solo el nombre y solo si el servidor lo guardó.
      ...(r.referredName ? { referredName: r.referredName } : {}),
    }));

    return NextResponse.json(
      { items, ...(inviteText ? { inviteText } : {}) },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    console.error("free-items/list", e);
    return vacio();
  }
}
