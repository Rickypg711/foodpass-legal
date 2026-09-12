"use client";

// 🖨️ Ticket para impresora térmica (10-sep-2026).
//
// POR QUÉ EXISTE: Zahir (Central Fast Food, RD) preguntó si podía conectar
// su impresora Aokia de 80 mm (12-sep: resultó AK-3280, USB + red, SIN
// Bluetooth — ver docs/TICKET_IMPRESORA.md). La respuesta barata y que sirve
// con CUALQUIER marca ESC/POS: una página de ticket limpia que el navegador
// imprime con su propio diálogo. En Android, una app puente gratis (ESCPOS
// Bluetooth Print Service, RawBT, Thermer) aparece como impresora y manda el
// ticket a la térmica. En una computadora con impresora USB, Chrome imprime
// directo. Nada de Bluetooth desde nuestro código.
//
// Vive fuera del layout del panel (sin barra lateral ni nav) para que lo
// impreso sea SOLO el ticket. Ancho 80 mm por default; ?w=58 para las de 58.
// ?auto=0 evita el diálogo automático (QA).

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { doc, getDoc, Timestamp } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import { waitForAuthReady } from "@/lib/auth";
import { resolveVendorContext } from "@/lib/vendorContext";
import { formatPrice } from "@/lib/priceFormat";
import { tableLabel } from "@/lib/order/tableSession";
import { POS_PAYMENT_OPTIONS } from "@/lib/pos/paidOrderFields";
import { TICKET_SAMPLE_ID, ticketPaperMm } from "@/lib/pos/ticketPaper";

/** Pedido de muestra: enseña todo lo que un ticket puede traer. */
function sampleOrder(): TicketOrder {
  return {
    items: [
      { name: "Taco de asada", quantity: 2, price: 35, subtotal: 70, selectedModifiers: [{ modifierName: "Salsa", selectedOptions: ["Verde"] }] },
      { name: "Agua de horchata", quantity: 1, price: 25, subtotal: 25, notes: "sin hielo" },
    ],
    total: 120,
    deliveryFee: 25,
    orderType: "delivery",
    deliveryAddress: "Calle Duarte #12, casa azul frente al colmado",
    customerName: "Ticket de prueba",
    customerPhone: "8090000000",
    pickupPaymentMethod: "cash",
    paymentStatus: "pending",
    createdAt: Timestamp.now(),
  };
}

type TicketItem = {
  name?: string;
  quantity?: number;
  price?: number;
  subtotal?: number;
  notes?: string;
  selectedModifiers?: { modifierName: string; selectedOptions: string[] }[];
};

type TicketOrder = {
  items?: TicketItem[];
  total?: number;
  status?: string;
  paymentStatus?: string;
  paymentMethod?: string;
  pickupPaymentMethod?: string;
  orderType?: string;
  orderSource?: string;
  tableNumber?: string;
  diners?: number;
  deliveryAddress?: string;
  deliveryFee?: number;
  customerName?: string;
  customerPhone?: string;
  pickupPin?: string;
  notes?: string;
  redemptionRequest?: { name?: string };
  redemptionResult?: string;
  createdAt?: Timestamp;
};

function paidLabel(method: string | undefined): string {
  switch (method) {
    case "cash":
      return "PAGADO EN EFECTIVO";
    case "card":
      return "PAGADO CON TARJETA";
    case "transfer":
      return "PAGADO POR TRANSFERENCIA";
    case "mercado_pago":
      return "PAGADO EN LINEA (MERCADO PAGO)";
    default:
      return "PAGADO";
  }
}

