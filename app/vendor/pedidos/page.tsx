"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  increment,
  setDoc,
  updateDoc,
  serverTimestamp,
  orderBy,
  onSnapshot,
  Timestamp,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import { waitForAuthReady } from "@/lib/auth";
import { creditPhonePointsForOrder } from "@/lib/loyalty/phonePoints";
import { shortOrderCode } from "@/lib/order/formatWhatsappMessage";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface OrderItem {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  subtotal: number;
  notes?: string;
  selectedModifiers?: {
    modifierName: string;
    selectedOptions: string[];
  }[];
}

interface Order {
  id: string;
  restaurantId: string;
  restaurantName: string;
  customerId?: string;
  customerName?: string;
  /** Digits-only customer WhatsApp captured at web checkout. */
  customerPhone?: string;
  /** Checkout redemption request — deduction executes at cobro. */
  redemptionRequest?: { tierId: string; name: string; points: number };
  /** Set by the credit transaction: "applied" | "insufficient". */
  redemptionResult?: string;
  /** Set by the credit transaction — points earned on this order. */
  phonePointsAwarded?: number;
  items: OrderItem[];
  total: number;
  subtotal: number;
  status: "pending" | "preparing" | "ready" | "completed" | "cancelled" | "draft" | "open_tab";
  isOpenTab?: boolean;
  paymentMethod: string;
  paymentStatus: "paid" | "pending";
  orderType: "pickup" | "delivery" | "in_store";
  orderSource: "pos" | "app" | "web" | string;
  notes?: string;
  createdAt: Timestamp;
  createdByUserId?: string;
  createdByName?: string;
}

type OrderTab = "pending" | "preparing" | "ready" | "completed";

// ─── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 2 });
}

