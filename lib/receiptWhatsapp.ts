// lib/receiptWhatsapp.ts
//
// Recibo por WhatsApp — UN solo constructor del mensaje para toda la web
// (Pedidos y Caja/POS). Antes vivía solo en Pedidos; la caja abría el share
// genérico y el número capturado del cliente se desperdiciaba. Ahora ambos
// arman EXACTAMENTE el mismo recibo (items, total, premio canjeado, puntos
// ganados, link al recibo con su tarjeta de puntos) y abren wa.me DIRECTO al
// número del cliente — el mensaje del premio llega EN el chat, no escondido
// tras el link.
//
// Paridad app: el Flutter (receipt_share.dart) construye el mismo texto; el
// fix 5.1.3 le agrega el mismo wa.me directo cuando hay customerPhone.

import { shortOrderCode, buildWhatsappUrl } from "@/lib/order/formatWhatsappMessage";

export type ReceiptItem = { name: string; quantity: number; price: number };

export type ReceiptWhatsappInput = {
  restaurantId: string;
  restaurantName?: string | null;
  orderId: string;
  /** Teléfono capturado (dígitos; 10 = MX local → se antepone 52). */
  customerPhone: string;
  customerName?: string | null;
  /** Items del ticket — incluye la línea $0 del premio si hubo canje. */
  items: ReceiptItem[];
  total: number;
  /** Nombre del premio SOLO si el canje quedó aplicado (redemptionResult === "applied"). */
  redemptionName?: string | null;
  /** order.phonePointsAwarded — puntos ganados con esta compra. */
  pointsAwarded?: number;
  /** window.location.origin del llamador (para el link del recibo). */
  origin: string;
};

const fmt = (n: number) =>
  n.toLocaleString("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 2 });

/** Mismo formato que Pedidos siempre mandó — no cambiar sin cambiar ambos lados. */
export function buildReceiptWhatsappText(r: ReceiptWhatsappInput): string {
  const items = r.items
    .map((i) => `${i.quantity}x ${i.name} — ${fmt(i.price * i.quantity)}`)
    .join("\n");
  const url = `${r.origin}/menu/${encodeURIComponent(r.restaurantId)}/order/${encodeURIComponent(r.orderId)}`;
  const points = Number(r.pointsAwarded) || 0;
  return [
    `¡Gracias por tu compra en *${r.restaurantName || "nuestro local"}*!`,
    "",
    `Recibo *#${shortOrderCode(r.orderId)}*`,
    ...(r.customerName ? [`Nombre: ${r.customerName}`] : []),
    "",
    items,
    "",
    `*Total: ${fmt(r.total)}*`,
    ...(r.redemptionName
      ? [`🎁 Premio canjeado: ${r.redemptionName} — GRATIS`]
      : []),
    ...(points > 0
      ? ["", `⭐ Ganaste *+${points} puntos* con esta compra`]
      : []),
    "",
    `Tu recibo y tus puntos: ${url}`,
  ].join("\n");
}

/** URL wa.me directa al número del cliente con el recibo ya escrito. */
export function receiptWhatsappUrl(r: ReceiptWhatsappInput): string {
  const digits = r.customerPhone.replace(/\D/g, "");
  const phone = digits.length === 10 ? `52${digits}` : digits;
  return buildWhatsappUrl(phone, buildReceiptWhatsappText(r));
}