export default function TicketPage() {
  const params = useParams();
  const search = useSearchParams();
  const orderId = typeof params.orderId === "string" ? params.orderId : "";
  const autoPrint = search.get("auto") !== "0";

  const [order, setOrder] = useState<TicketOrder | null>(null);
  const [restaurantName, setRestaurantName] = useState("");
  /** Ancho del papel: ?w= manda; si no, lo que el dueño eligió en Configuración; si no, 80. */
  const [paperMm, setPaperMm] = useState<58 | 80>(80);
  const [error, setError] = useState<string | null>(null);
  const widthMm: 58 | 80 = search.get("w") === "58" ? 58 : search.get("w") === "80" ? 80 : paperMm;

  useEffect(() => {
    if (!orderId) return;
    (async () => {
      try {
        const u = await waitForAuthReady();
        if (!u || u.isAnonymous) {
          setError("Entra a tu restaurante para imprimir.");
          return;
        }
        const db = getFirebaseDb();
        const ctx = await resolveVendorContext(db, u.uid);
        if (!ctx) {
          setError("Entra a tu restaurante para imprimir.");
          return;
        }
        const rSnap = await getDoc(doc(db, "restaurants", ctx.restaurantId));
        const r = rSnap.data() as Record<string, unknown> | undefined;
        setRestaurantName(typeof r?.name === "string" ? r.name : "");
        setPaperMm(ticketPaperMm(r));
        // "prueba": ticket de muestra desde Configuración → Impresora, para
        // dejar la impresora lista sin esperar un pedido real.
        if (orderId === TICKET_SAMPLE_ID) {
          setOrder(sampleOrder());
          return;
        }
        const oSnap = await getDoc(doc(db, "restaurants", ctx.restaurantId, "orders", orderId));
        if (!oSnap.exists()) {
          setError("No encontramos este pedido.");
          return;
        }
        setOrder(oSnap.data() as TicketOrder);
      } catch (e) {
        console.error("[ticket]", e);
        setError("No pudimos cargar el pedido.");
      }
    })();
  }, [orderId]);

  // El diálogo de impresión sale solo en cuanto hay ticket que imprimir. El
  // dueño solo elige su impresora y ya.
  useEffect(() => {
    if (!order || !autoPrint) return;
    const t = setTimeout(() => {
      try {
        window.print();
      } catch {
        /* sin diálogo (webview raro): queda el botón */
      }
    }, 400);
    return () => clearTimeout(t);
  }, [order, autoPrint]);

  const contentMm = widthMm - 8;
  const shortCode = orderId === TICKET_SAMPLE_ID ? "PRUEBA" : orderId.slice(-6).toUpperCase();
  const created = order?.createdAt?.toDate ? order.createdAt.toDate() : null;
  const when = created
    ? created.toLocaleString("es-MX", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
    : "";
  const esDomicilio = order?.orderType === "delivery" && (order.deliveryAddress ?? "").trim().length > 0;
  const mesa = order?.orderType === "dine_in" && order.tableNumber ? tableLabel(order.tableNumber) : null;
  const isPaid = order?.paymentStatus === "paid";
  const envio = typeof order?.deliveryFee === "number" && order.deliveryFee > 0 ? order.deliveryFee : 0;
  const saidMethod = POS_PAYMENT_OPTIONS.find((o) => o.key === order?.pickupPaymentMethod);
  const premio =
    order?.redemptionRequest?.name && order.redemptionResult !== "insufficient"
      ? order.redemptionRequest.name
      : null;

  return (
    <div className="ticket-root">
      <style>{`
        @page { size: ${widthMm}mm auto; margin: 0; }
        html, body { background: #fff !important; margin: 0; padding: 0; }
        .ticket-root { color: #000; background: #fff; font-family: "Courier New", ui-monospace, Menlo, monospace; }
        .ticket { width: ${contentMm}mm; margin: 0 auto; padding: 3mm 0 6mm; font-size: 12px; line-height: 1.3; }
        .center { text-align: center; }
        .big { font-size: 18px; font-weight: 700; }
        .bold { font-weight: 700; }
        .rule { border-top: 1px dashed #000; margin: 6px 0; }
        .row { display: flex; justify-content: space-between; gap: 8px; }
        .row span:first-child { flex: 1; min-width: 0; }
        .sub { padding-left: 10px; font-size: 11px; }
        .total { font-size: 16px; font-weight: 700; }
        .box { border: 1px solid #000; padding: 4px 6px; margin: 6px 0; }
        .no-print { display: flex; gap: 8px; justify-content: center; padding: 12px; }
        .no-print button { font: inherit; padding: 10px 16px; border-radius: 10px; border: 1px solid #000; background: #fff; }
        .no-print button.primary { background: #000; color: #fff; }
        @media print { .no-print { display: none !important; } }
        @media screen { body { background: #e5e5e5 !important; } .ticket { background: #fff; box-shadow: 0 1px 6px rgba(0,0,0,0.2); padding-left: 4mm; padding-right: 4mm; margin-top: 12px; } }
      `}</style>

      {error ? (
        <p className="center" style={{ padding: 24 }}>{error}</p>
      ) : !order ? (
        <p className="center" style={{ padding: 24 }}>Cargando ticket…</p>
      ) : (
        <>
          <div className="no-print">
            <button type="button" className="primary" onClick={() => window.print()}>
              Imprimir
            </button>
            <button type="button" onClick={() => window.close()}>
              Cerrar
            </button>
          </div>
          <div className="ticket">
            {restaurantName ? <p className="center big">{restaurantName}</p> : null}
            <p className="center">Pedido #{shortCode}{when ? ` · ${when}` : ""}</p>

            <div className="rule" />

            {/* A dónde va / dónde está — lo primero que lee la cocina. */}
            {esDomicilio ? (
              <div className="box">
                <p className="bold">A DOMICILIO</p>
                <p>{order.deliveryAddress}</p>
              </div>
            ) : mesa ? (
              <div className="box">
                <p className="bold">{mesa.toUpperCase()}{order.diners ? ` · ${order.diners} personas` : ""}</p>
              </div>
            ) : order.orderType === "pickup" ? (
              <div className="box">
                <p className="bold">PARA LLEVAR{order.pickupPin ? ` · PIN ${order.pickupPin}` : ""}</p>
              </div>
            ) : null}

            {order.customerName ? <p className="bold">{order.customerName}</p> : null}
            {order.customerPhone ? <p>Tel. {order.customerPhone}</p> : null}

            <div className="rule" />

            {(order.items ?? []).map((it, i) => {
              const qty = typeof it.quantity === "number" ? it.quantity : 1;
              const line =
                typeof it.subtotal === "number"
                  ? it.subtotal
                  : (typeof it.price === "number" ? it.price : 0) * qty;
              return (
                <div key={i}>
                  <div className="row">
                    <span className="bold">{qty}x {it.name ?? "—"}</span>
                    <span>{formatPrice(line)}</span>
                  </div>
                  {it.selectedModifiers?.map((m, j) => (
                    <p key={j} className="sub">
                      {m.modifierName}: {m.selectedOptions.join(", ")}
                    </p>
                  ))}
                  {it.notes?.trim() ? <p className="sub">* {it.notes.trim()}</p> : null}
                </div>
              );
            })}
            {order.notes?.trim() ? <p className="sub">Nota: {order.notes.trim()}</p> : null}
            {premio ? <p className="bold">GRATIS: {premio}</p> : null}

            <div className="rule" />

            {envio > 0 ? (
              <div className="row">
                <span>Envío</span>
                <span>{formatPrice(envio)}</span>
              </div>
            ) : null}
            <div className="row total">
              <span>TOTAL</span>
              <span>{formatPrice(order.total ?? 0)}</span>
            </div>
            <p className="bold" style={{ marginTop: 4 }}>
              {isPaid
                ? paidLabel(order.paymentMethod)
                : mesa
                  ? "PAGA AL FINAL EN LA MESA"
                  : saidMethod
                    ? `PAGA CON ${saidMethod.label.toUpperCase()}${esDomicilio ? " AL RECIBIR" : ""}`
                    : "SIN PAGAR"}
            </p>

            <div className="rule" />
            <p className="center" style={{ fontSize: 10 }}>comeleal.com</p>
          </div>
        </>
      )}
    </div>
  );
}