function Spinner() {
  return (
    <svg className="h-7 w-7 animate-spin" style={{ color: "#F28C38" }} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 12 5.373 12 12H4z" />
    </svg>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PedidosPage() {
  const router = useRouter();

  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [chargingOrderId, setChargingOrderId] = useState<string | null>(null);

  // ── Auth Init & Realtime Listener ──────────────────────────────────────────

  useEffect(() => {
    let unsubscribe: () => void = () => {};

    async function init() {
      const u = await waitForAuthReady();
      if (!u || u.isAnonymous) {
        router.push("/activar");
        return;
      }

      const db = getFirebaseDb();
      const userSnap = await getDoc(doc(db, "users", u.uid));
      const rid = userSnap.data()?.ownedRestaurantId as string | undefined;
      if (!rid) {
        router.push("/activar");
        return;
      }
      setRestaurantId(rid);

      // Fetch last 48 hours to ensure all active orders are visible
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      twoDaysAgo.setHours(0, 0, 0, 0);

      const q = query(
        collection(db, "restaurants", rid, "orders"),
        where("createdAt", ">=", Timestamp.fromDate(twoDaysAgo)),
        orderBy("createdAt", "desc")
      );

      unsubscribe = onSnapshot(
        q,
        (snap) => {
          const list: Order[] = snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<Order, "id">),
          }));
          setOrders(list);
          setLoading(false);
        },
        (err) => {
          console.error("Orders listener error", err);
          setError("Error de conexión con la base de datos.");
          setLoading(false);
        }
      );
    }

    init().catch((err) => {
      console.error("[Pedidos init]", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  // ── Order State Transitions ──────────────────────────────────────────────────

  const updateStatus = async (orderId: string, newStatus: Order["status"]) => {
    if (!restaurantId) return;
    try {
      const db = getFirebaseDb();
      const orderRef = doc(db, "restaurants", restaurantId, "orders", orderId);
      const updateData: Record<string, any> = {
        status: newStatus,
        updatedAt: serverTimestamp(),
        statusUpdatedAt: serverTimestamp(),
      };

      if (newStatus === "ready") {
        updateData.readyAt = serverTimestamp();
      } else if (newStatus === "completed") {
        updateData.completedAt = serverTimestamp();
      }

      await updateDoc(orderRef, updateData);

      // Phone Points v1: completing an already-PAID order (e.g. MP-paid)
      // credits phone loyalty. Idempotent — no-op if already awarded.
      if (newStatus === "completed") {
        try {
          const res = await creditPhonePointsForOrder({ db, restaurantId, orderId });
          if (res.credited) {
            console.log(`[phonePoints] +${res.points} pts → ${res.phone}`);
          }
        } catch (e) {
          console.error("[phonePoints] credit on complete failed", e);
        }
      }
    } catch (err) {
      console.error("Error updating status", err);
      alert("No se pudo actualizar el estado del pedido.");
    }
  };

  const deliverOrder = async (order: Order) => {
    if (order.paymentStatus === "pending") {
      const confirmDeliver = confirm(
        "Este pedido no ha sido pagado. ¿Deseas entregarlo de todos modos?"
      );
      if (!confirmDeliver) return;
    }
    await updateStatus(order.id, "completed");
  };

  const chargeOrder = async (orderId: string, method: "cash" | "card") => {
    if (!restaurantId) return;
    try {
      const db = getFirebaseDb();
      const orderRef = doc(db, "restaurants", restaurantId, "orders", orderId);

      await updateDoc(orderRef, {
        paymentStatus: "paid",
        paymentMethod: method,
        updatedAt: serverTimestamp(),
      });
      setChargingOrderId(null);

      // Phone Points v1: payment confirmed → credit phone loyalty (§4:
      // points ONLY on confirmed payment). Idempotent via loyaltyAwarded.
      try {
        const res = await creditPhonePointsForOrder({ db, restaurantId, orderId });
        if (res.credited) {
          console.log(`[phonePoints] +${res.points} pts → ${res.phone}`);
        }
      } catch (e) {
        console.error("[phonePoints] credit on charge failed", e);
      }
    } catch (err) {
      console.error("Error charging order", err);
      alert("No se pudo registrar el pago.");
    }
  };

  const cancelOrder = async (orderId: string) => {
    const confirmCancel = confirm(
      "¿Estás seguro de que deseas cancelar este pedido?"
    );
    if (!confirmCancel) return;
    await updateStatus(orderId, "cancelled");

    // No-show accounting (v2-10): cancelling an UNPAID pay-at-pickup order
    // with a phone counts against that number. The clientes page surfaces
    // repeat offenders; enforcement (require prepay) can build on this later.
    const o = orders.find((x) => x.id === orderId);
    if (
      o &&
      o.paymentMethod === "pay_at_pickup" &&
      o.paymentStatus !== "paid" &&
      o.customerPhone &&
      restaurantId
    ) {
      const phone10 = o.customerPhone.replace(/\D/g, "").slice(-10);
      if (phone10.length === 10) {
        try {
          const db = getFirebaseDb();
          await setDoc(
            doc(db, "restaurants", restaurantId, "phoneCustomers", phone10),
            {
              phone: phone10,
              noShowCount: increment(1),
              lastNoShowAt: serverTimestamp(),
            },
            { merge: true },
          );
        } catch (e) {
          console.error("[noShow] count failed", e);
        }
      }
    }
  };

  /** Vendor-sent WhatsApp receipt (vendor's own WhatsApp, human tap — §4).
   * Also how POS walk-ins get their receipt/points link into their chat. */
  const sendReceiptWhatsapp = (order: Order) => {
    if (!order.customerPhone || !restaurantId) return;
    const items = order.items
      .map((i) => `${i.quantity}x ${i.name} — ${fmt(i.price * i.quantity)}`)
      .join("\n");
    const url = `${window.location.origin}/menu/${encodeURIComponent(restaurantId)}/order/${encodeURIComponent(order.id)}`;
    const text = [
      `¡Gracias por tu compra en *${order.restaurantName || "nuestro local"}*!`,
      "",
      `Recibo *#${shortOrderCode(order.id)}*`,
      ...(order.customerName ? [`Nombre: ${order.customerName}`] : []),
      "",
      items,
      "",
      `*Total: ${fmt(order.total)}*`,
      // Dynamic loyalty lines — present only after the credit transaction ran
      // (send-receipt usually happens post-cobro). Hooked: the reward news
      // arrives IN the message, not just behind the link.
      ...(order.redemptionResult === "applied" && order.redemptionRequest
        ? [`🎁 Premio canjeado: ${order.redemptionRequest.name} — GRATIS`]
        : []),
      ...((Number(order.phonePointsAwarded) || 0) > 0
        ? ["", `⭐ Ganaste *+${Number(order.phonePointsAwarded)} puntos* con esta compra`]
        : []),
      "",
      `Tu recibo y tus puntos: ${url}`,
    ].join("\n");
    const phone =
      order.customerPhone.length === 10
        ? `52${order.customerPhone}`
        : order.customerPhone;
    window.open(
      `https://wa.me/${phone}?text=${encodeURIComponent(text)}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  // ── Grouping (board columns = tab filters, one source of truth) ─────────────

  const startOfToday = (() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  })();

  const groups: Record<OrderTab, Order[]> = {
    pending: orders.filter((o) => o.status === "pending" || o.status === "open_tab"),
    preparing: orders.filter((o) => o.status === "preparing"),
    ready: orders.filter((o) => o.status === "ready"),
    completed: orders.filter((o) => {
      const dateMs = o.createdAt?.toMillis ? o.createdAt.toMillis() : 0;
      return o.status === "completed" && dateMs >= startOfToday;
    }),
  };

  /** Column definitions — color language: orange = needs attention,
   * blue = working, green = ready to hand over, gray = done. */
  const COLUMNS: {
    key: OrderTab;
    label: string;
    accent: string;
    tint: string;
    emptyCopy: string;
  }[] = [
    { key: "pending", label: "Pendientes", accent: "#F28C38", tint: "rgba(242,140,56,0.06)", emptyCopy: "Sin pedidos nuevos" },
    { key: "preparing", label: "En cocina", accent: "#2563EB", tint: "rgba(37,99,235,0.05)", emptyCopy: "Nada en preparación" },
    { key: "ready", label: "Listos", accent: "#16A34A", tint: "rgba(22,163,74,0.05)", emptyCopy: "Nada listo por entregar" },
    { key: "completed", label: "Entregados hoy", accent: "#6B7280", tint: "rgba(107,114,128,0.05)", emptyCopy: "Aún no hay entregas hoy" },
  ];

  return (
    <>
      <main className="px-4 pb-16 pt-5 md:px-8 md:pt-7" style={{ background: "#F5F3EF", minHeight: "100vh" }}>
        
        {/* Page Title */}
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h1 className="text-[22px] font-extrabold tracking-tight" style={{ color: "#1C2526" }}>Pedidos</h1>
            <p className="mt-0.5 text-[13px]" style={{ color: "rgba(28,37,38,0.45)" }}>
              Fulfillment y cocina en tiempo real
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Spinner /></div>
        ) : error ? (
          <div className="text-center py-20 text-red-600 font-semibold">{error}</div>
        ) : (
          <div className="space-y-6">
            
            {/* Board: every stage visible at once — no clicking through tabs.
                Stacks on phones, 2 columns on tablets, full 4-column board on
                desktop. Live via onSnapshot: cards move between columns alone. */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
              {COLUMNS.map((col) => {
                const list = groups[col.key];
                return (
                  <section
                    key={col.key}
                    className="rounded-2xl p-3"
                    style={{ background: col.tint, border: `1px solid ${col.accent}22` }}
                  >
                    <header className="flex items-center justify-between px-1.5 pb-3 pt-1">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: col.accent }} aria-hidden />
                        <h2 className="text-[13px] font-extrabold tracking-tight" style={{ color: "#1C2526" }}>
                          {col.label}
                        </h2>
                      </div>
                      <span
                        className="flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-[11px] font-black text-white"
                        style={{ background: list.length > 0 ? col.accent : "rgba(28,37,38,0.18)" }}
                      >
                        {list.length}
                      </span>
                    </header>
                    {list.length === 0 ? (
                      <div
                        className="rounded-xl border border-dashed py-8 text-center text-[12px]"
                        style={{ borderColor: `${col.accent}33`, color: "rgba(28,37,38,0.35)" }}
                      >
                        {col.emptyCopy}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {list.map((order) => {
                  const date = order.createdAt?.toDate ? order.createdAt.toDate() : new Date();
                  const formattedTime = date.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
                  const isPaid = order.paymentStatus === "paid";

                  return (
                    <div
                      key={order.id}
                      className="rounded-2xl p-5 bg-white flex flex-col justify-between"
                      style={{
                        border: "1px solid rgba(28,37,38,0.07)",
                        boxShadow: "0 1px 3px rgba(28,37,38,0.04)",
                      }}
                    >
                      {/* Top Header */}
                      <div className="space-y-1.5 pb-3 border-b border-gray-100">
                        <div className="flex justify-between items-center">
                          <span className="text-[13px] font-extrabold text-[#1C2526]">
                            Pedido #{order.id.slice(-6).toUpperCase()}
                          </span>
                          <span className="text-[11px] font-bold text-gray-400">
                            {formattedTime}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          <span className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-gray-100 text-gray-600">
                            {order.orderSource.toUpperCase()}
                          </span>
                          <span className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-[#F28C38]/10 text-[#F28C38]">
                            {order.orderType === "in_store"
                              ? "Caja"
                              : order.orderType === "pickup"
                              ? "Para llevar"
                              : "Delivery"}
                          </span>
                          {order.isOpenTab && (
                            <span className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-blue-100 text-blue-600">
                              Cuenta Abierta
                            </span>
                          )}
                          {!isPaid && (
                            <span className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-red-100 text-red-600">
                              Sin Pagar
                            </span>
                          )}
                          {order.redemptionRequest && (
                            <span
                              className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                                order.redemptionResult === "insufficient"
                                  ? "bg-red-100 text-red-600"
                                  : "bg-green-100 text-green-700"
                              }`}
                              title={
                                order.redemptionResult === "insufficient"
                                  ? "Puntos insuficientes al cobrar — cobra normal, no entregues el premio"
                                  : `Entregar GRATIS: ${order.redemptionRequest.name} (canje de ${order.redemptionRequest.points} pts)`
                              }
                            >
                              🎁 {order.redemptionResult === "insufficient"
                                ? "Canje inválido"
                                : `Canje: ${order.redemptionRequest.name}`}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Items */}
                      <div className="py-4 flex-1 space-y-3">
                        <p className="text-[12px] font-bold text-gray-400">PRODUCTOS</p>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {order.items.map((item, idx) => (
                            <div key={idx} className="text-[12px] text-[#1C2526]">
                              <div className="flex justify-between font-semibold">
                                <span>{item.quantity}x {item.name}</span>
                                <span>{fmt(item.price * item.quantity)}</span>
                              </div>
                              {/* Modifiers */}
                              {item.selectedModifiers && item.selectedModifiers.map((mod, mIdx) => (
                                <div key={mIdx} className="text-[10px] text-gray-400 pl-3">
                                  {mod.modifierName}: {mod.selectedOptions.join(", ")}
                                </div>
                              ))}
                              {item.notes && (
                                <div className="text-[10px] italic text-[#F28C38] pl-3">
                                  Nota: {item.notes}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>

                        {order.notes && (
                          <div className="rounded-lg bg-orange-50 p-2.5 text-[11px] text-[#E07830] border border-orange-100">
                            <strong>Nota general:</strong> {order.notes}
                          </div>
                        )}

                        {order.customerName && (
                          <div className="pt-2 text-[12px] font-semibold text-gray-700 flex items-center gap-1.5">
                            👤 <span>{order.customerName}</span>
                          </div>
                        )}
                        {order.customerPhone && (
                          <div className="flex items-center justify-between gap-2">
                            <a
                              href={`https://wa.me/${order.customerPhone.length === 10 ? `52${order.customerPhone}` : order.customerPhone}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[12px] font-semibold text-[#128C7E] flex items-center gap-1.5 hover:underline"
                            >
                              💬 <span>{order.customerPhone}</span>
                            </a>
                            <button
                              onClick={() => sendReceiptWhatsapp(order)}
                              className="rounded-lg px-2.5 py-1.5 text-[11px] font-bold bg-[#25D366]/10 text-[#128C7E] hover:bg-[#25D366]/20 transition-colors"
                            >
                              🧾 Enviar recibo
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Bottom Actions */}
                      <div className="pt-3 border-t border-gray-100 space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-[11px] font-semibold text-gray-400">TOTAL</span>
                          <span className="text-[16px] font-extrabold text-[#1C2526]">{fmt(order.total)}</span>
                        </div>

                        <div className="flex gap-1.5">
                          {order.status !== "completed" && (
                            <button
                              onClick={() => cancelOrder(order.id)}
                              className="rounded-xl px-2.5 py-2.5 text-[11px] font-bold bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                            >
                              Cancelar
                            </button>
                          )}

                          {!isPaid && (
                            <button
                              onClick={() => setChargingOrderId(order.id)}
                              className="flex-1 rounded-xl py-2.5 text-[11px] font-bold bg-orange-100 text-[#E07830] hover:bg-orange-200 transition-colors text-center"
                            >
                              Cobrar
                            </button>
                          )}

                          {order.status === "pending" && (
                            <button
                              onClick={() => updateStatus(order.id, "preparing")}
                              className="flex-grow rounded-xl py-2.5 text-[11px] font-bold text-white bg-[#1C2526] hover:opacity-90 transition-all text-center"
                            >
                              Comenzar
                            </button>
                          )}

                          {order.status === "preparing" && (
                            <button
                              onClick={() => updateStatus(order.id, "ready")}
                              className="flex-grow rounded-xl py-2.5 text-[11px] font-bold text-white bg-blue-600 hover:bg-blue-700 transition-all text-center"
                            >
                              Terminar
                            </button>
                          )}

                          {order.status === "ready" && (
                            <button
                              onClick={() => deliverOrder(order)}
                              className="flex-grow rounded-xl py-2.5 text-[11px] font-bold text-white bg-green-600 hover:bg-green-700 transition-all text-center"
                            >
                              Entregar
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                        })}
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* ── Payment Dialog for Kitchen Fulfillment ── */}
      {chargingOrderId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setChargingOrderId(null)}>
          <div className="bg-white rounded-3xl p-6 w-[320px] text-center space-y-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <p className="text-[16px] font-extrabold text-[#1C2526]">Registrar Pago</p>
            <p className="text-[13px] text-gray-400 font-medium">Elige el método de pago del cliente</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => chargeOrder(chargingOrderId, "cash")}
                className="flex flex-col items-center justify-center p-4 rounded-2xl bg-gray-50 border border-gray-100 hover:bg-orange-50 hover:border-[#F28C38] transition-all"
              >
                <span className="text-2xl mb-1">💵</span>
                <span className="text-[12px] font-bold text-[#1C2526]">Efectivo</span>
              </button>
              <button
                onClick={() => chargeOrder(chargingOrderId, "card")}
                className="flex flex-col items-center justify-center p-4 rounded-2xl bg-gray-50 border border-gray-100 hover:bg-orange-50 hover:border-[#F28C38] transition-all"
              >
                <span className="text-2xl mb-1">💳</span>
                <span className="text-[12px] font-bold text-[#1C2526]">Tarjeta</span>
              </button>
            </div>
            <button
              onClick={() => setChargingOrderId(null)}
              className="w-full py-2.5 rounded-xl text-[12px] font-bold bg-gray-100 text-[#1C2526] hover:bg-gray-200 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </>
  );
}
