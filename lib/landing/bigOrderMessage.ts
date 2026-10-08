// "¿Pedido grande o evento?" en la portada /r (8-oct-2026). Copiado de la
// página de catering que se le armó a Rebellion Pizza: un pedido para una
// oficina o una fiesta vale lo de diez pedidos normales, y hoy no había por
// dónde pedirlo. El cliente llena 4 datos y se abre el WhatsApp del local
// con el mensaje ya escrito. El dueño contesta a mano, como siempre.

/** Switch del dueño en Configuración (8-oct-2026). PRENDIDO por defecto: el
 *  campo ausente = sí. Solo `bigOrdersEnabled: false` lo esconde, para el local
 *  que no hace pedidos grandes y no quiere prometer lo que no puede cumplir. */
export function bigOrdersOn(data: Record<string, unknown> | null | undefined): boolean {
  return !data || data.bigOrdersEnabled !== false;
}

export const BIG_ORDER_KINDS = ["Oficina", "Fiesta o cumpleaños", "Escuela o equipo", "Otro"] as const;

export type BigOrderInput = {
  restaurantName: string;
  kind: string;
  /** "YYYY-MM-DD" del <input type="date">. */
  date: string;
  people: number | null;
  customerName: string;
  notes: string;
};

/** "viernes 17 de octubre" sin brincar de día por la zona horaria. */
export function spanishDate(isoDate: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" });
}

export function bigOrderMessage(i: BigOrderInput): string {
  const lines = [`Hola ${i.restaurantName.trim() || ""}, quiero cotizar un pedido grande 🙌`.replace(" ,", ",")];
  if (i.kind.trim()) lines.push(`Para: ${i.kind.trim()}`);
  const when = spanishDate(i.date);
  if (when) lines.push(`Fecha: ${when}`);
  if (i.people && i.people > 0) lines.push(`Personas: ${Math.round(i.people)}`);
  if (i.customerName.trim()) lines.push(`Soy ${i.customerName.trim()}`);
  if (i.notes.trim()) lines.push(`Nota: ${i.notes.trim()}`);
  return lines.join("\n");
}
