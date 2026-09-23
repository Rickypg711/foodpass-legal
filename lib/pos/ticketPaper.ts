// 🖨️ Ticket para impresora térmica (10-sep-2026) — lo poco que se guarda.
// Sin imports con alias para poder ejecutarse en los tests de node.
//
// El emparejamiento con la impresora NO vive aquí: lo hace el celular
// (Bluetooth + una app puente ESC/POS) o la computadora (USB). Comeleal solo
// decide el ancho de la hoja que imprime.

/** Id reservado: /vendor/ticket/prueba pinta un pedido de muestra. */
export const TICKET_SAMPLE_ID = "prueba";

/** `restaurants/{id}.ticketPaperMm`: 58 u 80. Sin campo o basura → 80. */
export function ticketPaperMm(data: unknown): 58 | 80 {
  const raw = (data as { ticketPaperMm?: unknown } | null | undefined)?.ticketPaperMm;
  return Number(raw) === 58 ? 58 : 80;
}

/** `restaurants/{id}.autoPrintTickets` (23-sep-2026, Pro): el ticket de cocina
 * sale solo en cuanto entra un pedido, desde la pestaña de Pedidos. */
export function autoPrintTickets(data: unknown): boolean {
  return (data as { autoPrintTickets?: unknown } | null | undefined)?.autoPrintTickets === true;
}

/** Lo que la hoja del ticket le dice a Pedidos cuando ya mandó a imprimir
 * (vive en un iframe escondido): Pedidos lo quita y sigue con el siguiente. */
export const TICKET_PRINTED_MESSAGE = "comeleal:ticket-printed";

/** Un pedido se imprime solo si entró DESPUÉS de abrir Pedidos (con 2 min de
 * colchón). Si la pestaña se abre con los 20 pedidos de anoche, no salen 20. */
export const AUTO_PRINT_LOOKBACK_MS = 2 * 60 * 1000;

export function shouldAutoPrint(
  o: { id: string; status?: string; createdAtMs: number | null },
  openedAtMs: number,
  printed: Set<string>,
): boolean {
  if (printed.has(o.id)) return false;
  if (o.status !== "pending" && o.status !== "open_tab") return false;
  if (o.createdAtMs == null) return false;
  return o.createdAtMs >= openedAtMs - AUTO_PRINT_LOOKBACK_MS;
}
