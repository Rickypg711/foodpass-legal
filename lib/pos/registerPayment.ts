// ⚖️ UNA SOLA VERDAD DEL COBRO — Etapa 2 (regla de Ricardo, 25-ago).
//
// Este módulo es EL ÚNICO lugar de la web que sabe marcar un pedido como
// pagado. Los botones (Pedidos, la Caja) llaman aquí; nadie más escribe
// `paymentStatus: "paid"` — hay candado en validate-table-orders que truena
// si un literal de pago aparece en una página.
//
// Por qué existe: hoy se cazaron DOS bugs que nacieron de tener el cobro
// escrito en varios lados (el doble cobro de rondas y el cobro pelón de
// mesas). Mientras el "qué escribe un pago" viva en un solo archivo, esa
// familia de bugs no puede volver.
//
// Espejo Dart: FOODPASS lib/orders/paid_order_update.dart (mismos campos).
// Etapa 3 (futura, con disparador en PENDIENTES.md): esto se muda a una
// Cloud Function y las reglas prohíben a los clientes escribir paymentStatus.

import {
  doc,
  runTransaction,
  serverTimestamp,
  type Firestore,
} from "firebase/firestore";
import { creditPhonePointsForOrder } from "@/lib/loyalty/phonePoints";
import { distributeGroupNet, type TabGroup, type TabOrderLike } from "@/lib/pos/tabGroups";
import type { TabDiscountRecalc } from "@/lib/loyalty/tabDiscountRecalc";

export { paidOrderFields, type PaymentMethod } from "@/lib/pos/paidOrderFields";
import { paidOrderFields, type PaymentMethod } from "@/lib/pos/paidOrderFields";

export type CreditSummary = {
  creditedCount: number;
  capReached: boolean;
};

async function creditRounds(
  db: Firestore,
  restaurantId: string,
  orderIds: string[],
): Promise<CreditSummary> {
  let creditedCount = 0;
  let capReached = false;
  for (const orderId of orderIds) {
    try {
      const res = await creditPhonePointsForOrder({ db, restaurantId, orderId });
      if (res.credited) {
        creditedCount += 1;
        if (res.capReached === true) capReached = true;
      }
    } catch (e) {
      console.error("[registerPayment] credit failed", orderId, e);
    }
  }
  return { creditedCount, capReached };
}

/**
 * Cobro RÁPIDO de un pedido suelto (Pedidos: para llevar / web). En
 * transacción con guardia: un pedido ya pagado no se re-cobra (doble tap,
 * dos pantallas abiertas — da igual, solo pasa una vez).
 */
export async function registerOrderPayment(params: {
  db: Firestore;
  restaurantId: string;
  orderId: string;
  method: PaymentMethod;
}): Promise<CreditSummary> {
  const { db, restaurantId, orderId, method } = params;
  await runTransaction(db, async (transaction) => {
    const ref = doc(db, "restaurants", restaurantId, "orders", orderId);
    const snap = await transaction.get(ref);
    if (!snap.exists()) throw new Error("El pedido ya no existe.");
    const data = snap.data();
    if (String(data.paymentStatus || "") === "paid") {
      throw new Error("Este pedido ya estaba cobrado.");
    }
    transaction.update(ref, paidOrderFields(method));
  });
  return creditRounds(db, restaurantId, [orderId]);
}

/**
 * Cierre de CUENTA DE MESA: las N rondas del grupo en UNA transacción — una
 * propina, un descuento, un total. Propina/teléfono/discountApplied van UNA
 * vez (en el ancla); con descuento, el neto se reparte proporcional al bruto
 * por ronda en centavos exactos. Después, puntos RONDA POR RONDA: cada
 * teléfono sobre SU consumo.
 */
export async function registerTabGroupPayment(params: {
  db: Firestore;
  restaurantId: string;
  group: TabGroup<TabOrderLike & { id: string }>;
  method: PaymentMethod;
  tip?: number;
  tipMethod?: PaymentMethod;
  customerPhone?: string;
  recalc?: TabDiscountRecalc | null;
}): Promise<CreditSummary & { rondas: number }> {
  const {
    db,
    restaurantId,
    group,
    method,
    tip = 0,
    tipMethod = "cash",
    customerPhone = "",
    recalc = null,
  } = params;
  const anchorId = group.anchor.id;
  const orderIds = group.orders.map((o) => o.id);

  await runTransaction(db, async (transaction) => {
    const snaps = [];
    for (const oid of orderIds) {
      const ref = doc(db, "restaurants", restaurantId, "orders", oid);
      const snap = await transaction.get(ref);
      if (!snap.exists()) throw new Error("Una ronda de la cuenta ya no existe.");
      const data = snap.data();
      if (data.isOpenTab !== true || String(data.paymentStatus || "") === "paid") {
        throw new Error("Una ronda ya se había cobrado — recarga las cuentas.");
      }
      snaps.push({ ref, data });
    }

    const withDiscount = Boolean(recalc && recalc.hasDiscount && recalc.discountApplied);
    // Bruto por ronda desde SUS items a precio original — la misma base que
    // usa el recálculo, nunca un total que puede venir ya descontado.
    const grossPerOrder = snaps.map((s) =>
      (Array.isArray(s.data.items) ? s.data.items : []).reduce(
        (sum: number, i: { price?: unknown; quantity?: unknown }) =>
          sum + (Number(i.price) || 0) * (Number(i.quantity) || 0),
        0,
      ),
    );
    const shares = withDiscount ? distributeGroupNet(grossPerOrder, recalc!.net) : [];

    snaps.forEach((sn, i) => {
      const isAnchor = orderIds[i] === anchorId;
      transaction.update(sn.ref, {
        ...paidOrderFields(method, { close: true }),
        // Propina UNA vez, en el ancla — por ronda se multiplicaría en Reportes.
        ...(isAnchor && tip > 0
          ? { tipAmount: Math.round(tip * 100) / 100, tipMethod }
          : {}),
        // El teléfono del cierre va al ANCLA; las demás rondas conservan el
        // suyo — cada comensal ya dejó su número y sus puntos son de SU consumo.
        ...(isAnchor && customerPhone.length === 10 ? { customerPhone } : {}),
        // discountApplied vive UNA vez (ancla) — por ronda duplicaría
        // "descuentos dados". El neto se escribe ANTES de acreditar puntos.
        ...(withDiscount
          ? {
              total: shares[i],
              subtotal: grossPerOrder[i],
              ...(isAnchor ? { discountApplied: recalc!.discountApplied } : {}),
            }
          : {}),
      });
    });
  });

  const credit = await creditRounds(db, restaurantId, orderIds);
  return { ...credit, rondas: orderIds.length };
}
