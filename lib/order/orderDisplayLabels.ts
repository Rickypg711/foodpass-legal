import { orderStatusLabel } from "./orderStatusLabels";

export type OrderDisplayCopy = {
  title: string;
  subtitle?: string;
};

/**
 * Customer-facing order status (Firestore fields unchanged).
 */
export function customerOrderDisplay(
  status: string | undefined,
  paymentStatus: string | undefined,
  opts: { posReceipt?: boolean } = {},
): OrderDisplayCopy {
  const s = (status ?? "").trim();
  const ps = (paymentStatus ?? "pending").trim();

  // POS/counter orders: this page is a digital receipt, not order tracking —
  // the customer already ordered (and usually paid) in person at the counter.
  if (opts.posReceipt) {
    if (s === "cancelled") {
      return { title: "Pedido cancelado" };
    }
    return {
      title: "¡Gracias por tu compra! 🧾",
      subtitle: "Aquí queda tu recibo digital — y tus puntos, guardados en tu número.",
    };
  }

  // Customer-facing es-MX copy: tuteo, short, warm — reads like a person,
  // not a bank statement.
  if (ps === "paid" && s === "pending") {
    return {
      title: "¡Pedido pagado! ✅",
      subtitle: "El restaurante ya lo tiene — en un momento lo empiezan a preparar.",
    };
  }

  if (s === "payment_pending") {
    return {
      title: "Falta tu pago",
      subtitle: "En cuanto Mercado Pago confirme, tu pedido llega al restaurante.",
    };
  }

  if (s === "pending") {
    return {
      title: "¡Pedido recibido! 🛎️",
      subtitle: "El restaurante ya lo tiene — te avisan cuando esté listo.",
    };
  }

  if (s === "preparing") {
    return { title: "Preparando tu pedido 👨‍🍳" };
  }

  if (s === "ready") {
    return {
      title: "¡Listo! Pasa por él 🛍️",
      subtitle: "Muestra tu PIN al recoger.",
    };
  }

  if (s === "completed") {
    return { title: "Entregado ✔️" };
  }

  if (s === "cancelled") {
    return { title: "Pedido cancelado" };
  }

  return { title: orderStatusLabel(s || "pending") };
}

/**
 * Vendor-facing label when an order is shown outside the hidden payment_pending queue.
 */
export function vendorOrderDisplay(
  status: string | undefined,
  paymentStatus: string | undefined,
): OrderDisplayCopy {
  const s = (status ?? "").trim();
  const ps = (paymentStatus ?? "pending").trim();

  if (ps === "paid" && s === "pending") {
    return { title: "Pagada · Pendiente de preparar" };
  }

  if (s === "payment_pending") {
    return { title: "Pago pendiente · No preparar todavía" };
  }

  return { title: orderStatusLabel(s || "pending") };
}
