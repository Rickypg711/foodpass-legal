"use client";

import { restaurantPromisesPoints } from "@/lib/readiness/evaluate";
import React, { Suspense, useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
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
import { registerOrderPayment } from "@/lib/pos/registerPayment";
import { POS_PAYMENT_OPTIONS, acceptedPaymentOptions, type PaymentMethod } from "@/lib/pos/paidOrderFields";
import { tableLabel } from "@/lib/order/tableSession";
import { waitForAuthReady } from "@/lib/auth";
import { resolveVendorContext } from "@/lib/vendorContext";
import { businessDayStart } from "@/lib/businessDay";
import { creditPhonePointsForOrder } from "@/lib/loyalty/phonePoints";
import { receiptWhatsappUrl } from "@/lib/receiptWhatsapp";
import { markReceiptTapped } from "@/lib/order/receiptStamps";
import { primeChime, playNewOrderChime, flashTabTitle } from "@/lib/vendor/newOrderChime";
import { IN_TRAY_STATUSES, mergeOrdersById } from "@/lib/order/trayOrders";
import {
  isWaitingOrder,
  lateOrdersBanner,
  orderWaitLabel,
  orderWaitLevel,
  orderWaitingMinutes,
  shouldRemindLateOrders,
} from "@/lib/order/orderAging";
import { DEFAULT_PHONE_COUNTRY, phoneCountryOf } from "@/lib/phone/phoneCountry";
import { entrarHref } from "@/lib/vendor/pedidoLink";
import { buildWhatsappChatUrl } from "@/lib/order/formatWhatsappMessage";
import { fetchWithBilling } from "@/lib/subscription/billingDoc";
import {
  FREE_ENTITLEMENTS,
  entitlementOf,
  entitlementsOf,
  type Entitlement,
  type Entitlements,
} from "@/lib/subscription/entitlement";
import { ProWall } from "@/components/vendor/ProWall";
import { TICKET_PRINTED_MESSAGE, autoPrintTickets, shouldAutoPrint } from "@/lib/pos/ticketPaper";

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
  /** 🏦 Lo que el comensal dijo al ordenar (cash/card/transfer). */
  pickupPaymentMethod?: string;
  orderType: "pickup" | "delivery" | "in_store" | "dine_in";
  /** Mesa cuando el comensal pidió desde el QR de su mesa (orderType dine_in). */
  tableNumber?: string;
  /** Personas en la mesa (opcional, lo pone el comensal). */
  diners?: number;
  /** 🛵 A domicilio (9-sep): a dónde se lleva, con las palabras del comensal. */
  deliveryAddress?: string;
  /** 🛵 Envío ya sumado en `total`; se desglosa para que el cobro cuadre. */
  deliveryFee?: number;
  orderSource: "pos" | "app" | "web" | string;
  notes?: string;
  createdAt: Timestamp;
  createdByUserId?: string;
  createdByName?: string;
}

type OrderTab = "pending" | "preparing" | "ready" | "completed";

// ─── Helpers ───────────────────────────────────────────────────────────────────

// Opción A (23-sep-2026): los mismos tokens del Panel y del Design System
// "Comeleal". Crema + tinta, naranja solo en la acción principal.
const SERIF = "var(--font-lora), Lora, Georgia, serif";
const INK = "#1C2526";
const INK_MUTED = "#3F4A4D";
const INK_SOFT = "#5B6366";
const HAIRLINE = "#E9E3D7";
const BORDER = "#D9D2C5";
const LINK = "#8A4B12";
const BRAND = "#F28C38";
const WARN = "#B45309";
const WARN_SURFACE = "#FFFBEB";
const DANGER = "#B91C1C";
const SUCCESS_TEXT = "#15803D";

/** Chip neutro con borde: origen y tipo del pedido, lo que no es un estado. */
function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-[26px] items-center rounded-full px-2.5 text-[12px]" style={{ border: `1px solid ${BORDER}`, color: INK }}>
      {children}
    </span>
  );
}

