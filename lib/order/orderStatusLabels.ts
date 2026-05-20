const LABELS: Record<string, string> = {
  pending: "Pendiente",
  payment_pending: "Completa tu pago",
  preparing: "Preparando",
  ready: "Listo para recoger",
  completed: "Completado",
  cancelled: "Cancelado",
  draft: "Borrador",
};

export function orderStatusLabel(status: string): string {
  return LABELS[status] ?? status;
}
