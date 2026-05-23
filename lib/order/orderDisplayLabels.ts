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
): OrderDisplayCopy {
  const s = (status ?? "").trim();
  const ps = (paymentStatus ?? "pending").trim();

  if (ps === "paid" && s === "pending") {
    return {
      title: "Orden pagada",
      subtitle: "Esperando a que el restaurante comience a prepararla",
    };
  }

  if (s === "payment_pending") {
    return {
      title: "Pago pendiente",
      subtitle: "Tu pedido se enviará al restaurante cuando Mercado Pago confirme el pago.",
    };
  }

  if (s === "preparing" && ps === "paid") {
    return { title: "Preparando" };
  }

  if (s === "ready") {
    return { title: orderStatusLabel("ready") };
  }

  if (s === "completed") {
    return { title: "Completada" };
  }

  if (s === "cancelled") {
    return { title: "Cancelada" };
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