const ICON = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
function IconBell() { return <svg {...ICON}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10 21h4" /></svg>; }
function IconBellOff() { return <svg {...ICON}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10 21h4M3 3l18 18" /></svg>; }
function IconPrinter() { return <svg {...ICON}><path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v7H6z" /></svg>; }
function IconReceipt() { return <svg {...ICON} width={16} height={16}><path d="M6 2h12v20l-3-2-3 2-3-2-3 2zM9 7h6M9 11h6" /></svg>; }
function IconPin() { return <svg {...ICON} width={16} height={16} style={{ marginTop: 1, flexShrink: 0 }}><path d="M12 22s7-6.5 7-12a7 7 0 0 0-14 0c0 5.5 7 12 7 12z" /><circle cx="12" cy="10" r="2.5" /></svg>; }

function fmt(n: number) {
  return n.toLocaleString("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 2 });
}

function Spinner() {
  return (
    <svg className="h-6 w-6 animate-spin" style={{ color: "#F28C38" }} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 12 5.373 12 12H4z" />
    </svg>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PedidosPage() {
  // useSearchParams pide Suspense (?pedido= del link del recibo).
  return (
    <Suspense fallback={null}>
      <PedidosPageContent />
    </Suspense>
  );
}

function PedidosPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [restaurantId, setRestaurantId] = useState<string | null>(null);

  // ── 🖨️ Ticket de cocina = Pro (23-sep-2026, pared kitchenPrint) ──
  // El plan se lee fundido con private/billing al arrancar. Con la reja
  // cerrada, el 🖨️ abre LA pared (14 días gratis de un toque); si se abre,
  // repite la acción que detuvo.
  const [ent, setEnt] = useState<Entitlement | null>(null);
  const [ents, setEnts] = useState<Entitlements>(FREE_ENTITLEMENTS);
  const entsRef = useRef<Entitlements>(FREE_ENTITLEMENTS);
  const [wallOpen, setWallOpen] = useState(false);
  const pendingAction = useRef<(() => void) | null>(null);
  const openTicket = useCallback((orderId: string) => {
    if (!entsRef.current.kitchenPrintAccess) {
      pendingAction.current = () => window.open(`/vendor/ticket/${encodeURIComponent(orderId)}`, "_blank", "noopener,noreferrer");
      setWallOpen(true);
      return;
    }
    window.open(`/vendor/ticket/${encodeURIComponent(orderId)}`, "_blank", "noopener,noreferrer");
  }, []);

  // ── 🖨️ Impresión automática (23-sep-2026, Pro) ──
  // Con `autoPrintTickets` prendido en Configuración, cada pedido que ENTRA
  // mientras esta pestaña está abierta se manda a la impresora solo: la hoja
  // del ticket se abre en un iframe escondido y llama a print(). En un Chrome
  // abierto con --kiosk-printing sale sin preguntar; si no, sale la ventana
  // de imprimir y basta un Enter. Uno a la vez (cola), y nada de lo que ya
  // estaba en la bandeja al abrir (shouldAutoPrint).
  const [autoPrintOn, setAutoPrintOn] = useState(false);
  const autoPrintRef = useRef(false);
  const openedAtMs = useRef<number>(Date.now());
  const printedIds = useRef<Set<string>>(new Set());
  const printQueue = useRef<string[]>([]);
  const printingFrame = useRef<HTMLIFrameElement | null>(null);
  const printTimer = useRef<number | null>(null);
  const finishPrint = useCallback(() => {
    if (printTimer.current != null) {
      window.clearTimeout(printTimer.current);
      printTimer.current = null;
    }
    printingFrame.current?.remove();
    printingFrame.current = null;
    pumpPrintQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const pumpPrintQueue = useCallback(() => {
    if (printingFrame.current || printQueue.current.length === 0) return;
    const id = printQueue.current.shift()!;
    const f = document.createElement("iframe");
    f.src = `/vendor/ticket/${encodeURIComponent(id)}`;
    f.title = "Ticket de cocina";
    f.setAttribute("aria-hidden", "true");
    // Fuera de la vista pero con tamaño real: un iframe de 0×0 imprime en blanco.
    f.style.cssText = "position:fixed;left:-10000px;top:0;width:420px;height:640px;border:0;opacity:0;pointer-events:none;";
    document.body.appendChild(f);
    printingFrame.current = f;
    // Si nadie contesta (pestaña sin permiso, error de red), seguir de todos modos.
    printTimer.current = window.setTimeout(finishPrint, 45000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const enqueuePrint = useCallback((orderId: string) => {
    printedIds.current.add(orderId);
    printQueue.current.push(orderId);
    pumpPrintQueue();
  }, [pumpPrintQueue]);
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const data = e.data as { type?: string } | null;
      if (data?.type === TICKET_PRINTED_MESSAGE) finishPrint();
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [finishPrint]);

  /** Premios apagados (5-sep): el recibo por WhatsApp no anuncia puntos. */

  const [loyaltyLive, setLoyaltyLive] = useState(true);
  /** País del teléfono del local (5-sep): sus clientes marcan como él. */
  const [phoneCountry, setPhoneCountry] = useState(DEFAULT_PHONE_COUNTRY);
  // 🎚️ Formas de pago que el dueño acepta (Configuración); las tres hasta cargar.
  const [paymentOptions, setPaymentOptions] = useState<typeof POS_PAYMENT_OPTIONS>(POS_PAYMENT_OPTIONS);
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  // ?pedido=ID: llega del recibo por link ("Ir a Pedidos" / "¿Eres del local?"). Baja hasta esa
  // tarjeta y la resalta; si ya no está en la bandeja, lo dice.
  // Con useSearchParams, no window.location: al llegar con Link/router.replace la página se pinta ANTES de que
  // cambie la URL del navegador y el pedido no se marcaba (visto en QA 12-sep). Cerrar el letrero lo apaga.
  const pedidoParam = searchParams.get("pedido");
  const [dismissedFocusId, setDismissedFocusId] = useState<string | null>(null);
  const focusOrderId = pedidoParam && pedidoParam !== dismissedFocusId ? pedidoParam : null;
  const [error, setError] = useState<string | null>(null);
  const [chargingOrderId, setChargingOrderId] = useState<string | null>(null);
  // 🤝 "¿Ya te pagó?" (9-sep): cuando Entregar cae sobre un pedido sin
  // cobrar, el mismo diálogo de cobro se abre en modo entrega — tocar la
  // forma de pago COBRA Y ENTREGA en un paso. Por qué: Central Fast Food
  // entregó 3 de 10 pedidos reales tocando solo "Entregar"; quedaron
  // "completados" pero sin pagar (2,085 DOP invisibles para la métrica de
  // ventas identificadas y sin puntos). "Cobrar" y "Entregar" eran dos
  // botones y el dueño toca uno.
  const [deliverAfterCharge, setDeliverAfterCharge] = useState(false);

  const closeChargeDialog = () => {
    setChargingOrderId(null);
    setDeliverAfterCharge(false);
  };

  // La campana: ids de pedidos entrantes ya vistos por ESTE listener. null =
  // aún no llega el primer snapshot (la carga inicial jamás suena).
  const seenIncomingIds = useRef<Set<string> | null>(null);

  // ⏰ El reloj (10-sep-2026, La Familia): las ventas se quedaban en Pendientes
  // horas. Cada tarjeta dice cuánto lleva (naranja a los 10 min, roja y
  // parpadeando a los 20) y, mientras haya alguna en rojo, suena cada 5 min hasta
  // que la marquen o lo callen. Reglas en lib/order/orderAging.ts (espejo en la app).
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(t);
  }, []);
  const [avisoSilenciado, setAvisoSilenciado] = useState<boolean>(() => {
    try {
      return typeof window !== "undefined" && window.localStorage.getItem("pedidosAvisoSilenciado") === "1";
    } catch {
      return false; // sin storage: el aviso suena
    }
  });
  const toggleAviso = () => {
    const next = !avisoSilenciado;
    setAvisoSilenciado(next);
    try {
      window.localStorage.setItem("pedidosAvisoSilenciado", next ? "1" : "0");
    } catch { /* sin storage: dura mientras la pestaña esté abierta */ }
  };
  // Notificación de la compu: solo si el dueño la pide con un toque (el navegador
  // pregunta una vez). Sirve cuando la pestaña de Pedidos está escondida.
  const [notifPerm, setNotifPerm] = useState<NotificationPermission | "unsupported">(() =>
    typeof window === "undefined" || typeof Notification === "undefined" ? "unsupported" : Notification.permission,
  );
  const pedirNotificaciones = () => {
    if (typeof Notification === "undefined") return;
    void Notification.requestPermission().then(setNotifPerm).catch(() => {});
  };
  const minutesOf = (o: Order) =>
    orderWaitingMinutes(o.createdAt?.toMillis ? o.createdAt.toMillis() : now, now);
  const lateCount = orders.filter(
    (o) => isWaitingOrder(o) && orderWaitLevel(minutesOf(o)) === "late",
  ).length;
  const lastRemindAt = useRef<number | null>(null);
  useEffect(() => {
    if (lateCount === 0) {
      lastRemindAt.current = null; // se vació: el siguiente rojo suena de inmediato
      return;
    }
    if (avisoSilenciado) return;
    if (!shouldRemindLateOrders({ lateCount, lastRemindAtMs: lastRemindAt.current, nowMs: now })) return;
    lastRemindAt.current = now;
    playNewOrderChime();
    flashTabTitle("⏰ Pedido esperando");
    if (
      typeof Notification !== "undefined" &&
      Notification.permission === "granted" &&
      document.visibilityState !== "visible"
    ) {
      try {
        new Notification("Pedidos esperando", { body: lateOrdersBanner(lateCount), tag: "pedidos-esperando" });
      } catch { /* algunos navegadores solo notifican desde un service worker */ }
    }
  }, [lateCount, now, avisoSilenciado]);

  // ── Auth Init & Realtime Listener ──────────────────────────────────────────

  useEffect(() => primeChime(), []);

  useEffect(() => {
    let unsubscribe: () => void = () => {};

    async function init() {
      const u = await waitForAuthReady();
      if (!u || u.isAnonymous) {
        router.push(entrarHref(window.location.pathname + window.location.search));
        return;
      }

      const db = getFirebaseDb();
      // Staff-aware: todo rol activo procesa pedidos (canProcessOrders).
      const ctx = await resolveVendorContext(db, u.uid);
      if (!ctx) {
        // Con sesión pero sin local: SIN next, o Entrar lo regresaría aquí y rebotaría sin fin.
        router.push("/activar?modo=entrar");
        return;
      }
      const rid = ctx.restaurantId;
      setRestaurantId(rid);
      try {
        const rSnap = await getDoc(doc(db, "restaurants", rid));
        setPaymentOptions(acceptedPaymentOptions(rSnap.data()));
        setLoyaltyLive(restaurantPromisesPoints(rSnap.data()));
        setPhoneCountry(phoneCountryOf(rSnap.data()));
        // Pro (kitchenPrint) y la impresión automática, del doc fundido con billing.
        const rdata = (rSnap.data() ?? {}) as Record<string, unknown>;
        const merged = await fetchWithBilling(db, rid, rdata);
        setEnt(entitlementOf(merged));
        const es = entitlementsOf(merged, rid);
        setEnts(es);
        entsRef.current = es;
        const ap = autoPrintTickets(rdata);
        setAutoPrintOn(ap);
        autoPrintRef.current = ap;
      } catch {
        // Sin lectura, las tres: nunca un cobro sin botones.
      }

      // Dos lecturas que se unen en una sola bandeja:
      //  1. Últimas 48 h: lo de hoy y ayer, entregados incluidos (la columna
      //     "Entregados hoy" sale de aquí).
      //  2. TODO lo que sigue en bandeja (pending / preparing / ready / open_tab)
      //     sin importar la fecha. Antes solo existía la ventana de 48 h y un
      //     pedido pendiente de 3+ días desaparecía de Pedidos aunque el Panel
      //     lo siguiera contando como "sin cobrar" (18-sep-2026, Luzz Pizza:
      //     5 pedidos, $370, y "Cobrarlos en Pedidos" caía en una bandeja
      //     vacía). La app siempre leyó por estado sin fecha; esto la iguala.
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      twoDaysAgo.setHours(0, 0, 0, 0);

      const ordersRef = collection(db, "restaurants", rid, "orders");
      const recentQ = query(
        ordersRef,
        where("createdAt", ">=", Timestamp.fromDate(twoDaysAgo)),
        orderBy("createdAt", "desc")
      );
      const inTrayQ = query(ordersRef, where("status", "in", IN_TRAY_STATUSES));

      const recent = new Map<string, Order>();
      const inTray = new Map<string, Order>();
      let recentReady = false;
      let inTrayReady = false;

      const publish = () => {
        // Los dos snapshots llegan por separado; la bandeja se pinta cuando
        // ya están ambos, o el pedido viejo parpadearía al cargar.
        if (!recentReady || !inTrayReady) return;
        const list = mergeOrdersById([...recent.values()], [...inTray.values()]);

        // La campana: suena todo pedido que aparece en la bandeja
        // (pending/open_tab) DESPUÉS del primer snapshot. Desde el 10-sep
        // también los de la Caja: en La Familia uno cobra en la Caja y otro
        // prepara con Pedidos abierto en otra pantalla, y tiene que oírlo al
        // instante (antes la venta de la Caja caía en silencio).
        const incoming = list.filter(
          (o) => o.status === "pending" || o.status === "open_tab",
        );
        if (seenIncomingIds.current === null) {
          seenIncomingIds.current = new Set(incoming.map((o) => o.id));
        } else {
          const seen = seenIncomingIds.current;
          const fresh = incoming.filter((o) => !seen.has(o.id));
          incoming.forEach((o) => seen.add(o.id));
          if (fresh.length > 0) {
            playNewOrderChime();
            flashTabTitle();
          }
        }
        // 🖨️ Sale solo: cada pedido nuevo (pending/open_tab) que entró después
        // de abrir la pestaña, si el dueño lo prendió y tiene Pro.
        if (autoPrintRef.current && entsRef.current.kitchenPrintAccess) {
          for (const o of incoming) {
            const createdAtMs = o.createdAt?.toMillis ? o.createdAt.toMillis() : null;
            if (shouldAutoPrint({ id: o.id, status: o.status, createdAtMs }, openedAtMs.current, printedIds.current)) {
              enqueuePrint(o.id);
            }
          }
        }

        setOrders(list);
        setLoading(false);
      };

      const onListenerError = (err: unknown) => {
        console.error("Orders listener error", err);
        setError("Error de conexión con la base de datos.");
        setLoading(false);
      };

      const toOrder = (d: { id: string; data: () => unknown }): Order => ({
        id: d.id,
        ...(d.data() as Omit<Order, "id">),
      });

      const unsubRecent = onSnapshot(
        recentQ,
        (snap) => {
          recent.clear();
          snap.docs.forEach((d) => recent.set(d.id, toOrder(d)));
          recentReady = true;
          publish();
        },
        onListenerError
      );
      const unsubInTray = onSnapshot(
        inTrayQ,
        (snap) => {
          inTray.clear();
          snap.docs.forEach((d) => inTray.set(d.id, toOrder(d)));
          inTrayReady = true;
          publish();
        },
        onListenerError
      );
      unsubscribe = () => {
        unsubRecent();
        unsubInTray();
      };
    }

    init().catch((err) => {
      console.error("[Pedidos init]", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router, enqueuePrint]);

  // ── ?pedido=ID: bajar hasta el pedido del link ─────────────────────────────
  const focusScrolledId = useRef<string | null>(null);
  useEffect(() => {
    if (!focusOrderId || loading || focusScrolledId.current === focusOrderId) return;
    const el = document.getElementById(`pedido-${focusOrderId}`);
    if (!el) return;
    focusScrolledId.current = focusOrderId;
    requestAnimationFrame(() => el.scrollIntoView({ behavior: "smooth", block: "center" }));
  }, [focusOrderId, loading, orders]);

  // ── Order State Transitions ──────────────────────────────────────────────────

  const updateStatus = async (orderId: string, newStatus: Order["status"]) => {
    if (!restaurantId) return;
    try {
      const db = getFirebaseDb();
      const orderRef = doc(db, "restaurants", restaurantId, "orders", orderId);
      const updateData: Record<string, unknown> = {
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
    if (order.paymentStatus === "pending" && !order.isOpenTab) {
      // Pedido suelto sin cobrar: preguntar "¿ya te pagó?" con las formas de
      // pago a la mano. Nada de confirm() — ese "sí" es el que perdía el cobro.
      setDeliverAfterCharge(true);
      setChargingOrderId(order.id);
      return;
    }
    if (order.paymentStatus === "pending") {
      // Cuenta abierta: la mesa paga al final en la Caja; entregar la ronda
      // sin cobrarla es lo normal. Solo se confirma.
      const confirmDeliver = confirm(
        "Esta ronda es de una cuenta abierta y se cobra en la Caja al final. ¿Entregarla?"
      );
      if (!confirmDeliver) return;
    }
    await updateStatus(order.id, "completed");
  };

  /** "Todavía no me paga": entregar sin cobrar, a propósito. El botón Cobrar
   *  sigue en la tarjeta de Entregados hoy para cuando pague. */
  const deliverUnpaid = async (orderId: string) => {
    closeChargeDialog();
    await updateStatus(orderId, "completed");
  };

  const chargeOrder = async (orderId: string, method: PaymentMethod) => {
    if (!restaurantId) return;
    try {
      // ⚖️ Una sola verdad del cobro: registerPayment.ts es el ÚNICO lugar
      // que sabe marcar pagado (transacción con guardia anti-re-cobro, saca
      // la orden de Cuentas, y acredita los puntos del teléfono).
      await registerOrderPayment({
        db: getFirebaseDb(),
        restaurantId,
        orderId,
        method,
      });
      const alsoDeliver = deliverAfterCharge;
      closeChargeDialog();
      // Cobrar y entregar en UN toque (modo "¿Ya te pagó?").
      if (alsoDeliver) await updateStatus(orderId, "completed");
    } catch (err: unknown) {
      console.error("Error charging order", err);
      alert(`No se pudo registrar el pago. ${err instanceof Error ? err.message : ""}`);
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
   * Also how POS walk-ins get their receipt/points link into their chat.
   * Message lives in lib/receiptWhatsapp.ts — shared with the Caja post-cobro
   * button so both send the IDENTICAL receipt. */
  const sendReceiptWhatsapp = (order: Order) => {
    if (!order.customerPhone || !restaurantId) return;
    window.open(
      receiptWhatsappUrl({
        restaurantId,
        promisesPoints: loyaltyLive,
        phoneCountryCode: phoneCountry,
        restaurantName: order.restaurantName,
        orderId: order.id,
        customerPhone: order.customerPhone,
        customerName: order.customerName || null,
        items: order.items.map((i) => ({
          name: i.name,
          quantity: i.quantity,
          price: i.price,
        })),
        total: order.total,
        // Loyalty lines — present only after the credit transaction ran
        // (send-receipt usually happens post-cobro). Hooked: the reward news
        // arrives IN the message, not just behind the link.
        redemptionName:
          order.redemptionResult === "applied" && order.redemptionRequest
            ? order.redemptionRequest.name
            : null,
        pointsAwarded: Number(order.phonePointsAwarded) || 0,
        origin: window.location.origin,
      }),
      "_blank",
      "noopener,noreferrer",
    );
    // Stamp del embudo del recibo (docs/REFERIDOS_POR_TELEFONO.md §10):
    // después del window.open (el popup no puede esperar), sin await.
    void markReceiptTapped(getFirebaseDb(), restaurantId, order.id);
  };

  // ── Grouping (board columns = tab filters, one source of truth) ─────────────

  // "Hoy" = JORNADA comercial (corte 4 AM, lib/businessDay.ts) — los pedidos
  // de la 1 AM siguen siendo del turno en curso, no de un día nuevo.
  const startOfToday = businessDayStart().getTime();

  const groups: Record<OrderTab, Order[]> = {
    pending: orders.filter((o) => o.status === "pending" || o.status === "open_tab"),
    preparing: orders.filter((o) => o.status === "preparing"),
    ready: orders.filter((o) => o.status === "ready"),
    completed: orders.filter((o) => {
      const dateMs = o.createdAt?.toMillis ? o.createdAt.toMillis() : 0;
      return o.status === "completed" && dateMs >= startOfToday;
    }),
  };

  // El pedido del link ya no está en ninguna columna (entregado otro día o cancelado; lo que sigue en bandeja siempre sale).
  const focusMissing =
    focusOrderId !== null && !Object.values(groups).some((list) => list.some((o) => o.id === focusOrderId));

  /** Columnas del tablero. Opción A (23-sep-2026, lienzo "Sistema Comeleal"):
   *  sin fondos de color por columna; el estado se dice con palabra y punto. */
  const COLUMNS: { key: OrderTab; label: string; emptyCopy: string }[] = [
    { key: "pending", label: "Esperando", emptyCopy: "Sin pedidos nuevos" },
    { key: "preparing", label: "En cocina", emptyCopy: "Nada en preparación" },
    { key: "ready", label: "Listos", emptyCopy: "Nada listo por entregar" },
    { key: "completed", label: "Entregados hoy", emptyCopy: "Aún no hay entregas hoy" },
  ];

  const waitingCount = groups.pending.length;
  const oldestWaitingMin = groups.pending.reduce((m, o) => Math.max(m, minutesOf(o)), 0);
  // Edad en palabras llanas ("desde hace 2 h 15 min", "desde hace 3 d"); el chip
  // de cada tarjeta ya trae la pregunta "¿ya lo entregaste?".
  const ageShort = (min: number) => {
    if (min < 1) return "ahorita";
    if (min < 60) return `hace ${min} min`;
    const h = Math.floor(min / 60);
    const m = min % 60;
    if (h < 24) return m === 0 ? `hace ${h} h` : `hace ${h} h ${m} min`;
    const d = Math.floor(h / 24);
    return d === 1 ? "desde ayer" : `hace ${d} días`;
  };
  const subtitle = loading
    ? ""
    : waitingCount === 0
      ? "Nada esperando"
      : `${waitingCount} esperando · el más viejo ${ageShort(oldestWaitingMin)}`;

  return (
    <>
      <main className="px-5 pb-24 pt-5 md:px-8 md:pt-7" style={{ minHeight: "100vh" }}>

        {/* Título de pantalla (Lora) + qué hay, y a la derecha los controles del aviso. */}
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <h1 className="text-[22px] font-semibold leading-[26px] md:text-[24px] md:leading-7" style={{ color: INK, fontFamily: SERIF }}>Pedidos</h1>
            {subtitle && <p className="text-[13px] leading-4" style={{ color: INK_SOFT }}>{subtitle}</p>}
          </div>
          {/* Controles del aviso: solo ya cargado (lo que guarda el navegador no
              existe en el servidor y no debe pintarse en el primer render). */}
          {!loading && (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={toggleAviso}
                aria-pressed={!avisoSilenciado}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-white px-3.5 text-[14px] font-semibold transition hover:opacity-90"
                style={{ border: `1px solid ${avisoSilenciado ? BORDER : INK}`, color: INK }}
              >
                {avisoSilenciado ? <IconBellOff /> : <IconBell />}
                {avisoSilenciado ? "Aviso callado" : "Aviso encendido"}
              </button>
              {/* Impresión automática (Pro): prendida en Configuración. Con
                  la reja cerrada (se acabó la prueba) lo dice y abre la pared. */}
              {autoPrintOn && ents.kitchenPrintAccess && (
                <span className="inline-flex h-10 items-center gap-2 px-1 text-[13px]" style={{ color: INK_SOFT }} title="Cada pedido que entre sale solo en tu impresora">
                  <IconPrinter /> Sale solo en tu impresora
                </span>
              )}
              {autoPrintOn && !ents.kitchenPrintAccess && (
                <button
                  type="button"
                  onClick={() => {
                    pendingAction.current = null;
                    setWallOpen(true);
                  }}
                  className="inline-flex h-10 items-center gap-2 px-1 text-[13px] font-semibold hover:underline"
                  style={{ color: LINK }}
                >
                  <IconPrinter /> Impresión automática en pausa · es Pro
                </button>
              )}
              {notifPerm === "default" && (
                <button
                  type="button"
                  onClick={pedirNotificaciones}
                  className="inline-flex h-10 items-center px-1 text-[13px] font-semibold hover:underline"
                  style={{ color: LINK }}
                >
                  Avisarme también con notificación
                </button>
              )}
            </div>
          )}
        </div>

        {/* Pedidos olvidados: suena cada 5 min hasta que los marquen o callen el
            aviso. Aviso en ámbar con palabra, no un banner rojo que parpadea. */}
        {!loading && lateCount > 0 && (
          <div role="alert" className="mb-4 flex items-center gap-2.5 rounded-xl px-3.5 py-3" style={{ background: WARN_SURFACE, color: INK }}>
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: WARN }} />
            <p className="min-w-0 flex-1 text-[14px] leading-[18px]">
              {lateOrdersBanner(lateCount)}{" "}
              <span style={{ color: INK_SOFT }}>
                {avisoSilenciado
                  ? "El aviso está callado en esta pantalla. Márcalos cuando salgan."
                  : "Suena cada 5 min hasta que los marques: Comenzar, Terminar, Entregar."}
              </span>
            </p>
            <button type="button" onClick={toggleAviso} className="shrink-0 text-[14px] font-semibold hover:underline" style={{ color: LINK }}>
              {avisoSilenciado ? "Activar aviso" : "Silenciar"}
            </button>
          </div>
        )}

        {!loading && focusOrderId && focusMissing && (
          <div role="status" className="mb-4 flex items-start justify-between gap-3 rounded-xl bg-white px-4 py-3" style={{ border: `1px solid ${BORDER}` }}>
            <p className="text-[14px] leading-[18px]" style={{ color: INK }}>
              El pedido <span className="font-semibold">#{focusOrderId.slice(-6).toUpperCase()}</span> ya no está en la
              bandeja. Puede que ya se haya entregado o cancelado.
            </p>
            <button
              type="button"
              onClick={() => setDismissedFocusId(focusOrderId)}
              aria-label="Cerrar"
              className="shrink-0 text-[18px] font-semibold leading-none"
              style={{ color: INK_SOFT }}
            >
              ×
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20"><Spinner /></div>
        ) : error ? (
          <div className="py-20 text-center text-[14px] font-semibold" style={{ color: DANGER }}>{error}</div>
        ) : (
          <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-2 md:gap-4 xl:grid-cols-4">
            {/* Tablero: todas las etapas a la vista, sin pestañas. En teléfono se
                apilan; en escritorio, cuatro columnas. Vivo con onSnapshot. */}
            {COLUMNS.map((col) => {
              const list = groups[col.key];
              return (
                <section key={col.key} className="flex min-w-0 flex-col gap-2.5">
                  <header className="flex items-baseline justify-between px-0.5 pb-2" style={{ borderBottom: `1px solid ${HAIRLINE}` }}>
                    <h2 className="text-[14px] font-semibold" style={{ color: INK }}>{col.label}</h2>
                    <span className="text-[13px] font-semibold tabular-nums" style={{ color: list.length > 0 && col.key === "pending" ? LINK : INK_SOFT }}>
                      {list.length}
                    </span>
                  </header>
                  {list.length === 0 ? (
                    <div className="flex h-24 items-center justify-center rounded-xl text-[13px]" style={{ border: `1px dashed ${BORDER}`, color: INK_SOFT }}>
                      {col.emptyCopy}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2.5">
                      {list.map((order) => {
                        const date = order.createdAt?.toDate ? order.createdAt.toDate() : new Date();
                        const formattedTime = date.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
                        const isPaid = order.paymentStatus === "paid";
                        // Cuánto lleva (solo lo que sigue en la bandeja; las cuentas
                        // abiertas no, esas se quedan abiertas a propósito).
                        const waiting = isWaitingOrder(order);
                        const waitMin = minutesOf(order);
                        const level = waiting ? orderWaitLevel(waitMin) : "ok";
                        const src = String(order.orderSource || "");
                        const sourceLabel =
                          src === "pos"
                            ? null
                            : order.orderType === "dine_in"
                              ? "QR de mesa"
                              : src === "customer_app"
                                ? "Desde la app"
                                : src === "customer_web"
                                  ? "Pedido web"
                                  : src;
                        const typeLabel =
                          order.orderType === "in_store"
                            ? "Caja"
                            : order.orderType === "dine_in"
                              ? "En mesa"
                              : order.orderType === "pickup"
                                ? "Para llevar"
                                : "A domicilio";
                        const saidOpt = !isPaid && order.pickupPaymentMethod
                          ? POS_PAYMENT_OPTIONS.find((o) => o.key === order.pickupPaymentMethod)
                          : undefined;

                        return (
                          <article
                            key={order.id}
                            id={`pedido-${order.id}`}
                            className="flex flex-col gap-3 rounded-xl bg-white p-3.5"
                            style={{
                              border: `1px solid ${level === "late" ? WARN : BORDER}`,
                              ...(order.id === focusOrderId
                                ? { outline: `2px solid ${INK}`, outlineOffset: "2px", scrollMarginTop: "96px" }
                                : {}),
                            }}
                          >
                            <div className="flex items-baseline justify-between gap-2">
                              <span className="text-[15px] font-semibold tabular-nums" style={{ color: INK }}>#{order.id.slice(-6).toUpperCase()}</span>
                              <span className="text-[13px]" style={{ color: INK_SOFT }}>{formattedTime}</span>
                            </div>

                            {/* Chips: origen y tipo con borde; cuánto lleva con punto y
                                palabra (ámbar desde los 10 min). La mesa va en tinta,
                                es lo único que le dice al mesero a dónde llevar el plato. */}
                            <div className="flex flex-wrap items-center gap-1.5">
                              {sourceLabel && <Chip>{sourceLabel}</Chip>}
                              <Chip>{typeLabel}</Chip>
                              {order.tableNumber ? (
                                <span className="inline-flex h-[26px] items-center rounded-full px-2.5 text-[12px] font-semibold" style={{ background: INK, color: "#FAF9F5" }}>
                                  {tableLabel(order.tableNumber)}{order.diners ? ` · ${order.diners} personas` : ""}
                                </span>
                              ) : null}
                              {waiting && (
                                <span
                                  className="inline-flex h-[26px] items-center gap-1.5 rounded-full px-2.5 text-[12px] font-semibold"
                                  style={level === "ok"
                                    ? { background: "#F0EBE1", color: INK_MUTED }
                                    : { background: WARN_SURFACE, color: WARN }}
                                >
                                  {level !== "ok" && (
                                    <span
                                      className={`h-1.5 w-1.5 rounded-full${level === "late" ? " animate-pulse motion-reduce:animate-none" : ""}`}
                                      style={{ background: WARN }}
                                    />
                                  )}
                                  {orderWaitLabel(waitMin)}
                                </span>
                              )}
                              {saidOpt ? <Chip>Paga con {saidOpt.label.toLowerCase()}</Chip> : null}
                              {order.isOpenTab && <Chip>Cuenta abierta</Chip>}
                              {!isPaid && !order.isOpenTab && (
                                <span className="inline-flex h-[26px] items-center gap-1.5 rounded-full px-2.5 text-[12px] font-semibold" style={{ background: WARN_SURFACE, color: WARN }}>
                                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: WARN }} />Sin cobrar
                                </span>
                              )}
                              {order.redemptionRequest && (
                                <span
                                  className="inline-flex h-[26px] items-center gap-1.5 rounded-full px-2.5 text-[12px] font-semibold"
                                  style={order.redemptionResult === "insufficient"
                                    ? { background: "#F0EBE1", color: DANGER }
                                    : { background: "#F0EBE1", color: SUCCESS_TEXT }}
                                  title={
                                    order.redemptionResult === "insufficient"
                                      ? "Puntos insuficientes al cobrar: cobra normal, no entregues el premio"
                                      : `Entregar GRATIS: ${order.redemptionRequest.name} (canje de ${order.redemptionRequest.points} pts)`
                                  }
                                >
                                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: order.redemptionResult === "insufficient" ? DANGER : SUCCESS_TEXT }} />
                                  {order.redemptionResult === "insufficient" ? "Canje inválido" : `Canje: ${order.redemptionRequest.name}`}
                                </span>
                              )}
                            </div>

                            {/* La dirección es lo ÚNICO que le dice al dueño a dónde ir:
                                un renglón entero en tinta, no un chip. */}
                            {order.orderType === "delivery" && order.deliveryAddress?.trim() ? (
                              <div className="flex items-start gap-2 rounded-lg px-2.5 py-2 text-[14px] font-semibold leading-[18px]" style={{ background: "#F0EBE1", color: INK }}>
                                <IconPin />
                                <span className="min-w-0">{order.deliveryAddress.trim()}</span>
                              </div>
                            ) : null}

                            {/* Platillos */}
                            <div className="flex flex-col gap-1.5 py-2.5" style={{ borderTop: `1px solid ${HAIRLINE}`, borderBottom: `1px solid ${HAIRLINE}` }}>
                              {order.items.map((item, idx) => (
                                <div key={idx} className="flex flex-col gap-0.5">
                                  <div className="flex justify-between gap-3 text-[15px] leading-5" style={{ color: INK }}>
                                    <span>{item.quantity} × {item.name}</span>
                                    <span className="tabular-nums" style={{ color: INK_MUTED }}>{fmt(item.price * item.quantity)}</span>
                                  </div>
                                  {item.selectedModifiers && item.selectedModifiers.map((mod, mIdx) => (
                                    <div key={mIdx} className="pl-4 text-[13px] leading-4" style={{ color: INK_SOFT }}>
                                      {mod.modifierName}: {mod.selectedOptions.join(", ")}
                                    </div>
                                  ))}
                                  {item.notes && (
                                    <div className="pl-4 text-[13px] leading-4" style={{ color: INK_SOFT }}>Nota: {item.notes}</div>
                                  )}
                                </div>
                              ))}
                              {order.notes && (
                                <div className="text-[13px] leading-[18px]" style={{ color: INK_SOFT }}>Nota: {order.notes}</div>
                              )}
                            </div>

                            {/* Quién: nombre y teléfono (abre WhatsApp), y el recibo. */}
                            {(order.customerName || order.customerPhone) && (
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex min-w-0 flex-col gap-0.5">
                                  {order.customerName && <span className="truncate text-[14px] font-semibold" style={{ color: INK }}>{order.customerName}</span>}
                                  {order.customerPhone && (
                                    <a
                                      href={buildWhatsappChatUrl(order.customerPhone, phoneCountry)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-[13px] tabular-nums hover:underline"
                                      style={{ color: INK_SOFT }}
                                    >
                                      {order.customerPhone}
                                    </a>
                                  )}
                                </div>
                                {order.customerPhone && (
                                  <button
                                    type="button"
                                    onClick={() => sendReceiptWhatsapp(order)}
                                    className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[10px] bg-white px-3 text-[13px] font-semibold transition hover:opacity-90"
                                    style={{ border: `1px solid ${BORDER}`, color: INK }}
                                  >
                                    <IconReceipt /> Enviar recibo
                                  </button>
                                )}
                              </div>
                            )}

                            {/* Total y acciones */}
                            <div className="flex flex-col gap-2.5">
                              {typeof order.deliveryFee === "number" && order.deliveryFee > 0 ? (
                                <div className="flex items-baseline justify-between text-[13px]" style={{ color: INK_SOFT }}>
                                  <span>Envío</span>
                                  <span className="tabular-nums">{fmt(order.deliveryFee)}</span>
                                </div>
                              ) : null}
                              <div className="flex items-baseline gap-1.5">
                                <span className="text-[13px]" style={{ color: INK_SOFT }}>Total</span>
                                <span className="text-[17px] font-bold tabular-nums" style={{ color: INK }}>{fmt(order.total)}</span>
                              </div>
                              <div className="flex flex-wrap items-center justify-end gap-1.5">
                                {/* Ticket para la impresora térmica (10-sep, Zahir/Aokia):
                                    abre la hoja limpia y el navegador imprime. */}
                                <button
                                  type="button"
                                  onClick={() => openTicket(order.id)}
                                  className="mr-auto inline-flex h-10 w-10 items-center justify-center rounded-[10px] bg-white transition hover:opacity-90"
                                  style={{ border: `1px solid ${BORDER}`, color: INK }}
                                  title="Imprimir ticket"
                                  aria-label="Imprimir ticket"
                                >
                                  <IconPrinter />
                                </button>
                                {order.status !== "completed" && (
                                  <button
                                    type="button"
                                    onClick={() => cancelOrder(order.id)}
                                    className="inline-flex h-10 items-center px-2.5 text-[14px] font-semibold hover:underline"
                                    style={{ color: LINK }}
                                  >
                                    Cancelar
                                  </button>
                                )}

                                {!isPaid && order.isOpenTab ? (
                                  // CUENTA ABIERTA: el cobro de mesa pasa por la Caja SIEMPRE:
                                  // ahí vive la cuenta agrupada (todas las rondas), la propina,
                                  // el teléfono → puntos y el canje.
                                  <Link
                                    href="/vendor/pos?cuentas=1"
                                    className="inline-flex h-10 items-center rounded-[10px] bg-white px-3.5 text-[14px] font-semibold transition hover:opacity-90"
                                    style={{ border: `1px solid ${INK}`, color: INK }}
                                  >
                                    Cobrar en la Caja
                                  </Link>
                                ) : !isPaid ? (
                                  <button
                                    type="button"
                                    onClick={() => setChargingOrderId(order.id)}
                                    className="inline-flex h-10 items-center rounded-[10px] bg-white px-3.5 text-[14px] font-semibold transition hover:opacity-90"
                                    style={{ border: `1px solid ${INK}`, color: INK }}
                                  >
                                    Cobrar
                                  </button>
                                ) : null}

                                {order.status === "pending" && (
                                  <button type="button" onClick={() => updateStatus(order.id, "preparing")} className="inline-flex h-10 items-center rounded-[10px] px-4 text-[14px] font-semibold text-[#1C2526] transition hover:opacity-90 active:scale-[0.98]" style={{ background: BRAND }}>
                                    Comenzar
                                  </button>
                                )}
                                {order.status === "preparing" && (
                                  <button type="button" onClick={() => updateStatus(order.id, "ready")} className="inline-flex h-10 items-center rounded-[10px] px-4 text-[14px] font-semibold text-[#1C2526] transition hover:opacity-90 active:scale-[0.98]" style={{ background: BRAND }}>
                                    Está listo
                                  </button>
                                )}
                                {order.status === "ready" && (
                                  <button type="button" onClick={() => deliverOrder(order)} className="inline-flex h-10 items-center rounded-[10px] px-4 text-[14px] font-semibold text-[#1C2526] transition hover:opacity-90 active:scale-[0.98]" style={{ background: BRAND }}>
                                    Entregar
                                  </button>
                                )}
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </main>

      {/* ── Diálogo de cobro ── */}
      {chargingOrderId && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 md:items-center" onClick={closeChargeDialog}>
          <div className="flex w-full max-w-[360px] flex-col gap-3 rounded-xl bg-white p-5" style={{ border: `1px solid ${BORDER}` }} onClick={(e) => e.stopPropagation()}>
            <p className="text-[18px] font-semibold leading-6" style={{ color: INK, fontFamily: SERIF }}>
              {deliverAfterCharge ? "¿Ya te pagó?" : "Registrar pago"}
            </p>
            <p className="text-[14px] leading-5" style={{ color: INK_MUTED }}>
              {deliverAfterCharge
                ? "Toca con qué te pagó y el pedido queda entregado."
                : "Elige con qué te pagó el cliente."}
            </p>
            {(() => {
              const said = orders.find((o) => o.id === chargingOrderId)?.pickupPaymentMethod;
              const opt = said ? POS_PAYMENT_OPTIONS.find((o) => o.key === said) : undefined;
              return opt ? (
                <p className="text-[14px] font-semibold" style={{ color: WARN }}>
                  El cliente dijo: {opt.label}
                </p>
              ) : null;
            })()}
            <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${paymentOptions.length}, minmax(0, 1fr))` }}>
              {paymentOptions.map((m) => {
                const said = orders.find((o) => o.id === chargingOrderId)?.pickupPaymentMethod === m.key;
                return (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => chargeOrder(chargingOrderId, m.key)}
                    className="flex h-14 items-center justify-center rounded-xl bg-white px-2 text-[14px] font-semibold transition hover:opacity-90 active:scale-[0.98]"
                    style={{ border: `1px solid ${said ? INK : BORDER}`, color: INK }}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
            {deliverAfterCharge ? (
              <button
                type="button"
                onClick={() => deliverUnpaid(chargingOrderId)}
                className="flex h-11 w-full items-center justify-center rounded-xl bg-white text-[14px] font-semibold transition hover:opacity-90"
                style={{ border: `1px solid ${BORDER}`, color: INK }}
              >
                Todavía no me paga · Entregar sin cobrar
              </button>
            ) : null}
            <button
              type="button"
              onClick={closeChargeDialog}
              className="flex h-11 w-full items-center justify-center text-[14px] font-semibold hover:underline"
              style={{ color: LINK }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* ── Pared 4: ticket de cocina e impresora (23-sep-2026) ── */}
      {wallOpen && ent && restaurantId && (
        <ProWall
          wall="kitchenPrint"
          restaurantId={restaurantId}
          entitlement={ent}
          onClose={() => {
            setWallOpen(false);
            pendingAction.current = null;
          }}
          onUnlocked={(next, nextEnt) => {
            setEnts(next);
            entsRef.current = next;
            setEnt(nextEnt);
            setWallOpen(false);
            const again = pendingAction.current;
            pendingAction.current = null;
            again?.();
          }}
        />
      )}
    </>
  );
}
