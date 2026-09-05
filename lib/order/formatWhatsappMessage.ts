import { formatPrice } from "@/lib/priceFormat";
import type { CartLine } from "@/lib/cart/types";
import { describeSelectedOptions } from "@/lib/cart/lineId";
import { DEFAULT_PHONE_COUNTRY, waNumber } from "@/lib/phone/phoneCountry";

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
  /** Checkout redemption riding on the order (name of the free item). */
  redemptionName?: string | null;
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
    .map((l) => {
      const head = `${l.quantity}x ${l.name} — ${formatPrice(l.subtotal)}`;
      const extras = [describeSelectedOptions(l.selectedOptions), l.notes?.trim()]
        .filter(Boolean)
        .map((t) => `\n   ↳ ${t}`)
        .join("");
      return head + extras;
    })
    .join("\n");

  return [
    `Hola! Acabo de hacer un pedido en *${ctx.restaurantName}*:`,
    "",
    `Pedido *#${shortOrderCode(ctx.orderId)}*`,
    `Nombre: ${ctx.customerName}`,
    `PIN de recogida: *${ctx.pickupPin}*`,
    "",
    itemsLines,
    ...(ctx.redemptionName ? [`🎁 Premio en este pedido: ${ctx.redemptionName} — GRATIS`] : []),
    "",
    `*Total: ${formatPrice(ctx.total)}*`,
    ctx.paymentMethod === "pay_at_pickup"
      ? "Pago al recoger en el local."
      : "Pago en línea con Mercado Pago.",
    ...(ctx.orderUrl ? ["", `Mi recibo y puntos: ${ctx.orderUrl}`] : []),
  ].join("\n");
}

export function buildWhatsappUrl(
  phoneDigits: string,
  text: string,
  countryCode: string = DEFAULT_PHONE_COUNTRY,
): string {
  // Canon (26-ago, abierto al mundo el 5-sep): wa.me exige formato
  // internacional, así que TODO link se arma como país + últimos 10 dígitos —
  // sin importar cómo se haya guardado el número ("+52 614...", "52614...",
  // o 10 pelones). El país lo dice el restaurante (phoneCountryCode) y si no
  // dice nada es México. Antes "52" iba cosido y a un dueño de República
  // Dominicana su propio botón de WhatsApp le marcaba a un número mexicano.
  return `https://wa.me/${waNumber(phoneDigits, countryCode)}?text=${encodeURIComponent(text)}`;
}
