import { formatPrice } from "@/lib/priceFormat";
import type { CartLine } from "@/lib/cart/types";

export type WhatsappOrderContext = {
  restaurantName: string;
  orderId: string;
  pickupPin: string;
  customerName: string;
  cartLines: CartLine[];
  total: number;
};

export function formatWhatsappOrderMessage(ctx: WhatsappOrderContext): string {
  const itemsLines = ctx.cartLines
    .map((l) => `• ${l.quantity}x ${l.name} — ${formatPrice(l.subtotal)}`)
    .join("\n");

  return [
    "Hola, hice un pedido en Comeleal 🍽️",
    "",
    `Restaurante: ${ctx.restaurantName}`,
    `Orden: ${ctx.orderId}`,
    `PIN de recogida: ${ctx.pickupPin}`,
    `Nombre: ${ctx.customerName}`,
    "",
    itemsLines,
    "",
    `Total: ${formatPrice(ctx.total)}`,
    "",
    "Pago con Mercado Pago. Estado del pedido en Comeleal.",
  ].join("\n");
}

export function buildWhatsappUrl(phoneDigits: string, text: string): string {
  const digits = phoneDigits.replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
