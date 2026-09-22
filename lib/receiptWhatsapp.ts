// lib/receiptWhatsapp.ts
//
// Recibo por WhatsApp — UN solo constructor del mensaje para toda la web
// (Pedidos y Caja/POS). Antes vivía solo en Pedidos; la caja abría el share
// genérico y el número capturado del cliente se desperdiciaba. Ahora ambos
// arman EXACTAMENTE el mismo recibo (items, total, premio canjeado, puntos
// ganados, link al recibo con su tarjeta de puntos) y abren WhatsApp DIRECTO al
// número del cliente — el mensaje del premio llega EN el chat, no escondido
// tras el link.
//
// Paridad app: el Flutter (receipt_share.dart) construye el mismo texto; el
// fix 5.1.3 le agrega el mismo link directo cuando hay customerPhone.

import { shortOrderCode, buildWhatsappUrl } from "@/lib/order/formatWhatsappMessage";
import { phoneCountryOf } from "@/lib/phone/phoneCountry";

export type ReceiptItem = { name: string; quantity: number; price: number };

export type ReceiptWhatsappInput = {
  restaurantId: string;
  restaurantName?: string | null;
  orderId: string;
  /** Teléfono capturado (dígitos; se usan los últimos 10 + el país del local). */
  customerPhone: string;
  /** País del teléfono del restaurante (phoneCountryCode); default México. */
  phoneCountryCode?: string;
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
  /**
   * Premios apagados (5-sep): false = el recibo NO anuncia puntos (ni la
   * línea "ganaste" ni "y tus puntos" en el link). Default true.
   */
  promisesPoints?: boolean;
  /**
   * Link de invitación del que compró (docs/REFERIDOS_POR_TELEFONO.md §3 y §5).
   * Si viene, el recibo cierra con "Invita a un amigo y los dos ganan: {link}".
   *
   * Es OPCIONAL a propósito: el código lo acuña el servidor y puede no llegar a
   * tiempo (o el local no estar en esto). Sin él, el recibo sale exactamente
   * como siempre — nunca se manda un recibo a medias por esperar esta línea.
   */
  inviteLink?: string | null;
  /**
   * La frase de invitación que escribió la IA (§8). Sin ella se usa la fija.
   * El LINK se pega aparte, nunca lo escribe el modelo.
   */
  inviteText?: string | null;
};

const fmt = (n: number) =>
  n.toLocaleString("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 2 });

/** Mismo formato que Pedidos siempre mandó — no cambiar sin cambiar ambos lados. */
export function buildReceiptWhatsappText(r: ReceiptWhatsappInput): string {
  const items = r.items
    .map((i) => `${i.quantity}x ${i.name} — ${fmt(i.price * i.quantity)}`)
    .join("\n");
  const url = `${r.origin}/menu/${encodeURIComponent(r.restaurantId)}/order/${encodeURIComponent(r.orderId)}`;
  const promises = r.promisesPoints !== false;
  const points = promises ? Number(r.pointsAwarded) || 0 : 0;
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
    `${promises ? "Tu recibo y tus puntos" : "Tu recibo"}: ${url}`,
    // La invitación va AL FINAL, después del recibo: primero lo que pidió, y
    // ya luego lo que puede ganar. Nunca antes del total.
    ...(r.inviteLink
      ? [
          "",
          `🎁 ${(r.inviteText || "").trim() || "Invita a un amigo y los dos ganan:"} ${r.inviteLink}`,
        ]
      : []),
  ].join("\n");
}

/** URL directa al número del cliente con el recibo ya escrito (api.whatsapp.com). */
export function receiptWhatsappUrl(r: ReceiptWhatsappInput): string {
  // El país lo pone el restaurante (5-sep): sus clientes marcan como él.
  return buildWhatsappUrl(r.customerPhone, buildReceiptWhatsappText(r), phoneCountryOf(r));
}
