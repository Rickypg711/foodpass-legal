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
