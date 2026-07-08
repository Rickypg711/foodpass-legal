import { formatPrice } from "@/lib/priceFormat";
import type { CartLine } from "@/lib/cart/types";

export type WhatsappOrderContext = {
  restaurantName: string;
  orderId: string;
  pickupPin: string;
  customerName: string;
  cartLines: CartLine[];
  total: number;
  /** Order-status URL — lands in the CUSTOMER's own chat history too, making
   * the WhatsApp message double as their tappable receipt (points card lives there). */
  orderUrl?: string;
  /** "pay_at_pickup" | "mercado_pago" (defaults to MP copy for legacy callers). */
  paymentMethod?: string | null;
};

/** Short human order code — same as the vendor's Pedidos card (#XXXXXX). */
export function shortOrderCode(orderId: string): string {
  return orderId.slice(-6).toUpperCase();
}

// Mirrors the app's buildReceiptText structure (receipt_share.dart): name
// header, order #, items, bold total, payment line, one link. WhatsApp
// renders *bold*. No exotic emojis — several render as � on desktop clients.
export function formatWhatsappOrderMessage(ctx: WhatsappOrderContext): string {
  const itemsLines = ctx.cartLines
    .map((l) => `${l.quantity}x ${l.name} — ${formatPrice(l.subtotal)}`)
    .join("\n");

  return [
    `Hola! Acabo de hacer un pedido en *${ctx.restaurantName}*:`,
    "",
    `Pedido *#${shortOrderCode(ctx.orderId)}*`,
    `Nombre: ${ctx.customerName}`,
    `PIN de recogida: *${ctx.pickupPin}*`,
    "",
    itemsLines,
    "",
    `*Total: ${formatPrice(ctx.total)}*`,
    ctx.paymentMethod === "pay_at_pickup"
      ? "Pago al recoger en el local."
      : "Pago en línea con Mercado Pago.",
    ...(ctx.orderUrl ? ["", `Mi recibo y puntos: ${ctx.orderUrl}`] : []),
  ].join("\n");
}

export function buildWhatsappUrl(phoneDigits: string, text: string): string {
  const digits = phoneDigits.replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
