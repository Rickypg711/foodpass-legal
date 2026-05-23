export type PaymentReturnParam = "success" | "failure" | "pending" | null;

export function parsePaymentReturnParam(
  value: string | null | undefined,
): PaymentReturnParam {
  if (value === "success" || value === "failure" || value === "pending") {
    return value;
  }
  return null;
}

export function paymentReturnBannerMessage(param: PaymentReturnParam): string | null {
  switch (param) {
    case "success":
      return "Regresaste de Mercado Pago. Confirmaremos el pago en breve; no cierres esta página.";
    case "pending":
      return "Tu pago está pendiente en Mercado Pago. Tu pedido se enviará al restaurante cuando se confirme.";
    case "failure":
      return "El pago no se completó. Vuelve al menú del restaurante e intenta de nuevo con Mercado Pago.";
    default:
      return null;
  }
}

export function paymentStatusLabel(status: string | undefined): string {
  const labels: Record<string, string> = {
    pending: "Pago pendiente",
    paid: "Pagado",
    failed: "Pago fallido",
    refunded: "Reembolsado",
  };
  return labels[status ?? ""] ?? status ?? "—";
}
